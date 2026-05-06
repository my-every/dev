/**
 * Standard Work Sheet (SWS) Type System
 * 
 * Defines the complete type registry for SWS worksheet templates,
 * supporting both print and tablet execution modes.
 * 
 * Based on real SWS packet types from D380 manufacturing:
 * - Panel Build/Wire (standard and digital variants)
 * - Basic/Blank Panels
 * - Box Build Up
 * - Box Cross Wire
 * - Console Build Up / Panel Hang
 * - Console Cross Wire
 */

// ============================================================================
// SWS TYPE ENUM
// ============================================================================

/**
 * All supported SWS template types in the D380 manufacturing process.
 * Maps to specific SWS-IPV document variants.
 * 
 * NOTE: Renamed from the older simplified sheet classification naming to
 * SwsTemplateId so template identity stays separate from assignment type.
 */
export type SwsTemplateId =
  | 'PANEL_BUILD_WIRE'           // SWS-IPV_D380_ASY_PNL BUILD-WIRE_0.1
  | 'PANEL_BUILD_WIRE'   // SWS-IPV_D380_ASY_PNL BUILD-WIRE_1.2
  | 'BASIC_BLANK_PANEL'          // SWS-IPV_D380_ASSY_SMALL-BLANK PANEL_PILOT
  | 'BOX_BUILD_UP'               // SWS-IPV_D380_ASSY_Box Build Up_0.3
  | 'BOX_CROSS_WIRE'             // SWS-IPV_D380_ASSY_Box Cross Wire_0.1
  | 'CONSOLE_BUILD_UP_PANEL_HANG' // SWS-IPV_D380_ASSY_CON BUILD UP-Pnl Hang_B.2
  | 'CONSOLE_CROSS_WIRE'         // SWS-IPV_D380_ASSY_CON CROSS WIRE_B.1

/**
 * Categories of SWS types for grouping and filtering.
 */
export type SwsCategory =
  | 'PANEL'       // Panel-level work (build/wire)
  | 'BOX'         // Box enclosure work
  | 'CONSOLE'     // Console work
  | 'CROSS_WIRE'  // Cross-wiring (box or console)

/**
 * Stage in the manufacturing process where this SWS applies.
 */
export type SwsStageScope =
  | 'BUILD_UP'
  | 'WIRING'
  | 'BOX_BUILD'
  | 'CROSS_WIRE'
  | 'PANEL_HANG'

// ============================================================================
// EXECUTION MODES
// ============================================================================

/**
 * Execution mode for SWS worksheet.
 */
export type SwsExecutionMode =
  | 'PRINT_MANUAL'        // Printed worksheet with manual pen check-off
  | 'TABLET_INTERACTIVE'  // Interactive tablet-based execution

/**
 * Display format for the SWS content.
 */
export type SwsDisplayFormat =
  | 'FULL_WORKSHEET'      // Complete multi-page worksheet
  | 'SECTION_VIEW'        // Single section at a time
  | 'SUMMARY_VIEW'        // Summary/overview only
  | 'PRINT_READY'         // Optimized for printing

// ============================================================================
// SWS TEMPLATE DEFINITION
// ============================================================================

/**
 * Complete template definition for an SWS type.
 * Defines the structure, sections, and metadata for the worksheet.
 */
export interface SwsTemplateDefinition {
  /** Unique identifier for the template */
  id: SwsTemplateId

  /** SWS-IPV document ID (e.g., "SWS-IPV_D380_ASY_PNL BUILD-WIRE_0.1") */
  swsIpvId: string

  /** Human-readable name */
  name: string

  /** Short display label */
  shortLabel: string

  /** Description of when to use this SWS */
  description: string

  /** Category for grouping */
  category: SwsCategory

  /** Manufacturing stage scope */
  stageScopes: SwsStageScope[]

  /** Revision level (e.g., "0.1", "B.1", "1.2") */
  revisionLevel: string

  /** Revision date */
  revisionDate: string

  /** Process description shown in header */
  processDescription: string

  /** Detection patterns for auto-selection */
  detectionPatterns: SwsDetectionPattern[]

  /** Sections in the worksheet */
  sections: SwsSectionDefinition[]

  /** Metadata fields in the header */
  headerFields: SwsHeaderFieldDefinition[]

