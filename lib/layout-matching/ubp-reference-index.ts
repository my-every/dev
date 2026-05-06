/**
 * UBP Reference Index
 *
 * Builds structural lookup tables from `layout-unit-box-panel-reference.json`
 * so that layout pages can be matched to assignments using cross-project
 * validated signals (panel number, box number, unit type) rather than relying
 * solely on PDF text extraction.
 *
 * Signal confidence hierarchy:
 *   1. panelNumber exact match  → very high confidence (projectCount-weighted)
 *   2. boxNumber match + title  → high confidence
 *   3. unitType match + title   → medium confidence
 */

// ─── Raw reference types ──────────────────────────────────────────────────────

interface RawPanelNumber {
  value: string
  projectCount: number
}

interface RawAssignment {
  value: string
  projectCount: number
  swsType?: string
  boxSide?: string
  externalLocations?: (string | ExternalLocationConfig)[]
  panelNumbers: RawPanelNumber[]
}

interface RawUnitTypeEntry {
  unitType: string
  boxNumber: string
  projectCount: number
  assignments: RawAssignment[]
}

interface RawUbpReference {
  mappings: {
    unitTypeToBoxNumber: RawUnitTypeEntry[]
  }
}

// ─── Shared external location config ─────────────────────────────────────────

/**
 * Per-location visibility configuration for a given assignment.
 * Stored in the UBP reference and propagated to project manifests.
 * Managed via the /api/runtime/ubp-reference API so a UI can configure
 * system-wide defaults without code changes.
 */
export interface ExternalLocationConfig {
  /** Normalized location label, e.g. "PLC", "JB73 PANEL", "PANEL B" */
  location: string
  /** Whether this external location appears in the wire list (standardize) print output */
  wireListVisible: boolean
  /** Whether this external location appears in the branding print output */
  brandingVisible: boolean
}

// ─── Index entry types ────────────────────────────────────────────────────────

export interface UbpAssignmentEntry {
  /** Normalised assignment title from the reference (already stripped of JB#) */
  title: string
  unitType: string
  boxNumber: string
  /** Cross-project occurrence count for this assignment */
  projectCount: number
  /** All panel numbers ever seen for this assignment × unit type × box */
  panelNumbers: string[]
  /** SWS classification resolved from manual rules (e.g. CONSOLE, RAIL, BASIC, PANEL) */
  swsType?: string
  /** Box side resolved from manual rules (e.g. centerBackSide, leftDoor) */
  boxSide?: string
  /** Per-location visibility configuration for print output. Managed via the UBP reference API. */
  externalLocations?: ExternalLocationConfig[]
}

/**
 * Queryable index built from the UBP reference JSON.
 */
