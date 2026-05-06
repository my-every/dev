import { NextRequest, NextResponse } from "next/server";
import {
    migrateFromCatalog,
    initializePartsStructure,
} from "@/lib/project-state/parts-library-handlers";
import { readCatalogLibrary } from "@/lib/project-state/share-catalog-handlers";

export const dynamic = "force-dynamic";

/**
 * POST /api/parts/migrate
 * Migrate all parts from the old catalog format to the new parts library structure.
 */
export async function POST(_request: NextRequest) {
    try {
        console.log("[v0] Starting parts migration...");
        
        // Initialize structure first
        await initializePartsStructure();
        console.log("[v0] Parts structure initialized");
        
        // Read old catalog
        const catalog = await readCatalogLibrary();
        const entryCount = Object.keys(catalog.entries).length;
        console.log(`[v0] Found ${entryCount} entries in catalog`);
        
        // Migrate entries
        const result = await migrateFromCatalog(catalog.entries);
        console.log(`[v0] Migration complete: ${result.migrated} migrated, ${result.errors.length} errors`);
        
        if (result.errors.length > 0) {
            console.log("[v0] Migration errors:", result.errors.slice(0, 5));
        }
        
        return NextResponse.json({
            success: true,
            migrated: result.migrated,
            errors: result.errors,
            totalInCatalog: entryCount,
        });
    } catch (err) {
        console.error("[v0] Migration failed:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Migration failed" },
            { status: 500 }
        );
    }
}
