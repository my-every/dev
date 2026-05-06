import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { InstallationTemplate, DetailsTemplate } from "@/types/parts-library";
import { resolveShareDirectory } from "@/lib/runtime/share-directory";

async function resolveTemplatesDir(): Promise<string> {
    const shareRoot = await resolveShareDirectory();
    return path.join(shareRoot, "parts", "_templates");
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as T;
    } catch {
        return defaultValue;
    }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/parts/templates/[type]/[id]
 * Get a specific template
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ type: string; id: string }> }
) {
    const { type, id } = await params;
    const templatesDir = await resolveTemplatesDir();
    
    if (type !== "installation" && type !== "details") {
        return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
    }
    
    const filePath = path.join(templatesDir, type, `${id}.json`);
    const template = await readJsonFile<InstallationTemplate | DetailsTemplate>(
        filePath,
        null as unknown as InstallationTemplate
    );
    
    if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    return NextResponse.json({ template });
}

/**
 * PUT /api/parts/templates/[type]/[id]
 * Update a template
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ type: string; id: string }> }
) {
    const { type, id } = await params;
    const templatesDir = await resolveTemplatesDir();
    
    if (type !== "installation" && type !== "details") {
        return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
    }
    
    const filePath = path.join(templatesDir, type, `${id}.json`);
    const existing = await readJsonFile<InstallationTemplate | DetailsTemplate>(
        filePath,
        null as unknown as InstallationTemplate
    );
    
    if (!existing) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    const body = await request.json() as Partial<InstallationTemplate | DetailsTemplate>;
    
    const updated = {
        ...existing,
        ...body,
        id, // Preserve ID
        version: (existing.version || 0) + 1,
        updatedAt: new Date().toISOString(),
    };
    
    await writeJsonFile(filePath, updated);
    
    return NextResponse.json({ success: true, template: updated });
}

/**
 * DELETE /api/parts/templates/[type]/[id]
 * Delete a template
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ type: string; id: string }> }
) {
    const { type, id } = await params;
    const templatesDir = await resolveTemplatesDir();
    
    if (type !== "installation" && type !== "details") {
        return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
    }
    
    const filePath = path.join(templatesDir, type, `${id}.json`);
    
    try {
        await fs.unlink(filePath);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
}
