/**
 * Build Up Stage Progression
 * 
 * Handles the transition from BUILD_UP to READY_TO_WIRE
 * when a Build Up execution session completes.
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'
import { getSession, getCompletedSessions } from './build-up-execution-service'

// ============================================================================
// BUILD UP COMPLETION CHECK
// ============================================================================

/**
 * Check if an assignment's Build Up is complete.
 */
export function isBuildUpComplete(
  projectId: string,
  assignmentId: string
): boolean {
  const session = getSession(projectId, assignmentId)
  return session?.status === 'completed'
}

/**
 * Get Build Up completion timestamp.
 */
export function getBuildUpCompletedAt(
  projectId: string,
  assignmentId: string
): string | undefined {
  const session = getSession(projectId, assignmentId)
  return session?.completedAt
}

// ============================================================================
// STAGE PROGRESSION
// ============================================================================

/**
 * Determine the next stage after Build Up completion.
 * Based on whether the assignment has wire rows.
 */
export function getNextStageAfterBuildUp(
  assignment: MappedAssignment
): AssignmentStageId {
  // If assignment has wire rows, go to READY_TO_WIRE
  if (assignment.requiresWireSws) {
    return 'READY_TO_WIRE'
  }
  
  // Build-only assignments (no wires) go to READY_TO_HANG
  return 'READY_TO_HANG'
}

/**
 * Check if an assignment can progress from BUILD_UP.
 */
export function canProgressFromBuildUp(
  projectId: string,
  assignment: MappedAssignment
): {
  canProgress: boolean
  nextStage: AssignmentStageId
  reason: string
} {
  const isComplete = isBuildUpComplete(projectId, assignment.sheetSlug)
  const nextStage = getNextStageAfterBuildUp(assignment)
  
  if (!isComplete) {
    return {
      canProgress: false,
      nextStage,
      reason: 'Build Up execution session not completed',
    }
  }
  
  return {
    canProgress: true,
    nextStage,
    reason: 'Build Up execution complete, ready to progress',
  }
}

// ============================================================================
// PROJECT-LEVEL QUERIES
// ============================================================================

/**
 * Get all assignments with completed Build Up sessions.
 */
export function getAssignmentsWithCompletedBuildUp(
  projectId: string,
  assignments: MappedAssignment[]
): MappedAssignment[] {
  const completed = getCompletedSessions(projectId)
  const completedIds = new Set(Object.values(completed).map(s => s.assignmentId))
  
  return assignments.filter(a => completedIds.has(a.sheetSlug))
}

/**
 * Get Build Up progress summary for a project.
 */
export function getBuildUpProgressSummary(
  projectId: string,
  assignments: MappedAssignment[]
): {
  total: number
  notStarted: number
  inProgress: number
  completed: number
  percentage: number
} {
  const buildUpAssignments = assignments.filter(
    a => a.selectedStage === 'BUILD_UP' || a.selectedStage === 'KITTED'
  )
  
  const completedSessions = getCompletedSessions(projectId)
  const completedIds = new Set(Object.values(completedSessions).map(s => s.assignmentId))
  
  const completed = buildUpAssignments.filter(a => completedIds.has(a.sheetSlug)).length
  const inProgress = buildUpAssignments.filter(a => {
    const session = getSession(projectId, a.sheetSlug)
    return session?.status === 'in_progress'
  }).length
  const notStarted = buildUpAssignments.length - completed - inProgress
  
  return {
    total: buildUpAssignments.length,
    notStarted,
    inProgress,
    completed,
    percentage: buildUpAssignments.length > 0 
      ? Math.round((completed / buildUpAssignments.length) * 100)
      : 0,
  }
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Get Build Up session data for export/print.
 */
export function getBuildUpExportData(
  projectId: string,
  assignmentId: string
) {
  const session = getSession(projectId, assignmentId)
  if (!session) return null
  
  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    startedBy: session.startedBy,
    status: session.status,
    sections: session.sections.map(section => ({
      title: section.title,
      status: section.status,
      startedAt: section.startedAt,
      completedAt: section.completedAt,
      members: section.members.map(m => ({
        name: m.name,
        badgeId: m.badgeId,
        shift: m.shift,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
      })),
      steps: section.steps.map(step => ({
        label: step.label,
        completed: step.completed,
        completedAt: step.completedAt,
        completedBy: step.completedBy,
      })),
    })),
  }
}
