import { NextRequest, NextResponse } from "next/server";
import {
    getCategoryManifest,
    getSchemaForCategory,
    setSchemaForCategory,
    searchParts,
    getTypesForCategory,
} from "@/lib/project-state/parts-library-handlers";
import type { PartCategory, DetailSchema } from "@/types/parts-library";
import { PART_CATEGORY_INFO } from "@/types/parts-library";

export const dynamic = "force-dynamic";

/**
 * GET /api/parts/[category]
 * Get category manifest or search parts in category.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ category: string }> }
) {
    const { category } = await params;
    const cat = category as PartCategory;
    
    // Validate category
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const { searchParams } = request.nextUrl;
    
    // Return manifest
    if (searchParams.get("manifest") === "true") {
        const manifest = await getCategoryManifest(cat);
        return NextResponse.json(manifest);
    }
    
    // Return schema
    if (searchParams.get("schema") === "true") {
        const schema = await getSchemaForCategory(cat);
        return NextResponse.json({ schema });
    }
    
    // Return types list
    if (searchParams.get("types") === "true") {
        const types = await getTypesForCategory(cat);
        return NextResponse.json({ types });
    }
    
    // Search parts in category
    const query = searchParams.get("query") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;
    
    const result = await searchParts({ query, category: cat, type, limit, offset });
    return NextResponse.json(result);
}

/**
 * PUT /api/parts/[category]
 * Update category schema.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ category: string }> }
) {
    const { category } = await params;
    const cat = category as PartCategory;
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const body = await request.json() as { schema: DetailSchema };
    
    if (!body.schema) {
        return NextResponse.json({ error: "schema is required" }, { status: 400 });
    }
    
    await setSchemaForCategory(cat, body.schema);
    return NextResponse.json({ success: true });
}