  /** Standard references (WI numbers) */
  references: string[]

  /** Originator field */
  originator?: string

  /** Footer text */
  footerText: string

  /** Number of pages in the standard worksheet */
  pageCount: number

  /** Whether this template supports tablet mode */
  supportsTabletMode: boolean

  /** Computed field mappings */
  computedFields: SwsComputedFieldMapping[]

  /** Override policy for print mode */
  overridePolicy: SwsOverridePolicy
}

/**
 * Pattern for auto-detecting which SWS type to use.
 */
export interface SwsDetectionPattern {
  /** Pattern type */
  type: 'DRAWING_TITLE' | 'PANEL_NAME' | 'ENCLOSURE_TYPE' | 'KEYWORD'

  /** Regex pattern to match */
  pattern: RegExp

  /** Keywords to match */
  keywords?: string[]

  /** Confidence when matched */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'

  /** Priority when multiple patterns match */
  priority: number
}

// ============================================================================
// SWS SECTION DEFINITION
// ============================================================================

/**
 * Definition of a section within an SWS worksheet.
 */
export interface SwsSectionDefinition {
  /** Section identifier */
  id: string

  /** Work element number (1, 2, 3, etc.) */
  workElementNumber: number

  /** Work element description */
  description: string

  /** Symbol column (WI, SFN, SFT, etc.) */
  symbol?: string

  /** Cycle time in format "H:MM" */
  cycleTime?: string

  /** Reference documents (QAS numbers, WI numbers) */
  references: string[]

  /** Whether auditor stamp is required */
  requiresAuditor: boolean

  /** Auditor reference column content */
  auditorReference?: string

  /** Process steps (the detailed checklist items) */
  processSteps: SwsProcessStep[]

  /** Special verification checkpoints */
  verificationCheckpoints?: SwsVerificationCheckpoint[]

  /** Section-level notes */
  notes?: string[]

  /** Whether this section has time tracking */
  hasTimeTracking: boolean

  /** Whether this section supports multi-badge execution */
  supportsMultiBadge: boolean
}

/**
 * Individual process step within a section.
 */
export interface SwsProcessStep {
  /** Step identifier */
  id: string

  /** Step text (may include sub-steps) */
  text: string

  /** Sub-steps (numbered 1, 2, 3, etc.) */
  subSteps?: string[]

  /** Whether this step is a key point (bold/red text) */
  isKeyPoint: boolean

  /** Whether this step requires a check-off */
  requiresCheckOff: boolean

  /** Special verification type that requires different user badge */
  verificationType?: 'PULL_TEST' | 'VISUAL' | 'NUTCERT' | '1444' | 'AENTR' | 'ISOLATION'

  /** Requires verification from different user (1444 or nutcert) */
  requiresVerification?: '1444' | 'nutcert'

  /** Step marked as Not Applicable */
  notApplicable?: boolean

  /** Notes for this step */
  notes?: string[]
}

/**
 * Special verification checkpoint (like 3/8" Nutcert, 1444 Verification, etc.)
 */
export interface SwsVerificationCheckpoint {
  id: string
  label: string
  description: string
  requiresAuditorStamp: boolean
  columnLabel?: string
}

// ============================================================================
// SWS FIELD DEFINITIONS
// ============================================================================

/**
 * Header field definition for SWS metadata.
 */
export interface SwsHeaderFieldDefinition {
  /** Field identifier */
  id: string

  /** Display label */
  label: string

  /** Field type */
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'

  /** Whether the field is required */
  required: boolean

  /** Whether the field can be auto-computed */
  canAutoCompute: boolean

  /** Width in the layout (percentage) */
  widthPercent: number

  /** Placeholder text */
  placeholder?: string

  /** Options for SELECT type */
  options?: string[]
}

/**
 * Mapping from computed data to SWS field.
 */
export interface SwsComputedFieldMapping {
  /** Target field ID in the SWS */
  fieldId: string

  /** Source path in the data model */
  sourcePath: string

  /** Transform function name */
  transform?: 'FORMAT_DATE' | 'FORMAT_NUMBER' | 'UPPERCASE' | 'TRUNCATE'

  /** Whether this mapping can be overridden */
  allowOverride: boolean
}

/**
 * Override policy for print mode.
 */
