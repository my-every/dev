/**
 * Auto-Progression Service
 * 
 * Authoritative stage transition control layer.
 * All stage changes should go through this service.
 * 
 * Responsibilities:
 * - Validate transitions before allowing
 * - Determine if confirmation is required
 * - Apply transitions with audit trail
 * - Emit events for downstream systems
 * 
 * This is the single source of truth for stage progression logic.
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageDefinition } from '@/types/d380-assignment-stages'
import type {
  AssignmentDependencyNode,
  AssignmentDependencyGraph,
} from '@/types/d380-dependency-graph'
import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'
import { getStageOrderIndex, getStageFlowType, isValidTransition } from './stage-lifecycle'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of validating a stage transition.
 */
export interface StageTransitionValidation {
  /** Whether the transition is valid */
  isValid: boolean

  targetStage: AssignmentStageId

  /** Whether the user must confirm this transition */
  requiresConfirmation: boolean

  /** Warnings that don't block but should be displayed */
  warnings: TransitionWarning[]

  /** Blocking errors that prevent the transition */
  errors: TransitionError[]

  /** Human-readable summary */
  summary: string
}

/**
 * Warning for a stage transition (non-blocking).
 */
export interface TransitionWarning {
  code: string
  message: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

/**
 * Error that blocks a stage transition.
 */
export interface TransitionError {
  code: string
  message: string
  blockedBy?: string[]
}

/**
 * Result of applying a stage transition.
 */
export interface StageTransitionResult {
  /** Whether the transition succeeded */
  success: boolean

  previousStage: AssignmentStageId

  newStage?: AssignmentStageId

  /** Error message if failed */
  error?: string

  /** Events to emit */
  events: StageTransitionEvent[]

  /** Timestamp of the transition */
  timestamp: string

