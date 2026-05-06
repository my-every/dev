import { ASSIGNMENT_STAGES, type AssignmentStageId } from '@/types/d380-assignment-stages'
import type { ShiftId } from '@/types/d380-shift-calendar'

export const ASSIGNMENT_STATE_SCHEMA_VERSION = 1

export const EVENT_TAXONOMY = [
    'ASSIGNED',
    'REASSIGNED',
    'STARTED',
    'BLOCKED',
    'UNBLOCKED',
    'STAGE_JUMP_REQUESTED',
    'STAGE_JUMP_APPROVED',
    'STAGE_CHANGED',
    'COMPLETED',
    'REOPENED',
    'SLA_RECALCULATED',
    'WRITE_FAILED',
] as const

export type AssignmentPolicyEventType = typeof EVENT_TAXONOMY[number]

export const SOURCE_PRECEDENCE = [
    'projectState',
    'assignmentState',
    'derivedSnapshot',
    'activityFeed',
] as const

export type StateSource = typeof SOURCE_PRECEDENCE[number]

export const PERSISTENCE_ERROR_CODES = {
    BRIDGE_UNAVAILABLE: 'PERSIST_BRIDGE_001',
    TXN_WRITE_FAILED: 'TXN_COMMIT_002',
    TXN_ROLLBACK_FAILED: 'TXN_ROLLBACK_003',
    OUT_OF_ORDER_EVENT: 'EVENT_ORDER_004',
    STAGE_JUMP_NOTE_REQUIRED: 'STAGE_JUMP_005',
    SLA_XLARGE_MISSING_DUE: 'SLA_XLARGE_006',
    SCHEMA_INVALID: 'SCHEMA_007',
} as const

export type PersistenceErrorCode = typeof PERSISTENCE_ERROR_CODES[keyof typeof PERSISTENCE_ERROR_CODES]

export function normalizeShiftForPath(shift: string): '1ST' | '2ND' {
    const normalized = shift.trim().toUpperCase()
    return normalized.startsWith('2') ? '2ND' : '1ST'
}

export function normalizeShiftToDomain(shift: string): ShiftId {
    return normalizeShiftForPath(shift) === '2ND' ? '2nd' : '1st'
}

export function normalizeBadgeForPath(badge: string): string {
    return badge.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNKNOWN'
}

export function normalizeProjectFolderKey(pdNumber: string, projectName: string): string {
    const pd = pdNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const name = projectName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

    return `${pd || 'UNKNOWN'}_${name || 'PROJECT'}`
}

export function getStageOrderIndex(stage: AssignmentStageId): number {
    return ASSIGNMENT_STAGES.findIndex(item => item.id === stage)
}

export function isStageJump(fromStage: AssignmentStageId, toStage: AssignmentStageId): boolean {
    const fromIndex = getStageOrderIndex(fromStage)
    const toIndex = getStageOrderIndex(toStage)
    return fromIndex >= 0 && toIndex >= 0 && toIndex - fromIndex > 1
}

export function assertValidStageJumpNote(
    fromStage: AssignmentStageId,
    toStage: AssignmentStageId,
    note?: string,
): PersistenceErrorCode | null {
    if (!isStageJump(fromStage, toStage)) {
        return null
    }

    if (!note || note.trim().length < 8) {
        return PERSISTENCE_ERROR_CODES.STAGE_JUMP_NOTE_REQUIRED
    }

    return null
}
