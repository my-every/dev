import { NextRequest, NextResponse } from "next/server";
import {
    getTypeManifest,
    getSchemaForType,
    setSchemaForType,
    searchParts,
    createType,
    renameType,
    deleteType,
} from "@/lib/project-state/parts-library-handlers";
import type { PartCategory, DetailSchema } from "@/types/parts-library";
import { PART_CATEGORY_INFO } from "@/types/parts-library";

export const dynamic = "force-dynamic";

/**
 * GET /api/parts/[category]/[type]
 * Get type manifest, schema, or search parts.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string }> }
) {
    const { category, type } = await params;
    const cat = category as PartCategory;
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const { searchParams } = request.nextUrl;
    
    // Return manifest
    if (searchParams.get("manifest") === "true") {
        const manifest = await getTypeManifest(cat, type);
        return NextResponse.json(manifest);
    }
    
    // Return schema (type-specific or fallback to category)
    if (searchParams.get("schema") === "true") {
        const schema = await getSchemaForType(cat, type);
        return NextResponse.json({ schema });
    }
    
    // Search parts in type
    const query = searchParams.get("query") ?? undefined;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;
    
    const result = await searchParts({ query, category: cat, type, limit, offset });
    return NextResponse.json(result);
}

/**
 * POST /api/parts/[category]/[type]
 * Create a new type.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string }> }
) {
    const { category, type } = await params;
    const cat = category as PartCategory;
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const body = await request.json() as { label?: string; schema?: DetailSchema };
    
    try {
        await createType(cat, type, body.label, body.schema);
        return NextResponse.json({ success: true, type });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create type" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/parts/[category]/[type]
 * Update type schema or rename type.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string }> }
) {
    const { category, type } = await params;
    const cat = category as PartCategory;
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const body = await request.json() as { 
        schema?: DetailSchema;
        newName?: string;
    };
    
    // Handle rename
    if (body.newName) {
        const result = await renameType(cat, type, body.newName);
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ 
            success: true, 
            oldType: type, 
            newType: body.newName,
            movedParts: result.movedParts 
        });
    }
    
    // Handle schema update
    if (body.schema) {
        await setSchemaForType(cat, type, body.schema);
        return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: "No valid operation specified" }, { status: 400 });
}

/**
 * DELETE /api/parts/[category]/[type]
 * Delete a type and all its parts.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string }> }
) {
    const { category, type } = await params;
    const cat = category as PartCategory;
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const result = await deleteType(cat, type);
    
    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ 
        success: true, 
        deletedParts: result.deletedParts 
    });
}
