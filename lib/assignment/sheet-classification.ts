/**
 * Sheet Classification Helper
 * 
 * Classifies workbook sheets into assignment, reference, or other categories.
 * Reference sheets (Blue Labels, Part Numbers, etc.) are NOT executable assignments
 * and should be excluded from the assignment mapping flow.
 */

import type { ParsedWorkbookSheet, SemanticWireListRow, ProjectSheetKind } from '@/lib/workbook/types'
import {
  type WorkbookSheetKind,
  type AssignmentDetectionSummary,
  REFERENCE_SHEET_PATTERNS,
} from '@/types/d380-assignment'

/**
 * Minimal sheet shape accepted by filterExecutableSheets.
 * Accepts both old ManifestSheetEntry (slug/name) and new ManifestAssignmentNode (sheetSlug/sheetName).
 */
export interface FilterableSheet {
  slug?: string
  /** Alias used by ManifestAssignmentNode */
  sheetSlug?: string
  name?: string
  /** Alias used by ManifestAssignmentNode */
  sheetName?: string
  kind: ProjectSheetKind
  rowCount: number
  columnCount?: number
  sheetIndex?: number
  hasData?: boolean
  /** Present on ProjectSheetSummary */
  id?: string
}

// ============================================================================
// REFERENCE SHEET DETECTION
// ============================================================================

/**
 * Exact names of reference sheets (case-insensitive match).
 * These sheets are NOT executable assignments.
 */
const REFERENCE_SHEET_EXACT_NAMES = new Set(
  REFERENCE_SHEET_PATTERNS.map(p => p.toLowerCase())
)

/**
 * Additional patterns that indicate a reference sheet.
 * These patterns use "contains" logic (not anchored to start/end).
 */
const REFERENCE_SHEET_PATTERNS_REGEX = [
  // Exact or near-exact matches (anchored)
  /^panel\s*errors?$/i,
  /^blue\s*labels?$/i,
  /^white\s*labels?$/i,
  /^heat\s*shrink\s*labels?$/i,
  /^cable\s*part\s*numbers?$/i,
  /^part\s*number\s*list$/i,
  /^pn\s*list$/i,
  /^parts?\s*list$/i,
  /^errors?$/i,
  /^label\s*list$/i,
]

/**
 * Keywords that definitively indicate a reference sheet.
 * If sheet name CONTAINS any of these, it's a reference sheet.
 */
const REFERENCE_SHEET_KEYWORDS = [
  'panel errors',
  'blue labels',
  'white labels',
  'heat shrink labels',
  'heat shrink',
  'cable part numbers',
  'part number list',
  'part numbers',
  'pn list',
]

/**
 * Check if a sheet name matches a reference sheet pattern.
 */
export function isReferenceSheetName(sheetName: string): boolean {
  if (!sheetName) return false
  const normalized = sheetName.toLowerCase().trim()

  // Exact match against known names
  if (REFERENCE_SHEET_EXACT_NAMES.has(normalized)) {
    return true
  }

  // Check if name CONTAINS any reference keyword
  for (const keyword of REFERENCE_SHEET_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return true
    }
  }

  // Pattern match (anchored regex for exact patterns)
  for (const pattern of REFERENCE_SHEET_PATTERNS_REGEX) {
    if (pattern.test(sheetName)) {
      return true
    }
  }

  return false
}

// ============================================================================
// SHEET DATA ANALYSIS
// ============================================================================

/**
 * Analyze sheet data to determine if it contains wire rows.
 * A sheet has wire rows if it has semantic rows with valid wire data.
 */
export function hasWireRowData(sheet: ParsedWorkbookSheet): boolean {
  // Check if semantic rows exist and have wire data
  if (sheet.semanticRows && sheet.semanticRows.length > 0) {
    // Look for rows with wire-related data
    return sheet.semanticRows.some(row =>
      (row.wireId && row.wireId.length > 0) ||
      (row.fromDeviceId && row.fromDeviceId.length > 0) ||
      (row.toDeviceId && row.toDeviceId.length > 0)
    )
  }

  // Fall back to row count check
  return sheet.rowCount > 0
}

