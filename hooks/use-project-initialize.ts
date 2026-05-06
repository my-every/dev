'use client'

import { useState, useCallback, useMemo } from 'react'
import type { InitializePipelineResult } from '@/lib/project-state/project-initialize-pipeline'
import { runInitializePipeline } from '@/lib/persistence/initialize-pipeline-storage'

// ---------------------------------------------------------------------------
// Options / Result interfaces
// ---------------------------------------------------------------------------

export interface UseProjectInitializeOptions {
    projectId: string
}

export interface UseProjectInitializeResult {
    /** Result from the last pipeline run (null until triggered). */
    result: InitializePipelineResult | null
    /** Whether the pipeline is currently running. */
    isRunning: boolean
    /** Last error, if any. */
    error: Error | null
    /** Trigger the initialize pipeline. */
    initialize: () => Promise<InitializePipelineResult>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectInitialize(
    options: UseProjectInitializeOptions,
): UseProjectInitializeResult {
    const { projectId } = options

    const [result, setResult] = useState<InitializePipelineResult | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const initialize = useCallback(async () => {
        setIsRunning(true)
        setError(null)
        try {
            const data = await runInitializePipeline(projectId)
            setResult(data)
            return data
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            setError(err)
            throw err
        } finally {
            setIsRunning(false)
        }
    }, [projectId])

    return useMemo(
        () => ({ result, isRunning, error, initialize }),
        [result, isRunning, error, initialize],
    )
}
