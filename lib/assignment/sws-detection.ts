/**
 * SWS Detection Helper
 * 
 * Detects the appropriate SWS type for a sheet based on:
 * - Panel number presence (from layout)
 * - Drawing title content (Rail, Component, Box, Door)
 * - Wire row presence
 * - External location detection (cross-wire candidates)
 * 
 * Detection Rules:
 * A. BUILD-UP FAMILY (NO PANEL NUMBER):
 *    - Rail in title → RAIL_BUILD
 *    - Component in title → COMPONENT_BUILD
 *    - Box/Door in title → BOX_BUILD
 *    - None match → "-" (team lead decides)
 * 
 * B. PANEL BUILD:
 *    - Has panel number → PANEL_BUILD or PANEL_BUILD_WIRE
 * 
 * C. NO WIRES:
 *    - Must be Build-Up family (BLANK_PANEL_BUILD, etc.)
 * 
 * D. WIRES PRESENT:
 *    - Requires Wire SWS → requiresWireSws: true
 * 
 * E. CROSS WIRE:
 *    - Has external locations → requiresCrossWireSws: true
 */

import type { ProjectSheetSummary, ParsedWorkbookSheet } from '@/lib/workbook/types'
import { buildAssignmentDetectionSummary } from './sheet-classification'
import type { AssignmentDetectionSummary } from '@/types/d380-assignment'

/**
 * SWS Type for assignment classification - SIMPLIFIED
 * 
 * Only 6 primary SWS types as per requirements:
 * - Basic/Blank (Prox, Media, Terminal Strip, Marshalling, NTB panels)
 * - Rail (rail assembly)
 * - Box (box/enclosure with doors)
 * - Panel (standard panel with panel number + wires)
 * - Component (component assembly)
 * - Team Lead Decides (undecided)
 * 
 * Wire SWS and CrossWire SWS are flags, not separate types.
 */
export type SwsTypeId =
  // Primary SWS Types (the 6 main categories)
  | 'BLANK'      // Basic/Blank panel (Prox, Media, Terminal Strip, Marshalling, NTB)
  | 'RAIL'       // Rail assembly build
  | 'BOX'        // Box/enclosure build (has BOX number, no panel, or has door labels)
  | 'PANEL'      // Standard panel (has panel number + sheet rows) - renamed from DIGITAL
  | 'COMPONENT'  // Component assembly
  | 'UNDECIDED'  // Team lead needs to decide

/**
 * SWS detection result - includes wire/cross-wire requirement flags
 */
export interface SwsDetectionResult {
  type: SwsTypeId
  confidence: number // 0-100
  reasons: string[]
  alternativeTypes: SwsTypeId[]
  /** Whether this sheet requires a Wire SWS (has wires) */
  requiresWireSws?: boolean
  /** Whether this sheet is a Cross Wire candidate (has external locations) */
  requiresCrossWireSws?: boolean
}

/**
 * SWS type metadata for display
 */
export interface SwsTypeMetadata {
  id: SwsTypeId
  label: string
  shortLabel: string
  description: string
  color: string
}

/**
 * Registry of all SWS types with display metadata - SIMPLIFIED to 6 types
 */
export const SWS_TYPE_REGISTRY: Record<SwsTypeId, SwsTypeMetadata> = {
  BLANK: {
    id: 'BLANK',
    label: 'Basic/Blank',
    shortLabel: 'Blank',
    description: 'Basic/Blank panels (Prox, Media, Terminal Strip, Marshalling, NTB)',
    color: 'slate',
  },
  RAIL: {
    id: 'RAIL',
    label: 'Rail',
    shortLabel: 'Rail',
    description: 'Rail assembly build',
    color: 'cyan',
  },
  BOX: {
    id: 'BOX',
    label: 'Box',
    shortLabel: 'Box',
    description: 'Box/enclosure build (has BOX number, doors, or no panel number)',
    color: 'amber',
  },
  PANEL: {
    id: 'PANEL',
    label: 'Panel',
    shortLabel: 'Panel',
    description: 'Standard panel (has Panel Number plus sheet rows)',
    color: 'indigo',
  },
  COMPONENT: {
    id: 'COMPONENT',
    label: 'Component',
    shortLabel: 'Component',
    description: 'Component assembly build',
    color: 'teal',
  },
  UNDECIDED: {
    id: 'UNDECIDED',
    label: 'Undetermined',
    shortLabel: '-',
    description: 'Insufficient data - requires manual classification',
    color: 'orange',
  },
}

