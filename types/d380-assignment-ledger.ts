/**
 * Assignment Ledger Types
 *
 * Defines the shape of two per-user persistence files:
 *
 *   /Share/users/<shift>/<badge>/assignments.json
 *     → Monthly YYYY-MM bucketed ledger (active rolling window + counters)
 *
 *   /Share/users/<shift>/<badge>/assignment-history.json
 *     → Append-only immutable event log, archived monthly into
 *       /Share/users/<shift>/<badge>/history/<YYYY>/<MM>/assignment-history.json
 *
 * Project state under /Share/Projects/<pd>_<name>/state/ is canonical.
 * Ledger and history are reporting/audit files derived from project state.
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { AssignmentEvent } from '@/types/d380-assignment-event'
import type { ShiftId } from '@/types/d380-shift-calendar'

// ── Month bucket key ──────────────────────────────────────────────────────

/** YYYY-MM string, e.g. "2026-04" */
export type MonthBucketKey = string

// ── Assignment size tiers (drives completion SLA) ─────────────────────────

export type AssignmentSizeTier = 'small' | 'medium' | 'large' | 'xlarge'

/** Estimated-minutes boundaries per size tier. */
export const ASSIGNMENT_SIZE_TIER_THRESHOLDS: Record<AssignmentSizeTier, { min: number; max: number }> = {
    small: { min: 0, max: 240 },
    medium: { min: 241, max: 480 },
    large: { min: 481, max: 960 },
    xlarge: { min: 961, max: Infinity },
}

// ── Assignment snapshot stored in a monthly bucket ───────────────────────

/**
 * Lightweight snapshot of one assignment as it existed at last write.
 * This is a reporting artifact — never modify the project-state canonical record.
 */
export interface AssignmentLedgerEntry {
    /** Stable assignment ID: <pdNumber>_<sheetSlug> */
    assignmentId: string
    pdNumber: string
    projectName: string
    projectId: string
    sheetSlug: string
    sheetName: string

    /** Badge of the current (most recent) assignee. */
    currentAssigneeBadge: string
    currentAssigneeShift: ShiftId

    /** Badge of the original assignee (never overwritten on reassignment). */
    initialAssigneeBadge: string
    initialAssigneeShift: ShiftId

    /** Running count of membership transfers. */
    reassignmentCount: number
    handoffCount: number

    currentStage: AssignmentStageId
    status: string

    estimatedMinutes: number
    sizeTier: AssignmentSizeTier

    assignedAt: string
    readyAt?: string
    startedAt?: string
    completedAt?: string
    cancelledAt?: string
    blockedAt?: string
    unblockedAt?: string
    dueAt?: string

    /** Minutes logged by this user (current assignee). */
    activeWorkMinutes: number
    /** Minutes logged by the prior assignee (preserved on reassignment). */
    priorAssigneeWorkedMinutes: number
    /** Cumulative time spent blocked. */
    blockedMinutes: number

    /** Whether this assignment carried over from a prior month. */
    carriedOver: boolean
    /** Which month it originated if carried over (YYYY-MM). */
    carriedOverFromMonth?: MonthBucketKey

    // ── SLA evaluation fields (denormalized for fast queries) ────────────
    startSlaBreached: boolean
    completionSlaBreached: boolean
    overdue: boolean
    overdueByMinutes: number
    onTimeCompletion: boolean | null // null until completed
}

// ── Monthly counters ──────────────────────────────────────────────────────

export interface MonthlyAssignmentCounters {
    openedAssignments: number
    startedAssignments: number
    completedAssignments: number
    blockedAssignments: number
    unblockedAssignments: number
    reassignedAssignments: number
    carriedOverAssignments: number
    onTimeCompletedAssignments: number
    overdueAssignments: number

    /** Sum of all activeWorkMinutes for the month. */
    totalWorkedMinutes: number

    /** Average cycle time: assigned → completed (working minutes). */
    avgCycleTimeMinutes: number

    /** Average gap: assigned → started (working minutes). */
    avgStartLagMinutes: number

    /** Average gap: ready/started → completed (working minutes). */
    avgCompletionLagMinutes: number
}

// ── Monthly bucket ────────────────────────────────────────────────────────

export interface MonthlyAssignmentBucket {
    /** YYYY-MM — month this bucket covers. */
    month: MonthBucketKey
    counters: MonthlyAssignmentCounters
    /** All assignment snapshots for this user in this month. */
    assignments: AssignmentLedgerEntry[]
}

// ── Top-level assignments.json document ──────────────────────────────────

export interface UserAssignmentsLedger {
    /** Schema version for future migrations. */
    schemaVersion: 1
    badge: string
    shift: ShiftId
    lastUpdatedAt: string
    /** Rolling-window monthly buckets, keyed by YYYY-MM. */
    months: Record<MonthBucketKey, MonthlyAssignmentBucket>
}

// ── History document ──────────────────────────────────────────────────────

/**
 * Represents the in-file assignment-history.json document.
 * This file is append-only; no mutation of existing events is permitted.
 * Archived monthly into /history/<YYYY>/<MM>/assignment-history.json.
 */
export interface UserAssignmentHistory {
    /** Schema version for future migrations. */
    schemaVersion: 1
    badge: string
    shift: ShiftId
    /** YYYY-MM of the active (not yet archived) window. */
    activeWindow: MonthBucketKey
    lastAppendedAt: string
    /** Ordered chronological event log. */
    events: AssignmentEvent[]
}

// ── Archive metadata ──────────────────────────────────────────────────────

/**
 * Written alongside each archived history file as archive-meta.json.
 */
export interface AssignmentHistoryArchiveMeta {
    archivedMonth: MonthBucketKey
    archiveCreatedAt: string
    archiveRecordCount: number
    archiveSizeBytes: number
    /** Tracks how many times this archive was restored for replay. */
    restoreRequestCount: number
}

// ── Transaction boundary ──────────────────────────────────────────────────

/**
 * Describes one all-or-nothing write transaction that touches:
 *   - project state
 *   - monthly ledger (assignments.json)
 *   - history archive (assignment-history.json)
 *   - activity entry
 *
 * If any write fails, the entire transaction is rolled back and the user
 * sees a hard error. No partial success is permitted.
 */
export interface AssignmentWriteTransaction {
    transactionId: string
    transactionType: string
    transactionStartedAt: string
    transactionCompletedAt: string
    transactionDurationMs: number
    transactionSuccess: boolean
    transactionRollbackReason?: string
    affectedAssignmentIds: string[]
    affectedProjectIds: string[]
}
