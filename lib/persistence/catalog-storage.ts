/**
 * Client-side persistence helpers for the Catalog Library.
 *
 * All operations go through the API routes created in
 * `app/api/parts/catalog/` and do NOT touch the file system directly.
 */

import type { PartCatalogRecord } from '@/types/d380-catalog'
import type { CatalogLibraryFile } from '@/types/d380-catalog-library'

const BASE = '/api/parts/catalog'

// ---------------------------------------------------------------------------
// Full library
// ---------------------------------------------------------------------------

/** Fetch the full catalog library (all entries). */
export async function fetchCatalogLibrary(): Promise<CatalogLibraryFile> {
    const res = await fetch(`${BASE}?full=true`)
    if (!res.ok) throw new Error('Failed to fetch catalog library')
    return res.json() as Promise<CatalogLibraryFile>
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface CatalogSearchParams {
    query?: string
    category?: string
    limit?: number
    offset?: number
}

export interface CatalogSearchResult {
    entries: PartCatalogRecord[]
    total: number
}

/** Search / list catalog entries with optional filters. */
export async function searchCatalog(
    params: CatalogSearchParams = {},
): Promise<CatalogSearchResult> {
    const sp = new URLSearchParams()
    if (params.query) sp.set('query', params.query)
    if (params.category) sp.set('category', params.category)
    if (params.limit != null) sp.set('limit', String(params.limit))
    if (params.offset != null) sp.set('offset', String(params.offset))

    const res = await fetch(`${BASE}?${sp.toString()}`)
    if (!res.ok) throw new Error('Catalog search failed')
    return res.json() as Promise<CatalogSearchResult>
}

// ---------------------------------------------------------------------------
// Single entry CRUD
// ---------------------------------------------------------------------------

/** Fetch a single catalog entry by part number. */
export async function fetchCatalogEntry(
    partNumber: string,
): Promise<PartCatalogRecord | null> {
    const res = await fetch(`${BASE}/${encodeURIComponent(partNumber)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Failed to fetch catalog entry')
    const data = (await res.json()) as { entry: PartCatalogRecord }
    return data.entry
}

/** Create or update a catalog entry. */
export async function upsertCatalogEntry(
    entry: PartCatalogRecord,
): Promise<PartCatalogRecord> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
    })
    if (!res.ok) throw new Error('Failed to upsert catalog entry')
    const data = (await res.json()) as { entry: PartCatalogRecord }
    return data.entry
}

/** Delete a catalog entry by part number. */
export async function deleteCatalogEntry(
    partNumber: string,
): Promise<boolean> {
    const res = await fetch(`${BASE}/${encodeURIComponent(partNumber)}`, {
        method: 'DELETE',
    })
    return res.ok
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export interface CatalogImportResult {
    importedCount: number
    skippedCount: number
    errors: string[]
}

/** Import catalog entries from a CSV file (FormData with `file` field). */
export async function importCatalogCsv(
    file: File,
): Promise<CatalogImportResult> {
    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch(`${BASE}/import`, {
        method: 'POST',
        body: fd,
    })
    if (!res.ok) throw new Error('Catalog CSV import failed')
    return res.json() as Promise<CatalogImportResult>
}
