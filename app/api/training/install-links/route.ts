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

type TrainingCategory = {
    id: string
    label: string
    visibleRoles: UserRole[]
    description?: string
    order: number
}

const ALL_ROLES: UserRole[] = [
    "DEVELOPER",
    "MANAGER",
    "SUPERVISOR",
    "TEAM_LEAD",
    "QA",
    "BRANDER",
    "ASSEMBLER",
]

const DEFAULT_CATEGORIES: TrainingCategory[] = [
    { id: "app", label: "App", visibleRoles: ALL_ROLES, order: 0 },
    { id: "onboarding", label: "Onboarding", visibleRoles: ALL_ROLES, order: 1 },
    { id: "safety", label: "Safety", visibleRoles: ALL_ROLES, order: 2 },
    { id: "device", label: "Device", visibleRoles: ALL_ROLES, order: 3 },
    { id: "tool", label: "Tool", visibleRoles: ALL_ROLES, order: 4 },
]

async function ensureDir(dir: string) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeTraining(raw: unknown): TrainingModuleV2 | null {
    if (!raw || typeof raw !== "object") return null;

    const parsed = raw as Partial<TrainingModuleV2>;
    if (!parsed.id || !parsed.name) return null;

    return {
        ...parsed,
        id: parsed.id,
        name: parsed.name,
        slug: parsed.slug || parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        category: parsed.category,
        partNumbers: toStringArray(parsed.partNumbers),
        enabledStages: toStringArray(parsed.enabledStages) as TrainingModuleV2["enabledStages"],
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        tags: toStringArray(parsed.tags),
        difficulty: parsed.difficulty || "intermediate",
        status: parsed.status || "draft",
        version: parsed.version || 1,
        createdAt: parsed.createdAt || parsed.updatedAt || new Date(0).toISOString(),
        updatedAt: parsed.updatedAt || parsed.createdAt || new Date(0).toISOString(),
    };
}

async function findJsonFiles(dir: string, categoriesFilePath: string): Promise<string[]> {
    const files: string[] = [];

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const nested = await findJsonFiles(fullPath, categoriesFilePath);
                files.push(...nested);
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

function normalizeCategory(raw: unknown, index: number): TrainingCategory | null {
    if (!raw || typeof raw !== "object") return null;
    const parsed = raw as Partial<TrainingCategory>;
    if (!parsed.id || !parsed.label) return null;

    const visibleRoles = Array.isArray(parsed.visibleRoles)
        ? parsed.visibleRoles.filter((role): role is UserRole => ALL_ROLES.includes(role as UserRole))
        : ALL_ROLES;

    return {
        id: parsed.id,
        label: parsed.label,
        description: parsed.description,
        visibleRoles: visibleRoles.length > 0 ? visibleRoles : ALL_ROLES,
        order: typeof parsed.order === "number" ? parsed.order : index,
    };
}

async function readCategories(trainingBaseDir: string, categoriesFilePath: string): Promise<TrainingCategory[]> {
    await ensureDir(trainingBaseDir);

    try {
        const raw = await fs.readFile(categoriesFilePath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;

        const categories = parsed
            .map((entry, index) => normalizeCategory(entry, index))
            .filter((entry): entry is TrainingCategory => !!entry)
            .sort((a, b) => a.order - b.order);

        return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
    } catch {
        return DEFAULT_CATEGORIES;
    }
}

async function getAllTrainings(trainingBaseDir: string, categoriesFilePath: string): Promise<TrainingModuleV2[]> {
    await ensureDir(trainingBaseDir);
    const files = await findJsonFiles(trainingBaseDir, categoriesFilePath);

    const trainings: TrainingModuleV2[] = [];
    for (const filePath of files) {
        try {
            const raw = await fs.readFile(filePath, "utf-8");
            const training = normalizeTraining(JSON.parse(raw));
            if (training) trainings.push(training);
        } catch {
            // skip invalid files
        }
    }

    return trainings.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function GET(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const { searchParams } = new URL(request.url);
        const partNumber = searchParams.get("partNumber");
        const badgeNumber = searchParams.get("badgeNumber") || "";
        const role = searchParams.get("role") as UserRole | null;

        if (!partNumber) {
            return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
        }

        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const categoryMap = new Map(categories.map((entry) => [entry.id, entry]));
        const trainings = await getAllTrainings(trainingBaseDir, categoriesFilePath);

        const related = trainings
            .filter((training) => training.status === "published")
            .filter((training) => (training.partNumbers ?? []).includes(partNumber))
            .filter((training) => {
                if (!role) return true;
                const category = categoryMap.get(training.category || "");
                return category ? category.visibleRoles.includes(role) : true;
            })
            .map((training) => ({
                id: training.id,
                name: training.name,
                category: training.category || null,
                difficulty: training.difficulty,
                visibility: training.visibility || "everyone",
                stageCount: training.enabledStages?.length ?? 0,
                estimatedMinutes: training.totalEstimatedMinutes ?? null,
                openPageUrl: badgeNumber
                    ? `/${badgeNumber}/training/${training.id}`
                    : `/training/${training.id}`,
                openModalToken: training.id,
                pdfDownloadHint: badgeNumber
                    ? `/${badgeNumber}/training/${training.id}?export=pdf`
                    : `/training/${training.id}?export=pdf`,
            }));

        return NextResponse.json({
            partNumber,
            total: related.length,
            modules: related,
        });
    } catch (error) {
        console.error("Failed to build training install links:", error);
        return NextResponse.json({ error: "Failed to build training install links" }, { status: 500 });
    }
}
