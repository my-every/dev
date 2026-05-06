import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { InstallationTemplate, DetailsTemplate, PartCategory } from "@/types/parts-library";
import { resolveShareDirectory } from "@/lib/runtime/share-directory";

async function resolveTemplatesDir(): Promise<string> {
    const shareRoot = await resolveShareDirectory();
    return path.join(shareRoot, "parts", "_templates");
}

async function ensureTemplatesDir(templatesDir: string) {
    try {
        await fs.access(templatesDir);
    } catch {
        await fs.mkdir(templatesDir, { recursive: true });
        // Create subdirectories
        await fs.mkdir(path.join(templatesDir, "installation"), { recursive: true });
        await fs.mkdir(path.join(templatesDir, "details"), { recursive: true });
    }
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
 * GET /api/parts/templates
 * Get all templates or filter by type/category
 */
export async function GET(request: NextRequest) {
    const templatesDir = await resolveTemplatesDir();
    await ensureTemplatesDir(templatesDir);
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'installation' | 'details'
    const category = searchParams.get("category") as PartCategory | null;
    const partType = searchParams.get("partType");
    
    const templates: Array<InstallationTemplate | DetailsTemplate> = [];
    
    // Load installation templates
    if (!type || type === "installation") {
        const installDir = path.join(templatesDir, "installation");
        try {
            const files = await fs.readdir(installDir);
            for (const file of files) {
                if (file.endsWith(".json")) {
                    const template = await readJsonFile<InstallationTemplate>(
                        path.join(installDir, file),
                        null as unknown as InstallationTemplate
                    );
                    if (template) {
                        // Filter by category if specified
                        if (category && template.category !== category) continue;
                        if (partType && template.type && template.type !== partType) continue;
                        templates.push(template);
                    }
                }
            }
        } catch {
            // Directory doesn't exist yet
        }
    }
    
    // Load details templates
    if (!type || type === "details") {
        const detailsDir = path.join(templatesDir, "details");
        try {
            const files = await fs.readdir(detailsDir);
            for (const file of files) {
                if (file.endsWith(".json")) {
                    const template = await readJsonFile<DetailsTemplate>(
                        path.join(detailsDir, file),
                        null as unknown as DetailsTemplate
                    );
                    if (template) {
                        if (category && template.category !== category) continue;
                        if (partType && template.type && template.type !== partType) continue;
                        templates.push(template);
                    }
                }
            }
        } catch {
            // Directory doesn't exist yet
        }
    }
    
    return NextResponse.json({ templates });
}

/**
 * POST /api/parts/templates
 * Create a new template
 */
export async function POST(request: NextRequest) {
    const templatesDir = await resolveTemplatesDir();
    await ensureTemplatesDir(templatesDir);
    
    const body = await request.json() as {
        type: "installation" | "details";
        template: InstallationTemplate | DetailsTemplate;
    };
    
    const { type, template } = body;
    
    if (!type || !template) {
        return NextResponse.json(
            { error: "type and template are required" },
            { status: 400 }
        );
    }
    
    // Generate ID if not provided
    if (!template.id) {
        template.id = `${template.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    }
    
    // Set timestamps
    const now = new Date().toISOString();
    template.createdAt = now;
    template.updatedAt = now;
    template.version = 1;
    
    // Write template file
    const dir = path.join(templatesDir, type);
    await fs.mkdir(dir, { recursive: true });
    await writeJsonFile(path.join(dir, `${template.id}.json`), template);
    
    return NextResponse.json({ success: true, template });
}
