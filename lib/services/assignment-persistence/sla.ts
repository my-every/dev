import type { Assignment } from '@/lib/services/contracts/assignment-state-service'
import { SLA_COMPLETION_WORKING_MINUTES, SLA_START_WORKING_MINUTES } from '@/types/d380-assignment-sla'

import { PERSISTENCE_ERROR_CODES, type PersistenceErrorCode } from './policy'

export interface SlaEvaluationSummary {
    startSlaBreached: boolean
    completionSlaBreached: boolean
    overdue: boolean
    overdueByMinutes: number
    completionDueAt: string | null
    errorCode?: PersistenceErrorCode
}

function toMillis(value?: string): number | null {
    if (!value) {
        return null
    }
    const date = new Date(value)
    const time = date.getTime()
    return Number.isFinite(time) ? time : null
}

function toWorkingMinutes(startIso?: string, endIso?: string): number {
    const startMs = toMillis(startIso)
    const endMs = toMillis(endIso)
    if (startMs === null || endMs === null || endMs <= startMs) {
        return 0
    }

    // Default policy baseline for SLA calculations until holiday calendars are integrated.
    return Math.round((endMs - startMs) / 60000)
}

function resolveCompletionBudgetMinutes(assignment: Assignment): number | null {
    const tier = assignment.sizeTier.toLowerCase() as 'small' | 'medium' | 'large' | 'xlarge'
    return SLA_COMPLETION_WORKING_MINUTES[tier]
}

export function evaluateSla(assignment: Assignment): SlaEvaluationSummary {
    const nowIso = new Date().toISOString()
    const startLag = toWorkingMinutes(assignment.assignedAt, assignment.startedAt ?? nowIso)
    const completionLag = toWorkingMinutes(assignment.startedAt, assignment.completedAt ?? nowIso)
    const completionBudget = resolveCompletionBudgetMinutes(assignment)

    if (completionBudget === null && !assignment.dueAt) {
        return {
            startSlaBreached: startLag > SLA_START_WORKING_MINUTES,
            completionSlaBreached: false,
            overdue: false,
            overdueByMinutes: 0,
            completionDueAt: null,
            errorCode: PERSISTENCE_ERROR_CODES.SLA_XLARGE_MISSING_DUE,
        }
    }

    const completionDueAt = assignment.dueAt ?? null
    const overdueByMinutes = completionDueAt
        ? Math.max(0, toWorkingMinutes(completionDueAt, nowIso))
        : 0

    return {
        startSlaBreached: startLag > SLA_START_WORKING_MINUTES,
        completionSlaBreached: completionBudget !== null ? completionLag > completionBudget : overdueByMinutes > 0,
        overdue: overdueByMinutes > 0,
        overdueByMinutes,
        completionDueAt,
    }
}
