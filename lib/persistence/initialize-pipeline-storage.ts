/**
 * Client-side helper for the project initialize pipeline.
 */

import type { InitializePipelineResult } from '@/lib/project-state/project-initialize-pipeline'

/** Trigger the server-side initialize pipeline for a project. */
export async function runInitializePipeline(
    projectId: string,
): Promise<InitializePipelineResult> {
    const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/initialize`,
        { method: 'POST' },
    )
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
            (body as Record<string, string>).error ?? 'Initialize pipeline failed',
        )
    }
    return res.json() as Promise<InitializePipelineResult>
}
