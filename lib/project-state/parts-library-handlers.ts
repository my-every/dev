import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";

import type {
    PartRecord,
    PartCategory,
    PartsRootManifest,
    PartsCategoryManifest,
    PartsTypeManifest,
    DetailSchema,
    LEGACY_CATEGORY_MAPPING,
} from "@/types/parts-library";
import {
    PART_CATEGORY_INFO,
    DEFAULT_PART_TYPES,
    getDefaultSchemaForCategory,
} from "@/types/parts-library";

function sanitizeTerminalSchema(terminalSchema: PartRecord["terminalSchema"]): PartRecord["terminalSchema"] {
    if (!terminalSchema) {
        return terminalSchema;
    }

    return {
        negativePatterns: terminalSchema.negativePatterns ?? [],
        updatedAt: terminalSchema.updatedAt,
        terminals: (terminalSchema.terminals ?? []).map((terminal) => ({
            name: terminal.name,
            aliases: terminal.aliases ?? [],
            wireId: terminal.wireId ?? "",
            size: terminal.size ?? "",
            side: terminal.side ?? "unknown",
            tier: terminal.tier ?? "",
            order: terminal.order ?? null,
            isNegative: Boolean(terminal.isNegative),
            hardware: terminal.hardware ?? {},
            hardwareStackId: terminal.hardwareStackId,
            instructions: terminal.instructions ?? [],
        })),
    };
}

function sanitizePartRecord(part: PartRecord): PartRecord {
    return {
        ...part,
        terminalSchema: sanitizeTerminalSchema(part.terminalSchema),
    };
}

function getPartsDir(): string {
    return path.join(resolveShareDirectorySync(), "parts");
}

// ============================================================================
// DIRECTORY HELPERS
// ============================================================================

async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

function joinPath(...segments: string[]): string {
    return segments.filter(Boolean).join('/');
}

function getPartDir(category: PartCategory, type: string): string {
    return joinPath(getPartsDir(), category, type);
}

function getPartFilePath(category: PartCategory, type: string, partNumber: string): string {
    // Sanitize part number for filesystem (replace slashes, etc.)
    const safePartNumber = partNumber.replace(/[/\\:*?"<>|]/g, '_');
    return joinPath(getPartDir(category, type), `${safePartNumber}.json`);
}

function getRootManifestPath(): string {
    return joinPath(getPartsDir(), "manifest.json");
}

function getCategoryManifestPath(category: PartCategory): string {
    return joinPath(getPartsDir(), category, "manifest.json");
}

function getTypeManifestPath(category: PartCategory, type: string): string {
    return joinPath(getPartDir(category, type), "manifest.json");
}

// ============================================================================
// MANIFEST OPERATIONS
// ============================================================================

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as T;
    } catch {
        return defaultValue;
    }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function createEmptyRootManifest(): PartsRootManifest {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        categories: {},
        totalParts: 0,
    };
}

function createEmptyCategoryManifest(category: PartCategory): PartsCategoryManifest {
    return {
        category,
        version: 1,
        updatedAt: new Date().toISOString(),
        types: {},
        schema: getDefaultSchemaForCategory(category),
        totalParts: 0,
    };
}

function createEmptyTypeManifest(category: PartCategory, type: string): PartsTypeManifest {
    return {
        category,
        type,
        version: 1,
        updatedAt: new Date().toISOString(),
        parts: [],
        totalParts: 0,
    };
}

export async function getRootManifest(): Promise<PartsRootManifest> {
    return readJsonFile(getRootManifestPath(), createEmptyRootManifest());
}

export async function getCategoryManifest(category: PartCategory): Promise<PartsCategoryManifest> {
    return readJsonFile(getCategoryManifestPath(category), createEmptyCategoryManifest(category));
}

export async function getTypeManifest(category: PartCategory, type: string): Promise<PartsTypeManifest> {
    return readJsonFile(getTypeManifestPath(category, type), createEmptyTypeManifest(category, type));
}

