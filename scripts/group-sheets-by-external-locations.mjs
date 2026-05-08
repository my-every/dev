/**
 * group-sheets-by-external-locations.mjs
 *
 * Scan sheet JSON files under Share/Legal Drawings and group sheets that
 * contain external location references.
 *
 * Usage:
 *   node scripts/group-sheets-by-external-locations.mjs
 *   node scripts/group-sheets-by-external-locations.mjs --project 4K002
 *   node scripts/group-sheets-by-external-locations.mjs --project 4K002 --revision A.2
 *   node scripts/group-sheets-by-external-locations.mjs --json
 *   node scripts/group-sheets-by-external-locations.mjs --min-count 5 --out-json Share/References/external-location-groups.json --out-csv Share/References/external-location-groups.csv
 */

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

const { values: args } = parseArgs({
  options: {
    project: { type: 'string' },
    revision: { type: 'string' },
    json: { type: 'boolean', default: false },
    'min-count': { type: 'string', default: '1' },
    'out-json': { type: 'string' },
    'out-csv': { type: 'string' },
  },
  strict: false,
})

const LEGAL_DIR = path.resolve(
  new URL('.', import.meta.url).pathname,
  '../Share/Legal Drawings'
)

const UNIT_REFERENCE_PATH = path.resolve(
  new URL('.', import.meta.url).pathname,
  '../Share/References/layout-unit-box-panel-reference.json'
)

// Explicit user-requested mapping hints.
const LOCATION_UNIT_MAP = new Map([
  ['BOP PANEL', 'JB70'],
  ['BOP PANEL JB74', 'JB74'],
  ['JB73 PANEL', 'JB73'],
])

const JB70_CANDIDATE_PATTERNS = [
  { pattern: /\bSMT130\b/, label: 'SMT130 family alias' },
  { pattern: /\bPLC(?:\s+PANEL)?\b/, label: 'PLC alias' },
  { pattern: /\bCONTROL\s*A\b/, label: 'CONTROL A alias' },
  { pattern: /\bCONTROL\s*B\b/, label: 'CONTROL B alias' },
  { pattern: /\bFIRE\b/, label: 'FIRE alias' },
  { pattern: /\bGEN(?:ERATOR)?\b/, label: 'GEN alias' },
  { pattern: /\bTT6\b/, label: 'TT6 alias' },
  { pattern: /\bLEFT\s+RAIL\b|\bRAIL[, ]*LEFT\b/, label: 'LEFT RAIL alias' },
  { pattern: /\bRIGHT\s+RAIL\b|\bRAIL[, ]*RIGHT\b/, label: 'RIGHT RAIL alias' },
  { pattern: /\b(?:PANEL|PNL)\s*A\b/, label: 'PANEL A alias' },
  { pattern: /\b(?:PANEL|PNL)\s*B\b/, label: 'PANEL B alias' },
]

const CANONICAL_UNIT_TYPES = loadCanonicalUnitTypes()