export interface UbpReferenceIndex {
  /**
   * Maps a panel number to every assignment entry that has been seen on it
   * (across all unit types and box numbers).
   */
  byPanelNumber: Map<string, UbpAssignmentEntry[]>
  /**
   * Maps a box number to every assignment entry known for that box.
   */
  byBoxNumber: Map<string, UbpAssignmentEntry[]>
  /**
   * Maps a unit type to every assignment entry known for that unit type.
   */
  byUnitType: Map<string, UbpAssignmentEntry[]>
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normalizeKey(value: string | undefined | null): string {
  return (value ?? '').trim().toUpperCase()
}

// ─── Index builder ────────────────────────────────────────────────────────────

/**
 * Build the three lookup maps from the raw UBP reference data.
 * Pass the parsed JSON from `layout-unit-box-panel-reference.json`.
 */
export function buildUbpReferenceIndex(raw: unknown): UbpReferenceIndex {
  const byPanelNumber = new Map<string, UbpAssignmentEntry[]>()
  const byBoxNumber = new Map<string, UbpAssignmentEntry[]>()
  const byUnitType = new Map<string, UbpAssignmentEntry[]>()

  const data = raw as RawUbpReference
  const rows = data?.mappings?.unitTypeToBoxNumber ?? []

  for (const row of rows) {
    const unitType = normalizeKey(row.unitType)
    const boxNumber = normalizeKey(row.boxNumber)

    for (const assignment of row.assignments ?? []) {
      const title = normalizeKey(assignment.value)
      const panelNumbers = (assignment.panelNumbers ?? []).map((p) => normalizeKey(p.value))

      const entry: UbpAssignmentEntry = {
        title,
        unitType,
        boxNumber,
        projectCount: assignment.projectCount,
        panelNumbers,
        swsType: assignment.swsType,
        boxSide: assignment.boxSide,
        externalLocations: Array.isArray(assignment.externalLocations)
          ? assignment.externalLocations
              .map((item): ExternalLocationConfig | null => {
                if (typeof item === 'string') {
                  const loc = normalizeKey(item)
                  return loc ? { location: loc, wireListVisible: true, brandingVisible: true } : null
                }
                const loc = normalizeKey(item?.location)
                return loc
                  ? {
                      location: loc,
                      wireListVisible: item.wireListVisible ?? true,
                      brandingVisible: item.brandingVisible ?? true,
                    }
                  : null
              })
              .filter((x): x is ExternalLocationConfig => x !== null)
          : [],
      }

      // byUnitType
      const existingUnit = byUnitType.get(unitType) ?? []
      existingUnit.push(entry)
      byUnitType.set(unitType, existingUnit)

      // byBoxNumber
      const existingBox = byBoxNumber.get(boxNumber) ?? []
      existingBox.push(entry)
      byBoxNumber.set(boxNumber, existingBox)

      // byPanelNumber — one entry per distinct panel number
      for (const pn of panelNumbers) {
        if (!pn) continue
        const existingPanel = byPanelNumber.get(pn) ?? []
        existingPanel.push(entry)
        byPanelNumber.set(pn, existingPanel)
      }
    }
  }

  return { byPanelNumber, byBoxNumber, byUnitType }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Compute a reference-based bonus score for pairing `sheetName` with the
 * structural features of a single layout page.
 *
 * Returns a score in [0, 200]:
 *   - 0   = no reference signal
 *   - 80  = unitType match only (assignment in known list for that unit)
 *   - 120 = boxNumber match (assignment known for that exact box)
 *   - 200 = panelNumber exact match (highest confidence)
 *
 * Callers should add this on top of the existing structural score so that the
 * reference never overrides a clear structural conflict, but decisively breaks
 * ties and lifts ambiguous matches to high confidence.
 */
export function scorePageByUbpReference(
  page: { panelNumber?: string; boxNumber?: string; unitType?: string },
  sheetName: string,
  projectUnitTypes: string[],
  index: UbpReferenceIndex,
): number {
  const normalizedSheet = normalizeKey(sheetName)
  if (!normalizedSheet) return 0

  // ── 1. Panel number match (highest confidence) ───────────────────────────
  const pn = normalizeKey(page.panelNumber)
  if (pn) {
    const candidates = index.byPanelNumber.get(pn) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) {
      // Scale bonus by project count (more evidence = more confidence), cap at 200
      const countBonus = Math.min(30, match.projectCount * 2)
      return 170 + countBonus
    }
  }

  // ── 2. Box number match ───────────────────────────────────────────────────
  const bn = normalizeKey(page.boxNumber)
  if (bn) {
    const candidates = index.byBoxNumber.get(bn) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) {
      const countBonus = Math.min(20, match.projectCount)
      return 100 + countBonus
    }
  }

  // ── 3. Unit type match (weakest reference signal) ─────────────────────────
  const pageUnitType = normalizeKey(page.unitType)
  const unitTypes = [
    pageUnitType,
    ...projectUnitTypes.map(normalizeKey),
  ].filter(Boolean)

  for (const ut of unitTypes) {
    const candidates = index.byUnitType.get(ut) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) {
      const countBonus = Math.min(10, Math.floor(match.projectCount / 2))
      return 60 + countBonus
    }
  }

  return 0
}

/**
 * Infer the most likely unit type for a page+assignment pair from UBP references.
 * Priority: panelNumber -> boxNumber -> unitType buckets.
 */