  /** Assignments that were unlocked by this transition */
  unlockedAssignments: string[]
}

/**
 * Event emitted when a stage transition occurs.
 */
export interface StageTransitionEvent {
  type: StageTransitionEventType
  projectId: string
  assignmentId: string
  payload: Record<string, unknown>
  timestamp: string
}

export type StageTransitionEventType =
  | 'STAGE_CHANGED'
  | 'ASSIGNMENT_UNLOCKED'
  | 'MILESTONE_REACHED'
  | 'CROSS_WIRE_READY'
  | 'TEST_READY'
  | 'POWER_CHECK_READY'
  | 'BIQ_READY'
  | 'PROJECT_COMPLETE'

/**
 * Context for stage transition operations.
 */
export interface StageTransitionContext {
  projectId: string
  assignmentId: string
  assignment: MappedAssignment
  graph: AssignmentDependencyGraph
  performedBy?: string
}

// ============================================================================
// CRITICAL TRANSITIONS (require confirmation)
// ============================================================================

/**
 * Stages that require confirmation before transitioning TO.
 */
const CONFIRMATION_REQUIRED_STAGES: AssignmentStageId[] = [
  'WIRING',
  'WIRING_IPV',
  'BOX_BUILD',
  'CROSS_WIRE',
  'CROSS_WIRE_IPV',
  'TEST_1ST_PASS',
  'POWER_CHECK',
  'BIQ',
]

/**
 * Project-level milestone stages.
 */
const MILESTONE_STAGES: AssignmentStageId[] = [
  'CROSS_WIRE',
  'TEST_1ST_PASS',
  'POWER_CHECK',
  'BIQ',
  'FINISHED_BIQ',
]

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a stage transition before applying it.
 */
export function validateStageTransition(
  ctx: StageTransitionContext,
  targetStage: AssignmentStageId
): StageTransitionValidation {
  const { assignment, graph } = ctx
  const currentStage = assignment.selectedStage
  const warnings: TransitionWarning[] = []
  const errors: TransitionError[] = []

  // 1. Check basic transition validity
  const flowType = getStageFlowType(
    assignment.requiresWireSws,
    assignment.requiresCrossWireSws,
    assignment.selectedSwsType
  )

  if (!isValidTransition(currentStage, targetStage, flowType, assignment.requiresCrossWireSws)) {
    errors.push({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition from ${getStageDefinition(currentStage)?.label ?? currentStage} to ${getStageDefinition(targetStage)?.label ?? targetStage}`,
    })
  }

  // 2. Check dependency graph blocking
  const node = graph.nodeIndex.get(assignment.sheetSlug)
  if (node) {
    const unsatisfiedDeps = node.dependencies.filter(d => !d.satisfied)
    if (unsatisfiedDeps.length > 0) {
      for (const dep of unsatisfiedDeps) {
        errors.push({
          code: 'DEPENDENCY_NOT_MET',
          message: dep.description,
          blockedBy: dep.requiredAssignmentId ? [dep.requiredAssignmentId] : undefined,
        })
      }
    }
  }

  // 3. Check cross-wire gate (project-level)
  if (targetStage === 'CROSS_WIRE') {
    const crossWireWarnings = getCrossWireTransitionWarnings(ctx)
    warnings.push(...crossWireWarnings)

    if (!graph.crossWireAvailable) {
      errors.push({
        code: 'CROSS_WIRE_NOT_READY',
        message: 'Cross-wiring gate not met – insufficient panels at box-build stage or beyond',
        blockedBy: graph.crossWireReadiness.blockedAssignments,
      })
    }
  }

  if (targetStage === 'TEST_1ST_PASS') {
    const testWarnings = getTestTransitionWarnings(ctx)
    warnings.push(...testWarnings)
  }

  // 5. Add general progression warnings
  const progressionWarnings = getStageTransitionWarnings(ctx, targetStage)
  warnings.push(...progressionWarnings)

  // Build result
  const isValid = errors.length === 0
  const requiresConfirmation = isValid && CONFIRMATION_REQUIRED_STAGES.includes(targetStage)

  let summary: string
  if (!isValid) {
    summary = `Cannot progress: ${errors[0].message}`
  } else if (requiresConfirmation) {
    summary = `Ready to progress to ${getStageDefinition(targetStage)?.label ?? targetStage}. Confirmation required.`
  } else {
    summary = `Ready to progress to ${getStageDefinition(targetStage)?.label ?? targetStage}`
  }

  return {
    isValid,
    targetStage,
    requiresConfirmation,
    warnings,
    errors,
    summary,
  }
}

/**
 * Get warnings specific to cross-wire transitions.
 */
function getCrossWireTransitionWarnings(ctx: StageTransitionContext): TransitionWarning[] {
  const warnings: TransitionWarning[] = []
  const { graph } = ctx

  const readiness = graph.crossWireReadiness

  if (readiness.readyToHangProgress < 75) {
    warnings.push({
      code: 'LOW_READY_TO_HANG',
      message: `Only ${Math.round(readiness.readyToHangProgress)}% of panels at box-build stage or beyond`,
      severity: readiness.readyToHangProgress < 60 ? 'HIGH' : 'MEDIUM',
    })
  }

  if (readiness.blockedAssignments.length > 0) {
    warnings.push({
      code: 'BLOCKED_CROSS_WIRE_ASSIGNMENTS',
      message: `${readiness.blockedAssignments.length} cross-wire assignments are blocked`,
      severity: 'MEDIUM',
    })
  }

  return warnings
}

/**
 * Get warnings specific to test transitions.
 */
function getTestTransitionWarnings(ctx: StageTransitionContext): TransitionWarning[] {
  const warnings: TransitionWarning[] = []
  const { graph } = ctx

  // Check if any cross-wire assignments are still in progress
  const crossWireInProgress = graph.nodes.filter(n =>
    (n.requiresCrossWireSws || n.swsType.includes('CROSS')) &&
    getStageOrderIndex(n.stage) < getStageOrderIndex('TEST_1ST_PASS')
  )

  if (crossWireInProgress.length > 0) {
    warnings.push({
      code: 'CROSS_WIRE_IN_PROGRESS',
      message: `${crossWireInProgress.length} cross-wire assignments still in progress`,
      severity: 'HIGH',
    })
  }

  return warnings
}

/**
 * Get general warnings for stage transitions.
 */
export function getStageTransitionWarnings(
  ctx: StageTransitionContext,
  targetStage: AssignmentStageId
): TransitionWarning[] {
  const warnings: TransitionWarning[] = []
  const { assignment, graph } = ctx

  // Check if assignment is late
  const node = graph.nodeIndex.get(assignment.sheetSlug)
  if (node?.isLate) {
    warnings.push({
      code: 'ASSIGNMENT_LATE',
      message: 'This assignment is marked as late',
      severity: 'MEDIUM',
    })
  }

  // Check if skipping stages
  const currentIndex = getStageOrderIndex(assignment.selectedStage)
  const targetIndex = getStageOrderIndex(targetStage)
  if (targetIndex - currentIndex > 1) {
    warnings.push({
      code: 'STAGE_SKIP',
      message: `Skipping ${targetIndex - currentIndex - 1} intermediate stage(s)`,
      severity: 'LOW',
    })
  }

  if (targetStage === 'WIRING_IPV' || targetStage === 'CROSS_WIRE_IPV') {
    warnings.push({
      code: 'IPV_REQUIRED',
      message: 'This transition requires IPV completion verification',
      severity: 'LOW',
    })
  }

  return warnings
}

// ============================================================================
// APPLICATION
// ============================================================================

/**
 * Apply a stage transition after validation.
 * Returns the result with events to emit.
 */
export function applyStageTransition(
  ctx: StageTransitionContext,
  targetStage: AssignmentStageId,
  validation: StageTransitionValidation
): StageTransitionResult {
  const { projectId, assignmentId, assignment, graph } = ctx
  const timestamp = new Date().toISOString()
  const events: StageTransitionEvent[] = []

  if (!validation.isValid) {
    return {
      success: false,
      previousStage: assignment.selectedStage,
      error: validation.errors[0]?.message || 'Transition validation failed',
      events: [],
      timestamp,
      unlockedAssignments: [],
    }
  }

  const previousStage = assignment.selectedStage

  // 1. Emit stage changed event
  events.push({
    type: 'STAGE_CHANGED',
    projectId,
    assignmentId,
    payload: {
      previousStage,
      newStage: targetStage,
      performedBy: ctx.performedBy,
    },
    timestamp,
  })

  // 2. Check for milestone events
  if (MILESTONE_STAGES.includes(targetStage)) {
    events.push({
      type: 'MILESTONE_REACHED',
      projectId,
      assignmentId,
      payload: {
        milestone: targetStage,
        milestoneLabel: getStageDefinition(targetStage)?.label ?? targetStage,
      },
      timestamp,
    })
  }

  // 3. Check for project-level gate events
  if (targetStage === 'CROSS_WIRE' && !graph.crossWireAvailable) {
    // First assignment to reach cross-wire, gate opens
    events.push({
      type: 'CROSS_WIRE_READY',
      projectId,
      assignmentId,
      payload: {
        readyToHangProgress: graph.crossWireReadiness.readyToHangProgress,
        boxBuildProgress: graph.crossWireReadiness.boxBuildProgress,
      },
      timestamp,
    })
  }

  if (targetStage === 'TEST_1ST_PASS') {
    events.push({
      type: 'TEST_READY',
      projectId,
      assignmentId,
      payload: {},
      timestamp,
    })
  }

  if (targetStage === 'POWER_CHECK') {
    events.push({
      type: 'POWER_CHECK_READY',
      projectId,
      assignmentId,
      payload: {},
      timestamp,
    })
  }

  if (targetStage === 'BIQ') {
    events.push({
      type: 'BIQ_READY',
      projectId,
      assignmentId,
      payload: {},
      timestamp,
    })
  }

  if (targetStage === 'BIQ') {
    // Check if all assignments are now complete
    const allComplete = graph.nodes.every(n =>
      n.assignmentId === assignmentId ? true : n.stage === 'FINISHED_BIQ'
    )

    if (allComplete) {
      events.push({
        type: 'PROJECT_COMPLETE',
        projectId,
        assignmentId,
        payload: {
          completedAt: timestamp,
          totalAssignments: graph.nodes.length,
        },
        timestamp,
      })
    }
  }

  // 4. Determine which assignments would be unlocked
  const unlockedAssignments = findUnlockedAssignments(ctx, targetStage)

  for (const unlockedId of unlockedAssignments) {
    events.push({
      type: 'ASSIGNMENT_UNLOCKED',
      projectId,
      assignmentId: unlockedId,
      payload: {
        unlockedBy: assignmentId,
        triggeringStage: targetStage,
      },
      timestamp,
    })
  }

  return {
    success: true,
    previousStage,
    newStage: targetStage,
    events,
    timestamp,
    unlockedAssignments,
  }
}

/**
 * Find assignments that would be unlocked by this transition.
 */
function findUnlockedAssignments(
  ctx: StageTransitionContext,
  targetStage: AssignmentStageId
): string[] {
  const { graph, assignmentId } = ctx
  const unlocked: string[] = []

  if (targetStage === 'BOX_BUILD') {
    for (const node of graph.nodes) {
      if (node.assignmentId === assignmentId) continue
      if (!node.requiresCrossWireSws && !node.swsType.includes('CROSS')) continue
      const wasBlockedByPanels = node.dependencies.some(d =>
        d.kind === 'CROSS_WIRE_GATE' && !d.satisfied
      )
      if (wasBlockedByPanels) {
        unlocked.push(node.assignmentId)
      }
    }
  }

  return unlocked
}

// ============================================================================
// AUTO-PROGRESSION HELPERS
// ============================================================================

/**
 * Get the auto-suggested next stage for an assignment.
 */
export function getAutoNextStage(
  ctx: StageTransitionContext
): { nextStage: AssignmentStageId | undefined; reasons: string[] } {
  const { assignment, graph } = ctx
  const node = graph.nodeIndex.get(assignment.sheetSlug)

  if (!node) {
    return { nextStage: undefined, reasons: ['Assignment not found in dependency graph'] }
  }

  if (assignment.selectedStage === 'FINISHED_BIQ') {
    return { nextStage: undefined, reasons: ['Assignment is complete'] }
  }

  const unsatisfied = node.dependencies.filter(d => !d.satisfied)
  if (unsatisfied.length > 0) {
    return { nextStage: undefined, reasons: unsatisfied.map(d => d.reason || d.description) }
  }

  return { nextStage: node.nextSuggestedStage, reasons: node.readinessReasons }
}

/**
 * Check if an assignment can auto-progress (no confirmation needed).
 */
export function canAutoProgress(
  ctx: StageTransitionContext,
  targetStage: AssignmentStageId
): boolean {
  // Never auto-progress to confirmation-required stages
  if (CONFIRMATION_REQUIRED_STAGES.includes(targetStage)) {
    return false
  }

  const validation = validateStageTransition(ctx, targetStage)
  return validation.isValid && !validation.requiresConfirmation && validation.warnings.length === 0
}

/**
 * Get all assignments that are ready for auto-progression.
 */
export function getAutoProgressionCandidates(
  projectId: string,
  assignments: MappedAssignment[],
  graph: AssignmentDependencyGraph
): Array<{ assignmentId: string; currentStage: AssignmentStageId; nextStage: AssignmentStageId }> {
  const candidates: Array<{ assignmentId: string; currentStage: AssignmentStageId; nextStage: AssignmentStageId }> = []

  for (const assignment of assignments) {
    const ctx: StageTransitionContext = {
      projectId,
      assignmentId: assignment.sheetSlug,
      assignment,
      graph,
    }

    const { nextStage } = getAutoNextStage(ctx)

    if (nextStage && canAutoProgress(ctx, nextStage)) {
      candidates.push({
        assignmentId: assignment.sheetSlug,
        currentStage: assignment.selectedStage,
        nextStage,
      })
    }
  }

  return candidates
}
