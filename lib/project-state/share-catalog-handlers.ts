import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";

import type { PartCatalogRecord } from "@/types/d380-catalog";
import type { CatalogLibraryFile } from "@/types/d380-catalog-library";
import { createEmptyCatalogLibrary } from "@/types/d380-catalog-library";

function getCatalogDir(): string {
    return path.join(resolveShareDirectorySync(), "catalog");
}

function getLibraryFilePath(): string {
    return path.join(getCatalogDir(), "part-library.json");
}

async function ensureCatalogDir() {
    await fs.mkdir(getCatalogDir(), { recursive: true });
}

// ============================================================================
// READ
// ============================================================================

export async function readCatalogLibrary(): Promise<CatalogLibraryFile> {
    try {
        const raw = await fs.readFile(getLibraryFilePath(), "utf-8");
        return JSON.parse(raw) as CatalogLibraryFile;
    } catch {
        return createEmptyCatalogLibrary();
    }
}

// ============================================================================
// WRITE (full)
// ============================================================================

async function writeCatalogLibrary(lib: CatalogLibraryFile): Promise<void> {
    await ensureCatalogDir();
    lib.updatedAt = new Date().toISOString();
    await fs.writeFile(getLibraryFilePath(), JSON.stringify(lib, null, 2), "utf-8");
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function getCatalogEntry(partNumber: string): Promise<PartCatalogRecord | null> {
    const lib = await readCatalogLibrary();
    return lib.entries[partNumber] ?? null;
}

export async function upsertCatalogEntry(record: PartCatalogRecord): Promise<PartCatalogRecord> {
    const lib = await readCatalogLibrary();
    lib.entries[record.partNumber] = record;
    await writeCatalogLibrary(lib);
    return record;
}

export async function deleteCatalogEntry(partNumber: string): Promise<boolean> {
    const lib = await readCatalogLibrary();
    if (!(partNumber in lib.entries)) {
        return false;
    }
    delete lib.entries[partNumber];
    await writeCatalogLibrary(lib);
    return true;
}

export async function bulkImportCatalogEntries(records: PartCatalogRecord[]): Promise<number> {
    const lib = await readCatalogLibrary();
    let count = 0;
    for (const record of records) {
        if (record.partNumber) {
            lib.entries[record.partNumber] = record;
            count++;
        }
    }
    await writeCatalogLibrary(lib);
    return count;
}

export interface CatalogSearchOptions {
    query?: string;
    category?: string;
    limit?: number;
    offset?: number;
}

export interface CatalogSearchResult {
    records: PartCatalogRecord[];
    total: number;
}

export async function searchCatalog(options: CatalogSearchOptions = {}): Promise<CatalogSearchResult> {
    const lib = await readCatalogLibrary();
    let records = Object.values(lib.entries);

    if (options.category) {
        records = records.filter(r => r.category === options.category);
    }

    if (options.query) {
        const q = options.query.toLowerCase();
        records = records.filter(
            r =>
                r.partNumber.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                (r.manufacturer?.toLowerCase().includes(q) ?? false),
        );
    }

    const total = records.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    return {
        records: records.slice(offset, offset + limit),
        total,
    };
}
