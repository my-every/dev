import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { UserRole } from "@/types/d380-user-session";
import type { TrainingModuleV2 } from "@/types/training";
import { resolveShareDirectory } from "@/lib/runtime/share-directory";

async function resolveTrainingPaths() {
    const shareDir = await resolveShareDirectory();
    const trainingBaseDir = path.join(shareDir, "training");
    const categoriesFilePath = path.join(trainingBaseDir, "categories.json");

    return { trainingBaseDir, categoriesFilePath };
}

interface TrainingCategory {
    id: string;
    label: string;
    visibleRoles: UserRole[];
    description?: string;
    order: number;
}

const ALL_ROLES: UserRole[] = [
    "DEVELOPER",
    "MANAGER",
    "SUPERVISOR",
    "TEAM_LEAD",
    "QA",
    "BRANDER",
    "ASSEMBLER",
];

const DEFAULT_CATEGORIES: TrainingCategory[] = [
    {
        id: "app",
        label: "App",
        visibleRoles: ALL_ROLES,
        description: "Application workflows and tools",
        order: 0,
    },
    {
        id: "onboarding",
        label: "Onboarding",
        visibleRoles: ALL_ROLES,
        description: "New team member onboarding",
        order: 1,
    },
    {
        id: "safety",
        label: "Safety",
        visibleRoles: ALL_ROLES,
        description: "Safety procedures and compliance",
        order: 2,
    },
    {
        id: "device",
        label: "Device",
        visibleRoles: ALL_ROLES,
        description: "Device-specific installation training",
        order: 3,
    },
    {
        id: "tool",
        label: "Tool",
        visibleRoles: ALL_ROLES,
        description: "Tool usage and setup guides",
        order: 4,
    },
];

async function ensureDir(dir: string) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeCategory(raw: Partial<TrainingCategory>, index: number): TrainingCategory | null {
    if (!raw.id || !raw.label) return null;

    const roles = Array.isArray(raw.visibleRoles)
        ? raw.visibleRoles.filter((role): role is UserRole => ALL_ROLES.includes(role as UserRole))
        : ALL_ROLES;

    return {
        id: slugify(raw.id),
        label: raw.label.trim(),
        visibleRoles: roles.length > 0 ? roles : ALL_ROLES,
        description: raw.description?.trim() || undefined,
        order: typeof raw.order === "number" ? raw.order : index,
    };
}

async function readCategories(trainingBaseDir: string, categoriesFilePath: string): Promise<TrainingCategory[]> {
    await ensureDir(trainingBaseDir);

    try {
        const raw = await fs.readFile(categoriesFilePath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return DEFAULT_CATEGORIES;
        }

        const normalized = parsed
            .map((entry, index) => normalizeCategory(entry as Partial<TrainingCategory>, index))
            .filter((entry): entry is TrainingCategory => !!entry)
            .sort((a, b) => a.order - b.order);

        return normalized.length > 0 ? normalized : DEFAULT_CATEGORIES;
    } catch {
        await writeCategories(DEFAULT_CATEGORIES);
        return DEFAULT_CATEGORIES;
    }
}

async function writeCategories(categories: TrainingCategory[]): Promise<void> {
    const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
    await ensureDir(trainingBaseDir);
    await fs.writeFile(categoriesFilePath, JSON.stringify(categories, null, 2), "utf-8");
}

async function findJsonFiles(dir: string, categoriesFilePath: string): Promise<string[]> {
    const files: string[] = [];

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const nestedFiles = await findJsonFiles(fullPath, categoriesFilePath);
                files.push(...nestedFiles);
            } else if (entry.isFile() && entry.name.endsWith(".json")) {
                if (fullPath === categoriesFilePath) {
                    continue;
                }
                files.push(fullPath);
            }
        }
    } catch {
        return [];
    }

    return files;
}

async function getTrainingRecords(): Promise<Array<{ training: TrainingModuleV2; filePath: string }>> {
    const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
    const files = await findJsonFiles(trainingBaseDir, categoriesFilePath);
    const records: Array<{ training: TrainingModuleV2; filePath: string }> = [];

    for (const filePath of files) {
        try {
            const raw = await fs.readFile(filePath, "utf-8");
            const training = JSON.parse(raw) as TrainingModuleV2;
            if (training?.id && training?.name) {
                records.push({ training, filePath });
            }
        } catch {
            // Skip invalid files
        }
    }

    return records;
}

