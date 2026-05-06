'use client'

/**
 * Hook for fetching the global revision catalog — a lightweight summary
 * of every project's available revisions (wire-list + layout).
 *
 * Usage:
 *   const { catalog, forProject, allKnownRevisions, isLoading } = useRevisionCatalog()
 *   const projectRevisions = forProject('pd-4m093')
 */

import { useMemo } from 'react'
import useSWR from 'swr'

// ============================================================================
// Types (mirror the API response shape)
// ============================================================================

export interface RevisionCatalogEntry {
    projectId: string
    pdNumber: string
    folderName: string
    wireListRevisions: string[]
    layoutRevisions: string[]
    allRevisions: string[]
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = async (url: string): Promise<RevisionCatalogEntry[]> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch revision catalog')
    return res.json()
}

// ============================================================================
// Hook
// ============================================================================

export interface UseRevisionCatalogReturn {
    /** Full catalog array (one entry per project). */
    catalog: RevisionCatalogEntry[]
    /** Loading state. */
    isLoading: boolean
    /** Error state. */
    error: Error | null
    /** Look up a single project by projectId or pdNumber (case-insensitive). */
    forProject: (idOrPd: string) => RevisionCatalogEntry | undefined
    /** Flat, deduplicated list of every revision string known across all projects. */
    allKnownRevisions: string[]
    /** Re-fetch the catalog. */
    refresh: () => void
}

export function useRevisionCatalog(): UseRevisionCatalogReturn {
    const { data, error, isLoading, mutate } = useSWR<RevisionCatalogEntry[]>(
        '/api/projects/revisions',
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60_000 },
    )

    const catalog = data ?? []

    const forProject = useMemo(() => {
        const byId = new Map<string, RevisionCatalogEntry>()
        const byPd = new Map<string, RevisionCatalogEntry>()
        for (const entry of catalog) {
            byId.set(entry.projectId.toLowerCase(), entry)
            byPd.set(entry.pdNumber.toLowerCase(), entry)
        }
        return (idOrPd: string) => {
            const key = idOrPd.toLowerCase()
            return byId.get(key) ?? byPd.get(key)
        }
    }, [catalog])

    const allKnownRevisions = useMemo(() => {
        const set = new Set<string>()
        for (const entry of catalog) {
            for (const rev of entry.allRevisions) set.add(rev)
        }
        return Array.from(set).sort()
    }, [catalog])

    return {
        catalog,
        isLoading,
        error: error ?? null,
        forProject,
        allKnownRevisions,
        refresh: () => void mutate(),
    }
}
