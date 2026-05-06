'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PartCatalogRecord } from '@/types/d380-catalog'
import {
    fetchCatalogLibrary,
    searchCatalog,
    upsertCatalogEntry,
    deleteCatalogEntry,
    importCatalogCsv,
    type CatalogSearchParams,
    type CatalogSearchResult,
    type CatalogImportResult,
} from '@/lib/persistence/catalog-storage'
import type { CatalogLibraryFile } from '@/types/d380-catalog-library'

// ---------------------------------------------------------------------------
// Options / Result interfaces
// ---------------------------------------------------------------------------

export interface UseCatalogOptions {
    /** Load the full library on mount (default: false — lazy search instead) */
    loadOnMount?: boolean
    /** Initial search params (only used when loadOnMount is false) */
    initialSearch?: CatalogSearchParams
}

export interface UseCatalogResult {
    /** All catalog entries (when full library loaded). */
    library: CatalogLibraryFile | null
    /** Search results (paginated). */
    searchResults: CatalogSearchResult | null
    /** Whether the initial load is in progress. */
    isLoading: boolean
    /** Last error, if any. */
    error: Error | null

    /** Load full library (replaces search results view). */
    loadLibrary: () => Promise<void>
    /** Run a search / filter query. */
    search: (params: CatalogSearchParams) => Promise<void>
    /** Create or update a single entry. */
    upsert: (entry: PartCatalogRecord) => Promise<PartCatalogRecord>
    /** Delete an entry by part number. */
    remove: (partNumber: string) => Promise<boolean>
    /** Import entries from a CSV file. */
    importCsv: (file: File) => Promise<CatalogImportResult>
    /** Refresh (re-run last operation). */
    refresh: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCatalog(options: UseCatalogOptions = {}): UseCatalogResult {
    const { loadOnMount = false, initialSearch } = options

    const [library, setLibrary] = useState<CatalogLibraryFile | null>(null)
    const [searchResults, setSearchResults] =
        useState<CatalogSearchResult | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [lastParams, setLastParams] = useState<CatalogSearchParams | null>(
        initialSearch ?? null,
    )
    const [mode, setMode] = useState<'library' | 'search'>(
        loadOnMount ? 'library' : 'search',
    )

    // --- Load full library ---
    const loadLibrary = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await fetchCatalogLibrary()
            setLibrary(data)
            setMode('library')
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)))
        } finally {
            setIsLoading(false)
        }
    }, [])

    // --- Search ---
    const search = useCallback(async (params: CatalogSearchParams) => {
        setIsLoading(true)
        setError(null)
        setLastParams(params)
        try {
            const data = await searchCatalog(params)
            setSearchResults(data)
            setMode('search')
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)))
        } finally {
            setIsLoading(false)
        }
    }, [])

    // --- Upsert ---
    const upsert = useCallback(
        async (entry: PartCatalogRecord) => {
            const result = await upsertCatalogEntry(entry)
            // Optimistic: update local library/search
            if (library) {
                setLibrary((prev) => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        entries: { ...prev.entries, [result.partNumber]: result },
                        updatedAt: new Date().toISOString(),
                    }
                })
            }
            return result
        },
        [library],
    )

    // --- Delete ---
    const remove = useCallback(
        async (partNumber: string) => {
            const ok = await deleteCatalogEntry(partNumber)
            if (ok && library) {
                setLibrary((prev) => {
                    if (!prev) return prev
                    const next = { ...prev, entries: { ...prev.entries } }
                    delete next.entries[partNumber]
                    return next
                })
            }
            return ok
        },
        [library],
    )

    // --- CSV import ---
    const importCsv = useCallback(async (file: File) => {
        const result = await importCatalogCsv(file)
        // Refresh after import
        if (mode === 'library') {
            loadLibrary()
        } else if (lastParams) {
            search(lastParams)
        }
        return result
    }, [mode, loadLibrary, lastParams, search])

    // --- Refresh ---
    const refresh = useCallback(async () => {
        if (mode === 'library') {
            await loadLibrary()
        } else if (lastParams) {
            await search(lastParams)
        }
    }, [mode, loadLibrary, lastParams, search])

    // --- Mount ---
    useEffect(() => {
        if (loadOnMount) {
            loadLibrary()
        } else if (initialSearch) {
            search(initialSearch)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return useMemo(
        () => ({
            library,
            searchResults,
            isLoading,
            error,
            loadLibrary,
            search,
            upsert,
            remove,
            importCsv,
            refresh,
        }),
        [
            library,
            searchResults,
            isLoading,
            error,
            loadLibrary,
            search,
            upsert,
            remove,
            importCsv,
            refresh,
        ],
    )
}
