import type { Assignment } from '@/lib/services/contracts/assignment-state-service'

import { SOURCE_PRECEDENCE, type StateSource } from './policy'

export interface StateResolutionTrace {
    winnerByField: Record<string, StateSource>
}

export interface StateResolutionResult {
    assignment: Assignment | null
    trace: StateResolutionTrace
}

export interface AssignmentSourceSet {
    projectState?: Partial<Assignment>
    assignmentState?: Partial<Assignment>
    derivedSnapshot?: Partial<Assignment>
    activityFeed?: Partial<Assignment>
}

export function resolveAssignmentByPrecedence(sources: AssignmentSourceSet): StateResolutionResult {
    const keys = new Set<string>()
    for (const sourceName of SOURCE_PRECEDENCE) {
        const source = sources[sourceName]
        if (!source) {
            continue
        }
        Object.keys(source).forEach(key => keys.add(key))
    }

    if (keys.size === 0) {
        return {
            assignment: null,
            trace: { winnerByField: {} },
        }
    }

    const merged: Record<string, unknown> = {}
    const trace: Record<string, StateSource> = {}

    keys.forEach((key) => {
        for (const sourceName of SOURCE_PRECEDENCE) {
            const source = sources[sourceName]
            if (source && source[key as keyof Assignment] !== undefined) {
                merged[key] = source[key as keyof Assignment] as unknown
                trace[key] = sourceName
                break
            }
        }
    })

    return {
        assignment: merged as unknown as Assignment,
        trace: { winnerByField: trace },
    }
}
