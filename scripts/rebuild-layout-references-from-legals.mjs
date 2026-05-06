#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

const APP_ROOT = process.cwd()
const LEGAL_ROOT = process.env.LEGAL_DRAWINGS_ROOT || path.join(APP_ROOT, 'Share', 'Legal Drawings')
const REFERENCES_ROOT = process.env.LEGAL_REFERENCES_ROOT || path.join(APP_ROOT, 'Share', 'References')
const LAYOUT_REFERENCE_FILE = path.join(REFERENCES_ROOT, 'layout-pages-reference.json')
const LAYOUT_AGGREGATES_REFERENCE_FILE = path.join(REFERENCES_ROOT, 'layout-pages-aggregates-reference.json')
const UNIT_BOX_PANEL_REFERENCE_FILE = path.join(REFERENCES_ROOT, 'layout-unit-box-panel-reference.json')
const ASSIGNMENT_REFERENCE_FILE = path.join(REFERENCES_ROOT, 'layout-assignment-reference.json')
const ASSIGNMENT_AGGREGATE_REFERENCE_FILE = path.join(REFERENCES_ROOT, 'layout-assignment-aggregate-reference.json')

const { values } = parseArgs({
  options: {
    pd: { type: 'string' },
    revision: { type: 'string' },
  },
  strict: false,
})