/**
 * Pattern matching rules for SWS detection - SIMPLIFIED to 6 types
 */
const DETECTION_PATTERNS = {
  // Rail patterns → Rail
  RAIL: {
    patterns: [/rail/i, /\brail\b/i, /side\s*rail/i],
    primaryType: 'RAIL' as SwsTypeId,
    confidence: 90,
    reason: 'Rail detected in title',
  },

  // Basic/Blank patterns → Blank (Prox, Media, Terminal Strip, Marshalling, NTB)
  BLANK: {
    patterns: [/prox/i, /media/i, /terminal\s*strip/i, /marshalling/i, /\bntb\b/i, /\bts\b/i],
    primaryType: 'BLANK' as SwsTypeId,
    confidence: 90,
    reason: 'Basic/Blank panel type (Prox, Media, Terminal Strip, etc.)',
  },

  // Component patterns → Component
  COMPONENT: {
    patterns: [/component/i, /comp\s*build/i, /\bcomp\b/i],
    primaryType: 'COMPONENT' as SwsTypeId,
    confidence: 85,
    reason: 'Component detected in title',
  },

  // Door/Box patterns → Box (doors indicate box/enclosure)
  DOOR: {
    patterns: [/door/i, /\bdoor\b/i, /left\s*door/i, /right\s*door/i, /interior\s*view/i],
    primaryType: 'BOX' as SwsTypeId,
    confidence: 90,
    reason: 'Has Door References - Box/Enclosure',
  },

  // Box/Console/Enclosure patterns → Box
  BOX: {
    patterns: [/\bbox\b/i, /box\s*build/i, /enclosure/i, /console/i],
    primaryType: 'BOX' as SwsTypeId,
    confidence: 90,
    reason: 'Box/Enclosure detected in title',
  },
}

/**
 * Extended detection context for more accurate SWS type detection.
 */
export interface SwsDetectionContext {
  /** Sheet data for deeper analysis */
  sheetData?: ParsedWorkbookSheet
  /** Layout PDF title if available */
  layoutTitle?: string
  /** Full text content from layout PDF (for door label detection) */
  layoutTextContent?: string
  /** Whether PANEL number was detected in layout (from "PANEL: xxx" text) */
  hasPanelNumber?: boolean
  /** Whether BOX number was detected in layout (from "BOX: xxx" text) */
  hasBoxNumber?: boolean
  /** Whether wire rows exist in the sheet */
  hasWireRows?: boolean
  /** Whether external locations exist (cross-wire candidates) */
  hasExternalLocations?: boolean
  /** Panel part number found in layout */
  layoutPanelNumber?: string
  /** Box part number found in layout */
  layoutBoxNumber?: string
}

/**
 * Detect the SWS type for a sheet based on name, row count, and context.
 * 
 * PRIORITY ORDER for Detection Rules:
 * 
 * 1. RAIL: Drawing title includes "rail" AND no panel number
 * 2. BLANK: Drawing title includes "prox" (Basic/Blank panel)
 * 3. BOX: Layout has "right/left side rail" external references OR door labels
 * 4. PANEL: Sheet has internal wires AND layout has panel numbers
 * 5. COMPONENT: Component detected in title
 * 6. UNDECIDED: Team lead decides when unclear
 * 
 * Wire SWS and CrossWire SWS are FLAGS, not separate types.
 * 
 * @param sheet - The sheet to analyze
 * @param context - Optional additional context from layout
 * @returns Detection result with type, confidence, and flags
 */
