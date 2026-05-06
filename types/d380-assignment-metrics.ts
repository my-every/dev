/**
 * Assignment Profile Metrics Types
 *
 * Defines the data contract for the Profile Overview assignment widgets.
 * Top 5 confirmed metrics (in priority order):
 *   1. Active assignments count
 *   2. Completed this month
 *   3. On-time completion rate
 *   4. Avg cycle time
 *   5. Blocked count
 *
 * Secondary metrics (rendered below top 5):
 *   - Stage throughput
 *   - Reassignment count
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { MonthBucketKey } from '@/types/d380-assignment-ledger'
import type { ShiftId } from '@/types/d380-shift-calendar'

// ── Top-level profile assignment summary ─────────────────────────────────

/**
 * Primary assignment metrics for Profile Overview widgets.
 * Consumed directly by ProfileStatGrid and ProfileWidgetRenderer.
 */
export interface ProfileAssignmentMetrics {
    badge: string
    shiftId: ShiftId
    /** YYYY-MM month this summary reflects. */
    month: MonthBucketKey
    computedAt: string

    // ── Top 5 priority metrics ──────────────────────────────────────────

    /** Count of assignments currently in an active/non-completed state. */
    activeAssignmentsCount: number
    /** Count of assignments completed within the current calendar month. */
    completedThisMonth: number
    /**
     * Percentage of completed assignments finished on or before their SLA due target.
     * null when no completed assignments exist yet.
     */
    onTimeCompletionRate: number | null
    /** Average working minutes from assignment → completion across completed assignments. */
    avgCycleTimeMinutes: number | null
    /** Count of assignments currently in a blocked state. */
    blockedAssignmentsCount: number

    // ── Secondary metrics ───────────────────────────────────────────────

    /** Count of assignments completed per stage within this month. */
    stageThroughput: StageThroughputBreakdown[]
    /** Number of assignments reassigned to or from this user this month. */
    reassignmentCount: number
}

// ── Stage throughput breakdown ────────────────────────────────────────────

export interface StageThroughputBreakdown {
    stage: AssignmentStageId
    completedCount: number
    /** Average working minutes to complete one assignment in this stage. */
    avgCycleTimeMinutes: number | null
}

// ── Current assignment summary (for "Active Work" widget) ─────────────────

export interface ActiveAssignmentSummary {
    assignmentId: string
    pdNumber: string
    projectName: string
    sheetSlug: string
    sheetName: string
    currentStage: AssignmentStageId
    status: string
    startedAt?: string
    dueAt?: string
    overdue: boolean
    blockedMinutes: number
    activeWorkMinutes: number
}

// ── History preview entry (for "Recent Activity" assignment widget) ───────

export interface AssignmentHistoryPreviewEntry {
    assignmentId: string
    pdNumber: string
    projectName: string
    sheetName: string
    stage: AssignmentStageId
    eventType: string
    occurredAt: string
    summary: string
}

// ── Full profile overview assignment block ────────────────────────────────

/**
 * Composite block passed to the Profile Overview tab renderer.
 * Contains all data needed to populate the assignment section
 * without additional API calls from individual widgets.
 */
export interface ProfileAssignmentOverviewBlock {
    metrics: ProfileAssignmentMetrics
    /** Current non-completed assignments ordered by dispatch score. */
    activeAssignments: ActiveAssignmentSummary[]
    /** Recent assignment history events (latest N entries). */
    historyPreview: AssignmentHistoryPreviewEntry[]
}

// ── Widget stat card shape ────────────────────────────────────────────────

/**
 * Adapter shape for ProfileStatGrid / ProfileStatCard components.
 * Maps ProfileAssignmentMetrics onto the existing stat-card API.
 */
export interface AssignmentStatCard {
    id: string
    label: string
    value: string | number
    /** Numeric delta vs. prior month (positive = improvement, negative = regression). */
    change?: number
    changeLabel?: string
    /** Color hint for card accent: success, warning, danger, info, default. */
    color: 'default' | 'success' | 'warning' | 'danger' | 'info'
    icon?: string
}

/**
 * Derives the top-5 AssignmentStatCard array from ProfileAssignmentMetrics.
 * Exported as a type-safe factory signature for use in view-model layer.
 */
export type BuildAssignmentStatCards = (metrics: ProfileAssignmentMetrics) => AssignmentStatCard[]
