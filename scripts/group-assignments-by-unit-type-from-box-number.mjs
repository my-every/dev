/**
 * Group assignments by unit type using box-number references.
 *
 * Resolution order:
 * 1) Use assignment.layout.primaryPage.boxNumber (or first layout page with boxNumber)
 * 2) Map boxNumber -> unitType(s) via mappings.boxNumberToUnitType
 * 3) If ambiguous (shared boxNumber), disambiguate with mappings.unitTypeToBoxNumber assignment titles
 * 4) If still ambiguous, use project manifest unitTypes intersection
 * 5) Final fallback: highest projectCount candidate for that box
 *
 * Usage:
 *   node scripts/group-assignments-by-unit-type-from-box-number.mjs
 *   node scripts/group-assignments-by-unit-type-from-box-number.mjs --project 4M082 --revision C.1_M.2
 *   node scripts/group-assignments-by-unit-type-from-box-number.mjs --out-json Share/References/assignments-by-unit-via-box.json --out-csv Share/References/assignments-by-unit-via-box.csv
 */

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

const { values: args } = parseArgs({
  options: {
    project: { type: 'string' },
    revision: { type: 'string' },
    'min-count': { type: 'string', default: '1' },
    'out-json': { type: 'string' },
    'out-csv': { type: 'string' },
  },
  strict: false,
})

const LEGAL_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../Share/Legal Drawings')
const UNIT_REF_PATH = path.resolve(new URL('.', import.meta.url).pathname, '../Share/References/layout-unit-box-panel-reference.json')

