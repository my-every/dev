import { NextRequest, NextResponse } from "next/server";
import {
    getPart,
    updatePart,
    deletePart,
} from "@/lib/project-state/parts-library-handlers";
import type { PartCategory, PartRecord } from "@/types/parts-library";
import { PART_CATEGORY_INFO } from "@/types/parts-library";

export const dynamic = "force-dynamic";

/**
 * GET /api/parts/[category]/[type]/[partNumber]
 * Get a specific part.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string; partNumber: string }> }
) {
    const { category, type, partNumber } = await params;
    const cat = category as PartCategory;
    const decoded = decodeURIComponent(partNumber);
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const part = await getPart(cat, type, decoded);
    
    if (!part) {
        return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    
    return NextResponse.json({ part });
}

/**
 * PUT /api/parts/[category]/[type]/[partNumber]
 * Update a part.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string; partNumber: string }> }
) {
    const { category, type, partNumber } = await params;
    const cat = category as PartCategory;
    const decoded = decodeURIComponent(partNumber);
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const body = await request.json() as Partial<PartRecord>;
    
    try {
        const part = await updatePart({
            ...body,
            partNumber: decoded,
            category: cat,
            type,
        } as PartRecord);
        
        return NextResponse.json({ part });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to update part" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/parts/[category]/[type]/[partNumber]
 * Delete a part.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ category: string; type: string; partNumber: string }> }
) {
    const { category, type, partNumber } = await params;
    const cat = category as PartCategory;
    const decoded = decodeURIComponent(partNumber);
    
    if (!PART_CATEGORY_INFO[cat]) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    const deleted = await deletePart(cat, type, decoded);
    
    if (!deleted) {
        return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
}
