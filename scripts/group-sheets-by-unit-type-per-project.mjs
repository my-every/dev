/**
 * group-sheets-by-unit-type-per-project.mjs
 *
 * Group sheets by detected unit type within each project/revision.
 * Shows which sheets in each project reference which units (JB70, JB71, etc.)
 *
 * Usage:
 *   node scripts/group-sheets-by-unit-type-per-project.mjs
 *   node scripts/group-sheets-by-unit-type-per-project.mjs --project 4K002
 *   node scripts/group-sheets-by-unit-type-per-project.mjs --project 4K002 --revision A.2
 *   node scripts/group-sheets-by-unit-type-per-project.mjs --min-sheets 2 --out-json Share/References/sheets-by-unit-per-project.json
 */

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

const { values: args } = parseArgs({
  options: {
    project: { type: 'string' },
    revision: { type: 'string' },
    'min-sheets': { type: 'string', default: '1' },
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

const CLASSIFIED_GROUPS_PATH = path.resolve(
  new URL('.', import.meta.url).pathname,
  '../Share/References/external-location-groups-classified-min5.json'
)

// Preload and cache unit types
let CACHED_UNIT_TYPES = null

function getCachedUnitTypes() {
  if (CACHED_UNIT_TYPES !== null) return CACHED_UNIT_TYPES

  const refData = safeReadJson(UNIT_REFERENCE_PATH)
  if (!refData || !refData.mappings || !refData.mappings.unitTypeToBoxNumber) {
    CACHED_UNIT_TYPES = []
    return []
  }
  CACHED_UNIT_TYPES = refData.mappings.unitTypeToBoxNumber.map((m) => m.unitType).sort()
  return CACHED_UNIT_TYPES
}

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

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function normalizeText(v) {
  if (!v || typeof v !== 'string') return ''
  return v
    .toUpperCase()
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeCsv(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvRows(result) {
  const rows = ['project,revision,unitType,sheetCount,locationCount,sheets']
  for (const proj of result.projects) {
    for (const unit of proj.unitGroups) {
      rows.push([
        escapeCsv(proj.project),
        escapeCsv(proj.revision),
        escapeCsv(unit.unitType),
        escapeCsv(unit.sheetCount),
        escapeCsv(unit.locationCount),
        escapeCsv(unit.sheets.map((s) => `${s.name}:${s.file}`).join(';')),
      ].join(','))
    }
  }
  return `${rows.join('\n')}\n`
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

function getAllUnitTypes() {
  const refData = safeReadJson(UNIT_REFERENCE_PATH)
  if (!refData || !refData.mappings || !refData.mappings.unitTypeToBoxNumber) {
    return []
  }
  return refData.mappings.unitTypeToBoxNumber.map((m) => m.unitType).sort()
}

function detectUnitTypeFromFilename(filename) {
  const allUnitTypes = getCachedUnitTypes()
  const nameUpper = filename.toUpperCase().replace(/\.json$/, '')

  // Try exact match first
  for (const unitType of allUnitTypes) {
    if (nameUpper === unitType || nameUpper.includes(`_${unitType}`) || nameUpper.includes(`-${unitType}`)) {
      return unitType
    }
  }

  // Try substring match (longest match wins)
  let bestMatch = null
  let bestLength = 0
  for (const unitType of allUnitTypes) {
    if (nameUpper.includes(unitType) && unitType.length > bestLength) {
      bestMatch = unitType
      bestLength = unitType.length
    }
  }
  return bestMatch
}

function main() {
  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`Missing directory: ${LEGAL_DIR}`)
    process.exit(1)
  }

  const minSheets = Number.parseInt(args['min-sheets'], 10)
  if (!Number.isFinite(minSheets) || minSheets < 1) {
    console.error(`Invalid --min-sheets value: ${args['min-sheets']}`)
    process.exit(1)
  }

  // Load the pre-classified groups from the previous script
  const classifiedData = safeReadJson(CLASSIFIED_GROUPS_PATH)
  if (!classifiedData) {
    console.warn(
      `Warning: Could not load classified groups from ${CLASSIFIED_GROUPS_PATH}`
    )
    console.warn('Run group-sheets-by-external-locations.mjs first to generate it.')
    process.exit(1)
  }

  // Build a map of (project, revision, sheetName) -> { unitType, locations }
  const classifiedGroups = new Map()
  for (const group of classifiedData.groups || []) {
    for (const sheet of group.sheets || []) {
      const key = `${sheet.project}|${sheet.revision}|${sheet.sheetName}`
      if (!classifiedGroups.has(key)) {
        classifiedGroups.set(key, {
          unitType: group.detectedUnitType,
          locations: [],
        })
      }
      classifiedGroups.get(key).locations.push(group.location)
    }
  }

  const projects = args.project
    ? [args.project]
    : collectProjectDirs(LEGAL_DIR)

  const result = {
    generatedAt: new Date().toISOString(),
    minSheets,
    projects: [],
  }

  for (const project of projects) {
    const projectDir = path.join(LEGAL_DIR, project)
    if (!fs.existsSync(projectDir)) continue

    const revisions = args.revision
      ? [args.revision]
      : collectRevisionDirs(projectDir)

    for (const revision of revisions) {
      const printSchemaDir = path.join(projectDir, revision, 'wire-list-print-schema')
      if (!fs.existsSync(printSchemaDir)) continue

      const sheetFiles = fs.readdirSync(printSchemaDir)
        .filter((f) => f.endsWith('.json'))
        .sort()

      // Group sheets by unit type
      const unitMap = new Map() // unitType -> { sheets, locations }

      for (const fileName of sheetFiles) {
        const filePath = path.join(printSchemaDir, fileName)
        const schemaData = safeReadJson(filePath)
        if (!schemaData) continue

        const sheetName = schemaData.sheetName || fileName.replace(/\.json$/, '')
        const key = `${project}|${revision}|${sheetName}`
        const classified = classifiedGroups.get(key)

        // Try to get unit type from classified data, fall back to filename detection
        let unitType = classified?.unitType
        let locations = classified?.locations || []

        if (!unitType) {
          unitType = detectUnitTypeFromFilename(fileName)
        }

        if (!unitType) continue // Could not detect unit type from either source

        if (!unitMap.has(unitType)) {
          unitMap.set(unitType, {
            sheets: [],
            locations: new Set(),
          })
        }

        const entry = unitMap.get(unitType)
        entry.sheets.push({
          name: sheetName,
          file: fileName,
        })
        locations.forEach((loc) => entry.locations.add(loc))
      }

      // Convert to sorted array and filter by minSheets
      const unitGroups = [...unitMap.entries()]
        .map(([unitType, data]) => ({
          unitType,
          sheetCount: data.sheets.length,
          locationCount: data.locations.size,
          locations: [...data.locations].sort(),
          sheets: data.sheets.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .filter((g) => g.sheetCount >= minSheets)
        .sort((a, b) => b.sheetCount - a.sheetCount || a.unitType.localeCompare(b.unitType))

      if (unitGroups.length === 0) continue

      result.projects.push({
        project,
        revision,
        unitGroupCount: unitGroups.length,
        totalSheets: unitGroups.reduce((s, g) => s + g.sheetCount, 0),
        unitGroups,
      })
    }
  }

  const outJsonPath = resolveOutputPath(args['out-json'])
  const outCsvPath = resolveOutputPath(args['out-csv'])

  if (outJsonPath) {
    ensureOutputDir(outJsonPath)
    fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2))
  }

  if (outCsvPath) {
    ensureOutputDir(outCsvPath)
    fs.writeFileSync(outCsvPath, toCsvRows(result))
  }

  console.log(`Projects scanned: ${result.projects.length}`)
  console.log(`Minimum sheets per unit group: ${minSheets}`)

  if (outJsonPath) console.log(`Wrote JSON: ${outJsonPath}`)
  if (outCsvPath) console.log(`Wrote CSV: ${outCsvPath}`)

  for (const proj of result.projects) {
    console.log(
      `\n${proj.project} ${proj.revision} (${proj.unitGroupCount} unit types, ${proj.totalSheets} sheets)`
    )
    for (const unit of proj.unitGroups) {
      console.log(
        `  [${unit.unitType}] ${unit.sheetCount} sheets, ${unit.locationCount} locations`
      )
      for (const sheet of unit.sheets) {
        console.log(`    - ${sheet.name} (${sheet.file})`)
      }
    }
  }
}

main()
