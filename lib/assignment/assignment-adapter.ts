/**
 * Assignment Adapter
 * 
 * Converts sheet data to assignment records without breaking existing logic.
 * This is a soft wrapper layer that allows gradual migration to the assignment model.
 */

import { ProjectSheetSummary } from '@/lib/workbook/types'
import { AssignmentRecord } from '@/types/d380-assignment'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Map a sheet to an assignment record.
 * 
 * Creates a new AssignmentRecord from sheet data.
 * Assigns default values that can be overridden by Team Lead.
 * 
 * @param sheet - The sheet to map
 * @param projectId - The project ID
 * @returns Assignment record
 */
export function mapSheetToAssignment(
  sheet: ProjectSheetSummary,
  projectId: string
): AssignmentRecord {
  const now = new Date().toISOString()

  return {
    assignmentId: generateId(),
    projectId,
    sourceSheetSlug: sheet.slug,
    sourceSheetName: sheet.name,
    rowCount: sheet.wireCount ?? 0,

    // SWS detection will be populated by auto-detection helpers
    detectedSwsType: undefined,
    detectedConfidence: undefined,
    detectedReasons: undefined,

    // Team Lead will select these
    selectedSwsType: undefined,
    selectedStage: 'KITTED',

    // Initial state
    readinessState: 'NOT_READY',
    isLate: false,
    reviewRequiredCount: 0,

    createdAt: now,
    updatedAt: now,
  }
}

export function getSuggestedStageForSwsType(swsType: string): AssignmentStageId {
  const stageMap: Record<string, AssignmentStageId> = {
    PANEL_BUILD_WIRE: 'KITTED',
    PANEL_BUILD_WIRE: 'KITTED',
    BASIC_BLANK_PANEL: 'KITTED',
    CONSOLE_BUILD_UP_PANEL_HANG: 'KITTED',
    BOX_BUILD_UP: 'KITTED',
    BOX_CROSS_WIRE: 'CROSS_WIRING',
    CONSOLE_CROSS_WIRE: 'CROSS_WIRING',
  }
  return stageMap[swsType] ?? 'KITTED'
}

/**
 * Merge assignment overrides into a base assignment.
 * Used when Team Lead selects SWS type and stage.
 * 
 * @param baseAssignment - The initial assignment
 * @param overrides - Partial assignment data to merge
 * @returns Merged assignment
 */
export function mergeAssignmentOverrides(
  baseAssignment: AssignmentRecord,
  overrides: Partial<AssignmentRecord>
): AssignmentRecord {
  return {
    ...baseAssignment,
    ...overrides,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Batch convert sheets to assignments.
 * Returns a map of sheet slug to assignment.
 * 
 * @param sheets - Array of sheets
 * @param projectId - The project ID
 * @returns Map of sheet slug to assignment
 */
export function batchMapSheetsToAssignments(
  sheets: ProjectSheetSummary[],
  projectId: string
): Map<string, AssignmentRecord> {
  const assignments = new Map<string, AssignmentRecord>()

  for (const sheet of sheets) {
    const assignment = mapSheetToAssignment(sheet, projectId)
    assignments.set(sheet.slug, assignment)
  }

  return assignments
}

/**
 * Convert assignment back to a sheet-like view for backwards compatibility.
 * This allows existing wire-list components to continue working.
 * 
 * @param assignment - The assignment
 * @param sheet - The original sheet (for full data)
 * @returns Sheet-compatible data
 */
export function assignmentToSheetView(
  assignment: AssignmentRecord,
  sheet: ProjectSheetSummary
) {
  return {
    ...sheet,
    slug: assignment.sourceSheetSlug,
    name: assignment.sourceSheetName,
    // Add assignment metadata as extended properties
    _assignmentId: assignment.assignmentId,
    _assignmentStage: assignment.selectedStage,
    _swsType: assignment.selectedSwsType,
    _readinessState: assignment.readinessState,
  }
}
