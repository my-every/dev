/**
 * Assignment Dispatch & Sort Types
 *
 * Defines the dispatch scoring model, sort dimensions, worker allocation
 * metrics, and shift balancing metrics used by supervisors and dispatchers
 * to prioritize and allocate assignments.
 *
 * Dispatch score formula:
 *   dispatchScore =
 *     (overdue ? 100 : 0)
 *     + (commitRiskScore * 20)
 *     + (isBlocking ? 15 : 0)
 *     + (skillMatchScore * 10)
 *     + (speedScore * 8)
 *     - (assigneeUtilizationRate * 10)
 *     - (handoffDelayRisk * 5)
 *     - (blockedRisk * 10)
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { ShiftId } from '@/types/d380-shift-calendar'

// ── Sort dimension groups ─────────────────────────────────────────────────

export type DispatchSortDimension =
    // Time urgency
    | 'commitDate_asc'
    | 'dueAt_asc'
    | 'overdue_desc'
    | 'overdueByMinutes_desc'
    // Execution risk
    | 'commitRiskScore_desc'
    | 'blockingDependencyCount_desc'
    | 'stageJumpCount_desc'
    | 'blockedMinutes_desc'
    // Capacity fit
    | 'skillMatchScore_desc'
    | 'speedScore_desc'
    | 'shiftAvailability_desc'
    | 'shiftLoadVariance_asc'
    // Throughput optimization
    | 'estimatedMinutes_asc'
    | 'priorityScore_desc'
    | 'remainingMinutes_asc'
    | 'sameStageBatching_desc'
    | 'samePanelOrZoneBatching_desc'
    // Labor fairness
    | 'utilizationRate_asc'
    | 'wipCount_asc'
    | 'reassignmentCount_asc'

// ── Worker allocation metrics ─────────────────────────────────────────────

export interface WorkerAllocationMetrics {
    badge: string
    shiftId: ShiftId

    /** 0–1 score: how well assignee skills match assignment requirements. */
    assigneeSkillMatchScore: number
    /** 0–1 score: assignee historical speed (cycle time vs. peer average). */
    assigneeSpeedScore: number
    /** 0–1 score: assignee quality/defect history. */
    assigneeQualityScore: number
    /** 0–1 score: assignee on-time reliability. */
    assigneeReliabilityScore: number

    /** Available working minutes remaining in current shift. */
    assigneeShiftAvailabilityMinutes: number
    /** 0–1 rate: currently committed minutes / available minutes. */
    assigneeUtilizationRate: number
    /** Active work-in-progress assignment count. */
    assigneeWipCount: number
}

// ── Shift balancing metrics ───────────────────────────────────────────────

export interface ShiftBalancingMetrics {
    shift1AvailableMinutes: number
    shift2AvailableMinutes: number
    shift1AssignedMinutes: number
    shift2AssignedMinutes: number
    shift1BacklogMinutes: number
    shift2BacklogMinutes: number
    /** Variance between shift committed loads (lower = more balanced). */
    shiftLoadVariance: number
    /** 0–1: proportion of required skill-minutes covered by shift. */
    shiftSkillCoverage: number
}

// ── Priority and risk metrics ─────────────────────────────────────────────

export interface AssignmentPriorityMetrics {
    /** Calendar days until project commit date (negative = overdue). */
    daysUntilCommitDate: number
    /** 0–100 composite risk score for the parent project. */
    projectCommitRiskScore: number
    /** Composite priority score used in dispatch sort. */
    assignmentPriorityScore: number

    /** Number of assignments that cannot start until this one completes. */
    blockingDependencyCount: number
    /** Depth of the blocking chain downstream of this assignment. */
    blockingChainDepth: number

    /** Remaining estimated minutes for the project. */
    projectRemainingMinutes: number
    /** Count of incomplete assignments remaining in the project. */
    projectRemainingAssignments: number
    /** Skill-weighted minutes still required to complete the project. */
    projectRequiredSkillMinutes: number

    /** True if this assignment is currently blocking others. */
    isBlocking: boolean
}

// ── Stage jump score inputs ───────────────────────────────────────────────

export interface StageJumpMetrics {
    /** Total number of stage jumps on this assignment. */
    stageJumpCount: number
    /** Total number of individual stages bypassed across all jumps. */
    skippedStageCount: number
}

// ── Full dispatch candidate record ───────────────────────────────────────

/**
 * Assembled per assignment for dispatch-sorting. Combines raw metrics
 * and the computed dispatch score for sorting, display, and audit.
 */
export interface AssignmentDispatchCandidate {
    assignmentId: string
    pdNumber: string
    projectName: string
    sheetSlug: string
    sheetName: string
    currentStage: AssignmentStageId

    // ── Source score inputs ─────────────────────────────────────────────
    overdue: boolean
    overdueByMinutes: number
    commitRiskScore: number
    isBlocking: boolean
    skillMatchScore: number
    speedScore: number
    assigneeUtilizationRate: number
    handoffDelayRisk: number
    blockedRisk: number

    // ── Composite metrics ───────────────────────────────────────────────
    worker: WorkerAllocationMetrics
    priority: AssignmentPriorityMetrics
    stageJumps: StageJumpMetrics
    shiftBalance: ShiftBalancingMetrics

    // ── Computed dispatch score ─────────────────────────────────────────
    /**
     * Higher score = higher dispatch priority.
     * Formula:
     *   dispatchScore =
     *     (overdue ? 100 : 0) +
     *     (commitRiskScore * 20) +
     *     (isBlocking ? 15 : 0) +
     *     (skillMatchScore * 10) +
     *     (speedScore * 8) -
     *     (assigneeUtilizationRate * 10) -
     *     (handoffDelayRisk * 5) -
     *     (blockedRisk * 10)
     */
    dispatchScore: number

    /** Active sort dimension applied when this candidate was scored. */
    activeSortDimension: DispatchSortDimension

    /** ISO timestamp when this candidate record was computed. */
    scoredAt: string
}

// ── Dispatch sort request & result ───────────────────────────────────────

export interface DispatchSortRequest {
    /** IDs of assignments to sort. */
    assignmentIds: string[]
    /** Primary sort dimension. */
    primaryDimension: DispatchSortDimension
    /** Secondary tiebreaker dimension. */
    secondaryDimension?: DispatchSortDimension
    /** Filter to a specific shift. */
    shiftId?: ShiftId
}

export interface DispatchSortResult {
    sortedCandidates: AssignmentDispatchCandidate[]
    primaryDimension: DispatchSortDimension
    secondaryDimension?: DispatchSortDimension
    scoredAt: string
    candidateCount: number
}
