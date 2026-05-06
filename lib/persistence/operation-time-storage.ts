/**
 * Client-side persistence helpers for Operation Code time tracking.
 *
 * All operations go through the API routes at
 * `app/api/projects/[projectId]/operation-time/`.
 */

import type {
    OperationTimeEntry,
    ProjectOperationSummary,
} from '@/types/d380-operation-codes'

function base(projectId: string) {
    return `/api/projects/${encodeURIComponent(projectId)}/operation-time`
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch the aggregated operation-time summary for a project. */
export async function fetchOperationSummary(
    projectId: string,
): Promise<ProjectOperationSummary> {
    const res = await fetch(base(projectId))
    if (!res.ok) throw new Error('Failed to fetch operation summary')
    const data = (await res.json()) as { summary: ProjectOperationSummary }
    return data.summary
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface LogOperationTimeParams {
    opCode: string
    badgeNumber: string
    sheetSlug?: string
    startedAt: string
    endedAt?: string
    actualMinutes?: number
    note?: string
}

/** Log a new operation-time entry. Returns the created entry. */
export async function logOperationTime(
    projectId: string,
    params: LogOperationTimeParams,
): Promise<OperationTimeEntry> {
    const res = await fetch(base(projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error('Failed to log operation time')
    const data = (await res.json()) as { entry: OperationTimeEntry }
    return data.entry
}

// ---------------------------------------------------------------------------
// Update / Delete individual entries
// ---------------------------------------------------------------------------

/** Update an existing time entry (e.g. set endedAt, actualMinutes). */
export async function updateOperationTime(
    projectId: string,
    entryId: string,
    update: Partial<Pick<OperationTimeEntry, 'endedAt' | 'actualMinutes' | 'note'>>,
): Promise<OperationTimeEntry> {
    const res = await fetch(
        `${base(projectId)}/${encodeURIComponent(entryId)}`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        },
    )
    if (!res.ok) throw new Error('Failed to update operation time entry')
    const data = (await res.json()) as { entry: OperationTimeEntry }
    return data.entry
}

/** Delete an operation-time entry. */
export async function deleteOperationTime(
    projectId: string,
    entryId: string,
): Promise<boolean> {
    const res = await fetch(
        `${base(projectId)}/${encodeURIComponent(entryId)}`,
        { method: 'DELETE' },
    )
    return res.ok
}
