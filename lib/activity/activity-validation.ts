import { ACTIVITY_ACTIONS, type ActivityAction } from '@/types/activity'

export const ACTIVITY_RESULTS = ['success', 'failure', 'pending'] as const

type ActivityResult = (typeof ACTIVITY_RESULTS)[number]

export function isActivityAction(value: unknown): value is ActivityAction {
    return typeof value === 'string' && (ACTIVITY_ACTIONS as string[]).includes(value)
}

export function isActivityResult(value: unknown): value is ActivityResult {
    return typeof value === 'string' && (ACTIVITY_RESULTS as readonly string[]).includes(value)
}

export function normalizeMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

export function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
}

export function normalizeOptionalNumber(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
    return value
}

export function validateBadge(value: unknown): value is string {
    return typeof value === 'string' && /^\d+$/.test(value)
}

export function validateShift(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const normalized = value.trim().toLowerCase()
    return ['1st', '2nd', 'first', 'second', '1', '2', '1st-shift', '2nd-shift',].includes(normalized)
}

export function validateActivityPayload(payload: {
    action: unknown
    shift: unknown
    result: unknown
    durationSeconds: unknown
    comment: unknown
}): string | null {
    if (!isActivityAction(payload.action)) {
        return 'Invalid action value'
    }

    if (!validateShift(payload.shift)) {
        return 'Invalid shift value'
    }

    if (payload.result != null && !isActivityResult(payload.result)) {
        return 'Invalid result value'
    }

    if (payload.durationSeconds != null) {
        const duration = normalizeOptionalNumber(payload.durationSeconds)
        if (duration == null || duration < 0) {
            return 'durationSeconds must be a non-negative number'
        }
    }

    if (payload.action === 'COMMENT_ADDED') {
        const comment = normalizeOptionalString(payload.comment)
        if (!comment) {
            return 'comment is required for COMMENT_ADDED action'
        }
    }

    return null
}
