/**
 * D380 Catalog Library Schema
 *
 * Defines the on-disk format for the persistent parts catalog
 * stored at Share/catalog/part-library.json.
 */

import type { PartCatalogRecord } from './d380-catalog'

export interface CatalogLibraryFile {
    /** Schema version for forward-compat */
    version: 1
    /** ISO timestamp of last modification */
    updatedAt: string
    /** All records keyed by primary part number */
    entries: Record<string, PartCatalogRecord>
}

export function createEmptyCatalogLibrary(): CatalogLibraryFile {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: {},
    }
}