function normalizeFilter(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeRevisionFolderName(revision) {
  return String(revision || '').trim().toUpperCase() || 'IMPORTED'
}

function compareRevisionNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function normalizeTitle(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBoxNumber(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizePanelNumber(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeSwsType(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized || ''
}

const EXTRA_UNIT_TYPE_TOKENS = ['CONSOLE', '1BAY', '2BAY', '3BAY', '4BAY']

function slugify(value) {
  return normalizeTitle(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'assignment'
}

function resolveAssignmentSwsType(baseTitle, sourceTitle, swsTypeByTitle) {
  const source = normalizeTitle(sourceTitle)
  const sourceBase = stripUnitTypeFromTitle(source)
  const base = normalizeTitle(baseTitle)

  const candidates = [source, sourceBase, base].filter(Boolean)
  for (const key of candidates) {
    const swsType = swsTypeByTitle.get(key)
    if (swsType) return swsType
  }

  return ''
}

function stripUnitTypeFromTitle(title) {
  return normalizeTitle(title)
    .replace(/^JB\d+\s+/i, '')
    .replace(/\s+JB\d+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractUnitTypeToken(title) {
  const normalized = normalizeTitle(title)
  const match = normalized.match(/\b(JB\d+)\b/i)
  if (match) return match[1].toUpperCase()

  if (/\b1\s*BAY\b|\b1BAY\b/i.test(normalized)) return '1BAY'
  if (/\b2\s*BAY\b|\b2BAY\b/i.test(normalized)) return '2BAY'
  if (/\b3\s*BAY\b|\b3BAY\b/i.test(normalized)) return '3BAY'
  if (/\b4\s*BAY\b|\b4BAY\b/i.test(normalized)) return '4BAY'
  if (/\bCONSOLE\b/i.test(normalized)) return 'CONSOLE'

  return null
}

function resolveUnitBoxKey(unitType, boxNumber) {
  if (boxNumber) return boxNumber
  if (EXTRA_UNIT_TYPE_TOKENS.includes(unitType)) {
    return `UNITBOX:${unitType}`
  }
  return ''
}

const JB70_IMPLICIT_PATTERNS = [
  /^DOOR(\s|$)/i,
  /\bDOOR\s*PANELS?\b/i,
  /^(PANEL|PNL)\s+[AB]\b/i,
  /^[AB]\s+(PANEL|PNL)\b/i,
  /^CONTROL\s+[AB]\b/i,
  /^PLC(\s+PANEL)?$/i,
  /^(LEFT|RIGHT)\s+(SIDE\s+)?RAIL$/i,
  /^RAIL\s+(LEFT|RIGHT)$/i,
  /^FG[\s&E]+(\w+\s*)*PANEL$/i,
  /^FG[\s&E]+\w/i,
  /^VIBRATION\s+PANEL$/i,
  /^CONTROL$/i,
  /\bTCP\b/i,
  /PWR\s+DS?T/i,
  /POWERDIST/i,
  /^TURBINE\b/i,
  /\bTURBINE\s+(PANEL|VIB|VIBRATION)\b/i,
]

const NAMED_BOX_PREFIXES = [
  /^GENERATOR\s+BOX/i,
  /^GAS\s+PRODUCER/i,
  /^POWER\s+TURBINE/i,
  /^RGB\s+VIB/i,
  /^VFD\s+MEDIA/i,
  /^BOP\s+BOX/i,
  /^HPC\s+CTRL/i,
  /^LP\s+COMP/i,
  /^HP\s+COMP/i,
]

function isImplicitJB70Title(baseTitle) {
  if (NAMED_BOX_PREFIXES.some((pattern) => pattern.test(baseTitle))) return false
  return JB70_IMPLICIT_PATTERNS.some((pattern) => pattern.test(baseTitle))
}

function inferImplicitUnitType(baseTitle, explicitUnitTypes) {
  if (explicitUnitTypes.size === 0) return null
  if (explicitUnitTypes.size === 1) return [...explicitUnitTypes][0]
  if (explicitUnitTypes.has('JB70') && isImplicitJB70Title(baseTitle)) return 'JB70'
  return null
}

function registerExplicitUnit(baseTitleExplicitUnits, baseTitle, unitType) {
  if (!unitType || unitType === 'UNASSIGNED') return
  if (!baseTitleExplicitUnits.has(baseTitle)) {
    baseTitleExplicitUnits.set(baseTitle, new Set())
  }
  baseTitleExplicitUnits.get(baseTitle).add(unitType)
}

function registerExplicitUnitForBox(boxExplicitUnits, boxNumber, unitType) {
  if (!boxNumber || !unitType || unitType === 'UNASSIGNED') return
  if (!boxExplicitUnits.has(boxNumber)) {
    boxExplicitUnits.set(boxNumber, new Set())
  }
  boxExplicitUnits.get(boxNumber).add(unitType)
}

function resolveAssignmentUnitType({
  title,
  baseTitle,
  boxNumber,
  explicitUnitTypes,
  baseTitleExplicitUnits,
  boxExplicitUnits,
}) {
  const explicitUnit = extractUnitTypeToken(title)
  if (explicitUnit) return explicitUnit

  // Stronger rule: if this box number maps to exactly one unit type in this project,
  // bind the assignment to that unit before any generic inference.
  const explicitUnitsForBox = boxNumber ? boxExplicitUnits.get(boxNumber) : null
  if (explicitUnitsForBox && explicitUnitsForBox.size === 1) {
    return [...explicitUnitsForBox][0]
  }

  // Strong rule: if this base title has a single known explicit unit in this project,
  // bind to that unit before generic inference.
  const explicitUnitsForBaseTitle = baseTitleExplicitUnits.get(baseTitle)
  if (explicitUnitsForBaseTitle && explicitUnitsForBaseTitle.size === 1) {
    return [...explicitUnitsForBaseTitle][0]
  }

  return inferImplicitUnitType(baseTitle, explicitUnitTypes) || 'UNASSIGNED'
}

function collectUnique(values) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const next = String(value || '').trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    output.push(next)
  }
  return output
}

function toAggregateItems(values) {
  const counts = new Map()
  for (const list of values) {
    for (const value of list) {
      counts.set(value, (counts.get(value) || 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([value, projectCount]) => ({ value, projectCount }))
    .sort((left, right) => {
      if (right.projectCount !== left.projectCount) {
        return right.projectCount - left.projectCount
      }
      return left.value.localeCompare(right.value)
    })
}

function toAggregateItemsFromSets(map) {
  const output = []
  for (const [value, set] of map.entries()) {
    output.push({ value, projectCount: set.size })
  }
  return output.sort((left, right) => {
    if (right.projectCount !== left.projectCount) {
      return right.projectCount - left.projectCount
    }
    return left.value.localeCompare(right.value)
  })
}

function buildAggregateOnlyReference({ snapshots, assignmentProjects, startedAt, legalRoot }) {
  const boxToProjects = new Map()
  const unitToProjects = new Map()
  const panelToProjects = new Map()
  const titleToProjects = new Map()

  for (const snapshot of snapshots) {
    const projectKey = snapshot.projectKey
    for (const box of snapshot.boxNumbers || []) {
      if (!boxToProjects.has(box)) boxToProjects.set(box, new Set())
      boxToProjects.get(box).add(projectKey)
    }
    for (const unit of snapshot.unitTypes || []) {
      if (!unitToProjects.has(unit)) unitToProjects.set(unit, new Set())
      unitToProjects.get(unit).add(projectKey)
    }
    for (const panel of snapshot.panelNumbers || []) {
      if (!panelToProjects.has(panel)) panelToProjects.set(panel, new Set())
      panelToProjects.get(panel).add(projectKey)
    }
    for (const title of snapshot.normalizedTitles || []) {
      if (!titleToProjects.has(title)) titleToProjects.set(title, new Set())
      titleToProjects.get(title).add(projectKey)
    }
  }

  const unitTypeBoxMap = new Map()
  const boxUnitTypeMap = new Map()

  for (const [projectKey, project] of Object.entries(assignmentProjects || {})) {
    const byUnitAndBox = project?.assignmentsByUnitTypeAndBoxNumber || {}
    for (const [unitType, byBox] of Object.entries(byUnitAndBox)) {
      if (!unitType || unitType === 'UNASSIGNED') continue
      if (!unitTypeBoxMap.has(unitType)) unitTypeBoxMap.set(unitType, new Map())

      for (const boxNumber of Object.keys(byBox || {})) {
        if (!boxNumber || boxNumber === 'UNKNOWN_BOX') continue

        const unitBoxProjects = unitTypeBoxMap.get(unitType)
        if (!unitBoxProjects.has(boxNumber)) unitBoxProjects.set(boxNumber, new Set())
        unitBoxProjects.get(boxNumber).add(projectKey)

        if (!boxUnitTypeMap.has(boxNumber)) boxUnitTypeMap.set(boxNumber, new Map())
        const boxUnitProjects = boxUnitTypeMap.get(boxNumber)
        if (!boxUnitProjects.has(unitType)) boxUnitProjects.set(unitType, new Set())
        boxUnitProjects.get(unitType).add(projectKey)
      }
    }
  }

  const unitTypeToBoxNumbers = [...unitTypeBoxMap.entries()]
    .map(([unitType, boxProjects]) => {
      const boxes = [...boxProjects.entries()]
        .map(([value, projectSet]) => ({ value, projectCount: projectSet.size }))
        .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))

      const projectSet = new Set()
      for (const set of boxProjects.values()) {
        for (const projectKey of set) projectSet.add(projectKey)
      }

      return {
        unitType,
        projectCount: projectSet.size,
        boxNumbers: boxes,
      }
    })
    .sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType))

  const boxNumberToUnitTypes = [...boxUnitTypeMap.entries()]
    .map(([boxNumber, unitProjects]) => {
      const unitTypes = [...unitProjects.entries()]
        .map(([value, projectSet]) => ({ value, projectCount: projectSet.size }))
        .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))

      const projectSet = new Set()
      for (const set of unitProjects.values()) {
        for (const projectKey of set) projectSet.add(projectKey)
      }

      return {
        boxNumber,
        projectCount: projectSet.size,
        unitTypes,
      }
    })
    .sort((a, b) => (b.projectCount - a.projectCount) || a.boxNumber.localeCompare(b.boxNumber))

  return {
    updatedAt: new Date().toISOString(),
    totalProjects: snapshots.length,
    aggregates: {
      boxNumbers: toAggregateItemsFromSets(boxToProjects),
      unitTypes: toAggregateItemsFromSets(unitToProjects),
      panelNumbers: toAggregateItemsFromSets(panelToProjects),
      normalizedTitles: toAggregateItemsFromSets(titleToProjects),
    },
    regrouped: {
      unitTypeToBoxNumbers,
      boxNumberToUnitTypes,
    },
    source: {
      mode: 'legal-scan',
      legalRoot,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  }
}

function buildUnitBoxPanelReference({
  projectUnitBoxPanelNumbers,
  projectUnitBoxPanelTitleMappings,
  projectPartNumbersByTitle,
  projectAssignmentsByUnitTypeAndBoxNumber,
  assignmentOverrides,
  startedAt,
  legalRoot,
}) {
  const unitToBoxProjects = new Map()
  const pairToPanelProjects = new Map()
  // pairPanelKey -> Map<title, Set<projects>>
  const pairPanelToTitleProjects = new Map()
  // pairTitleKey (unitType||box||title) -> Map<panelNumber, Set<projects>>
  const pairTitleToPanelProjects = new Map()
  // pairTitleKey (unitType||box||title) -> Set<externalLocation>
  const pairTitleToExternalLocations = new Map()
  // projectKey||pairTitleKey -> Set<sourceTitle>
  const projectPairTitleToSourceTitles = new Map()
  // pairTitleKey (unitType||box||title) -> Set<partNumber>
  const pairTitleToPartNumbers = new Map()

  for (const [projectKey, unitBoxPanelNumbers] of Object.entries(projectUnitBoxPanelNumbers || {})) {
    for (const [pairKey, panelNumbers] of Object.entries(unitBoxPanelNumbers || {})) {
      const [unitType, boxNumber] = pairKey.split('||')
      if (!unitType || !boxNumber) continue

      if (!unitToBoxProjects.has(unitType)) unitToBoxProjects.set(unitType, new Map())
      const boxProjects = unitToBoxProjects.get(unitType)
      if (!boxProjects.has(boxNumber)) boxProjects.set(boxNumber, new Set())
      boxProjects.get(boxNumber).add(projectKey)

      if (!pairToPanelProjects.has(pairKey)) pairToPanelProjects.set(pairKey, new Map())
      const panelProjects = pairToPanelProjects.get(pairKey)
      for (const panelNumber of panelNumbers || []) {
        if (!panelProjects.has(panelNumber)) panelProjects.set(panelNumber, new Set())
        panelProjects.get(panelNumber).add(projectKey)
      }
    }
  }

  for (const [projectKey, byUnitType] of Object.entries(projectAssignmentsByUnitTypeAndBoxNumber || {})) {
    for (const [unitType, byBox] of Object.entries(byUnitType || {})) {
      for (const [boxNumberRaw, sideMap] of Object.entries(byBox || {})) {
        const boxNumber = normalizeBoxNumber(boxNumberRaw)
        if (!boxNumber || boxNumber === 'UNKNOWN_BOX') continue

        for (const [, assignmentsByKey] of Object.entries(sideMap || {})) {
          for (const assignment of Object.values(assignmentsByKey || {})) {
          const title = normalizeTitle(assignment?.title)
          if (!title) continue

          const externalLocations = Array.isArray(assignment?.externalLocations)
            ? assignment.externalLocations.map((location) => {
                if (location && typeof location === 'object') return normalizeTitle(location.location)
                return normalizeTitle(location)
              }).filter(Boolean)
            : []
          const sourceTitles = Array.isArray(assignment?.sourceTitles)
            ? assignment.sourceTitles.map((sourceTitle) => normalizeTitle(sourceTitle)).filter(Boolean)
            : []

          const pairTitleKey = `${unitType}||${boxNumber}||${title}`
          if (!pairTitleToExternalLocations.has(pairTitleKey)) {
            pairTitleToExternalLocations.set(pairTitleKey, new Set())
          }
          const locationSet = pairTitleToExternalLocations.get(pairTitleKey)
          for (const location of externalLocations) {
            locationSet.add(location)
          }

          const projectPairTitleKey = `${projectKey}||${pairTitleKey}`
          if (!projectPairTitleToSourceTitles.has(projectPairTitleKey)) {
            projectPairTitleToSourceTitles.set(projectPairTitleKey, new Set())
          }
          const sourceTitleSet = projectPairTitleToSourceTitles.get(projectPairTitleKey)
          for (const sourceTitle of sourceTitles) {
            sourceTitleSet.add(sourceTitle)
          }
          }
        }
      }
    }
  }

  for (const [projectKey, unitBoxPanelTitleMap] of Object.entries(projectUnitBoxPanelTitleMappings || {})) {
    const projectPNByTitle = projectPartNumbersByTitle?.[projectKey]
    for (const [pairKey, panelMap] of Object.entries(unitBoxPanelTitleMap || {})) {
      for (const [panelNumber, mappings] of Object.entries(panelMap || {})) {
        const pairPanelKey = `${pairKey}||${panelNumber}`

        if (!pairPanelToTitleProjects.has(pairPanelKey)) {
          pairPanelToTitleProjects.set(pairPanelKey, new Map())
        }
        const titleProjects = pairPanelToTitleProjects.get(pairPanelKey)

        for (const title of mappings?.normalizedTitles || []) {
          if (!titleProjects.has(title)) titleProjects.set(title, new Set())
          titleProjects.get(title).add(projectKey)

          // Also build inverted: pairKey||title -> panelNumber -> projects
          const pairTitleKey = `${pairKey}||${title}`
          if (!pairTitleToPanelProjects.has(pairTitleKey)) {
            pairTitleToPanelProjects.set(pairTitleKey, new Map())
          }
          const panelProjectsForTitle = pairTitleToPanelProjects.get(pairTitleKey)
          if (!panelProjectsForTitle.has(panelNumber)) panelProjectsForTitle.set(panelNumber, new Set())
          panelProjectsForTitle.get(panelNumber).add(projectKey)

          // Collect part numbers from this project for this exact unit+box+title.
          if (projectPNByTitle) {
            const projectPairTitleKey = `${projectKey}||${pairTitleKey}`
            const sourceTitles = [...(projectPairTitleToSourceTitles.get(projectPairTitleKey) || new Set())]
            const lookupTitles = [title, ...sourceTitles]
            const pnSets = lookupTitles
              .map((lookupTitle) => projectPNByTitle.get(lookupTitle))
              .filter(Boolean)

            if (pnSets.length > 0) {
              if (!pairTitleToPartNumbers.has(pairTitleKey)) pairTitleToPartNumbers.set(pairTitleKey, new Set())
              const dest = pairTitleToPartNumbers.get(pairTitleKey)
              for (const pnSet of pnSets) {
                for (const pn of pnSet) dest.add(pn)
              }
            }
          }
        }
      }
    }
  }

  const unitTypeToBoxNumber = []
  const boxNumberToUnitType = new Map()

  for (const [unitType, boxProjects] of unitToBoxProjects.entries()) {
    const rankedBoxes = [...boxProjects.entries()]
      .map(([boxNumber, projects]) => ({ boxNumber, projectCount: projects.size }))
      .sort((a, b) => (b.projectCount - a.projectCount) || a.boxNumber.localeCompare(b.boxNumber))

    if (rankedBoxes.length === 0) continue

    const canonical = rankedBoxes[0]
    const canonicalPairKey = `${unitType}||${canonical.boxNumber}`

    // Build assignment-centric view: collect all titles across all panels for this unit+box,
    // then for each title record which panel numbers it appears on.
    const assignmentMap = new Map() // title -> { projectCount: Set, panelNumbers: Map<panelNumber, Set<projects>> }

    const panelProjectsMap = pairToPanelProjects.get(canonicalPairKey) || new Map()
    for (const [panelNumber] of panelProjectsMap.entries()) {
      const pairPanelKey = `${canonicalPairKey}||${panelNumber}`
      const titleProjects = pairPanelToTitleProjects.get(pairPanelKey) || new Map()
      for (const [title, projSet] of titleProjects.entries()) {
        if (!assignmentMap.has(title)) {
          assignmentMap.set(title, { projects: new Set(), panelNumbers: new Map() })
        }
        const entry = assignmentMap.get(title)
        for (const p of projSet) entry.projects.add(p)
        if (!entry.panelNumbers.has(panelNumber)) entry.panelNumbers.set(panelNumber, new Set())
        for (const p of projSet) entry.panelNumbers.get(panelNumber).add(p)
      }
    }

    const assignments = [...assignmentMap.entries()]
      .map(([title, entry]) => {
        const panelNumbers = [...entry.panelNumbers.entries()]
          .map(([pn, pnProjects]) => ({ value: pn, projectCount: pnProjects.size }))
          .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))

        const pairTitleKey = `${canonicalPairKey}||${title}`
        const partNumbers = [...(pairTitleToPartNumbers.get(pairTitleKey) || [])].sort()
        const externalLocationStrings = [...(pairTitleToExternalLocations.get(pairTitleKey) || new Set())].sort()
        const overrideKey = `${unitType}||${normalizeTitle(title)}`
        const override = assignmentOverrides?.get(overrideKey)
        const unitLocationVisibility = assignmentOverrides?.__unitLocationVisibility
        const externalLocations = externalLocationStrings.map((loc) => {
          const locKey = normalizeTitle(loc)
          const visibility =
            override?.externalLocationVisibility?.get(locKey) ||
            unitLocationVisibility?.get(`${unitType}||${locKey}`)
          return {
            location: loc,
            wireListVisible: visibility?.wireListVisible === true,
            brandingVisible: visibility?.brandingVisible === true,
          }
        })
        return {
          value: title,
          swsType: override?.swsType || resolveManualReferenceSwsType(title, unitType),
          boxSide: override?.boxSide || resolveManualReferenceBoxSide(title),
          externalLocations,
          projectCount: entry.projects.size,
          partNumbers,
          panelNumbers,
        }
      })
      .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))

    // Auto-infer stub assignments from external locations that belong to this unit type.
    // If a cross-wire destination name starts with this unit's type token (e.g. "JB74 LEFT SIDE RAIL"
    // for unit JB74), upsert it as a stub assignment so it appears in the reference.
    const existingAssignmentTitles = new Set(assignments.map((a) => normalizeTitle(a.value)))
    const stubsToAdd = []
    for (const assignment of assignments) {
      for (const extLoc of assignment.externalLocations) {
        const locTitle = typeof extLoc === 'string' ? extLoc : extLoc.location
        if (!locTitle) continue
        const normalizedLoc = normalizeTitle(locTitle)
        if (existingAssignmentTitles.has(normalizedLoc)) continue
        existingAssignmentTitles.add(normalizedLoc)
        const stubOverrideKey = `${unitType}||${normalizedLoc}`
        const stubOverride = assignmentOverrides?.get(stubOverrideKey)
        stubsToAdd.push({
          value: normalizedLoc,
          swsType: stubOverride?.swsType || resolveManualReferenceSwsType(normalizedLoc, unitType),
          boxSide: stubOverride?.boxSide || resolveManualReferenceBoxSide(normalizedLoc),
          externalLocations: [],
          projectCount: 0,
          partNumbers: [],
          panelNumbers: [],
        })
      }
    }
    assignments.push(...stubsToAdd)

    const unitPartNumbers = [...new Set(assignments.flatMap((a) => a.partNumbers))].sort()

    unitTypeToBoxNumber.push({
      unitType,
      boxNumber: canonical.boxNumber,
      projectCount: canonical.projectCount,
      partNumbers: unitPartNumbers,
      assignments,
      alternateBoxes: rankedBoxes.slice(1),
    })

    if (!boxNumberToUnitType.has(canonical.boxNumber)) boxNumberToUnitType.set(canonical.boxNumber, [])
    boxNumberToUnitType.get(canonical.boxNumber).push({
      unitType,
      projectCount: canonical.projectCount,
    })
  }

  unitTypeToBoxNumber.sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType))

  const boxNumberToUnitTypeRows = [...boxNumberToUnitType.entries()]
    .map(([boxNumber, units]) => ({
      boxNumber,
      unitTypes: units.sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType)),
    }))
    .sort((a, b) => a.boxNumber.localeCompare(b.boxNumber))

  return {
    updatedAt: new Date().toISOString(),
    totalUnitTypes: unitTypeToBoxNumber.length,
    mappings: {
      unitTypeToBoxNumber,
      boxNumberToUnitType: boxNumberToUnitTypeRows,
    },
    source: {
      mode: 'legal-scan',
      legalRoot,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  }
}