export function inferUnitTypeByUbpReference(
  page: { panelNumber?: string; boxNumber?: string; unitType?: string },
  sheetName: string,
  projectUnitTypes: string[],
  index: UbpReferenceIndex,
): string | undefined {
  const normalizedSheet = normalizeKey(sheetName)
  if (!normalizedSheet) return undefined

  const pn = normalizeKey(page.panelNumber)
  if (pn) {
    const candidates = index.byPanelNumber.get(pn) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) return match.unitType
  }

  const bn = normalizeKey(page.boxNumber)
  if (bn) {
    const candidates = index.byBoxNumber.get(bn) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) return match.unitType
  }

  const pageUnit = normalizeKey(page.unitType)
  if (pageUnit) {
    const candidates = index.byUnitType.get(pageUnit) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) return match.unitType
  }

  for (const ut of projectUnitTypes.map(normalizeKey).filter(Boolean)) {
    const candidates = index.byUnitType.get(ut) ?? []
    const match = findBestTitleMatch(normalizedSheet, candidates, projectUnitTypes)
    if (match) return match.unitType
  }

  return undefined
}

// ─── Title similarity helper ──────────────────────────────────────────────────

/**
 * Find the best matching entry from `candidates` by title similarity to
 * `normalizedSheet`, optionally filtering to preferred unit types first.
 */
function findBestTitleMatch(
  normalizedSheet: string,
  candidates: UbpAssignmentEntry[],
  preferredUnitTypes: string[],
): UbpAssignmentEntry | null {
  if (candidates.length === 0) return null

  const preferred = preferredUnitTypes.map(normalizeKey)

  // Score each candidate by title overlap
  const scored = candidates.map((c) => ({
    entry: c,
    score: titleSimilarity(normalizedSheet, c.title),
    preferred: preferred.includes(c.unitType),
  }))

  // Prefer entries matching the project's unit types, then sort by score
  scored.sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
    return b.score - a.score
  })

  const best = scored[0]
  // Require at least a partial title match (≥ 0.4 similarity)
  return best && best.score >= 0.4 ? best.entry : null
}

/**
 * Jaccard-style token overlap similarity in [0, 1].
 */
function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const tokensA = new Set(tokenize(a))
  const tokensB = new Set(tokenize(b))
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }
  const union = tokensA.size + tokensB.size - intersection
  return intersection / union
}

const STOP_WORDS = new Set(['THE', 'AND', 'OR', 'OF', 'TO', 'A'])

function tokenize(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

// ─── Assignment lookup ────────────────────────────────────────────────────────

/**
 * Strip a leading unit-type token (e.g. "JB1 ", "JB12 ") from a sheet name so
 * it can be matched against UBP reference titles which do not carry the prefix.
 */
function stripUnitTypePrefix(sheetName: string): string {
  return sheetName.replace(/^JB\d+\s+/i, '').trim()
}

/**
 * Look up the best-matching UBP reference entry for a given sheet / assignment.
 *
 * Lookup priority:
 *   1. unitType bucket (most specific — scopes to the correct JB box family)
 *   2. All entries (fallback when unit type is unknown)
 *
 * Returns `null` when no entry reaches the minimum title similarity threshold.
 */
export function lookupUbpAssignment(
  sheetName: string,
  unitType: string | undefined,
  index: UbpReferenceIndex,
): UbpAssignmentEntry | null {
  const strippedName = normalizeKey(stripUnitTypePrefix(sheetName))
  if (!strippedName) return null

  const unitTypes = unitType ? [normalizeKey(unitType)] : []

  // 1. Try within the resolved unit type bucket first
  for (const ut of unitTypes) {
    const candidates = index.byUnitType.get(ut) ?? []
    const match = findBestTitleMatch(strippedName, candidates, unitTypes)
    if (match) return match
  }

  // 2. Fallback: search across all unit type buckets (weaker — no preferred filter)
  const allCandidates: UbpAssignmentEntry[] = []
  for (const entries of index.byUnitType.values()) {
    allCandidates.push(...entries)
  }
  return findBestTitleMatch(strippedName, allCandidates, unitTypes)
}
