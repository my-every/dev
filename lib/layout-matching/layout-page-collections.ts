import type { SlimLayoutPage } from '@/lib/layout-matching/types'

export interface LayoutPageCollectionsDocument {
  generatedAt: string
  boxNumbers: string[]
  unitTypes: string[]
  panelNumbers: string[]
  normalizedTitles: string[]
  /** Normalized titles with JB# prefix/suffix stripped (e.g. "PANEL A JB70" → "PANEL A") */
  baseTitles: string[]
  /**
   * Base titles grouped by their unit type (explicit or inferred).
   * Titles that explicitly contain a JB# are mapped to that unit.
   * Titles without a JB# are inferred when possible (see inferImplicitUnitType).
   */
  groupedByUnitType: Record<string, string[]>
  /** Base titles for which no unit type could be confidently determined. */
  unassignedTitles: string[]
}

/**
 * Strips a JB# token (prefix or suffix) from a normalized title and trims the result.
 * "PANEL A JB70" → "PANEL A"
 * "JB70 DOOR"    → "DOOR"
 * "CONTROL"      → "CONTROL"
 */
export function stripUnitTypeFromTitle(title: string): string {
  return title
    .replace(/^JB\d+\s+/i, '')   // leading JB# prefix ("JB70 DOOR" → "DOOR")
    .replace(/\s+JB\d+$/i, '')   // trailing JB# suffix ("PANEL A JB70" → "PANEL A")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * JB70 primary-panel title patterns: pages that commonly belong to the JB70 main enclosure
 * but are sometimes drawn without a JB# label on the layout.
 * Applied only when the project has at least one explicit JB70 page and the title has no JB#.
 */
const JB70_IMPLICIT_PATTERNS: RegExp[] = [
  /^DOOR(\s|$)/i,                         // "DOOR", "DOOR PANELS"
  /\bDOOR\s*PANELS?\b/i,                  // "…DOOR PANELS"
  /^(PANEL|PNL)\s+[AB]\b/i,              // "PANEL A", "PANEL B", "PNL A …"
  /^[AB]\s+(PANEL|PNL)\b/i,              // "A PANEL", "B PANEL"
  /^CONTROL\s+[AB]\b/i,                  // "CONTROL A", "CONTROL B"
  /^PLC(\s+PANEL)?$/i,                   // "PLC", "PLC PANEL"
  /^(LEFT|RIGHT)\s+(SIDE\s+)?RAIL$/i,    // "LEFT SIDE RAIL", "RIGHT RAIL"
  /^RAIL\s+(LEFT|RIGHT)$/i,              // "RAIL LEFT", "RAIL RIGHT"
  /^FG[\s&E]+(\w+\s*)*PANEL$/i,          // "FG E PANEL", "FG&E PANEL", "FG E CTRL …"
  /^FG[\s&E]+\w/i,                       // "FG E CTRL SMT130", "FG PWR …"
  /^VIBRATION\s+PANEL$/i,                // "VIBRATION PANEL"
  /^CONTROL$/i,                          // plain "CONTROL"
  /\bTCP\b/i,                            // "TCP …", "… TCP …"
  /PWR\s+DS?T/i,                         // "PWR DST RAIL", "POWERDIST PANEL"
  /POWERDIST/i,
]

/**
 * Prefixes that indicate a specifically-named enclosure that is NOT the main JB70 box.
 * Titles starting with these are excluded from JB70 implicit inference.
 */
const NAMED_BOX_PREFIXES: RegExp[] = [
  /^TURBINE\s+BOX/i,
  /^TURBINE\s+VIBRATION\s+BOX/i,
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

function isNamedBoxTitle(baseTitle: string): boolean {
  return NAMED_BOX_PREFIXES.some((pattern) => pattern.test(baseTitle))
}

function isImplicitJB70Title(baseTitle: string): boolean {
  if (isNamedBoxTitle(baseTitle)) return false
  return JB70_IMPLICIT_PATTERNS.some((pattern) => pattern.test(baseTitle))
}

/**
 * Infer a unit type for a title that has no explicit JB# marker.
 * Returns the inferred unit type string, or null if ambiguous.
 *
 * @param baseTitle     Title with JB# already stripped.
 * @param projectUnits  Set of explicit unit types found elsewhere in this project.
 */
function inferImplicitUnitType(baseTitle: string, projectUnits: Set<string>): string | null {
  if (projectUnits.size === 0) return null

  // Single-unit project → confident assignment to that unit
  if (projectUnits.size === 1) {
    return [...projectUnits][0]
  }

  // Multi-unit project: only infer JB70 for known primary-panel titles
  if (projectUnits.has('JB70') && isImplicitJB70Title(baseTitle)) {
    return 'JB70'
  }

  return null
}

function collectUnique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const next = value?.trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    output.push(next)
  }

  return output
}

function addToGroup(groups: Record<string, string[]>, key: string, value: string) {
  if (!groups[key]) groups[key] = []
  if (!groups[key].includes(value)) groups[key].push(value)
}

export function buildLayoutPageCollections(
  pages: Array<Pick<SlimLayoutPage, 'boxNumber' | 'unitType' | 'panelNumber' | 'normalizedTitle'>>,
): LayoutPageCollectionsDocument {
  const groupedByUnitType: Record<string, string[]> = {}
  const unassignedTitles: string[] = []
  const baseTitlesOrdered: string[] = []
  const seenBaseTitles = new Set<string>()

  // Pass 1: process pages with an explicit unit type from the JB# in their title
  const explicitUnitTypes = new Set<string>()
  for (const page of pages) {
    if (page.unitType) {
      explicitUnitTypes.add(page.unitType)
    }
  }

  // Pass 2: classify each page
  for (const page of pages) {
    const normalized = page.normalizedTitle?.trim()
    if (!normalized) continue

    const baseTitle = stripUnitTypeFromTitle(normalized)
    if (!seenBaseTitles.has(baseTitle)) {
      seenBaseTitles.add(baseTitle)
      baseTitlesOrdered.push(baseTitle)
    }

    if (page.unitType) {
      // Explicit unit type extracted from JB# in title
      addToGroup(groupedByUnitType, page.unitType, baseTitle)
    } else {
      // No explicit unit type — attempt inference
      const inferred = inferImplicitUnitType(baseTitle, explicitUnitTypes)
      if (inferred) {
        addToGroup(groupedByUnitType, inferred, baseTitle)
      } else if (!unassignedTitles.includes(baseTitle)) {
        unassignedTitles.push(baseTitle)
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    boxNumbers: collectUnique(pages.map((page) => page.boxNumber)),
    unitTypes: collectUnique(pages.map((page) => page.unitType)),
    panelNumbers: collectUnique(pages.map((page) => page.panelNumber)),
    normalizedTitles: collectUnique(pages.map((page) => page.normalizedTitle)),
    baseTitles: baseTitlesOrdered,
    groupedByUnitType,
    unassignedTitles,
  }
}
