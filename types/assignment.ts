/**
 * Assignment Domain — Barrel Export
 *
 * Re-exports all assignment-related type modules so consumers can import from a
 * single path:
 *
 *   import type { AssignmentEvent, ShiftId, ProfileAssignmentMetrics } from '@/types/assignment'
 *
 * Individual modules remain importable directly for code-splitting and
 * tree-shaking where needed.
 */

export type * from './d380-shift-calendar'
export * from './d380-shift-calendar'               // re-export constants (SHIFT_SCHEDULES, etc.)

export type * from './d380-assignment-event'
export * from './d380-assignment-event'             // re-export ASSIGNMENT_MILESTONE_EVENT_TYPES

export type * from './d380-assignment-ledger'
export * from './d380-assignment-ledger'            // re-export ASSIGNMENT_SIZE_TIER_THRESHOLDS

export type * from './d380-assignment-sla'
export * from './d380-assignment-sla'               // re-export SLA_START_WORKING_MINUTES, etc.

export type * from './d380-assignment-dispatch'

export type * from './d380-assignment-metrics'