async function updateRootManifest(): Promise<void> {
    const rootManifest = await getRootManifest();
    
    // Scan All Categories
    let totalParts = 0;
    const categories: PartsRootManifest['categories'] = {};
    
    for (const category of Object.keys(PART_CATEGORY_INFO) as PartCategory[]) {
        try {
            const categoryManifest = await getCategoryManifest(category);
            if (categoryManifest.totalParts > 0) {
                categories[category] = {
                    count: categoryManifest.totalParts,
                    types: Object.keys(categoryManifest.types),
                };
                totalParts += categoryManifest.totalParts;
            }
        } catch {
            // Category doesn't exist yet
        }
    }
    
    rootManifest.categories = categories;
    rootManifest.totalParts = totalParts;
    rootManifest.updatedAt = new Date().toISOString();
    
    await writeJsonFile(getRootManifestPath(), rootManifest);
}

async function updateCategoryManifest(category: PartCategory): Promise<void> {
    const categoryManifest = await getCategoryManifest(category);
    
    // Scan all types in this category
    let totalParts = 0;
    const types: PartsCategoryManifest['types'] = {};
    
    const categoryDir = path.join(getPartsDir(), category);
    try {
        const entries = await fs.readdir(categoryDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const typeManifest = await getTypeManifest(category, entry.name);
                if (typeManifest.totalParts > 0) {
                    types[entry.name] = {
                        count: typeManifest.totalParts,
                        label: entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    };
                    totalParts += typeManifest.totalParts;
                }
            }
        }
    } catch {
        // Directory doesn't exist yet
    }
    
    categoryManifest.types = types;
    categoryManifest.totalParts = totalParts;
    categoryManifest.updatedAt = new Date().toISOString();
    
    await writeJsonFile(getCategoryManifestPath(category), categoryManifest);
}

async function updateTypeManifest(
    category: PartCategory,
    type: string,
    expectedPartNumbers: string[] = [],
): Promise<void> {
    const typeManifest = await getTypeManifest(category, type);
    
    // Scan all part files in this type directory
    const parts: PartsTypeManifest['parts'] = [];
    
    const knownPartNumbers = new Set<string>([
        ...typeManifest.parts.map(item => item.partNumber),
        ...expectedPartNumbers,
    ]);

    for (const partNumber of knownPartNumbers) {
        const partPath = getPartFilePath(category, type, partNumber);
        const part = await readJsonFile<PartRecord | null>(partPath, null);
        if (part) {
            parts.push({
                partNumber: part.partNumber,
                description: part.description,
                updatedAt: part.updatedAt,
            });
        }
    }
    
    typeManifest.parts = parts;
    typeManifest.totalParts = parts.length;
    typeManifest.updatedAt = new Date().toISOString();
    
    await writeJsonFile(getTypeManifestPath(category, type), typeManifest);
}

// ============================================================================
// PART CRUD OPERATIONS
// ============================================================================

export async function getPart(
    category: PartCategory,
    type: string,
    partNumber: string
): Promise<PartRecord | null> {
    const filePath = getPartFilePath(category, type, partNumber);
    return readJsonFile<PartRecord | null>(filePath, null);
}

export async function getPartByNumber(partNumber: string): Promise<PartRecord | null> {
    // Search through All Categories and types
    const rootManifest = await getRootManifest();
    
    for (const [category, info] of Object.entries(rootManifest.categories)) {
        if (!info) continue;
        for (const type of info.types) {
            const part = await getPart(category as PartCategory, type, partNumber);
            if (part) return part;
        }
    }
    
    return null;
}

export async function createPart(part: PartRecord): Promise<PartRecord> {
    part = sanitizePartRecord(part);
    const { category, type, partNumber } = part;
    
    // Ensure directory exists
    await ensureDir(getPartDir(category, type));
    
    // Set timestamps
    const now = new Date().toISOString();
    part.createdAt = now;
    part.updatedAt = now;
    
    // Write part file
    await writeJsonFile(getPartFilePath(category, type, partNumber), part);
    
    // Update manifests
    await updateTypeManifest(category, type, [partNumber]);
    await updateCategoryManifest(category);
    await updateRootManifest();
    
    return part;
}

