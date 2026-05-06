/**
 * Due Date Service
 * 
 * Handles due date logic for assignments and projects.
 * Provides real late-state derivation instead of hardcoded false.
 * 
 * Features:
 * - Calculate days until due / days overdue
 * - Determine late state based on current stage
 * - Estimate completion based on stage progression
 * - Warning thresholds for approaching deadlines
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageOrderIndex } from './stage-lifecycle'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Due date information for an assignment.
 */
export interface AssignmentDueDate {
  /** The assignment ID */
  assignmentId: string
  
  /** Due date as ISO string (if set) */
  dueDate?: string
  
  /** Project-level target completion date (if set) */
  projectTargetDate?: string
}

/**
 * Late state result for an assignment.
 */
export interface LateStateResult {
  /** Whether the assignment is late */
  isLate: boolean
  
  /** Days overdue (negative = days remaining) */
  daysOverdue: number
  
  /** Warning level */
  warningLevel: 'NONE' | 'APPROACHING' | 'IMMINENT' | 'OVERDUE' | 'CRITICAL'
  
  /** Human-readable status */
  status: string
  
  /** Whether notification should be shown */
  shouldNotify: boolean
}

/**
 * Estimated completion result.
 */
export interface CompletionEstimate {
  /** Estimated completion date */
  estimatedDate?: string
  
  /** Whether estimate is likely to meet due date */
  willMeetDeadline: boolean
  
  /** Days of slack (positive) or overrun (negative) */
  slackDays: number
  
