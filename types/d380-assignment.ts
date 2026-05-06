/**
 * Assignment Record Types
 *
 * Sheet-level classification, SWS detection, and status types.
 * Stage types are defined exclusively in types/d380-assignment-stages.ts.
 */

import type { AssignmentStageId, AssignmentStageHours, SwsTypeId } from '@/types/d380-assignment-stages'

// ============================================================================
// SHEET CLASSIFICATION
// ============================================================================

export type WorkbookSheetKind = 'assignment' | 'reference' | 'other'

export const REFERENCE_SHEET_NAMES = [
  'Panel Errors',
  'Blue Labels',
  'White Labels',
  'Heat Shrink Labels',
  'Cable Part Numbers',
  'Part Number List',
] as const

export const REFERENCE_SHEET_PATTERNS = REFERENCE_SHEET_NAMES.map(name =>
  name.toLowerCase().trim()
)

// ============================================================================
// ASSIGNMENT STATUS
// ============================================================================

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'INCOMPLETE' | 'COMPLETE'

export const ASSIGNMENT_STATUS_CONFIG: Record<AssignmentStatus, {
  label: string
  description: string
  color: string
  actionLabel: string
}> = {
  NOT_STARTED: {
    label: 'Not Started',
    description: 'No work has been started on this assignment',
    color: 'slate',
    actionLabel: 'Start',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    description: 'Work is currently being performed',
    color: 'green',
    actionLabel: 'Continue',
  },
  INCOMPLETE: {
    label: 'Incomplete',
    description: 'Work was paused and needs to be resumed',
    color: 'amber',
    actionLabel: 'Continue',
  },
  COMPLETE: {
    label: 'Complete',
    description: 'Work is complete, ready for review or next stage',
    color: 'blue',
    actionLabel: 'Review',
  },
}

// ============================================================================
// DETECTION SUMMARY
// ============================================================================

export type AssignmentReadinessState = 'NOT_READY' | 'READY' | 'BLOCKED'

export interface AssignmentDetectionSummary {
  sheetKind: WorkbookSheetKind
  hasPanelNumber: boolean
  hasWireRows: boolean
  hasExternalLocations: boolean
  layoutTitle?: string
  inferredStructureType: 'PANEL' | 'RAIL' | 'COMPONENT' | 'BOX' | 'UNKNOWN'
  suggestedSwsType: string
  confidence: number
  reasons: string[]
  requiresWireSws: boolean
  requiresCrossWireSws: boolean
}

export interface AssignmentSwsSelectionRecord {
  assignmentId: string
  detectedSwsType: string
  detectedConfidence: 'LOW' | 'MEDIUM' | 'HIGH'
  detectedReasons: string[]
  selectedSwsType: string
  isOverride: boolean
  overrideReason?: string
  selectedAt: string
  selectedBy: string
}

// ============================================================================
// ASSIGNMENT RECORD
// ============================================================================

export interface AssignmentRecord {
  assignmentId: string
  projectId: string
  sourceSheetSlug: string
  sourceSheetName: string
  rowCount: number
  sheetKind: WorkbookSheetKind
  detectionSummary?: AssignmentDetectionSummary
  detectedSwsType?: string
  detectedConfidence?: 'LOW' | 'MEDIUM' | 'HIGH'
  detectedReasons?: string[]
  selectedSwsType?: SwsTypeId
  selectedStage?: AssignmentStageId
  readinessState?: AssignmentReadinessState
  isLate?: boolean
  reviewRequiredCount?: number
  requiresWireSws?: boolean
  requiresCrossWireSws?: boolean
  /** Per-stage hours tracking (est / avg / actual) */
  stageHours?: Partial<Record<AssignmentStageId, AssignmentStageHours>>
  createdAt: string
  updatedAt: string
}

export type AssignmentExecutionMode = 'PRINT_MANUAL' | 'TABLET_INTERACTIVE'