export interface SwsOverridePolicy {
  /** Fields that can be overridden in print sidebar */
  overridableFields: string[]

  /** Whether override requires reason */
  requiresOverrideReason: boolean

  /** Whether to log all overrides */
  logOverrides: boolean

  /** Maximum override count before warning */
  warnAfterOverrideCount: number
}

// ============================================================================
// SWS WORKSHEET DATA
// ============================================================================

/**
 * Complete data for an SWS worksheet instance.
 */
export interface SwsWorksheetData {
  /** Template being used */
  templateId: SwsTemplateId

  /** Execution mode */
  executionMode: SwsExecutionMode

  /** Project metadata */
  metadata: SwsWorksheetMetadata

  /** Section completion states */
  sections: SwsSectionState[]

  /** Override state (for print mode) */
  overrides: SwsWorksheetOverrideState

  /** Discrepancy tracking */
  discrepancies: SwsDiscrepancyEntry[]

  /** Comments */
  comments: string[]

  /** Timestamps */
  createdAt: string
  lastModifiedAt: string
  completedAt?: string
}

/**
 * Worksheet metadata (header fields).
 */
export interface SwsWorksheetMetadata {
  pdNumber: string
  projectName: string
  unit: string
  panel?: string
  box?: string
  bays?: string
  date: string
  revision: string
  swsIpvId: string
  revLevel: string
  revDate: string
}

/**
 * Section state for worksheet execution.
 */
export interface SwsSectionState {
  sectionId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED'
  completedBy?: string
  startTime?: string
  endTime?: string
  auditorStamp?: string
  checklistState: Record<string, boolean>
  comments: string[]
  discrepancyCounts: Record<string, number>
}

/**
 * Override state for print mode sidebar.
 */
export interface SwsWorksheetOverrideState {
  /** Overridden field values */
  fields: Record<string, string>

  /** Override reasons */
  reasons: Record<string, string>

  /** Who applied the overrides */
  overriddenBy?: string

  /** When overrides were applied */
  overriddenAt?: string

  /** Original values before override */
  originalValues: Record<string, string>
}

// ============================================================================
// TABLET MODE TYPES
// ============================================================================

/**
 * Badge stamp for section completion.
 */
export interface SwsSectionStamp {
  /** Badge number */
  badgeNumber: string

  /** Employee name */
  employeeName: string

  /** Timestamp */
  timestamp: string

  /** Stamp type */
  type: 'START' | 'COMPLETE' | 'AUDITOR' | 'VERIFICATION'

  /** Section ID */
  sectionId: string

  /** PIN verified */
  pinVerified: boolean
}

/**
 * Multi-badge activity tracking for tablet mode.
 */
export interface SwsTabletSectionActivity {
  sectionId: string
  badgeStamps: SwsSectionStamp[]
  startTimestamp?: string
  endTimestamp?: string
  durationMinutes?: number
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_AUDIT' | 'COMPLETE'
  auditorBadge?: string
  autoTimeStamped: boolean
}

/**
 * IPV code mapping for tablet mode.
 */
export interface SwsIpvCodeMapping {
  code: string
  description: string
  category: 'COMPONENT' | 'WIRE' | 'LABEL' | 'PROCESS' | 'OTHER'
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  requiresRework: boolean
}

/**
 * Discrepancy entry for quality tracking.
 */
export interface SwsDiscrepancyEntry {
  id: string
  code: string
  description: string
  count: number
  sectionId: string
  reportedBy: string
  reportedAt: string
  resolvedBy?: string
  resolvedAt?: string
  mrcaNumber?: string
  notes?: string
}

// ============================================================================
// DISCREPANCY CODES
// ============================================================================

/**
 * Standard discrepancy codes used across SWS types.
 * Based on the discrepancy code sections in the SWS PDFs.
 */
