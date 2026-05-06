/**
 * Assignment SLA & Timing Metrics Types
 *
 * Defines SLA thresholds, overdue conditions, and the complete set of
 * timing/performance metrics captured per assignment. All time values
 * are in working minutes (shift-adjusted, not wall-clock) unless the
 * field name explicitly ends in "WallClockMinutes".
 *
 * SLA rules confirmed:
 *   Start SLA           = 8 working hours (480 working minutes)
 *   Completion SLA      = size-based (size tiers in d380-assignment-ledger.ts)
 *     small  → 2 working days (960 min)
 *     medium → 3 working days (1440 min)
 *     large  → 5 working days (2400 min)
 *     xlarge → project-driven staged target (tracked via dueAt)
 *   Overdue condition   = now > dueAt && status NOT IN ['completed','cancelled']
 *
 * Measurement uses shift-working hours, not wall-clock hours.
 */

import type { AssignmentSizeTier } from '@/types/d380-assignment-ledger'
import type { ShiftId } from '@/types/d380-shift-calendar'

// ── SLA threshold constants ───────────────────────────────────────────────

export const SLA_START_WORKING_MINUTES = 480 // 8 working hours

export const SLA_COMPLETION_WORKING_MINUTES: Record<AssignmentSizeTier, number | null> = {
    small: 960,   // 2 working days
    medium: 1440,  // 3 working days
    large: 2400,  // 5 working days
    xlarge: null,  // project-driven — use dueAt
}

// ── Working-days to minutes helper constants ──────────────────────────────

/** Standard shift working minutes per day (based on 8-hour standard window). */
export const STANDARD_WORKING_MINUTES_PER_DAY = 480

// ── SLA configuration ─────────────────────────────────────────────────────

export interface AssignmentSlaConfig {
    /** Working minutes allowed from assignedAt → startedAt before start SLA breach. */
    startSlaWorkingMinutes: number
    /** Working minutes allowed from startedAt → completedAt before completion SLA breach. null = project target drives. */
    completionSlaWorkingMinutes: number | null
    /** Which size tier determined completionSlaWorkingMinutes. */
    sizeTier: AssignmentSizeTier
}

// ── Overdue classification ────────────────────────────────────────────────

export type OverdueKind =
    | 'start_overdue'       // Not started within start SLA
    | 'completion_overdue'  // Started/ready but not completed by due target
    | 'handoff_overdue'     // Reassigned but not resumed within 1 working shift

export interface OverdueFlags {
    /** True if now > dueAt and status not in ['completed', 'cancelled']. */
    overdue: boolean
    overdueByMinutes: number
    overdueKinds: OverdueKind[]

    /** was not started within start SLA */
    startOverdue: boolean
    /** was started/ready but not completed on time */
    completionOverdue: boolean
    /** was reassigned but new assignee did not resume within 1 shift */
    handoffOverdue: boolean
}

// ── Assignment timing metrics ─────────────────────────────────────────────

/**
 * Raw ISO timestamps captured at lifecycle events.
 * All optional because most events are future at creation time.
 */
export interface AssignmentTimestamps {
    assignedAt: string
    readyAt?: string
    startedAt?: string
    completedAt?: string
    blockedAt?: string
    unblockedAt?: string
    reassignedAt?: string
    /** Computed SLA target: assignedAt + startSlaWorkingMinutes in shift time. */
    startDueAt?: string
    /** Computed SLA target based on size tier or project-driven date. */
    dueAt?: string
    /** Project commitment date (drives project-level risk scoring). */
    commitDate?: string
}

// ── Derived timing metrics ────────────────────────────────────────────────

/**
 * All derived metrics are in working minutes (shift-adjusted) unless noted.
 */
export interface AssignmentTimingMetrics {
    /** assignedAt → startedAt in working minutes. */
    timeToStartMinutes: number
    /** readyAt → startedAt in working minutes (time sitting in queue). */
    timeInReadyQueueMinutes: number
    /** Total working minutes actively worked (not blocked). */
    activeWorkMinutes: number
    /** Total working minutes spent blocked. */
    blockedMinutes: number
    /** (now or completedAt) − assignedAt in working minutes. */
    elapsedCycleMinutes: number
    /** elapsedCycleMinutes − blockedMinutes. */
    workingCycleMinutes: number
    /** Gap between reassignment and first action by new assignee, in working minutes. */
    handoffDelayMinutes: number
    /** completedAt − dueAt in working minutes (negative = early, positive = late). */
    completionLagMinutes: number
    /** startedAt − assignedAt in working minutes (alias for timeToStartMinutes, explicit naming). */
    startLagMinutes: number
}

// ── SLA evaluation result ─────────────────────────────────────────────────

export interface AssignmentSlaEvaluation {
    slaConfig: AssignmentSlaConfig
    timestamps: AssignmentTimestamps
    timingMetrics: AssignmentTimingMetrics
    overdue: OverdueFlags

    startSlaBreached: boolean
    completionSlaBreached: boolean
    onTimeCompletion: boolean | null // null until completed

    shiftId: ShiftId
    evaluatedAt: string
}

// ── SLA metrics (captured for monitoring/analytics) ───────────────────────

export interface AssignmentSlaMetrics {
    startSlaHours: number
    completionSlaDays: number | null
    startSlaBreached: boolean
    completionSlaBreached: boolean
    overdue: boolean
    overdueByMinutes: number
    onTimeCompletion: boolean | null
}

// ── Throughput metrics ────────────────────────────────────────────────────

export interface AssignmentThroughputMetrics {
    /** Completed assignments per calendar day (rolling 7-day average). */
    assignmentsCompletedPerDay: number
    /** Completed assignments per shift cycle. */
    assignmentsCompletedPerShift: number
    /** Cross-worker average for the project. */
    avgAssignmentsCompletedPerWorker: number
    /** Average working minutes spent per assignment. */
    avgWorkedMinutesPerAssignment: number
    /** Stage-level completions per day. */
    stageThroughputPerDay: number
    /** Project-level completions per month (for forecasting). */
    projectThroughputPerMonth: number
}