function normalizeText(v) {
  if (!v || typeof v !== 'string') return ''
  return v
    .toUpperCase()
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function loadCanonicalUnitTypes() {
  const ref = safeReadJson(UNIT_REFERENCE_PATH)
  const rows = ref?.mappings?.unitTypeToBoxNumber
  if (!Array.isArray(rows)) return []
  return [...new Set(rows.map((row) => normalizeText(row?.unitType || '')).filter(Boolean))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
}

function resolveOutputPath(p) {
  if (!p) return null
  if (path.isAbsolute(p)) return p
  return path.resolve(process.cwd(), p)
}

function ensureOutputDir(filePath) {
  const outDir = path.dirname(filePath)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
}

function escapeCsv(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvRows(groups) {
  const rows = ['location,mappedUnitType,detectedUnitType,groupingConfidence,groupingReason,sheetCount,project,revision,sheetName,file']
  for (const group of groups) {
    for (const s of group.sheets) {
      rows.push([
        escapeCsv(group.location),
        escapeCsv(group.mappedUnitType || ''),
        escapeCsv(group.detectedUnitType || ''),
        escapeCsv(group.groupingConfidence || ''),
        escapeCsv(group.groupingReason || ''),
        escapeCsv(group.sheetCount),
        escapeCsv(s.project),
        escapeCsv(s.revision),
        escapeCsv(s.sheetName),
        escapeCsv(s.file),
      ].join(','))
    }
  }
  return `${rows.join('\n')}\n`
}

function looksLikeSheetFile(fileName) {
  if (!fileName.endsWith('.json')) return false
  return ![
    'blue-labels.json',
    'white-labels.json',
    'heat-shrink-labels.json',
    'panel-errors.json',
    'part-number-list.json',
    'cable-part-numbers.json',
  ].includes(fileName)
}

function looksLikePrintSchemaFile(fileName) {
  return fileName.endsWith('.json')
}

function collectProjectDirs(baseDir) {
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function collectRevisionDirs(projectDir) {
  return fs.readdirSync(projectDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^([A-Z]|\d)+\./i.test(name))
    .sort()
}

function extractExternalLocationsFromRows(sheetData) {
  const rows = Array.isArray(sheetData?.rows) ? sheetData.rows : []
  const sheetName = normalizeText(sheetData?.name || '')
  const locations = new Set()

  for (const row of rows) {
    const from = normalizeText(row?.fromLocation || '')
    const to = normalizeText(row?.toLocation || '')

    // Treat as cross-location only when both sides are present and distinct.
    if (!from || !to || from === to) continue

    if (from && from !== sheetName) locations.add(from)
    if (to && to !== sheetName) locations.add(to)
  }

  return [...locations].sort()
}

function extractExternalLocationsFromPrintSchema(schemaData) {
  const pages = Array.isArray(schemaData?.pages) ? schemaData.pages : []
  const locations = new Set()

  for (const page of pages) {
    const locationGroups = Array.isArray(page?.locationGroups) ? page.locationGroups : []
    for (const group of locationGroups) {
      if (!group?.isExternal) continue
      const location = normalizeText(group.location || '')
      if (location) locations.add(location)
    }
  }

  return [...locations].sort()
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectUnitCandidates(location) {
  const normalized = normalizeText(location)
  return CANONICAL_UNIT_TYPES.filter((unitType) => {
    const re = new RegExp(`(^|[^A-Z0-9])${escapeRegex(unitType)}([^A-Z0-9]|$)`)
    return re.test(normalized)
  })
}

function detectJb70AliasReasons(location) {
  const normalized = normalizeText(location)
  return JB70_CANDIDATE_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label)
}

function detectJb70AliasReasonsFromSheets(sheets) {
  const labels = new Set()

  for (const sheet of sheets) {
    const candidates = [sheet?.sheetName, sheet?.file?.replace(/\.json$/i, '')]
    for (const candidate of candidates) {
      const normalized = normalizeText(candidate || '')
      if (!normalized) continue

      for (const { pattern, label } of JB70_CANDIDATE_PATTERNS) {
        if (pattern.test(normalized)) labels.add(label)
      }

      if (/\bJB70\b/.test(normalized)) {
        labels.add('JB70 sheet context')
      }
    }
  }

  return [...labels].sort()
}

function classifyLocationGroup(location, sheets = []) {
  const normalized = normalizeText(location)
  const mappedUnitType = LOCATION_UNIT_MAP.get(normalized) || null
  const unitCandidates = detectUnitCandidates(normalized)
  const jb70AliasReasons = detectJb70AliasReasons(normalized)
  const sheetAliasReasons = detectJb70AliasReasonsFromSheets(sheets)

  if (unitCandidates.includes(normalized)) {
    return {
      mappedUnitType,
      detectedUnitType: normalized,
      groupingConfidence: 'high',
      groupingReason: 'exact unit type match',
    }
  }

  if (unitCandidates.length === 1) {
    return {
      mappedUnitType,
      detectedUnitType: unitCandidates[0],
      groupingConfidence: 'medium',
      groupingReason: 'location contains a single canonical unit token',
    }
  }

  if (mappedUnitType) {
    return {
      mappedUnitType,
      detectedUnitType: mappedUnitType,
      groupingConfidence: 'medium',
      groupingReason: 'matched explicit mapping hint',
    }
  }

  if (jb70AliasReasons.length > 0) {
    return {
      mappedUnitType,
      detectedUnitType: 'JB70',
      groupingConfidence: 'low',
      groupingReason: `matched JB70 candidate aliases: ${jb70AliasReasons.join(', ')}`,
    }
  }

  if (sheetAliasReasons.length > 0) {
    return {
      mappedUnitType,
      detectedUnitType: 'JB70',
      groupingConfidence: 'low',
      groupingReason: `matched JB70 candidate sheet context: ${sheetAliasReasons.join(', ')}`,
    }
  }

  if (unitCandidates.length > 1) {
    return {
      mappedUnitType,
      detectedUnitType: unitCandidates[0],
      groupingConfidence: 'low',
      groupingReason: `ambiguous location matched multiple unit tokens: ${unitCandidates.join(', ')}`,
    }
  }

  return {
    mappedUnitType,
    detectedUnitType: null,
    groupingConfidence: 'low',
    groupingReason: 'no canonical unit token found; alias mapping required',
  }
}

function main() {
  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`Missing directory: ${LEGAL_DIR}`)
    process.exit(1)
  }

  const minCount = Number.parseInt(args['min-count'], 10)
  if (!Number.isFinite(minCount) || minCount < 1) {
    console.error(`Invalid --min-count value: ${args['min-count']}`)
    process.exit(1)
  }

  const projects = args.project
    ? [args.project]
    : collectProjectDirs(LEGAL_DIR)

  const groups = new Map() // location -> { location, mappedUnitType, sheets: [] }
  let scannedSheets = 0

  for (const project of projects) {
    const projectDir = path.join(LEGAL_DIR, project)
    if (!fs.existsSync(projectDir)) continue

    const revisions = args.revision
      ? [args.revision]
      : collectRevisionDirs(projectDir)

    for (const revision of revisions) {
      const printSchemaDir = path.join(projectDir, revision, 'wire-list-print-schema')
      const sheetsDir = path.join(projectDir, revision, 'sheets')
      const hasPrintSchemas = fs.existsSync(printSchemaDir)
      const hasSheets = fs.existsSync(sheetsDir)
      if (!hasPrintSchemas && !hasSheets) continue

      const sourceDir = hasPrintSchemas ? printSchemaDir : sheetsDir
      const fileFilter = hasPrintSchemas ? looksLikePrintSchemaFile : looksLikeSheetFile
      const sheetFiles = fs.readdirSync(sourceDir).filter(fileFilter).sort()

      for (const fileName of sheetFiles) {
        const filePath = path.join(sourceDir, fileName)
        const fileData = safeReadJson(filePath)
        if (!fileData) continue

        let sheetName = fileName.replace(/\.json$/, '')
        let externalLocations = []

        if (hasPrintSchemas) {
          scannedSheets += 1
          sheetName = fileData.sheetName || sheetName
          externalLocations = extractExternalLocationsFromPrintSchema(fileData)

          // Fallback to rows-based extraction when print schema has no flags.
          if (externalLocations.length === 0 && hasSheets) {
            const fallbackSheetPath = path.join(sheetsDir, fileName)
            if (fs.existsSync(fallbackSheetPath)) {
              const fallbackSheetData = safeReadJson(fallbackSheetPath)
              if (fallbackSheetData) {
                externalLocations = extractExternalLocationsFromRows(fallbackSheetData)
              }
            }
          }
        } else {
          scannedSheets += 1
          sheetName = fileData.name || sheetName
          externalLocations = extractExternalLocationsFromRows(fileData)
        }

        if (externalLocations.length === 0) continue

        const sheetRef = {
          project,
          revision,
          file: fileName,
          sheetName,
        }

        for (const location of externalLocations) {
          if (!groups.has(location)) {
            groups.set(location, {
              location,
              mappedUnitType: null,
              detectedUnitType: null,
              groupingConfidence: null,
              groupingReason: null,
              sheets: [],
            })
          }
          groups.get(location).sheets.push(sheetRef)
        }
      }
    }
  }

  const sortedGroups = [...groups.values()]
    .map((g) => ({
      ...g,
      ...classifyLocationGroup(g.location, g.sheets),
      sheetCount: g.sheets.length,
      sheets: g.sheets.sort((a, b) => {
        const pa = `${a.project}|${a.revision}|${a.sheetName}`
        const pb = `${b.project}|${b.revision}|${b.sheetName}`
        return pa.localeCompare(pb)
      }),
    }))
    .sort((a, b) => b.sheetCount - a.sheetCount || a.location.localeCompare(b.location))
    .filter((g) => g.sheetCount >= minCount)

  const result = {
    scannedSheets,
    minCount,
    groupedLocations: sortedGroups.length,
    groups: sortedGroups,
  }

  const outJsonPath = resolveOutputPath(args['out-json'])
  const outCsvPath = resolveOutputPath(args['out-csv'])

  if (outJsonPath) {
    ensureOutputDir(outJsonPath)
    fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2))
  }

  if (outCsvPath) {
    ensureOutputDir(outCsvPath)
    fs.writeFileSync(outCsvPath, toCsvRows(sortedGroups))
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    if (outJsonPath) console.log(`Wrote JSON: ${outJsonPath}`)
    if (outCsvPath) console.log(`Wrote CSV: ${outCsvPath}`)
    return
  }

  console.log(`Scanned sheets: ${scannedSheets}`)
  console.log(`Minimum group size: ${minCount}`)
  console.log(`Location groups with external references: ${sortedGroups.length}`)
  if (outJsonPath) console.log(`Wrote JSON: ${outJsonPath}`)
  if (outCsvPath) console.log(`Wrote CSV: ${outCsvPath}`)

  for (const group of sortedGroups) {
    const mapHint = group.mappedUnitType ? ` -> ${group.mappedUnitType}` : ''
    console.log(`\n[${group.location}]${mapHint} (${group.sheetCount})`)
    for (const s of group.sheets) {
      console.log(`  - ${s.project} ${s.revision} | ${s.sheetName} (${s.file})`)
    }
  }
}

main()