function buildAssignmentAggregateReference({ unitBoxPanelReference, startedAt, legalRoot }) {
  // Invert unitTypeToBoxNumber → assignments: for each unique assignment title, collect which
  // unit types it appears on with their project counts, part numbers, and panel numbers.
  const titleMap = new Map()
  // title -> { projectCount: number, unitTypes: Map<unitType, number>, partNumbers: Set, panelNumbers: Map<pn, number> }

  for (const unit of unitBoxPanelReference.mappings?.unitTypeToBoxNumber || []) {
    for (const assignment of unit.assignments || []) {
      const title = assignment.value
      if (!titleMap.has(title)) {
        titleMap.set(title, {
          projectCount: 0,
          unitTypes: new Map(),
          partNumbers: new Set(),
          panelNumbers: new Map(),
        })
      }
      const entry = titleMap.get(title)
      // projectCount is the max seen across unit types (an assignment belongs to one unit per project)
      entry.projectCount = Math.max(entry.projectCount, assignment.projectCount)
      entry.unitTypes.set(unit.unitType, (entry.unitTypes.get(unit.unitType) || 0) + assignment.projectCount)
      for (const pn of assignment.partNumbers || []) entry.partNumbers.add(pn)
      for (const panel of assignment.panelNumbers || []) {
        const cur = entry.panelNumbers.get(panel.value) || 0
        entry.panelNumbers.set(panel.value, cur + panel.projectCount)
      }
    }
  }

  const assignments = [...titleMap.entries()]
    .map(([title, entry]) => ({
      title,
      projectCount: entry.projectCount,
      unitTypes: [...entry.unitTypes.entries()]
        .map(([unitType, projectCount]) => ({ value: unitType, projectCount }))
        .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value)),
      partNumbers: [...entry.partNumbers].sort(),
      panelNumbers: [...entry.panelNumbers.entries()]
        .map(([value, projectCount]) => ({ value, projectCount }))
        .sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value)),
    }))
    .sort((a, b) => (b.projectCount - a.projectCount) || a.title.localeCompare(b.title))

  return {
    updatedAt: new Date().toISOString(),
    totalAssignments: assignments.length,
    assignments,
    source: {
      mode: 'legal-scan',
      legalRoot,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  }
}

