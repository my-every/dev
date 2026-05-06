import { describe, expect, it } from 'vitest'

import { resolveAssignmentByPrecedence } from './resolver'

describe('resolveAssignmentByPrecedence', () => {
    it('prefers projectState over all other sources', () => {
        const result = resolveAssignmentByPrecedence({
            projectState: { stage: 'TEST_READY', status: 'IN_PROGRESS' } as any,
            assignmentState: { stage: 'WIRING', status: 'BLOCKED' } as any,
            derivedSnapshot: { stage: 'BUILD_UP' } as any,
            activityFeed: { stage: 'KITTED' } as any,
        })

        expect(result.assignment?.stage).toBe('TEST_READY')
        expect(result.assignment?.status).toBe('IN_PROGRESS')
        expect(result.trace.winnerByField.stage).toBe('projectState')
        expect(result.trace.winnerByField.status).toBe('projectState')
    })

    it('falls back to assignmentState then derivedSnapshot then activityFeed', () => {
        const result = resolveAssignmentByPrecedence({
            assignmentState: { stage: 'IPV1' } as any,
            derivedSnapshot: { status: 'ASSIGNED' } as any,
            activityFeed: { statusNote: 'fallback-note' } as any,
        })

        expect(result.assignment?.stage).toBe('IPV1')
        expect(result.assignment?.status).toBe('ASSIGNED')
        expect(result.assignment?.statusNote).toBe('fallback-note')
        expect(result.trace.winnerByField.stage).toBe('assignmentState')
        expect(result.trace.winnerByField.status).toBe('derivedSnapshot')
        expect(result.trace.winnerByField.statusNote).toBe('activityFeed')
    })
})