// Unit type aliases: resolved unit types matching a key are remapped to the value.
const UNIT_TYPE_ALIASES = {
  TURBINE: 'JB70',
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function normalizeText(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveOutputPath(outputPath) {
  if (!outputPath) return null
  if (path.isAbsolute(outputPath)) return outputPath
  return path.resolve(process.cwd(), outputPath)
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function escapeCsv(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function collectProjectDirs(baseDir) {
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

function collectRevisionDirs(projectDir) {
  return fs.readdirSync(projectDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => /^([A-Z]|\d)+\./i.test(name))
    .sort()
}

function getAssignmentBoxNumber(assignment) {
  return assignment?.layout?.primaryPage?.boxNumber
    || assignment?.layout?.pages?.find((p) => p?.boxNumber)?.boxNumber
    || null
}

function buildReferenceIndexes(reference) {
  const byBoxCountMap = new Map()

  const addBoxCandidate = (boxNumber, unitType, projectCount = 0) => {
    if (!boxNumber || !unitType) return
    if (!byBoxCountMap.has(boxNumber)) byBoxCountMap.set(boxNumber, new Map())
    const unitCounts = byBoxCountMap.get(boxNumber)
    const current = unitCounts.get(unitType) || 0
    unitCounts.set(unitType, Math.max(current, projectCount || 0))
  }

  // Primary source: explicit inverse map from reference.
  for (const row of reference?.mappings?.boxNumberToUnitType || []) {
    for (const unit of row.unitTypes || []) {
      addBoxCandidate(row.boxNumber, unit.unitType, unit.projectCount)
    }
  }

  // Secondary source: canonical + alternate boxes from unitType rows.
  for (const row of reference?.mappings?.unitTypeToBoxNumber || []) {
    addBoxCandidate(row.boxNumber, row.unitType, row.projectCount)
    for (const alt of row.alternateBoxes || []) {
      addBoxCandidate(alt.boxNumber, row.unitType, alt.projectCount || row.projectCount || 0)
    }
  }

  const byBox = new Map()
  for (const [boxNumber, unitCounts] of byBoxCountMap.entries()) {
    const units = [...unitCounts.entries()]
      .map(([unitType, projectCount]) => ({ unitType, projectCount }))
      .sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType))
    byBox.set(boxNumber, units)
  }

  const byUnit = new Map()
  const assignmentTitleToUnits = new Map()

  for (const row of reference?.mappings?.unitTypeToBoxNumber || []) {
    byUnit.set(row.unitType, row)

    for (const assignment of row.assignments || []) {
      const key = normalizeText(assignment.value)
      if (!assignmentTitleToUnits.has(key)) assignmentTitleToUnits.set(key, [])
      assignmentTitleToUnits.get(key).push({
        unitType: row.unitType,
        projectCount: assignment.projectCount || 0,
      })
    }
  }

  for (const [key, list] of assignmentTitleToUnits.entries()) {
    list.sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType))
    assignmentTitleToUnits.set(key, list)
  }

  return { byBox, byUnit, assignmentTitleToUnits }
}

function resolveUnitTypeFromBox({ assignment, manifest, indexes }) {
  const boxNumber = getAssignmentBoxNumber(assignment)
  const assignmentName = assignment?.sheetName || assignment?.name || assignment?.sheetSlug || ''
  const normalizedAssignmentName = normalizeText(assignmentName)

  // Title-based lookup helper — used when box is missing or not in reference.
  const resolveTitleOnly = ({ fallbackBoxNumber = null, missingBoxReason }) => {
    const titleCandidates = indexes.assignmentTitleToUnits.get(normalizedAssignmentName) || []
    if (titleCandidates.length === 1) {
      return {
        unitType: titleCandidates[0].unitType,
        boxNumber: fallbackBoxNumber,
        confidence: 'medium',
        reason: `${missingBoxReason}-resolved-by-assignment-title`,
        candidateUnitTypes: titleCandidates.map((c) => c.unitType),
      }
    }
    // Intersect with manifest unit types if still ambiguous.
    const manifestUnitTypes = (manifest?.unitTypes || []).filter((u) => typeof u === 'string')
    const titleManifestIntersect = titleCandidates.filter((c) => manifestUnitTypes.includes(c.unitType))
    if (titleManifestIntersect.length === 1) {
      return {
        unitType: titleManifestIntersect[0].unitType,
        boxNumber: fallbackBoxNumber,
        confidence: 'medium',
        reason: `${missingBoxReason}-title-resolved-by-manifest`,
        candidateUnitTypes: titleCandidates.map((c) => c.unitType),
      }
    }
    if (titleCandidates.length > 1) {
      return {
        unitType: titleCandidates[0].unitType,
        boxNumber: fallbackBoxNumber,
        confidence: 'low',
        reason: `${missingBoxReason}-title-fallback-highest-projectCount`,
        candidateUnitTypes: titleCandidates.map((c) => c.unitType),
      }
    }
    return {
      unitType: assignment?.unitType || 'UNKNOWN',
      boxNumber: fallbackBoxNumber,
      confidence: assignment?.unitType ? 'low' : 'none',
      reason: assignment?.unitType ? `${missingBoxReason}-fallback-assignment-unitType` : missingBoxReason,
      candidateUnitTypes: [],
    }
  }

  if (!boxNumber) {
    return resolveTitleOnly({ missingBoxReason: 'missing-box-number' })
  }

  const boxCandidates = indexes.byBox.get(boxNumber) || []
  if (boxCandidates.length === 0) {
    return resolveTitleOnly({ fallbackBoxNumber: boxNumber, missingBoxReason: 'box-not-in-reference' })
  }

  if (boxCandidates.length === 1) {
    return {
      unitType: boxCandidates[0].unitType,
      boxNumber,
      confidence: 'high',
      reason: 'boxNumberToUnitType-unique',
      candidateUnitTypes: boxCandidates.map((c) => c.unitType),
    }
  }

  // Ambiguous box number: use assignment-title-to-unit reference to break tie.
  const titleCandidates = indexes.assignmentTitleToUnits.get(normalizedAssignmentName) || []
  const titleIntersect = titleCandidates.filter((c) => boxCandidates.some((b) => b.unitType === c.unitType))
  if (titleIntersect.length === 1) {
    return {
      unitType: titleIntersect[0].unitType,
      boxNumber,
      confidence: 'high',
      reason: 'ambiguous-box-resolved-by-assignment-title',
      candidateUnitTypes: boxCandidates.map((c) => c.unitType),
    }
  }

  const manifestUnitTypes = (manifest?.unitTypes || []).filter((u) => typeof u === 'string')
  const manifestIntersect = boxCandidates.filter((c) => manifestUnitTypes.includes(c.unitType))
  if (manifestIntersect.length === 1) {
    return {
      unitType: manifestIntersect[0].unitType,
      boxNumber,
      confidence: 'medium',
      reason: 'ambiguous-box-resolved-by-project-manifest-unitTypes',
      candidateUnitTypes: boxCandidates.map((c) => c.unitType),
    }
  }

  if (assignment?.unitType && boxCandidates.some((c) => c.unitType === assignment.unitType)) {
    return {
      unitType: assignment.unitType,
      boxNumber,
      confidence: 'medium',
      reason: 'ambiguous-box-resolved-by-assignment-unitType',
      candidateUnitTypes: boxCandidates.map((c) => c.unitType),
    }
  }

  // Final tie-break: highest projectCount candidate from boxNumberToUnitType.
  return {
    unitType: boxCandidates[0].unitType,
    boxNumber,
    confidence: 'low',
    reason: 'ambiguous-box-fallback-highest-projectCount',
    candidateUnitTypes: boxCandidates.map((c) => c.unitType),
  }
}

function toCsv(result) {
  const rows = [
    'project,revision,unitType,assignmentCount,assignmentName,sheetSlug,boxNumber,resolutionConfidence,resolutionReason,candidateUnitTypes',
  ]

  for (const p of result.projects) {
    for (const g of p.unitGroups) {
      for (const assignment of g.assignments) {
        rows.push([
          escapeCsv(p.project),
          escapeCsv(p.revision),
          escapeCsv(g.unitType),
          escapeCsv(g.assignmentCount),
          escapeCsv(assignment.assignmentName),
          escapeCsv(assignment.sheetSlug),
          escapeCsv(assignment.boxNumber || ''),
          escapeCsv(assignment.resolutionConfidence),
          escapeCsv(assignment.resolutionReason),
          escapeCsv((assignment.candidateUnitTypes || []).join('|')),
        ].join(','))
      }
    }
  }

  return `${rows.join('\n')}\n`
}

function main() {
  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`Missing legal drawings directory: ${LEGAL_DIR}`)
    process.exit(1)
  }

  const minCount = Number.parseInt(args['min-count'], 10)
  if (!Number.isFinite(minCount) || minCount < 1) {
    console.error(`Invalid --min-count value: ${args['min-count']}`)
    process.exit(1)
  }

  const unitReference = readJson(UNIT_REF_PATH)
  if (!unitReference) {
    console.error(`Could not read unit reference: ${UNIT_REF_PATH}`)
    process.exit(1)
  }

  const indexes = buildReferenceIndexes(unitReference)

  const projects = args.project ? [args.project] : collectProjectDirs(LEGAL_DIR)

  const result = {
    generatedAt: new Date().toISOString(),
    sourceReference: UNIT_REF_PATH,
    strategy: 'boxNumberToUnitType-first-with-unitTypeToBoxNumber-disambiguation',
    minCount,
    projects: [],
    totals: {
      projectsScanned: 0,
      assignmentsScanned: 0,
      unresolvedAssignments: 0,
      ambiguousBoxAssignments: 0,
    },
  }

  for (const project of projects) {
    const projectDir = path.join(LEGAL_DIR, project)
    if (!fs.existsSync(projectDir)) continue

    const revisions = args.revision ? [args.revision] : collectRevisionDirs(projectDir)

    for (const revision of revisions) {
      const manifestPath = path.join(projectDir, revision, 'project-manifest.json')
      if (!fs.existsSync(manifestPath)) continue

      const manifest = readJson(manifestPath)
      if (!manifest || !manifest.assignments || typeof manifest.assignments !== 'object') continue

      result.totals.projectsScanned += 1

      const grouped = new Map()

      for (const [sheetSlug, assignment] of Object.entries(manifest.assignments)) {
        result.totals.assignmentsScanned += 1

        const resolved = resolveUnitTypeFromBox({ assignment, manifest, indexes })
        if (UNIT_TYPE_ALIASES[resolved.unitType]) resolved.unitType = UNIT_TYPE_ALIASES[resolved.unitType]

        if (resolved.unitType === 'UNKNOWN') result.totals.unresolvedAssignments += 1
        if (resolved.candidateUnitTypes.length > 1) result.totals.ambiguousBoxAssignments += 1

        if (!grouped.has(resolved.unitType)) grouped.set(resolved.unitType, [])

        grouped.get(resolved.unitType).push({
          assignmentName: assignment?.sheetName || assignment?.name || sheetSlug,
          sheetSlug,
          boxNumber: resolved.boxNumber,
          resolutionConfidence: resolved.confidence,
          resolutionReason: resolved.reason,
          candidateUnitTypes: resolved.candidateUnitTypes,
        })
      }

      const unitGroups = [...grouped.entries()]
        .map(([unitType, assignments]) => ({
          unitType,
          assignmentCount: assignments.length,
          assignments: assignments.sort((a, b) => a.assignmentName.localeCompare(b.assignmentName)),
        }))
        .filter((g) => g.assignmentCount >= minCount)
        .sort((a, b) => (b.assignmentCount - a.assignmentCount) || a.unitType.localeCompare(b.unitType))

      if (unitGroups.length === 0) continue

      result.projects.push({
        project,
        revision,
        unitGroupCount: unitGroups.length,
        totalAssignments: unitGroups.reduce((sum, g) => sum + g.assignmentCount, 0),
        unitGroups,
      })
    }
  }

  const outJson = resolveOutputPath(args['out-json'])
  const outCsv = resolveOutputPath(args['out-csv'])

  if (outJson) {
    ensureDirForFile(outJson)
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8')
    console.log(`Wrote JSON: ${outJson}`)
  }

  if (outCsv) {
    ensureDirForFile(outCsv)
    fs.writeFileSync(outCsv, toCsv(result), 'utf8')
    console.log(`Wrote CSV: ${outCsv}`)
  }

  console.log(`Projects scanned: ${result.totals.projectsScanned}`)
  console.log(`Assignments scanned: ${result.totals.assignmentsScanned}`)
  console.log(`Ambiguous-box assignments: ${result.totals.ambiguousBoxAssignments}`)
  console.log(`Unresolved assignments: ${result.totals.unresolvedAssignments}`)

  for (const p of result.projects) {
    console.log(`\n${p.project} ${p.revision} (${p.unitGroupCount} unit types, ${p.totalAssignments} assignments)`)
    for (const g of p.unitGroups) {
      console.log(`  [${g.unitType}] ${g.assignmentCount}`)
    }
  }
}

main()