export function detectSwsType(
  sheet: ProjectSheetSummary,
  context?: SwsDetectionContext
): SwsDetectionResult {
  const reasons: string[] = []
  const alternativeTypes: SwsTypeId[] = []
  let detectedType: SwsTypeId = 'UNDECIDED'
  let confidence = 25

  const sheetName = String(sheet.name ?? sheet.slug ?? '').toLowerCase()
  const layoutTitle = context?.layoutTitle?.toLowerCase() || ''
  const layoutText = context?.layoutTextContent?.toLowerCase() || ''
  const rowCount = typeof sheet.rowCount === 'number' ? sheet.rowCount : 0

  // Key detection flags from layout
  const hasPanelNumber = context?.hasPanelNumber ?? !!context?.layoutPanelNumber
  const hasBoxNumber = context?.hasBoxNumber ?? !!context?.layoutBoxNumber
  const hasWireRows = context?.hasWireRows ?? (rowCount > 0)
  const hasExternalLocations = context?.hasExternalLocations ?? false

  // Check for door labels in layout (indicates BOX type)
  const hasDoorLabels = /right\s*door|left\s*door|door\s*label/i.test(layoutText) ||
    /interior\s*view/i.test(layoutText)

  // Check for side rail references (indicates BOX type - external rail references)
  const hasSideRailReferences = /right\s*side\s*rail|left\s*side\s*rail|mount\s*rail\s*on/i.test(layoutText) ||
    /reference\s*page.*rail/i.test(layoutText)

  // Check for explicit "SIDE RAIL" or "rail" in drawing title (sheet name or layout title)
  // "RIGHT SIDE RAIL" or "LEFT SIDE RAIL" are explicit rail assemblies
  const hasExplicitSideRail = /side\s*rail/i.test(sheetName) || /side\s*rail/i.test(layoutTitle)
  const hasRailInTitle = /rail/i.test(sheetName) || /rail/i.test(layoutTitle)

  // Check for "EDIO" in drawing title (indicates rail assembly - e.g., F&G EDIO ONSK)
  const hasEdioInTitle = /edio/i.test(sheetName) || /edio/i.test(layoutTitle)

  // ========================================
  // Rule 1: RAIL - Drawing title explicitly includes "SIDE RAIL" (always Rail regardless of panel number)
  // Examples: "JB74, RIGHT SIDE RAIL", "LEFT SIDE RAIL"
  // ========================================
  if (hasExplicitSideRail) {
    detectedType = 'RAIL'
    confidence = 95
    reasons.push('Side Rail in title - Rail assembly')
    alternativeTypes.push('COMPONENT', 'BOX')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 1b: RAIL - Drawing title includes "rail" OR "EDIO" AND no panel number
  // EDIO typically indicates a rail assembly (e.g., F&G EDIO ONSK)
  // ========================================
  if ((hasRailInTitle || hasEdioInTitle) && !hasPanelNumber) {
    detectedType = 'RAIL'
    confidence = 95
    if (hasEdioInTitle) {
      reasons.push('EDIO in title with no Panel number - Rail assembly')
    } else {
      reasons.push('Rail in title with no Panel number')
    }
    alternativeTypes.push('COMPONENT', 'BOX')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 2: BLANK - Drawing title includes "prox" or "HMI-S" (Basic/Blank panel)
  // Also matches: Media, Terminal Strip, Marshalling, NTB
  // ========================================
  if (/prox/i.test(sheetName) || /prox/i.test(layoutTitle)) {
    detectedType = 'BLANK'
    confidence = 95
    reasons.push('Has Prox - Basic/Blank panel')
    alternativeTypes.push('COMPONENT', 'RAIL')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // HMI-S is a Basic/Blank panel type
  if (/hmi-s/i.test(sheetName) || /hmi-s/i.test(layoutTitle)) {
    detectedType = 'BLANK'
    confidence = 95
    reasons.push('Has HMI-S - Basic/Blank panel')
    alternativeTypes.push('COMPONENT', 'PANEL')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // Also check other Basic/Blank types
  if (/media|terminal\s*strip|marshalling|\bntb\b|\bts\b/i.test(sheetName) ||
    /media|terminal/i.test(layoutTitle)) {
    detectedType = 'BLANK'
    confidence = 90

    if (/media/i.test(sheetName)) {
      reasons.push('Has Media - Basic/Blank panel')
    } else if (/terminal/i.test(sheetName) || /\bts\b/i.test(sheetName)) {
      reasons.push('Has Terminal Strip - Basic/Blank panel')
    } else if (/marshalling/i.test(sheetName)) {
      reasons.push('Has Marshalling - Basic/Blank panel')
    } else if (/ntb/i.test(sheetName)) {
      reasons.push('Has NTB - Basic/Blank panel')
    } else {
      reasons.push('Basic/Blank panel type detected')
    }

    alternativeTypes.push('COMPONENT', 'RAIL')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 3: BOX - Layout has right/left side rail references OR door labels
  // This indicates an enclosure with external rail references
  // ========================================
  if (hasSideRailReferences || hasDoorLabels) {
    detectedType = 'BOX'
    confidence = 95
    if (hasDoorLabels) {
      reasons.push('Has Door References - Box/Enclosure')
    }
    if (hasSideRailReferences) {
      reasons.push('Has Side Rail external references - Box/Enclosure')
    }
    alternativeTypes.push('COMPONENT', 'BLANK')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 4: PANEL - Sheet has internal wires AND layout has panel number
  // PANEL requires BOTH: panel number AND wire rows
  // ========================================
  if (hasPanelNumber && hasWireRows && rowCount > 0) {
    detectedType = 'PANEL'

    // Higher confidence for more rows
    if (rowCount >= 50) {
      confidence = 95
    } else if (rowCount >= 10) {
      confidence = 90
    } else {
      confidence = 85
    }

    reasons.push('Has Panel Number plus internal wires')
    alternativeTypes.push('BOX', 'COMPONENT')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: true,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 5: COMPONENT - Component detected in title
  // ========================================
  if (/component|comp\s*build/i.test(sheetName) || /component/i.test(layoutTitle)) {
    detectedType = 'COMPONENT'
    confidence = 85
    reasons.push('Component detected in title')
    alternativeTypes.push('RAIL', 'BOX')

    return {
      type: detectedType,
      confidence,
      reasons,
      alternativeTypes,
      requiresWireSws: hasWireRows,
      requiresCrossWireSws: hasExternalLocations,
    }
  }

  // ========================================
  // Rule 6: UNDECIDED - No clear type detected
  // Team Lead should decide based on manual review
  // ========================================
  detectedType = 'UNDECIDED'

  if (hasWireRows && rowCount > 0) {
    confidence = 50
    reasons.push('Has sheet rows but no clear type - Team Lead should decide')
  } else {
    confidence = 25
    reasons.push('No clear SWS type - Team Lead should decide')
  }

  alternativeTypes.push('PANEL', 'RAIL', 'BOX', 'COMPONENT', 'BLANK')

  return {
    type: detectedType,
    confidence,
    reasons,
    alternativeTypes,
    requiresWireSws: hasWireRows,
    requiresCrossWireSws: hasExternalLocations,
  }
}

/**
 * Batch detect SWS types for multiple sheets.
 */
export function batchDetectSwsTypes(
  sheets: ProjectSheetSummary[]
): Map<string, SwsDetectionResult> {
  const results = new Map<string, SwsDetectionResult>()

  for (const [index, sheet] of sheets.entries()) {
    results.set(String(sheet.slug ?? sheet.name ?? `sheet-${index}`), detectSwsType(sheet))
  }

  return results
}

/**
 * Get all available SWS types for dropdown selection.
 * Returns only the 6 primary types: Basic/Blank, Rail, Box, Panel, Component, Team Lead Decides
 */
export function getSwsTypeOptions(): SwsTypeMetadata[] {
  // Return in display order
  return [
    SWS_TYPE_REGISTRY.BLANK,
    SWS_TYPE_REGISTRY.RAIL,
    SWS_TYPE_REGISTRY.BOX,
    SWS_TYPE_REGISTRY.PANEL,
    SWS_TYPE_REGISTRY.COMPONENT,
    SWS_TYPE_REGISTRY.UNDECIDED,
  ]
}

/**
 * Get confidence badge color based on confidence percentage.
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'green'
  if (confidence >= 75) return 'emerald'
  if (confidence >= 50) return 'amber'
  return 'red'
}

/**
 * Get confidence label based on percentage.
 * Very High (90+), High (75-89), Low (50-74), Very Low (<50)
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Very High'
  if (confidence >= 75) return 'High'
  if (confidence >= 50) return 'Low'
  return 'Very Low'
}