export async function updatePart(part: PartRecord): Promise<PartRecord> {
    part = sanitizePartRecord(part);
    const { category, type, partNumber } = part;
    
    // Check if part exists
    const existing = await getPart(category, type, partNumber);
    if (!existing) {
        throw new Error(`Part ${partNumber} not found`);
    }
    
    // Preserve created timestamp
    part.createdAt = existing.createdAt;
    part.updatedAt = new Date().toISOString();
    
    // Write updated part
    await writeJsonFile(getPartFilePath(category, type, partNumber), part);
    
    // Update manifests
    await updateTypeManifest(category, type, [partNumber]);
    await updateCategoryManifest(category);
    await updateRootManifest();
    
    return part;
}

export async function deletePart(
    category: PartCategory,
    type: string,
    partNumber: string
): Promise<boolean> {
    const filePath = getPartFilePath(category, type, partNumber);
    
    try {
        await fs.unlink(filePath);
        
        // Update manifests
        await updateTypeManifest(category, type);
        await updateCategoryManifest(category);
        await updateRootManifest();
        
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// SEARCH & QUERY
// ============================================================================

export interface PartsSearchOptions {
    query?: string;
    category?: PartCategory;
    type?: string;
    limit?: number;
    offset?: number;
}

export interface PartsSearchResult {
    parts: PartRecord[];
    total: number;
}

export async function searchParts(options: PartsSearchOptions = {}): Promise<PartsSearchResult> {
    const { query, category, type, limit = 100, offset = 0 } = options;
    
    const allParts: PartRecord[] = [];
    const rootManifest = await getRootManifest();
    
    // Filter categories to search
    const categoriesToSearch = category 
        ? [category] 
        : (Object.keys(rootManifest.categories) as PartCategory[]);
    
    for (const cat of categoriesToSearch) {
        const catInfo = rootManifest.categories[cat];
        if (!catInfo) continue;
        
        // Filter types to search
        const typesToSearch = type 
            ? [type] 
            : catInfo.types;
        
        for (const t of typesToSearch) {
            const typeManifest = await getTypeManifest(cat, t);
            try {
                for (const item of typeManifest.parts) {
                    const partPath = getPartFilePath(cat, t, item.partNumber);
                    const part = await readJsonFile<PartRecord | null>(partPath, null);
                    if (part) {
                        allParts.push(part);
                    } else {
                        // Fallback: create a minimal PartRecord from manifest data
                        // This handles cases where manifest exists but part files are missing
                        allParts.push({
                            partNumber: item.partNumber,
                            description: item.description ?? 'No description',
                            category: cat,
                            type: t,
                            createdAt: item.updatedAt ?? new Date().toISOString(),
                            updatedAt: item.updatedAt ?? new Date().toISOString(),
                        });
                    }
                }
            } catch {
                // Directory doesn't exist
            }
        }
    }
    
    // Filter by query
    let filtered = allParts;
    if (query) {
        const q = query.toLowerCase();
        filtered = allParts.filter(
            p =>
                p.partNumber.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                (p.manufacturer?.toLowerCase().includes(q) ?? false) ||
                (p.tags?.some(t => t.toLowerCase().includes(q)) ?? false)
        );
    }
    
    const total = filtered.length;
    
    return {
        parts: filtered.slice(offset, offset + limit),
        total,
    };
}

// ============================================================================
// SCHEMA OPERATIONS
// ============================================================================

export async function getSchemaForCategory(category: PartCategory): Promise<DetailSchema | undefined> {
    const manifest = await getCategoryManifest(category);
    return manifest.schema ?? getDefaultSchemaForCategory(category);
}

export async function getSchemaForType(category: PartCategory, type: string): Promise<DetailSchema | undefined> {
    const typeManifest = await getTypeManifest(category, type);
    if (typeManifest.schema) return typeManifest.schema;
    
    const categoryManifest = await getCategoryManifest(category);
    return categoryManifest.schema ?? getDefaultSchemaForCategory(category);
}

export async function setSchemaForCategory(category: PartCategory, schema: DetailSchema): Promise<void> {
    const manifest = await getCategoryManifest(category);
    manifest.schema = schema;
    manifest.updatedAt = new Date().toISOString();
    await writeJsonFile(getCategoryManifestPath(category), manifest);
}

export async function setSchemaForType(
    category: PartCategory,
    type: string,
    schema: DetailSchema
): Promise<void> {
    const manifest = await getTypeManifest(category, type);
    manifest.schema = schema;
    manifest.updatedAt = new Date().toISOString();
    await writeJsonFile(getTypeManifestPath(category, type), manifest);
}

// ============================================================================
// MIGRATION FROM OLD CATALOG
// ============================================================================

import type { PartCatalogRecord } from "@/types/d380-catalog";
import { LEGACY_CATEGORY_MAPPING as MAPPING } from "@/types/parts-library";

export async function migrateFromCatalog(
    catalogEntries: Record<string, PartCatalogRecord>
): Promise<{ migrated: number; errors: string[] }> {
    let migrated = 0;
    const errors: string[] = [];
    
    for (const [partNumber, entry] of Object.entries(catalogEntries)) {
        try {
            // Map old category to new structure
            const mapping = MAPPING[entry.category] ?? { category: 'unknown' as PartCategory, type: 'uncategorized' };
            
            // Convert to new PartRecord format
            const part: PartRecord = {
                partNumber: entry.partNumber,
                description: entry.description,
                category: mapping.category,
                type: mapping.type,
                images: {
                    icon: entry.images?.icon,
                    gallery: entry.images?.images,
                },
                manufacturer: entry.manufacturer,
                manufacturerPartNumber: entry.manufacturerPartNumber,
                alternatePartNumbers: entry.alternatePartNumbers,
                associatedParts: entry.associatedParts?.map(ap => ({
                    partNumber: ap.partNumber,
                    operationship: ap.operationship.toLowerCase() as 'requires' | 'recommended' | 'alternative' | 'accessory',
                    quantity: ap.quantity,
                    notes: ap.description,
                })),
                details: {
                    voltageRating: entry.voltageRating,
                    currentRating: entry.currentRating,
                    wireGauges: entry.wireGauges,
                    mountType: entry.mountType,
                    devicePrefixes: entry.devicePrefixes,
                },
                tags: [entry.category, entry.subcategory].filter(Boolean) as string[],
                source: 'migrated',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            await createPart(part);
            migrated++;
        } catch (err) {
            errors.push(`Failed to migrate ${partNumber}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    
    return { migrated, errors };
}

// ============================================================================
// TYPE MANAGEMENT (Create, Rename, Delete)
// ============================================================================

/**
 * Create a new type within a category
 */
export async function createType(
    category: PartCategory,
    type: string,
    label?: string,
    schema?: DetailSchema
): Promise<void> {
    const typeDir = getPartDir(category, type);
    await ensureDir(typeDir);
    
    const manifest = createEmptyTypeManifest(category, type);
    if (schema) {
        manifest.schema = schema;
    }
    await writeJsonFile(getTypeManifestPath(category, type), manifest);
    
    // Update category manifest
    await updateCategoryManifest(category);
    await updateRootManifest();
}

/**
 * Rename a type (moves the folder and updates all references)
 */
export async function renameType(
    category: PartCategory,
    oldType: string,
    newType: string
): Promise<{ success: boolean; movedParts: number; error?: string }> {
    const oldDir = getPartDir(category, oldType);
    const newDir = getPartDir(category, newType);
    
    try {
        // Check if old directory exists
        await fs.access(oldDir);
    } catch {
        return { success: false, movedParts: 0, error: `Type "${oldType}" not found` };
    }
    
    try {
        // Check if new directory already exists
        await fs.access(newDir);
        return { success: false, movedParts: 0, error: `Type "${newType}" already exists` };
    } catch {
        // Good - new directory doesn't exist
    }
    
    // Read all parts from old type to update their type field
    const oldManifest = await getTypeManifest(category, oldType);
    const partCount = oldManifest.totalParts;
    const partNumbers = oldManifest.parts.map((item) => item.partNumber);
    
    // Rename the directory
    await fs.rename(oldDir, newDir);
    
    // Update all part files with new type
    for (const partNumber of partNumbers) {
        const partPath = getPartFilePath(category, newType, partNumber);
        const part = await readJsonFile<PartRecord>(partPath, null as unknown as PartRecord);
        if (part) {
            part.type = newType;
            part.updatedAt = new Date().toISOString();
            await writeJsonFile(partPath, part);
        }
    }
    
    // Update the type manifest with new type name
    const newManifest = await getTypeManifest(category, newType);
    newManifest.type = newType;
    newManifest.updatedAt = new Date().toISOString();
    await writeJsonFile(getTypeManifestPath(category, newType), newManifest);
    
    // Update category and root manifests
    await updateCategoryManifest(category);
    await updateRootManifest();
    
    return { success: true, movedParts: partCount };
}

/**
 * Delete a type and all its parts
 */
export async function deleteType(
    category: PartCategory,
    type: string
): Promise<{ success: boolean; deletedParts: number; error?: string }> {
    const typeDir = getPartDir(category, type);
    
    try {
        await fs.access(typeDir);
    } catch {
        return { success: false, deletedParts: 0, error: `Type "${type}" not found` };
    }
    
    // Count parts before deletion
    const manifest = await getTypeManifest(category, type);
    const partCount = manifest.totalParts;
    
    // Delete the entire directory recursively
    await fs.rm(typeDir, { recursive: true, force: true });
    
    // Update manifests
    await updateCategoryManifest(category);
    await updateRootManifest();
    
    return { success: true, deletedParts: partCount };
}

/**
 * Get all types for a category with their metadata
 */
export async function getTypesForCategory(
    category: PartCategory
): Promise<Array<{ type: string; label: string; partCount: number; hasSchema: boolean }>> {
    const manifest = await getCategoryManifest(category);
    const types: Array<{ type: string; label: string; partCount: number; hasSchema: boolean }> = [];
    
    for (const [typeName, typeInfo] of Object.entries(manifest.types)) {
        const typeManifest = await getTypeManifest(category, typeName);
        types.push({
            type: typeName,
            label: typeInfo.label,
            partCount: typeInfo.count,
            hasSchema: !!typeManifest.schema,
        });
    }
    
    return types;
}

// ============================================================================
// INITIALIZE PARTS STRUCTURE
// ============================================================================

export async function initializePartsStructure(): Promise<void> {
    // Ensure root parts directory exists
    await ensureDir(getPartsDir());
    
    // Create root manifest if it doesn't exist
    const rootPath = getRootManifestPath();
    try {
        await fs.access(rootPath);
    } catch {
        await writeJsonFile(rootPath, createEmptyRootManifest());
    }
    
    // Create category directories with manifests
    for (const category of Object.keys(PART_CATEGORY_INFO) as PartCategory[]) {
        const categoryDir = path.join(getPartsDir(), category);
        await ensureDir(categoryDir);
        
        const categoryManifestPath = getCategoryManifestPath(category);
        try {
            await fs.access(categoryManifestPath);
        } catch {
            await writeJsonFile(categoryManifestPath, createEmptyCategoryManifest(category));
        }
        
        // Create default type directories
        const defaultTypes = DEFAULT_PART_TYPES[category] ?? [];
        for (const type of defaultTypes) {
            const typeDir = getPartDir(category, type);
            await ensureDir(typeDir);
            
            const typeManifestPath = getTypeManifestPath(category, type);
            try {
                await fs.access(typeManifestPath);
            } catch {
                await writeJsonFile(typeManifestPath, createEmptyTypeManifest(category, type));
            }
        }
    }
}