export const SWS_DISCREPANCY_CODES: SwsIpvCodeMapping[] = [
  // Component discrepancies
  { code: 'CD', description: 'Component Damaged', category: 'COMPONENT', severity: 'MAJOR', requiresRework: true },
  { code: 'CH', description: 'Component Hardware', category: 'COMPONENT', severity: 'MINOR', requiresRework: true },
  { code: 'CW', description: 'Component Wrong', category: 'COMPONENT', severity: 'MAJOR', requiresRework: true },
  { code: 'CM', description: 'Component Missing', category: 'COMPONENT', severity: 'MAJOR', requiresRework: true },

  // Label discrepancies
  { code: 'LA', description: 'Label Alignment', category: 'LABEL', severity: 'MINOR', requiresRework: false },
  { code: 'LD', description: 'Label Damaged', category: 'LABEL', severity: 'MINOR', requiresRework: true },
  { code: 'LI', description: 'Label Incorrect', category: 'LABEL', severity: 'MINOR', requiresRework: true },
  { code: 'LM', description: 'Label Missing', category: 'LABEL', severity: 'MINOR', requiresRework: true },
  { code: 'LV', description: 'Label Visibility', category: 'LABEL', severity: 'MINOR', requiresRework: false },

  // Process discrepancies
  { code: 'PC', description: 'Process Compliance', category: 'PROCESS', severity: 'MINOR', requiresRework: false },
  { code: 'PH', description: 'Process Hardware', category: 'PROCESS', severity: 'MINOR', requiresRework: true },
  { code: 'PP', description: 'Process Panduct', category: 'PROCESS', severity: 'MINOR', requiresRework: false },
  { code: 'PS', description: 'Process Shortage', category: 'PROCESS', severity: 'MAJOR', requiresRework: false },
  { code: 'PT', description: 'Process Torque', category: 'PROCESS', severity: 'MINOR', requiresRework: true },
  { code: 'PTW', description: 'Process Torque Witness', category: 'PROCESS', severity: 'MINOR', requiresRework: false },

  // Wire discrepancies
  { code: 'WB', description: 'Wire Bird Caging', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
  { code: 'WC', description: 'Wire Color', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
  { code: 'WE', description: 'Wire Exposed', category: 'WIRE', severity: 'CRITICAL', requiresRework: true },
  { code: 'WF', description: 'Wire Ferrule', category: 'WIRE', severity: 'MINOR', requiresRework: true },
  { code: 'WG', description: 'Wire Gauge', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
  { code: 'WI', description: 'Wire Insulation', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
  { code: 'WJ', description: 'Wire Jumper', category: 'WIRE', severity: 'MINOR', requiresRework: true },
  { code: 'WL', description: 'Wire Label', category: 'WIRE', severity: 'MINOR', requiresRework: true },
  { code: 'WM', description: 'Wire Missing', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
  { code: 'WP', description: 'Wire Polarity', category: 'WIRE', severity: 'CRITICAL', requiresRework: true },
  { code: 'WR', description: 'Wire Routing', category: 'WIRE', severity: 'MINOR', requiresRework: false },
  { code: 'WT', description: 'Wire Termination', category: 'WIRE', severity: 'MAJOR', requiresRework: true },
]

// ============================================================================
// SWS SELECTION AND AUTO-DETECTION
// ============================================================================

/**
 * Result of auto-detecting the appropriate SWS type.
 */
export interface SwsAutoDetectResult {
  detectedType: SwsTemplateId
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  reasons: string[]
  alternativeTypes: SwsTemplateId[]
}

/**
 * Record of an SWS type selection by Team Lead.
 * Captures both detected and selected values for audit trail.
 */
export interface SwsSelectionRecord {
  projectId: string
  assignmentId: string
  detectedType: SwsTemplateId
  selectedType: SwsTemplateId
  isOverride: boolean
  overrideReason?: string
  detectionConfidence: 'LOW' | 'MEDIUM' | 'HIGH'
  detectionReasons: string[]
  selectedAt: string
  selectedBy: string
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSwsTemplateId(value: string): value is SwsTemplateId {
  return [
    'PANEL_BUILD_WIRE',
    'PANEL_BUILD_WIRE',
    'BASIC_BLANK_PANEL',
    'BOX_BUILD_UP',
    'BOX_CROSS_WIRE',
    'CONSOLE_BUILD_UP_PANEL_HANG',
    'CONSOLE_CROSS_WIRE',
  ].includes(value)
}

export function isSwsCategory(value: string): value is SwsCategory {
  return ['PANEL', 'BOX', 'CONSOLE', 'CROSS_WIRE'].includes(value)
}

export function isSwsExecutionMode(value: string): value is SwsExecutionMode {
  return ['PRINT_MANUAL', 'TABLET_INTERACTIVE'].includes(value)
}