  /** Confidence in estimate */
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  
  /** Basis for estimate */
  reason: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Warning threshold - days before due date to show "approaching" warning */
const APPROACHING_THRESHOLD_DAYS = 7

/** Warning threshold - days before due date to show "imminent" warning */
const IMMINENT_THRESHOLD_DAYS = 2

/** Critical threshold - days overdue to escalate to "critical" */
const CRITICAL_THRESHOLD_DAYS = 3

/** Estimated days per stage (rough average) */
const ESTIMATED_DAYS_PER_STAGE: Partial<Record<AssignmentStageId, number>> = {
  BUILD_UP: 2,
  WIRING: 3,
  WIRING_IPV: 0.5,
  BOX_BUILD: 2,
  CROSS_WIRE: 2,
  CROSS_WIRE_IPV: 0.5,
  TEST_1ST_PASS: 1,
  POWER_CHECK: 1,
  BIQ: 0,
}

// ============================================================================
// LATE STATE CALCULATION
// ============================================================================

/**
 * Calculate the late state for an assignment.
 */
export function calculateLateState(
  dueDate: string | undefined,
  currentStage: AssignmentStageId,
  now: Date = new Date()
): LateStateResult {
  // No due date = not late
  if (!dueDate) {
    return {
      isLate: false,
      daysOverdue: 0,
      warningLevel: 'NONE',
      status: 'No due date set',
      shouldNotify: false,
    }
  }
  
  // Already complete = not late
  if (currentStage === 'BIQ') {
    return {
      isLate: false,
      daysOverdue: 0,
      warningLevel: 'NONE',
      status: 'Completed',
      shouldNotify: false,
    }
  }
  
  const dueDateObj = new Date(dueDate)
  const diffMs = dueDateObj.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const daysOverdue = -diffDays // Positive = overdue, negative = days remaining
  
  // Determine warning level
  let warningLevel: LateStateResult['warningLevel']
  let status: string
  let shouldNotify = false
  
  if (daysOverdue > CRITICAL_THRESHOLD_DAYS) {
    warningLevel = 'CRITICAL'
    status = `${Math.floor(daysOverdue)} days overdue - CRITICAL`
    shouldNotify = true
  } else if (daysOverdue > 0) {
    warningLevel = 'OVERDUE'
    status = `${Math.ceil(daysOverdue)} day(s) overdue`
    shouldNotify = true
  } else if (-daysOverdue <= IMMINENT_THRESHOLD_DAYS) {
    warningLevel = 'IMMINENT'
    status = `Due in ${Math.ceil(-daysOverdue)} day(s)`
    shouldNotify = true
  } else if (-daysOverdue <= APPROACHING_THRESHOLD_DAYS) {
    warningLevel = 'APPROACHING'
    status = `Due in ${Math.ceil(-daysOverdue)} days`
    shouldNotify = false
  } else {
    warningLevel = 'NONE'
    status = `Due in ${Math.ceil(-daysOverdue)} days`
    shouldNotify = false
  }
  
  return {
    isLate: daysOverdue > 0,
    daysOverdue: Math.round(daysOverdue),
    warningLevel,
    status,
    shouldNotify,
  }
}

/**
 * Get warning color for late state.
 */
export function getLateStateColor(warningLevel: LateStateResult['warningLevel']): {
  text: string
  bg: string
  border: string
} {
  switch (warningLevel) {
    case 'CRITICAL':
      return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
    case 'OVERDUE':
      return { text: 'text-red-600', bg: 'bg-red-50/50', border: 'border-red-100' }
    case 'IMMINENT':
      return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
    case 'APPROACHING':
      return { text: 'text-amber-600', bg: 'bg-amber-50/50', border: 'border-amber-100' }
    case 'NONE':
    default:
      return { text: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-muted' }
  }
}

// ============================================================================
// COMPLETION ESTIMATION
// ============================================================================

/**
 * Estimate completion date based on current stage and historical averages.
 */
export function estimateCompletion(
  currentStage: AssignmentStageId,
  dueDate?: string,
  startDate?: string,
  now: Date = new Date()
): CompletionEstimate {
  // Get remaining stages
  const currentIndex = getStageOrderIndex(currentStage)
  const terminalIndex = getStageOrderIndex('FINISHED_BIQ')
  
  // Calculate estimated days remaining
  let estimatedDaysRemaining = 0
  const allStages: AssignmentStageId[] = [
    'BUILD_UP',
    'WIRING',
    'WIRING_IPV',
    'BOX_BUILD',
    'CROSS_WIRE',
    'CROSS_WIRE_IPV',
    'TEST_1ST_PASS',
    'POWER_CHECK',
    'BIQ',
    'FINISHED_BIQ',
  ]
  
  for (const stage of allStages) {
    const stageIndex = getStageOrderIndex(stage)
    if (stageIndex > currentIndex) {
      estimatedDaysRemaining += ESTIMATED_DAYS_PER_STAGE[stage] || 1
    }
  }
  
  // Calculate estimated completion date
  const estimatedDate = new Date(now)
  estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(estimatedDaysRemaining))
  
  // Compare with due date
  let willMeetDeadline = true
  let slackDays = 0
  
  if (dueDate) {
    const dueDateObj = new Date(dueDate)
    slackDays = Math.round((dueDateObj.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24))
    willMeetDeadline = slackDays >= 0
  }
  
  // Determine confidence
  let confidence: CompletionEstimate['confidence']
  if (currentIndex >= terminalIndex - 3) {
    confidence = 'HIGH' // Close to completion
  } else if (currentIndex >= terminalIndex - 7) {
    confidence = 'MEDIUM'
  } else {
    confidence = 'LOW' // Many stages remaining
  }
  
  const reason = `Based on ${Math.round(estimatedDaysRemaining)} estimated days for ${terminalIndex - currentIndex} remaining stages`
  
  return {
    estimatedDate: estimatedDate.toISOString(),
    willMeetDeadline,
    slackDays,
    confidence,
    reason,
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Calculate late state for multiple assignments.
 */
export function calculateBatchLateState(
  assignments: Array<{
    assignmentId: string
    dueDate?: string
    currentStage: AssignmentStageId
  }>,
  now: Date = new Date()
): Map<string, LateStateResult> {
  const results = new Map<string, LateStateResult>()
  
  for (const assignment of assignments) {
    results.set(
      assignment.assignmentId,
      calculateLateState(assignment.dueDate, assignment.currentStage, now)
    )
  }
  
  return results
}

/**
 * Get assignments that are late or approaching due date.
 */
export function getUrgentAssignments(
  assignments: Array<{
    assignmentId: string
    assignmentName: string
    dueDate?: string
    currentStage: AssignmentStageId
  }>,
  now: Date = new Date()
): Array<{
  assignmentId: string
  assignmentName: string
  lateState: LateStateResult
}> {
  const urgent: Array<{
    assignmentId: string
    assignmentName: string
    lateState: LateStateResult
  }> = []
  
  for (const assignment of assignments) {
    const lateState = calculateLateState(assignment.dueDate, assignment.currentStage, now)
    
    if (lateState.warningLevel !== 'NONE') {
      urgent.push({
        assignmentId: assignment.assignmentId,
        assignmentName: assignment.assignmentName,
        lateState,
      })
    }
  }
  
  // Sort by urgency (most critical first)
  return urgent.sort((a, b) => {
    const levelOrder = ['CRITICAL', 'OVERDUE', 'IMMINENT', 'APPROACHING', 'NONE']
    return levelOrder.indexOf(a.lateState.warningLevel) - levelOrder.indexOf(b.lateState.warningLevel)
  })
}

// ============================================================================
// PROJECT-LEVEL DUE DATE
// ============================================================================

/**
 * Calculate project completion estimate.
 */
export function calculateProjectCompletionEstimate(
  assignments: Array<{
    assignmentId: string
    currentStage: AssignmentStageId
    dueDate?: string
  }>,
  projectTargetDate?: string,
  now: Date = new Date()
): {
  latestEstimatedCompletion: string
  assignmentsOnTrack: number
  assignmentsAtRisk: number
  assignmentsOverdue: number
  projectWillMeetTarget: boolean
  criticalPathAssignments: string[]
} {
  let latestCompletion = now
  let assignmentsOnTrack = 0
  let assignmentsAtRisk = 0
  let assignmentsOverdue = 0
  const criticalPath: string[] = []
  
  for (const assignment of assignments) {
    const estimate = estimateCompletion(assignment.currentStage, assignment.dueDate, undefined, now)
    const lateState = calculateLateState(assignment.dueDate, assignment.currentStage, now)
    
    // Track latest completion
    if (estimate.estimatedDate) {
      const estimatedDate = new Date(estimate.estimatedDate)
      if (estimatedDate > latestCompletion) {
        latestCompletion = estimatedDate
        criticalPath.push(assignment.assignmentId)
      }
    }
    
    // Track status
    if (lateState.isLate) {
      assignmentsOverdue++
    } else if (!estimate.willMeetDeadline) {
      assignmentsAtRisk++
    } else {
      assignmentsOnTrack++
    }
  }
  
  // Check against project target
  let projectWillMeetTarget = true
  if (projectTargetDate) {
    const targetDate = new Date(projectTargetDate)
    projectWillMeetTarget = latestCompletion <= targetDate
  }
  
  return {
    latestEstimatedCompletion: latestCompletion.toISOString(),
    assignmentsOnTrack,
    assignmentsAtRisk,
    assignmentsOverdue,
    projectWillMeetTarget,
    criticalPathAssignments: criticalPath.slice(-3), // Last 3 on critical path
  }
}
