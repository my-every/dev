/**
 * Assignment Event Model
 *
 * Canonical, immutable event record for every assignment lifecycle transition.
 * Audit requirements: every event must carry actor, timestamp, and coroperationId.
 * Ordering guarantee: strict per-assignment event sequence (assignmentEventSequence).
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { ShiftId } from '@/types/d380-shift-calendar'

// ── Event type taxonomy ───────────────────────────────────────────────────

/**
 * Major milestone events that generate an activity feed entry.
 * Non-milestone internal events are stored in history only.
 */
export type AssignmentMilestoneEventType =
    | 'ASSIGNED'
    | 'REASSIGNED'
    | 'STARTED'
    | 'BLOCKED'
    | 'UNBLOCKED'
    | 'STAGE_CHANGED'
    | 'COMPLETED'
    | 'REOPENED'
    | 'CANCELLED'

/**
 * Full set of trackable assignment event types.
 * Non-milestone types are stored in history/ledger but do NOT create activity entries.
 */
export type AssignmentEventType =
    | AssignmentMilestoneEventType
    | 'PROGRESS_UPDATED'
    | 'NOTE_ADDED'
    | 'CHECKLIST_ITEM_TOGGLED'
    | 'SLA_BREACHED'
    | 'STAGE_JUMP_REQUESTED'
    | 'STAGE_JUMP_APPROVED'
    | 'SLA_RECALCULATED'
    | 'WRITE_FAILED'

/** Set of event types that produce an activity feed entry. */
export const ASSIGNMENT_MILESTONE_EVENT_TYPES = new Set<AssignmentEventType>([
    'ASSIGNED',
    'REASSIGNED',
    'STARTED',
    'BLOCKED',
    'UNBLOCKED',
    'STAGE_CHANGED',
    'COMPLETED',
    'REOPENED',
    'CANCELLED',
])

// ── Core identity references ──────────────────────────────────────────────

export interface AssignmentEventActorRef {
    badge: string
    shift: ShiftId
    displayName: string
}

export interface AssignmentEventProjectRef {
    pdNumber: string
    projectName: string
    projectId: string
}

export interface AssignmentEventSheetRef {
    sheetSlug: string
    sheetName: string
}

// ── Stage jump metadata ───────────────────────────────────────────────────

export interface StageJumpRecord {
    /** Stage immediately before the jump. */
    fromStage: AssignmentStageId
    /** Stage immediately after the jump. */
    toStage: AssignmentStageId
    /** Intermediate stages that were bypassed. */
    skippedStages: AssignmentStageId[]
    /** Number of stages skipped. */
    skippedStageCount: number
    /** Human-readable reason for the jump. */
    reason: string
    /** Free-text validation/approval note required on any direct jump. */
    validationNote: string
    /** Badge of person who authorized the jump (may equal actor). */
    validatedBy: string
    /** ISO timestamp of jump authorization. */
    validatedAt: string
}

// ── Reassignment metadata ─────────────────────────────────────────────────

export interface ReassignmentRecord {
    priorAssigneeBadge: string
    priorAssigneeShift: ShiftId
    /** Minutes logged by prior assignee before handoff. */
    priorAssigneeWorkedMinutes: number
    /** Handoff delay: gap between reassignment and new assignee first action (minutes). */
    handoffDelayMinutes: number
    reason: string
}

// ── Event snapshot ────────────────────────────────────────────────────────

/**
 * Lightweight snapshot of assignment state captured at event time.
 * Enables replay and conflict resolution without re-reading project state.
 */
export interface AssignmentStateSnapshot {
    stage: AssignmentStageId
    status: string
    assigneeBadge: string | null
    progressPercent: number
    estimatedMinutes: number
    activeWorkMinutes: number
    blockedMinutes: number
}

// ── Canonical event record ────────────────────────────────────────────────

/**
 * Immutable assignment event. Once appended to assignment-history.json it
 * must never be mutated. Redress via compensating events only.
 */
export interface AssignmentEvent {
    /** Application-generated stable UUID v4. */
    eventId: string

    /**
     * Groups related multi-step mutations into one logical operation.
     * All file writes in a single action share the same coroperationId.
     */
    coroperationId: string

    /** Per-assignment monotonically increasing counter. Rejects out-of-order events. */
    assignmentEventSequence: number

    type: AssignmentEventType

    /** ISO 8601 UTC timestamp. */
    occurredAt: string

    /** User who triggered the event. */
    actor: AssignmentEventActorRef

    /** Project this assignment belongs to. */
    project: AssignmentEventProjectRef

    /** Sheet this assignment represents. */
    sheet: AssignmentEventSheetRef

    /**
     * Unique assignment identifier.
     * Format: <pdNumber>_<sheetSlug>
     */
    assignmentId: string

    /** State of the assignment immediately before this event. */
    previousSnapshot: AssignmentStateSnapshot

    /** State of the assignment immediately after this event. */
    nextSnapshot: AssignmentStateSnapshot

    // ── Optional typed payloads ──────────────────────────────────────────

    /** Present when type === 'STAGE_CHANGED' and stages were skipped. */
    stageJump?: StageJumpRecord

    /** Present when type === 'REASSIGNED'. */
    reassignment?: ReassignmentRecord

    /** Free-text note for any event type. */
    note?: string

    // ── Conflict resolution metadata ─────────────────────────────────────

    conflict?: {
        conflictCount: number
        conflictLastDetectedAt: string
        conflictResolvedAt: string
        conflictSourceA: 'projectState' | 'assignmentState' | 'derivedSnapshot' | 'activityFeed'
        conflictSourceB: 'projectState' | 'assignmentState' | 'derivedSnapshot' | 'activityFeed'
        /** Canonical winner per confirmed priority: projectState > assignmentState > derivedSnapshot > activityFeed */
        canonicalWinner: 'projectState' | 'assignmentState' | 'derivedSnapshot' | 'activityFeed'
        conflictReason: string
    }

    // ── Transaction metadata ─────────────────────────────────────────────

    transaction: {
        transactionId: string
        transactionType: string
        transactionStartedAt: string
        transactionCompletedAt: string
        transactionDurationMs: number
        transactionSuccess: boolean
        /** Populated only when transactionSuccess === false. */
        transactionRollbackReason?: string
        affectedAssignmentIds: string[]
        affectedProjectIds: string[]
    }
}

// ── Event ordering guards ─────────────────────────────────────────────────

export interface AssignmentEventOrderingState {
    /** Last accepted sequence number for this assignment. */
    lastAcceptedSequence: number
    /** Number of events rejected for arriving out of order. */
    outOfOrderEventRejectedCount: number
    /** Number of duplicate events silently ignored. */
    duplicateEventIgnoredCount: number
    lastEventAt: string
}