/**
 * Analyze sheet data to determine if it has external locations.
 * External locations indicate cross-wire candidates.
 */
export function hasExternalLocationData(
  sheet: ParsedWorkbookSheet,
  currentPanelName?: string
): boolean {
  if (!sheet.semanticRows || sheet.semanticRows.length === 0) {
    return false
  }

  // Normalize current panel name for comparison
  const normalizedPanel = currentPanelName?.toLowerCase().trim() || ''

  for (const row of sheet.semanticRows) {
    const fromLocation = row.fromLocation?.toLowerCase().trim() || ''
    const toLocation = row.toLocation?.toLowerCase().trim() || ''

    // Check if locations differ (external connection)
    if (fromLocation && toLocation && fromLocation !== toLocation) {
      // Check for known external zone patterns
      if (isExternalZonePattern(fromLocation) || isExternalZonePattern(toLocation)) {
        return true
      }

      // Check if either location differs from current panel
      if (normalizedPanel) {
        if (fromLocation !== normalizedPanel || toLocation !== normalizedPanel) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if a location string matches an external zone pattern.
 */
function isExternalZonePattern(location: string): boolean {
  const externalPatterns = [
    /door/i,
    /rail/i,
    /side\s*rail/i,
    /harness/i,
    /console/i,
    /box/i,
    /enclosure/i,
    /external/i,
    /ext/i,
  ]

  return externalPatterns.some(pattern => pattern.test(location))
}

// ============================================================================
// PANEL NUMBER DETECTION
// ============================================================================

/**
 * Extract panel number from sheet name or layout title.
 */
export function extractPanelNumber(sheetName: string, layoutTitle?: string): string | null {
  // Panel patterns: PNL A, Panel B, PNL-1, etc.
  const panelPatterns = [
    /pnl\s*([a-z0-9]+)/i,
    /panel\s*([a-z0-9]+)/i,
    /pn\s*([a-z0-9]+)/i,
  ]

  // Try sheet name first
  for (const pattern of panelPatterns) {
    const match = sheetName.match(pattern)
    if (match) {
      return match[1].toUpperCase()
    }
  }

  // Try layout title
  if (layoutTitle) {
    for (const pattern of panelPatterns) {
      const match = layoutTitle.match(pattern)
      if (match) {
        return match[1].toUpperCase()
      }
    }
  }

  return null
}

/**
 * Detect structure type from sheet name and layout title.
 */
export function detectStructureType(
  sheetName: string,
  layoutTitle?: string
): 'PANEL' | 'RAIL' | 'COMPONENT' | 'BOX' | 'UNKNOWN' {
  const combined = `${sheetName} ${layoutTitle || ''}`.toLowerCase()

  // Order matters - check more specific patterns first
  if (/rail/i.test(combined)) return 'RAIL'
  if (/component/i.test(combined)) return 'COMPONENT'
  if (/box|enclosure|console/i.test(combined)) return 'BOX'
  if (/pnl|panel/i.test(combined)) return 'PANEL'

  return 'UNKNOWN'
}

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Known executable assignment sheet name patterns.
 * If a sheet name matches ANY of these patterns, it should be classified as an assignment.
 */
const ASSIGNMENT_SHEET_PATTERNS = [
  // Structure patterns
  /\bpnl\b/i,
  /\bpanel\b/i,
  /\bbox\b/i,
  /\brail\b/i,
  /\bdoor\b/i,
  /\bconsole\b/i,
  // Control patterns
  /\bcontrol\b/i,
  /\bctrl\b/i,
  // System patterns
  /\bplc\b/i,
  /\bhmi\b/i,
  /\bhpc\b/i,
  /\bbop\b/i,
  /\bprox\b/i,
  /\bf&g\b/i,
  /\bfandg\b/i,
  /\bf\s*&\s*g\b/i,
  /\bpwr\b/i,
  /\bpower\b/i,
  /\bvfd\b/i,
  /\bconv\b/i,
  /\bedio\b/i,
  /\bonsk\b/i,
  // JB identifier patterns (JB70, JB73, JB74, etc.)
  /\bjb\s*\d+\b/i,
  // Sheet number patterns (SHT 1, SHT 2, etc.) - usually indicates executable
  /\bsht\s*\d+\b/i,
]

/**
 * Check if a sheet name matches any known assignment pattern.
 */
function matchesAssignmentPattern(sheetName: string): boolean {
  return ASSIGNMENT_SHEET_PATTERNS.some(pattern => pattern.test(sheetName))
}

/**
 * Classify a workbook sheet into assignment, reference, or other.
 * This is the main entry point for sheet classification.
 * 
 * Classification priority:
 * 1. Reference sheets are always excluded (Blue Labels, Part Numbers, etc.)
 * 2. Sheets with wire list headers are assignments
 * 3. Sheets with known assignment name patterns are assignments
 * 4. Sheets with data rows are likely assignments (fallback)
 * 5. Empty sheets are classified as "other"
 * 
 * @param sheetName - The name of the sheet
 * @param sheetData - Optional full sheet data for deeper analysis
 * @param layoutTitle - Optional layout PDF title for additional context
 * @returns Classification result with kind and reasons
 */
export function classifyWorkbookSheetKind(
  sheetName: string,
  sheetData?: ParsedWorkbookSheet,
  layoutTitle?: string
): { kind: WorkbookSheetKind; reasons: string[] } {
  const reasons: string[] = []

  // Rule 1: Check for reference sheet names (highest priority exclusion)
  const isReference = isReferenceSheetName(sheetName)
  console.log(`[d380] classifyWorkbookSheetKind: "${sheetName}" isReference=${isReference}`)

  if (isReference) {
    reasons.push(`"${sheetName}" is a known reference sheet (not executable)`)
    return { kind: 'reference', reasons }
  }

  // Rule 2: Check for known assignment name patterns (even without sheet data)
  const matchesPattern = matchesAssignmentPattern(sheetName)

  if (!sheetData) {
    // No sheet data - rely on name patterns
    if (matchesPattern) {
      reasons.push(`Sheet name "${sheetName}" matches executable assignment pattern`)
      return { kind: 'assignment', reasons }
    }

    // If name doesn't clearly match a pattern, still default to assignment
    // This is more permissive - better to include than exclude
    reasons.push(`Sheet "${sheetName}" has no data but is not a known reference sheet - treating as potential assignment`)
    return { kind: 'assignment', reasons }
  }

  // Rule 3: Check for valid wire list structure
  const hasValidHeaders = sheetData.headers.some(h =>
    /from|to|wire|device|location|terminal|cable|pin/i.test(h)
  )

  if (hasValidHeaders) {
    reasons.push('Sheet has valid wire list headers')
    return { kind: 'assignment', reasons }
  }

  // Rule 4: Check if sheet has any data rows - likely executable if it has content
  if (sheetData.rowCount > 0) {
    if (matchesPattern) {
      reasons.push(`Sheet has ${sheetData.rowCount} rows and matches assignment pattern "${sheetName}"`)
      return { kind: 'assignment', reasons }
    }

    // Has data but no matching headers - still likely an assignment
    reasons.push(`Sheet has ${sheetData.rowCount} data rows - treating as assignment`)
    return { kind: 'assignment', reasons }
  }

  // Rule 5: Empty sheet with no matching pattern
  reasons.push('Sheet is empty and does not match any known patterns')
  return { kind: 'other', reasons }
}

/**
 * Build a complete assignment detection summary for a sheet.
 * This provides all the metadata needed for SWS type detection.
 */
export function buildAssignmentDetectionSummary(
  sheet: ProjectSheetSummary,
  sheetData?: ParsedWorkbookSheet,
  layoutTitle?: string
): AssignmentDetectionSummary {
  const { kind: sheetKind, reasons } = classifyWorkbookSheetKind(
    sheet.name,
    sheetData,
    layoutTitle
  )

  const hasPanelNumber = extractPanelNumber(sheet.name, layoutTitle) !== null
  const hasWireRows = sheetData ? hasWireRowData(sheetData) : sheet.rowCount > 0
  const hasExternalLocations = sheetData
    ? hasExternalLocationData(sheetData, sheet.name)
    : false

  const structureType = detectStructureType(sheet.name, layoutTitle)

  // Determine SWS type based on analysis
  let suggestedSwsType = 'UNKNOWN'
  let confidence = 30

  if (sheetKind === 'reference') {
    suggestedSwsType = '-' // Not applicable
    confidence = 100
    reasons.push('Reference sheet - no SWS type applicable')
  } else if (!hasPanelNumber) {
    // No panel number - Build-Up family
    if (structureType === 'RAIL') {
      suggestedSwsType = 'RAIL_BUILD'
      confidence = 75
      reasons.push('No panel number + Rail detected in title')
    } else if (structureType === 'COMPONENT') {
      suggestedSwsType = 'COMPONENT_BUILD'
      confidence = 70
      reasons.push('No panel number + Component detected in title')
    } else if (structureType === 'BOX') {
      suggestedSwsType = 'BOX_BUILD'
      confidence = 75
      reasons.push('No panel number + Box/Door detected in title')
    } else {
      suggestedSwsType = '-' // Team lead decides
      confidence = 25
      reasons.push('No panel number - team lead should decide SWS type')
    }
  } else {
    // Has panel number
    if (!hasWireRows) {
      suggestedSwsType = 'BLANK_PANEL_BUILD'
      confidence = 85
      reasons.push('Panel number detected but no wire rows - blank panel')
    } else {
      suggestedSwsType = 'PANEL_BUILD_WIRE'
      confidence = 70
      reasons.push('Panel number detected with wire rows')
    }
  }

  // Augment with cross-wire detection
  const requiresWireSws = hasWireRows
  const requiresCrossWireSws = hasExternalLocations

  if (requiresCrossWireSws) {
    reasons.push('External locations detected - cross wire candidate')
  }

  return {
    sheetKind,
    hasPanelNumber,
    hasWireRows,
    hasExternalLocations,
    layoutTitle,
    inferredStructureType: structureType,
    suggestedSwsType,
    confidence,
    reasons,
    requiresWireSws,
    requiresCrossWireSws,
  }
}

/**
 * Debug info for a single sheet classification.
 */
export interface SheetClassificationDebug {
  sheetName: string
  normalizedName: string
  classification: WorkbookSheetKind
  reasons: string[]
  hasData: boolean
  rowCount: number
  headers: string[]
}

export interface ExecutableSheetFilterOptions {
  hasLayoutMatch?: (sheet: ProjectSheetSummary) => boolean
}

/**
 * Filter sheets to only include executable assignments.
 * Returns sheets that should appear in the assignment mapping modal.
 * 
 * The function respects the ProjectSheetKind that was set during project creation:
 * - "operational" sheets are treated as potential assignments
 * - "reference" sheets are excluded
 * - "unknown" sheets are reclassified based on name patterns
 */
export function filterExecutableSheets<T extends FilterableSheet>(
  sheets: T[],
  sheetDataMap?: Record<string, ParsedWorkbookSheet>,
  options?: ExecutableSheetFilterOptions,
): {
  assignments: T[]
  excluded: { sheet: T; reason: string }[]
  summary: { assignments: number; reference: number; other: number }
  debugInfo: SheetClassificationDebug[]
} {
  console.group(`[d380] filterExecutableSheets: Processing ${sheets.length} sheets`)

  const assignments: T[] = []
  const excluded: { sheet: T; reason: string }[] = []
  const debugInfo: SheetClassificationDebug[] = []

  let referenceCount = 0
  let otherCount = 0

  for (const sheet of sheets) {
    const resolvedName = sheet.sheetName ?? sheet.name ?? ''
    const sheetData = sheet.id ? sheetDataMap?.[sheet.id] : undefined
    const hasLayoutMatch = options?.hasLayoutMatch?.(sheet) ?? true

    if (isReferenceSheetName(resolvedName)) {
      const debug: SheetClassificationDebug = {
        sheetName: resolvedName,
        normalizedName: resolvedName.toLowerCase().trim(),
        classification: 'reference',
        reasons: ['Sheet name matches reference-sheet rules'],
        hasData: !!sheetData,
        rowCount: sheetData?.rowCount ?? sheet.rowCount ?? 0,
        headers: sheetData?.headers ?? [],
      }
      debugInfo.push(debug)
      referenceCount++
      excluded.push({ sheet, reason: 'Reference sheet (name-based classification)' })
      console.log(`[d380] Sheet "${resolvedName}": reference (name-based classification)`)
      continue
    }

    // First check the ProjectSheetKind that was set during project creation
    // This respects the classification done by classifySheet() in build-project-model.ts
    if (sheet.kind === 'reference') {
      // Already classified as reference - exclude it
      const debug: SheetClassificationDebug = {
        sheetName: resolvedName,
        normalizedName: resolvedName.toLowerCase().trim(),
        classification: 'reference',
        reasons: ['Sheet was classified as reference during project creation'],
        hasData: !!sheetData,
        rowCount: sheetData?.rowCount ?? sheet.rowCount ?? 0,
        headers: sheetData?.headers ?? [],
      }
      debugInfo.push(debug)
      referenceCount++
      excluded.push({ sheet, reason: 'Reference sheet (from project classification)' })
      console.log(`[d380] Sheet "${resolvedName}": reference (from ProjectSheetKind)`)
      continue
    }

    // For operational sheets with data, include them as assignments directly
    // This is the most important rule - if buildProjectModel classified it as operational with data, trust it
    if (sheet.kind === 'operational' && sheet.rowCount > 0) {
      if (!hasLayoutMatch) {
        const debug: SheetClassificationDebug = {
          sheetName: resolvedName,
          normalizedName: resolvedName.toLowerCase().trim(),
          classification: 'other',
          reasons: ['Sheet has no matching layout page - excluding from assignments'],
          hasData: !!sheetData,
          rowCount: sheetData?.rowCount ?? sheet.rowCount ?? 0,
          headers: sheetData?.headers ?? [],
        }
        debugInfo.push(debug)
        otherCount++
        excluded.push({ sheet, reason: 'No matching layout page' })
        console.log(`[d380] Sheet "${resolvedName}": other (no matching layout page)`)
        continue
      }

      const debug: SheetClassificationDebug = {
        sheetName: resolvedName,
        normalizedName: resolvedName.toLowerCase().trim(),
        classification: 'assignment',
        reasons: ['Sheet is operational with data - including as assignment'],
        hasData: !!sheetData,
        rowCount: sheetData?.rowCount ?? sheet.rowCount ?? 0,
        headers: sheetData?.headers ?? [],
      }
      debugInfo.push(debug)
      assignments.push(sheet)
      console.log(`[d380] Sheet "${resolvedName}": assignment (operational with ${sheet.rowCount} rows)`)
      continue
    }

    // For unknown sheets or operational sheets without data, reclassify them
    const { kind, reasons } = classifyWorkbookSheetKind(resolvedName, sheetData)

    // Build debug info
    const debug: SheetClassificationDebug = {
      sheetName: resolvedName,
      normalizedName: resolvedName.toLowerCase().trim(),
      classification: kind,
      reasons,
      hasData: !!sheetData,
      rowCount: sheetData?.rowCount ?? sheet.rowCount ?? 0,
      headers: sheetData?.headers ?? [],
    }
    debugInfo.push(debug)

    console.log(`[d380] Sheet "${resolvedName}": ${kind}`, {
      originalKind: sheet.kind,
      reasons,
      rowCount: debug.rowCount,
      hasData: debug.hasData,
      headers: debug.headers.slice(0, 5).join(', '),
    })

    if (kind === 'assignment') {
      if (hasLayoutMatch) {
        assignments.push(sheet)
      } else {
        otherCount++
        excluded.push({ sheet, reason: 'No matching layout page' })
      }
    } else if (kind === 'reference') {
      referenceCount++
      excluded.push({ sheet, reason: reasons[0] || 'Reference sheet' })
    } else {
      otherCount++
      excluded.push({ sheet, reason: reasons[0] || 'Unknown sheet type' })
    }
  }

  console.log(`[d380] Summary: ${assignments.length} assignments, ${referenceCount} reference, ${otherCount} other`)
  console.groupEnd()

  return {
    assignments,
    excluded,
    summary: {
      assignments: assignments.length,
      reference: referenceCount,
      other: otherCount,
    },
    debugInfo,
  }
}