function resolveBoxSide(baseTitle) {
  const title = normalizeTitle(baseTitle)

  if (/\bLEFT\b.*\bDOOR\b|\bDOOR\b.*\bLEFT\b/i.test(title)) return 'leftDoor'
  if (/\bRIGHT\b.*\bDOOR\b|\bDOOR\b.*\bRIGHT\b/i.test(title)) return 'rightDoor'
  if (/\bDOOR\b/i.test(title)) return 'leftDoor'

  if (/\bLEFT\s+(SIDE\s+)?RAIL\b|\bRAIL\s+LEFT\b/i.test(title)) return 'leftSide'
  if (/\bRIGHT\s+(SIDE\s+)?RAIL\b|\bRAIL\s+RIGHT\b/i.test(title)) return 'rightDoor'

  if (/\b(PANEL|PNL)\s+A\b|\bCONTROL\s+A\b|\bA\s+(PANEL|PNL)\b/i.test(title)) return 'leftBackSide'
  if (/\b(PANEL|PNL)\s+B\b|\bCONTROL\s+B\b|\bB\s+(PANEL|PNL)\b/i.test(title)) return 'rightBackSide'

  if (/\bGEN\b|\bGENERATOR\b/i.test(title)) return 'rightBackSide'

  return 'topBackSide'
}

function resolveManualReferenceSwsType(title, unitType) {
  const normalized = normalizeTitle(title)

  if (unitType === 'CONSOLE' || /\bCONSOLE\b/i.test(normalized)) return 'CONSOLE'
  if (/\b(RIGHT|LEFT)\b.*\bRAIL\b|\bRAIL\b.*\b(RIGHT|LEFT)\b/i.test(normalized)) return 'RAIL'
  if (/\bPROX\b/i.test(normalized)) return 'BASIC'
  if (/\b(PANEL|PNL)\b/i.test(normalized)) return 'PANEL'

  return 'UNDECIDED'
}

function resolveManualReferenceBoxSide(title) {
  const normalized = normalizeTitle(title)

  if (/\bRIGHT\b.*\bRAIL\b|\bRAIL\b.*\bRIGHT\b/i.test(normalized)) return 'rightDoor'
  if (/\bLEFT\b.*\bRAIL\b|\bRAIL\b.*\bLEFT\b/i.test(normalized)) return 'leftDoor'
  if (/\bPROX\b/i.test(normalized)) return 'centerBackSide'

  if (/\bRIGHT\b/i.test(normalized) || /\bB\b/i.test(normalized)) return 'rightBackSide'
  if (/\bLEFT\b/i.test(normalized) || /\bA\b/i.test(normalized)) return 'leftBackSide'

  return resolveBoxSide(normalized)
}

