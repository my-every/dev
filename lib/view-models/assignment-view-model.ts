/**
 * Assignment View Model Helpers
 * 
 * Pure functions for working with assignments in UI contexts.
 * Supports transitioning from pure sheets to assignment-oriented views.
 */

import { AssignmentRecord } from '@/types/d380-assignment'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { ASSIGNMENT_STAGES, STAGE_DISPLAY_CONFIG } from '@/types/d380-assignment-stages'
import { ProjectModel } from '@/lib/workbook/types'
import { mapSheetToAssignment, batchMapSheetsToAssignments } from '@/lib/assignment/assignment-adapter'

/**
 * Build assignments from a project.
 * Wraps all sheets as assignment records.
 */
export function buildAssignmentsFromProject(
  project: ProjectModel
): AssignmentRecord[] {
  const assignments: AssignmentRecord[] = []

  for (const sheet of project.sheets) {
    const summary = project.sheetSummaryMap.get(sheet.slug)
    if (summary) {
      const assignment = mapSheetToAssignment(summary, project.projectId)
      assignments.push(assignment)
    }
  }

  return assignments
}

/**
 * Group assignments by stage.
 * Returns a map of stage to assignment array.
 */
export function groupAssignmentsByStage(
  assignments: AssignmentRecord[]
): Map<AssignmentStageId, AssignmentRecord[]> {
  const groups = new Map<AssignmentStageId, AssignmentRecord[]>()
  ASSIGNMENT_STAGES.forEach(s => { groups.set(s.id, []) })
  for (const assignment of assignments) {
    const stage = assignment.selectedStage ?? 'KITTED'
    const group = groups.get(stage) ?? []
    group.push(assignment)
    groups.set(stage, group)
  }
  return groups
}

/**
 * Count assignments by stage.
 */
export function countAssignmentsByStage(
  assignments: AssignmentRecord[]
): Record<AssignmentStageId, number> {
  const counts = Object.fromEntries(ASSIGNMENT_STAGES.map(s => [s.id, 0])) as Record<AssignmentStageId, number>
  for (const assignment of assignments) {
    const stage = assignment.selectedStage ?? 'KITTED'
    counts[stage]++
  }
  return counts
}

/**
 * Filter assignments by criteria.
 */
export function filterAssignments(
  assignments: AssignmentRecord[],
  criteria: {
    stage?: AssignmentStageId
    swsType?: string
    isLate?: boolean
    readinessState?: string
  }
): AssignmentRecord[] {
  return assignments.filter(assignment => {
    if (criteria.stage && assignment.selectedStage !== criteria.stage) {
      return false
    }
    if (criteria.swsType && assignment.selectedSwsType !== criteria.swsType) {
      return false
    }
    if (criteria.isLate !== undefined && assignment.isLate !== criteria.isLate) {
      return false
    }
    if (criteria.readinessState && assignment.readinessState !== criteria.readinessState) {
      return false
    }
    return true
  })
}

/**
 * Get stage label for display.
 */
export function getStageLabel(stage: AssignmentStageId): string {
  return STAGE_DISPLAY_CONFIG[stage] ? (ASSIGNMENT_STAGES.find(s => s.id === stage)?.label ?? stage) : stage
}

/**
 * Calculate completion percentage across all assignments.
 */
export function calculateProjectCompletion(
  assignments: AssignmentRecord[]
): number {
  if (assignments.length === 0) return 0

  const completed = assignments.filter(a => a.selectedStage === 'BIQ').length
  return Math.round((completed / assignments.length) * 100)
}

/**
 * Calculate assignments by readiness state.
 */
export function calculateReadinessSummary(assignments: AssignmentRecord[]) {
  return {
    ready: assignments.filter(a => a.readinessState === 'READY').length,
    notReady: assignments.filter(a => a.readinessState === 'NOT_READY').length,
    blocked: assignments.filter(a => a.readinessState === 'BLOCKED').length,
  }
}

/**
 * Count assignments that need review.
 */
export function countReviewRequired(assignments: AssignmentRecord[]): number {
  return assignments.reduce((sum, a) => sum + (a.reviewRequiredCount ?? 0), 0)
}

/**
 * Get late assignments (if available).
 */
export function getLateAssignments(assignments: AssignmentRecord[]): AssignmentRecord[] {
  return assignments.filter(a => a.isLate === true)
}
