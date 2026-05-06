'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
    OperationTimeEntry,
    ProjectOperationSummary,
} from '@/types/d380-operation-codes'
import {
    fetchOperationSummary,
    logOperationTime,
    updateOperationTime,
    deleteOperationTime,
    type LogOperationTimeParams,
} from '@/lib/persistence/operation-time-storage'

// ---------------------------------------------------------------------------
// Options / Result interfaces
// ---------------------------------------------------------------------------

export interface UseOperationTimeOptions {
    projectId: string
    /** Load summary on mount (default: true) */
    autoLoad?: boolean
}

export interface UseOperationTimeResult {
    summary: ProjectOperationSummary | null
    isLoading: boolean
    error: Error | null

    /** Re-fetch the summary from the server. */
    refresh: () => Promise<void>
    /** Log a new time entry then refresh summary. */
    log: (params: LogOperationTimeParams) => Promise<OperationTimeEntry>
    /** Update an existing entry then refresh summary. */
    update: (
        entryId: string,
        update: Partial<Pick<OperationTimeEntry, 'endedAt' | 'actualMinutes' | 'note'>>,
    ) => Promise<OperationTimeEntry>
    /** Delete an entry then refresh summary. */
    remove: (entryId: string) => Promise<boolean>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOperationTime(
    options: UseOperationTimeOptions,
): UseOperationTimeResult {
    const { projectId, autoLoad = true } = options

    const [summary, setSummary] = useState<ProjectOperationSummary | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const refresh = useCallback(async () => {
        if (!projectId) return
        setIsLoading(true)
        setError(null)
        try {
            const data = await fetchOperationSummary(projectId)
            setSummary(data)
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)))
        } finally {
            setIsLoading(false)
        }
    }, [projectId])

    const log = useCallback(
        async (params: LogOperationTimeParams) => {
            const entry = await logOperationTime(projectId, params)
            await refresh()
            return entry
        },
        [projectId, refresh],
    )

    const update = useCallback(
        async (
            entryId: string,
            upd: Partial<Pick<OperationTimeEntry, 'endedAt' | 'actualMinutes' | 'note'>>,
        ) => {
            const entry = await updateOperationTime(projectId, entryId, upd)
            await refresh()
            return entry
        },
        [projectId, refresh],
    )

    const remove = useCallback(
        async (entryId: string) => {
            const ok = await deleteOperationTime(projectId, entryId)
            if (ok) await refresh()
            return ok
        },
        [projectId, refresh],
    )

    useEffect(() => {
        if (autoLoad) {
            refresh()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    return useMemo(
        () => ({ summary, isLoading, error, refresh, log, update, remove }),
        [summary, isLoading, error, refresh, log, update, remove],
    )
}