function buildAssignmentOverrideMap(existingReference) {
  const map = new Map()
  const unitLocationVisibility = new Map()
  const rows = existingReference?.mappings?.unitTypeToBoxNumber || []

  for (const row of rows) {
    const unitType = String(row?.unitType || '').trim().toUpperCase()
    if (!unitType) continue

    for (const assignment of row?.assignments || []) {
      const title = normalizeTitle(assignment?.value)
      if (!title) continue

      const key = `${unitType}||${title}`
      const externalLocationVisibility = new Map()
      for (const extLoc of assignment?.externalLocations || []) {
        if (extLoc && typeof extLoc === 'object' && extLoc.location) {
          const locKey = normalizeTitle(extLoc.location)
          if (locKey) {
            const visibility = {
              wireListVisible: extLoc.wireListVisible === true,
              brandingVisible: extLoc.brandingVisible === true,
            }
            externalLocationVisibility.set(locKey, visibility)

            const unitLocKey = `${unitType}||${locKey}`
            if (!unitLocationVisibility.has(unitLocKey)) {
              unitLocationVisibility.set(unitLocKey, { ...visibility })
            } else {
              const prior = unitLocationVisibility.get(unitLocKey)
              // If any historical entry is false, keep false as the safer default.
              prior.wireListVisible = prior.wireListVisible && visibility.wireListVisible
              prior.brandingVisible = prior.brandingVisible && visibility.brandingVisible
            }
          }
        }
      }
      map.set(key, {
        swsType: normalizeSwsType(assignment?.swsType),
        boxSide: String(assignment?.boxSide || '').trim(),
        externalLocationVisibility,
      })
    }
  }

  map.__unitLocationVisibility = unitLocationVisibility
  return map
}

function ensureBoxSideMap(group) {
  return {
    leftDoor: group.leftDoor || {},
    leftSide: group.leftSide || {},
    topBackSide: group.topBackSide || {},
    leftBackSide: group.leftBackSide || {},
    rightBackSide: group.rightBackSide || {},
    rightDoor: group.rightDoor || {},
  }
}

function ensureUnitTypeAndBoxMap(container, unitType, boxNumber) {
  if (!container[unitType]) container[unitType] = {}
  if (!container[unitType][boxNumber]) {
    container[unitType][boxNumber] = ensureBoxSideMap({})
  }
  return container[unitType][boxNumber]
}

function iterateAssignmentsFromSideMap(sideMap) {
  const pairs = []
  for (const [boxSide, assignments] of Object.entries(sideMap || {})) {
    for (const [assignmentKey, assignment] of Object.entries(assignments || {})) {
      pairs.push({ boxSide, assignmentKey, assignment })
    }
  }
  return pairs
}

function buildGlobalBoxToUnitMap(assignmentProjects) {
  const countsByBox = new Map()

  for (const project of Object.values(assignmentProjects || {})) {
    const byUnitAndBox = project?.assignmentsByUnitTypeAndBoxNumber || {}
    for (const [unitType, byBox] of Object.entries(byUnitAndBox)) {
      if (!unitType || unitType === 'UNASSIGNED') continue
      for (const [boxNumber, sideMap] of Object.entries(byBox || {})) {
        if (!boxNumber || boxNumber === 'UNKNOWN_BOX') continue
        const assignmentCount = iterateAssignmentsFromSideMap(sideMap).length
        if (assignmentCount === 0) continue

        if (!countsByBox.has(boxNumber)) countsByBox.set(boxNumber, new Map())
        const unitCounts = countsByBox.get(boxNumber)
        unitCounts.set(unitType, (unitCounts.get(unitType) || 0) + assignmentCount)
      }
    }
  }

  const resolved = new Map()
  for (const [boxNumber, unitCounts] of countsByBox.entries()) {
    const ranked = [...unitCounts.entries()].sort((a, b) => b[1] - a[1])
    const [winnerUnit, winnerCount] = ranked[0] || []
    const secondCount = ranked[1]?.[1] || 0
    if (!winnerUnit) continue

    // Resolve only when box ownership is clear globally.
    if (winnerCount > secondCount) {
      resolved.set(boxNumber, winnerUnit)
    }
  }

  return resolved
}

function removeEmptyAssignmentsAndUnits(assignmentsByUnitType, assignmentsByUnitTypeAndBoxNumber) {
  for (const [unitType, sideMap] of Object.entries(assignmentsByUnitType || {})) {
    for (const boxSide of Object.keys(sideMap || {})) {
      const assignments = sideMap[boxSide] || {}
      for (const assignmentKey of Object.keys(assignments)) {
        const assignment = assignments[assignmentKey]
        if (!assignment) delete assignments[assignmentKey]
      }
      if (Object.keys(assignments).length === 0) {
        delete sideMap[boxSide]
      }
    }
    if (Object.keys(sideMap || {}).length === 0) {
      delete assignmentsByUnitType[unitType]
    }
  }

  for (const [unitType, byBox] of Object.entries(assignmentsByUnitTypeAndBoxNumber || {})) {
    for (const [boxNumber, sideMap] of Object.entries(byBox || {})) {
      for (const boxSide of Object.keys(sideMap || {})) {
        const assignments = sideMap[boxSide] || {}
        for (const assignmentKey of Object.keys(assignments)) {
          const assignment = assignments[assignmentKey]
          if (!assignment) delete assignments[assignmentKey]
        }
        if (Object.keys(assignments).length === 0) {
          delete sideMap[boxSide]
        }
      }
      if (Object.keys(sideMap || {}).length === 0) {
        delete byBox[boxNumber]
      }
    }
    if (Object.keys(byBox || {}).length === 0) {
      delete assignmentsByUnitTypeAndBoxNumber[unitType]
    }
  }
}

function mergeUnassignedByGlobalBoxOwnership(assignmentProjects) {
  const globalBoxToUnit = buildGlobalBoxToUnitMap(assignmentProjects)
  if (globalBoxToUnit.size === 0) {
    return { mergedCount: 0, boxMappings: 0 }
  }

  let mergedCount = 0

  for (const project of Object.values(assignmentProjects || {})) {
    const byUnit = project.assignmentsByUnitType || {}
    const byUnitAndBox = project.assignmentsByUnitTypeAndBoxNumber || {}
    const unassignedByBox = byUnitAndBox.UNASSIGNED || {}

    for (const [boxNumber, unassignedSideMap] of Object.entries(unassignedByBox)) {
      const targetUnit = globalBoxToUnit.get(boxNumber)
      if (!targetUnit || targetUnit === 'UNASSIGNED') continue

      const targetByBoxSide = ensureUnitTypeAndBoxMap(byUnitAndBox, targetUnit, boxNumber)
      if (!byUnit[targetUnit]) byUnit[targetUnit] = ensureBoxSideMap({})
      if (!byUnit.UNASSIGNED) byUnit.UNASSIGNED = ensureBoxSideMap({})

      for (const { boxSide, assignmentKey, assignment } of iterateAssignmentsFromSideMap(unassignedSideMap)) {
        if (!assignment) continue

        const reassigned = {
          ...assignment,
          unitType: targetUnit,
          boxNumber,
        }

        // unit+box bucket
        if (!targetByBoxSide[boxSide]) targetByBoxSide[boxSide] = {}
        if (!targetByBoxSide[boxSide][assignmentKey]) {
          targetByBoxSide[boxSide][assignmentKey] = reassigned
        } else {
          const existing = targetByBoxSide[boxSide][assignmentKey]
          existing.sourceTitles = collectUnique([...(existing.sourceTitles || []), ...(reassigned.sourceTitles || [])])
          existing.externalLocations = collectUnique([...(existing.externalLocations || []), ...(reassigned.externalLocations || [])])
        }

        // unit bucket (all boxes)
        const targetSide = byUnit[targetUnit][boxSide] || (byUnit[targetUnit][boxSide] = {})
        if (!targetSide[assignmentKey]) {
          targetSide[assignmentKey] = {
            ...reassigned,
            boxNumbers: collectUnique([...(reassigned.boxNumbers || []), boxNumber]),
          }
        } else {
          const existing = targetSide[assignmentKey]
          existing.sourceTitles = collectUnique([...(existing.sourceTitles || []), ...(reassigned.sourceTitles || [])])
          existing.externalLocations = collectUnique([...(existing.externalLocations || []), ...(reassigned.externalLocations || [])])
          existing.boxNumbers = collectUnique([...(existing.boxNumbers || []), boxNumber])
        }

        // remove old UNASSIGNED nodes
        if (unassignedSideMap[boxSide]) {
          delete unassignedSideMap[boxSide][assignmentKey]
        }
        if (byUnit.UNASSIGNED[boxSide]) {
          delete byUnit.UNASSIGNED[boxSide][assignmentKey]
        }

        mergedCount += 1
      }
    }

    removeEmptyAssignmentsAndUnits(byUnit, byUnitAndBox)
  }

  return { mergedCount, boxMappings: globalBoxToUnit.size }
}

