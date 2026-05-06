import { z } from 'zod'

import { ASSIGNMENT_STATE_SCHEMA_VERSION } from './policy'

export const userAssignmentsLedgerSchema = z.object({
    schemaVersion: z.literal(ASSIGNMENT_STATE_SCHEMA_VERSION),
    badge: z.string().min(1),
    shift: z.string().min(1),
    lastUpdatedAt: z.string().datetime(),
    months: z.record(z.string(), z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        counters: z.record(z.string(), z.number()),
        assignments: z.array(z.record(z.string(), z.unknown())),
    })),
})

export const userAssignmentHistorySchema = z.object({
    schemaVersion: z.literal(ASSIGNMENT_STATE_SCHEMA_VERSION),
    badge: z.string().min(1),
    shift: z.string().min(1),
    activeWindow: z.string().regex(/^\d{4}-\d{2}$/),
    lastAppendedAt: z.string().datetime(),
    events: z.array(z.record(z.string(), z.unknown())),
})

export const projectStateSnapshotSchema = z.object({
    schemaVersion: z.literal(ASSIGNMENT_STATE_SCHEMA_VERSION),
    projectId: z.string().min(1),
    pdNumber: z.string().min(1),
    projectName: z.string().min(1),
    updatedAt: z.string().datetime(),
    assignments: z.record(z.string(), z.record(z.string(), z.unknown())),
    workflowMetadata: z.object({
        lastGlobalSequence: z.number().int().nonnegative(),
        updatedAt: z.string().datetime(),
    }),
})

export type ProjectStateSnapshot = z.infer<typeof projectStateSnapshotSchema>