async function rewriteTrainingCategories(fromId: string, toId: string): Promise<void> {
    const records = await getTrainingRecords();

    for (const record of records) {
        if (record.training.category !== fromId) continue;
        const updated: TrainingModuleV2 = {
            ...record.training,
            category: toId,
            updatedAt: new Date().toISOString(),
        };
        await fs.writeFile(record.filePath, JSON.stringify(updated, null, 2), "utf-8");
    }
}

export async function GET(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const { searchParams } = new URL(request.url);
        const role = searchParams.get("role") as UserRole | null;

        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const visibleCategories = role
            ? categories.filter((category) => category.visibleRoles.includes(role))
            : categories;

        return NextResponse.json({ categories: visibleCategories });
    } catch (error) {
        console.error("Failed to load training categories:", error);
        return NextResponse.json({ error: "Failed to load training categories" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const body = await request.json() as Partial<TrainingCategory>;
        if (!body.label) {
            return NextResponse.json({ error: "Category label is required" }, { status: 400 });
        }

        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const id = slugify(body.id || body.label);

        if (!id) {
            return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
        }

        if (categories.some((category) => category.id === id)) {
            return NextResponse.json({ error: "Category already exists" }, { status: 409 });
        }

        const newCategory: TrainingCategory = {
            id,
            label: body.label.trim(),
            visibleRoles: Array.isArray(body.visibleRoles) && body.visibleRoles.length > 0
                ? body.visibleRoles.filter((role): role is UserRole => ALL_ROLES.includes(role as UserRole))
                : ALL_ROLES,
            description: body.description?.trim() || undefined,
            order: categories.length,
        };

        const updatedCategories = [...categories, newCategory].sort((a, b) => a.order - b.order);
        await writeCategories(updatedCategories);

        return NextResponse.json({ category: newCategory, categories: updatedCategories });
    } catch (error) {
        console.error("Failed to create training category:", error);
        return NextResponse.json({ error: "Failed to create training category" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const body = await request.json() as Partial<TrainingCategory> & { previousId?: string };
        if (!body.id || !body.label) {
            return NextResponse.json({ error: "Category id and label are required" }, { status: 400 });
        }

        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const previousId = body.previousId || body.id;
        const nextId = slugify(body.id);

        const existingIndex = categories.findIndex((category) => category.id === previousId);
        if (existingIndex === -1) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        const duplicate = categories.find(
            (category, index) => index !== existingIndex && category.id === nextId,
        );
        if (duplicate) {
            return NextResponse.json({ error: "Category id already exists" }, { status: 409 });
        }

        const existing = categories[existingIndex];
        const updatedCategory: TrainingCategory = {
            ...existing,
            id: nextId,
            label: body.label.trim(),
            description: body.description?.trim() || undefined,
            visibleRoles: Array.isArray(body.visibleRoles) && body.visibleRoles.length > 0
                ? body.visibleRoles.filter((role): role is UserRole => ALL_ROLES.includes(role as UserRole))
                : ALL_ROLES,
        };

        const updatedCategories = [...categories];
        updatedCategories[existingIndex] = updatedCategory;
        await writeCategories(updatedCategories);

        if (previousId !== nextId) {
            await rewriteTrainingCategories(previousId, nextId);
        }

        return NextResponse.json({ category: updatedCategory, categories: updatedCategories });
    } catch (error) {
        console.error("Failed to update training category:", error);
        return NextResponse.json({ error: "Failed to update training category" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const body = await request.json() as { id?: string };
        if (!body.id) {
            return NextResponse.json({ error: "Category id is required" }, { status: 400 });
        }

        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const categoryIndex = categories.findIndex((category) => category.id === body.id);
        if (categoryIndex === -1) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        if (categories.length === 1) {
            return NextResponse.json({ error: "At least one category must remain" }, { status: 400 });
        }

        const fallback = categories.find((category) => category.id !== body.id);
        if (!fallback) {
            return NextResponse.json({ error: "No fallback category available" }, { status: 400 });
        }

        await rewriteTrainingCategories(body.id, fallback.id);

        const updatedCategories = categories
            .filter((category) => category.id !== body.id)
            .map((category, index) => ({ ...category, order: index }));

        await writeCategories(updatedCategories);

        return NextResponse.json({ categories: updatedCategories, fallbackCategoryId: fallback.id });
    } catch (error) {
        console.error("Failed to delete training category:", error);
        return NextResponse.json({ error: "Failed to delete training category" }, { status: 500 });
    }
}