function rebuildSnapshotGroupingFromAssignments(projectSnapshot, assignmentProject) {
  const groupedByUnitType = {}

  for (const [unitType, sideMap] of Object.entries(assignmentProject.assignmentsByUnitType || {})) {
    const titles = []
    const seen = new Set()
    for (const { assignment } of iterateAssignmentsFromSideMap(sideMap)) {
      const title = normalizeTitle(assignment?.title)
      if (!title || seen.has(title)) continue
      seen.add(title)
      titles.push(title)
    }
    if (titles.length > 0) groupedByUnitType[unitType] = titles
  }

  const inferredUnitTypes = Object.keys(groupedByUnitType).filter((unit) => unit !== 'UNASSIGNED')
  projectSnapshot.groupedByUnitType = groupedByUnitType
  projectSnapshot.unassignedTitles = groupedByUnitType.UNASSIGNED || []
  projectSnapshot.unitTypes = collectUnique([...(projectSnapshot.unitTypes || []), ...inferredUnitTypes])
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function listDirs(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function getLatestRevision(pdRoot) {
  const latest = await readJsonIfExists(path.join(pdRoot, 'latest.json'))
  if (latest?.latestRevision) {
    return normalizeRevisionFolderName(latest.latestRevision)
  }

  const revisions = (await listDirs(pdRoot))
    .map((name) => normalizeRevisionFolderName(name))
    .filter((name) => name !== 'ELECTRICAL')
    .sort(compareRevisionNames)

  return revisions.at(-1) || null
}

function extractPartNumbersFromPartNumberList(data) {
  const result = new Map() // normalizedTitle -> Set<partNumber>
  for (const row of data?.rawRows || []) {
    const rawLocation = String(row['Location'] || '').replace('^', ' ').trim()
    const normalized = normalizeTitle(rawLocation)
    if (!normalized) continue
    const partNums = String(row['Part Number'] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!result.has(normalized)) result.set(normalized, new Set())
    for (const pn of partNums) result.get(normalized).add(pn)
  }
  return result
}

function extractExternalLocationsFromWireListSchema(schema) {
  const external = new Set()

  for (const page of schema?.pages || []) {
    if (page?.pageType !== 'wire-list') continue
    for (const group of page?.locationGroups || []) {
      if (!group || !group.isExternal) continue
      const location = normalizeTitle(group.location)
      if (location) external.add(location)
    }
  }

  return [...external]
}

async function collectProjectData(pdRoot, pdNumber, requestedRevision) {
  const revision = requestedRevision ? normalizeRevisionFolderName(requestedRevision) : await getLatestRevision(pdRoot)
  if (!revision) return null

  const revisionRoot = path.join(pdRoot, revision)
  const revisionStat = await fs.stat(revisionRoot).catch(() => null)
  if (!revisionStat?.isDirectory()) return null
  const layout = await readJsonIfExists(path.join(revisionRoot, 'layout-pages.json'))
  if (!layout || !Array.isArray(layout.pages)) return null

  const pages = layout.pages
  const pageEntries = pages
    .map((page) => {
      const title = normalizeTitle(page?.normalizedTitle || page?.title || '')
      if (!title) return null
      return {
        title,
        baseTitle: stripUnitTypeFromTitle(title),
        boxNumber: normalizeBoxNumber(page?.boxNumber),
        panelNumber: normalizePanelNumber(page?.panelNumber),
        pageUnitType: String(page?.unitType || '').trim().toUpperCase() || null,
      }
    })
    .filter(Boolean)

  const explicitUnitTypes = new Set()
  const baseTitleExplicitUnits = new Map()
  const boxExplicitUnits = new Map()

  // Pass 1: gather explicit evidence from layout pages (token or page.unitType)
  for (const entry of pageEntries) {
    const explicitUnit = extractUnitTypeToken(entry.title) || entry.pageUnitType
    if (explicitUnit) {
      explicitUnitTypes.add(explicitUnit)
      registerExplicitUnit(baseTitleExplicitUnits, entry.baseTitle, explicitUnit)
      registerExplicitUnitForBox(boxExplicitUnits, entry.boxNumber, explicitUnit)
    }
  }

  const printSchemaRoot = path.join(revisionRoot, 'wire-list-print-schema')
  const schemaFiles = await fs.readdir(printSchemaRoot).catch(() => [])
  const schemaTitlePairs = []

  const revisionManifest = await readJsonIfExists(path.join(revisionRoot, 'project-manifest.json'))
  const swsTypeByTitle = new Map()
  for (const assignment of Object.values(revisionManifest?.assignments || {})) {
    const swsType = normalizeSwsType(assignment?.swsType)
    if (!swsType) continue

    const sheetName = normalizeTitle(assignment?.sheetName)
    const baseSheetName = stripUnitTypeFromTitle(sheetName)

    if (sheetName && !swsTypeByTitle.has(sheetName)) swsTypeByTitle.set(sheetName, swsType)
    if (baseSheetName && !swsTypeByTitle.has(baseSheetName)) swsTypeByTitle.set(baseSheetName, swsType)
  }

  // Pass 2: gather explicit evidence from wire-list sheet names
  for (const fileName of schemaFiles) {
    if (!fileName.toLowerCase().endsWith('.json')) continue
    const schema = await readJsonIfExists(path.join(printSchemaRoot, fileName))
    if (!schema) continue

    const sheetName = normalizeTitle(schema.sheetName || fileName.replace(/\.json$/i, ''))
    const baseTitle = stripUnitTypeFromTitle(sheetName)
    const explicitUnit = extractUnitTypeToken(sheetName)
    if (explicitUnit) {
      explicitUnitTypes.add(explicitUnit)
      registerExplicitUnit(baseTitleExplicitUnits, baseTitle, explicitUnit)
    }

    schemaTitlePairs.push({
      fileName,
      schema,
      sheetName,
      baseTitle,
    })
  }

  // Pass 3: use box-number ownership to strengthen base-title ownership when unique.
  for (const entry of pageEntries) {
    if (extractUnitTypeToken(entry.title) || entry.pageUnitType) continue
    const explicitUnitsForBox = entry.boxNumber ? boxExplicitUnits.get(entry.boxNumber) : null
    if (explicitUnitsForBox && explicitUnitsForBox.size === 1) {
      const inheritedUnit = [...explicitUnitsForBox][0]
      registerExplicitUnit(baseTitleExplicitUnits, entry.baseTitle, inheritedUnit)
    }
  }

  const normalizedTitles = collectUnique(pageEntries.map((entry) => entry.title))
  const baseTitles = collectUnique(pageEntries.map((entry) => entry.baseTitle))

  const groupedByUnitType = {}
  const unassignedTitles = []
  const assignmentsByUnitType = {}
  const assignmentsByUnitTypeAndBoxNumber = {}
  const unitBoxPanelNumbers = {}
  const unitBoxPanelTitleMappings = {}
  const boxNumbersByUnitAndTitle = new Map()

  const upsertAssignment = ({ unitType, boxNumber, baseTitle, sourceTitle, swsType = '', externalLocations = [] }) => {
    const boxSide = resolveBoxSide(baseTitle)
    const assignmentKey = slugify(baseTitle)
    const boxKey = boxNumber || 'UNKNOWN_BOX'

    if (!assignmentsByUnitType[unitType]) {
      assignmentsByUnitType[unitType] = ensureBoxSideMap({})
    }
    const byUnitSideBucket = assignmentsByUnitType[unitType][boxSide]
    if (!byUnitSideBucket[assignmentKey]) {
      byUnitSideBucket[assignmentKey] = {
        assignmentKey,
        title: baseTitle,
        unitType,
        boxSide,
        swsTypes: [],
        sourceTitles: [],
        boxNumbers: [],
        externalLocations: [],
      }
    }

    const byUnitAssignment = byUnitSideBucket[assignmentKey]
    if (swsType && !byUnitAssignment.swsTypes.includes(swsType)) {
      byUnitAssignment.swsTypes.push(swsType)
    }
    if (sourceTitle && !byUnitAssignment.sourceTitles.includes(sourceTitle)) {
      byUnitAssignment.sourceTitles.push(sourceTitle)
    }
    if (boxNumber && !byUnitAssignment.boxNumbers.includes(boxNumber)) {
      byUnitAssignment.boxNumbers.push(boxNumber)
    }
    for (const location of externalLocations) {
      if (!byUnitAssignment.externalLocations.includes(location)) {
        byUnitAssignment.externalLocations.push(location)
      }
    }

    const byUnitAndBox = ensureUnitTypeAndBoxMap(assignmentsByUnitTypeAndBoxNumber, unitType, boxKey)
    const byUnitAndBoxSideBucket = byUnitAndBox[boxSide]
    if (!byUnitAndBoxSideBucket[assignmentKey]) {
      byUnitAndBoxSideBucket[assignmentKey] = {
        assignmentKey,
        title: baseTitle,
        unitType,
        boxNumber: boxKey,
        boxSide,
        swsTypes: [],
        sourceTitles: [],
        externalLocations: [],
      }
    }

    const byUnitAndBoxAssignment = byUnitAndBoxSideBucket[assignmentKey]
    if (swsType && !byUnitAndBoxAssignment.swsTypes.includes(swsType)) {
      byUnitAndBoxAssignment.swsTypes.push(swsType)
    }
    if (sourceTitle && !byUnitAndBoxAssignment.sourceTitles.includes(sourceTitle)) {
      byUnitAndBoxAssignment.sourceTitles.push(sourceTitle)
    }
    for (const location of externalLocations) {
      if (!byUnitAndBoxAssignment.externalLocations.includes(location)) {
        byUnitAndBoxAssignment.externalLocations.push(location)
      }
    }

    const unitTitleKey = `${unitType}::${assignmentKey}`
    if (!boxNumbersByUnitAndTitle.has(unitTitleKey)) {
      boxNumbersByUnitAndTitle.set(unitTitleKey, new Set())
    }
    if (boxNumber) {
      boxNumbersByUnitAndTitle.get(unitTitleKey).add(boxNumber)
    }
  }

  for (const entry of pageEntries) {
    const unitType = resolveAssignmentUnitType({
      title: entry.title,
      baseTitle: entry.baseTitle,
      boxNumber: entry.boxNumber,
      explicitUnitTypes,
      baseTitleExplicitUnits,
      boxExplicitUnits,
    })

    if (!groupedByUnitType[unitType]) groupedByUnitType[unitType] = []
    if (!groupedByUnitType[unitType].includes(entry.baseTitle)) {
      groupedByUnitType[unitType].push(entry.baseTitle)
    }

    if (unitType === 'UNASSIGNED' && !unassignedTitles.includes(entry.baseTitle)) {
      unassignedTitles.push(entry.baseTitle)
    }

    if (unitType !== 'UNASSIGNED' && entry.panelNumber) {
      const unitBoxKey = resolveUnitBoxKey(unitType, entry.boxNumber)
      if (unitBoxKey) {
        const pairKey = `${unitType}||${unitBoxKey}`
        if (!unitBoxPanelNumbers[pairKey]) unitBoxPanelNumbers[pairKey] = []
        if (!unitBoxPanelNumbers[pairKey].includes(entry.panelNumber)) {
          unitBoxPanelNumbers[pairKey].push(entry.panelNumber)
        }

        if (!unitBoxPanelTitleMappings[pairKey]) unitBoxPanelTitleMappings[pairKey] = {}
        if (!unitBoxPanelTitleMappings[pairKey][entry.panelNumber]) {
          unitBoxPanelTitleMappings[pairKey][entry.panelNumber] = {
            normalizedTitles: [],
            assignments: [],
          }
        }
        const panelMap = unitBoxPanelTitleMappings[pairKey][entry.panelNumber]
        if (!panelMap.normalizedTitles.includes(entry.title)) {
          panelMap.normalizedTitles.push(entry.title)
        }
        if (!panelMap.assignments.includes(entry.baseTitle)) {
          panelMap.assignments.push(entry.baseTitle)
        }
      }
    }

    if (unitType !== 'UNASSIGNED' && entry.boxNumber && entry.panelNumber) {
      const pairKey = `${unitType}||${entry.boxNumber}`
      if (!unitBoxPanelNumbers[pairKey]) unitBoxPanelNumbers[pairKey] = []
      if (!unitBoxPanelNumbers[pairKey].includes(entry.panelNumber)) {
        unitBoxPanelNumbers[pairKey].push(entry.panelNumber)
      }
    }

    upsertAssignment({
      unitType,
      boxNumber: entry.boxNumber,
      baseTitle: entry.baseTitle,
      sourceTitle: entry.title,
      swsType: resolveAssignmentSwsType(entry.baseTitle, entry.title, swsTypeByTitle),
      externalLocations: [],
    })
  }

  for (const { schema, sheetName, baseTitle } of schemaTitlePairs) {
    const assignmentKey = slugify(baseTitle)
    const externalLocations = extractExternalLocationsFromWireListSchema(schema)

    // For wire-list sheets we usually don't have a box number; derive it from known
    // layout assignments by unit+title when there is exactly one candidate box.
    const unitType = resolveAssignmentUnitType({
      title: sheetName,
      baseTitle,
      boxNumber: '',
      explicitUnitTypes,
      baseTitleExplicitUnits,
      boxExplicitUnits,
    })
    const unitTitleKey = `${unitType}::${assignmentKey}`
    const knownBoxes = boxNumbersByUnitAndTitle.get(unitTitleKey)
    const resolvedBox = knownBoxes && knownBoxes.size === 1 ? [...knownBoxes][0] : ''

    upsertAssignment({
      unitType,
      boxNumber: resolvedBox,
      baseTitle,
      sourceTitle: sheetName,
      swsType: resolveAssignmentSwsType(baseTitle, sheetName, swsTypeByTitle),
      externalLocations,
    })
  }

  const partNumberListData = await readJsonIfExists(path.join(revisionRoot, 'sheets', 'part-number-list.json'))
  const partNumbersByTitle = partNumberListData
    ? extractPartNumbersFromPartNumberList(partNumberListData)
    : new Map()

  return {
    pdNumber,
    revision,
    updatedAt: new Date().toISOString(),
    boxNumbers: collectUnique(pageEntries.map((entry) => entry.boxNumber)),
    unitTypes: collectUnique([...explicitUnitTypes]),
    panelNumbers: collectUnique(pages.map((page) => String(page?.panelNumber || '').trim())),
    normalizedTitles,
    baseTitles,
    groupedByUnitType,
    unassignedTitles,
    unitBoxPanelNumbers,
    unitBoxPanelTitleMappings,
    assignmentsByUnitType,
    assignmentsByUnitTypeAndBoxNumber,
    partNumbersByTitle,
  }
}

async function main() {
  const startedAt = new Date().toISOString()
  const pdFilter = normalizeFilter(values.pd)
  const revisionFilter = String(values.revision || '').trim()
  if (revisionFilter && !pdFilter) {
    throw new Error('The --revision option requires --pd so the scope is unambiguous.')
  }

  const pdEntries = await fs.readdir(LEGAL_ROOT, { withFileTypes: true }).catch(() => [])
  const pdFolders = pdEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !pdFilter || normalizeFilter(name) === pdFilter)

  const projectSnapshots = {}
  const assignmentProjects = {}
  const projectUnitBoxPanelNumbers = {}
  const projectUnitBoxPanelTitleMappings = {}
  const projectPartNumbersByTitle = {}
  const projectAssignmentsByUnitTypeAndBoxNumber = {}

  for (const pdNumber of pdFolders) {
    const pdRoot = path.join(LEGAL_ROOT, pdNumber)
    const data = await collectProjectData(pdRoot, pdNumber, revisionFilter)
    if (!data) continue

    projectSnapshots[pdNumber] = {
      projectKey: pdNumber,
      pdNumber,
      projectName: pdNumber,
      updatedAt: data.updatedAt,
      boxNumbers: data.boxNumbers,
      unitTypes: data.unitTypes,
      panelNumbers: data.panelNumbers,
      normalizedTitles: data.normalizedTitles,
      baseTitles: data.baseTitles,
      groupedByUnitType: data.groupedByUnitType,
      unassignedTitles: data.unassignedTitles,
    }

    assignmentProjects[pdNumber] = {
      projectKey: pdNumber,
      pdNumber,
      revision: data.revision,
      updatedAt: data.updatedAt,
      assignmentsByUnitType: data.assignmentsByUnitType,
      assignmentsByUnitTypeAndBoxNumber: data.assignmentsByUnitTypeAndBoxNumber,
    }
    projectUnitBoxPanelNumbers[pdNumber] = data.unitBoxPanelNumbers
    projectUnitBoxPanelTitleMappings[pdNumber] = data.unitBoxPanelTitleMappings
    projectPartNumbersByTitle[pdNumber] = data.partNumbersByTitle
    projectAssignmentsByUnitTypeAndBoxNumber[pdNumber] = data.assignmentsByUnitTypeAndBoxNumber
  }

  const mergeSummary = mergeUnassignedByGlobalBoxOwnership(assignmentProjects)

  for (const [pdNumber, assignmentProject] of Object.entries(assignmentProjects)) {
    const snapshot = projectSnapshots[pdNumber]
    if (!snapshot) continue
    rebuildSnapshotGroupingFromAssignments(snapshot, assignmentProject)
  }

  const snapshots = Object.values(projectSnapshots)
  const layoutReference = {
    updatedAt: new Date().toISOString(),
    totalProjects: snapshots.length,
    projects: projectSnapshots,
    aggregates: {
      boxNumbers: toAggregateItems(snapshots.map((snapshot) => snapshot.boxNumbers)),
      unitTypes: toAggregateItems(snapshots.map((snapshot) => snapshot.unitTypes)),
      panelNumbers: toAggregateItems(snapshots.map((snapshot) => snapshot.panelNumbers)),
      normalizedTitles: toAggregateItems(snapshots.map((snapshot) => snapshot.normalizedTitles)),
    },
    source: {
      mode: 'legal-scan',
      legalRoot: LEGAL_ROOT,
      pdFilter: values.pd || undefined,
      revisionFilter: values.revision || undefined,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  }

  const layoutAggregatesReference = buildAggregateOnlyReference({
    snapshots,
    assignmentProjects,
    startedAt,
    legalRoot: LEGAL_ROOT,
  })

  const existingUnitBoxPanelReference = await readJsonIfExists(UNIT_BOX_PANEL_REFERENCE_FILE)
  const assignmentOverrides = buildAssignmentOverrideMap(existingUnitBoxPanelReference)

  const unitBoxPanelReference = buildUnitBoxPanelReference({
    projectUnitBoxPanelNumbers,
    projectUnitBoxPanelTitleMappings,
    projectPartNumbersByTitle,
    projectAssignmentsByUnitTypeAndBoxNumber,
    assignmentOverrides,
    startedAt,
    legalRoot: LEGAL_ROOT,
  })

  const assignmentReference = {
    updatedAt: new Date().toISOString(),
    totalProjects: Object.keys(assignmentProjects).length,
    projects: assignmentProjects,
    mergeSummary,
    source: {
      mode: 'legal-scan',
      legalRoot: LEGAL_ROOT,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  }

  const assignmentAggregateReference = buildAssignmentAggregateReference({
    unitBoxPanelReference,
    startedAt,
    legalRoot: LEGAL_ROOT,
  })

  await fs.mkdir(REFERENCES_ROOT, { recursive: true })
  await Promise.all([
    fs.writeFile(LAYOUT_REFERENCE_FILE, JSON.stringify(layoutReference, null, 2), 'utf-8'),
    fs.writeFile(LAYOUT_AGGREGATES_REFERENCE_FILE, JSON.stringify(layoutAggregatesReference, null, 2), 'utf-8'),
    fs.writeFile(UNIT_BOX_PANEL_REFERENCE_FILE, JSON.stringify(unitBoxPanelReference, null, 2), 'utf-8'),
    fs.writeFile(ASSIGNMENT_REFERENCE_FILE, JSON.stringify(assignmentReference, null, 2), 'utf-8'),
    fs.writeFile(ASSIGNMENT_AGGREGATE_REFERENCE_FILE, JSON.stringify(assignmentAggregateReference, null, 2), 'utf-8'),
  ])

  process.stdout.write(`${JSON.stringify({
    ok: true,
    legalRoot: LEGAL_ROOT,
    pdFilter: values.pd || null,
    revisionFilter: values.revision || null,
    totalProjects: layoutReference.totalProjects,
    layoutReferenceFile: LAYOUT_REFERENCE_FILE,
    layoutAggregatesReferenceFile: LAYOUT_AGGREGATES_REFERENCE_FILE,
    unitBoxPanelReferenceFile: UNIT_BOX_PANEL_REFERENCE_FILE,
    assignmentReferenceFile: ASSIGNMENT_REFERENCE_FILE,
    assignmentAggregateReferenceFile: ASSIGNMENT_AGGREGATE_REFERENCE_FILE,
  }, null, 2)}\n`)
}

main().catch((error) => {
  console.error('[rebuild-layout-references-from-legals] failed', error)
  process.exitCode = 1
})
