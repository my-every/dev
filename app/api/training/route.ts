import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { UserRole } from "@/types/d380-user-session";
import type { TrainingModuleV2, TrainingSummary } from "@/types/training";
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
    { id: "app", label: "App", visibleRoles: ALL_ROLES, description: "Application workflows and tools", order: 0 },
    { id: "onboarding", label: "Onboarding", visibleRoles: ALL_ROLES, description: "New team member onboarding", order: 1 },
    { id: "safety", label: "Safety", visibleRoles: ALL_ROLES, description: "Safety procedures and compliance", order: 2 },
    { id: "device", label: "Device", visibleRoles: ALL_ROLES, description: "Device-specific installation training", order: 3 },
    { id: "tool", label: "Tool", visibleRoles: ALL_ROLES, description: "Tool usage and setup guides", order: 4 },
]

async function ensureDir(dir: string) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

/**
 * Get the path to a training module JSON file
 * Structure: Share/training/<category>/<type>/<id>.json
 * Falls back to: Share/training/<id>.json if no category/type
 */
function getTrainingPath(trainingBaseDir: string, training: { id: string; category?: string; type?: string }): string {
    const safeId = `${sanitizePathSegment(training.id)}.json`;
    const safeCategory = training.category ? sanitizePathSegment(training.category) : "";
    const safeType = training.type ? sanitizePathSegment(training.type) : "";

    if (safeCategory && safeType) {
        return `${trainingBaseDir}/${safeCategory}/${safeType}/${safeId}`;
    } else if (safeCategory) {
        return `${trainingBaseDir}/${safeCategory}/${safeId}`;
    }

    return `${trainingBaseDir}/${safeId}`;
}

/**
 * Recursively find all JSON files in a directory
 */
async function findJsonFiles(dir: string, categoriesFilePath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await findJsonFiles(fullPath, categoriesFilePath);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith(".json")) {
                if (fullPath === categoriesFilePath) {
                    continue;
                }
                files.push(fullPath);
            }
        }
    } catch {
        // Directory doesn't exist or not readable
    }
    
    return files;
}

function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeStageRoleArray(value: unknown): TrainingModuleV2["competencyTargets"]["stages"] {
    return Array.isArray(value) ? value.filter((item): item is TrainingModuleV2["competencyTargets"]["stages"][number] => typeof item === "string") : [];
}

function normalizeCategoryRoleArray(value: unknown): UserRole[] {
    if (!Array.isArray(value)) return ALL_ROLES;

    const roles = value.filter((role): role is UserRole => ALL_ROLES.includes(role as UserRole));
    return roles.length > 0 ? roles : ALL_ROLES;
}

function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "").trim();
}

function normalizeCategory(raw: unknown, index: number): TrainingCategory | null {
    if (!raw || typeof raw !== "object") return null;
    const parsed = raw as Partial<TrainingCategory>;
    if (!parsed.id || !parsed.label) return null;

    return {
        id: slugify(parsed.id),
        label: parsed.label.trim(),
        description: parsed.description?.trim() || undefined,
        visibleRoles: normalizeCategoryRoleArray(parsed.visibleRoles),
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
        await fs.writeFile(categoriesFilePath, JSON.stringify(DEFAULT_CATEGORIES, null, 2), "utf-8");
        return DEFAULT_CATEGORIES;
    }
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
        coverImage: {
            imageUrl: parsed.coverImage?.imageUrl || "",
            alt: parsed.coverImage?.alt || "",
            caption: parsed.coverImage?.caption || "",
        },
        visibility: parsed.visibility === "restricted" ? "restricted" : "everyone",
        visibleRoles: normalizeCategoryRoleArray(parsed.visibleRoles),
        category: parsed.category,
        partNumbers: toStringArray(parsed.partNumbers),
        competencyTargets: {
            stages: normalizeStageRoleArray(parsed.competencyTargets?.stages),
            partNumbers: toStringArray(parsed.competencyTargets?.partNumbers).map((value) => value.trim().toUpperCase()),
            deviceFamilies: toStringArray(parsed.competencyTargets?.deviceFamilies),
            qualificationLevel: parsed.competencyTargets?.qualificationLevel ?? "trainee",
            relatedIntakeTemplateIds: toStringArray(parsed.competencyTargets?.relatedIntakeTemplateIds),
        },
        trainingTriggerRules: {
            requiredForStages: normalizeStageRoleArray(parsed.trainingTriggerRules?.requiredForStages),
            requiredForPartNumbers: toStringArray(parsed.trainingTriggerRules?.requiredForPartNumbers).map((value) => value.trim().toUpperCase()),
            autoAssignOnMissingCompetency: Boolean(parsed.trainingTriggerRules?.autoAssignOnMissingCompetency),
        },
        progressTracking: {
            requireAssessment: Boolean(parsed.progressTracking?.requireAssessment),
            requireLeadReview: Boolean(parsed.progressTracking?.requireLeadReview),
            milestoneLabels: toStringArray(parsed.progressTracking?.milestoneLabels),
        },
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

async function getAllTrainings(trainingBaseDir: string, categoriesFilePath: string): Promise<TrainingModuleV2[]> {
    await ensureDir(trainingBaseDir);
    
    try {
        const jsonFiles = await findJsonFiles(trainingBaseDir, categoriesFilePath);
        
        const trainings: TrainingModuleV2[] = [];
        for (const filePath of jsonFiles) {
            try {
                const content = await fs.readFile(filePath, "utf-8");
                const parsed = JSON.parse(content);
                const normalized = normalizeTraining(parsed);
                // Only include valid training modules (must have id and name)
                if (normalized) {
                    trainings.push(normalized);
                }
            } catch {
                // Skip invalid files
            }
        }
        
        return trainings.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    } catch {
        return [];
    }
}

export async function GET(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const partNumber = searchParams.get("partNumber");
        const category = searchParams.get("category");
        const role = searchParams.get("role") as UserRole | null;
        
        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const categoryMap = new Map(categories.map(entry => [entry.id, entry]));
        let trainings = await getAllTrainings(trainingBaseDir, categoriesFilePath);

        // Filter by role visibility restrictions
        if (role) {
            trainings = trainings.filter(training => {
                const categoryId = training.category || categories[0]?.id || "app";
                const categoryEntry = categoryMap.get(categoryId);
                if (!categoryEntry) return true;
                return categoryEntry.visibleRoles.includes(role);
            });
        }

        // Filter by training category
        if (category && category !== "all") {
            trainings = trainings.filter(training => (training.category || "") === category);
        }
        
        // Filter by part number (for Install tab lookup)
        if (partNumber) {
            trainings = trainings.filter(t => 
                (t.partNumbers ?? []).includes(partNumber) && t.status === "published"
            );
        }
        
        // Filter by status
        if (status && status !== "all") {
            trainings = trainings.filter(t => t.status === status);
        }
        
        // Filter by search query
        if (search) {
            const query = search.toLowerCase();
            trainings = trainings.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query) ||
                t.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        // Convert to summaries for list view
        const summaries: TrainingSummary[] = trainings.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            status: t.status,
            difficulty: t.difficulty,
            category: t.category,
            coverImageUrl: t.coverImage?.imageUrl || "",
            visibility: t.visibility || "everyone",
            partCount: t.partNumbers?.length ?? 0,
            stageCount: t.enabledStages?.length ?? 0,
            sectionCount: t.sections?.length ?? 0,
            totalEstimatedMinutes: t.totalEstimatedMinutes,
            updatedAt: t.updatedAt,
        }));
        
        return NextResponse.json({ trainings: summaries });
    } catch (error) {
        console.error("Failed to get trainings:", error);
        return NextResponse.json(
            { error: "Failed to get trainings" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { trainingBaseDir, categoriesFilePath } = await resolveTrainingPaths();
        const module: TrainingModuleV2 = await request.json();
        const categories = await readCategories(trainingBaseDir, categoriesFilePath);
        const categoryIds = new Set(categories.map(category => category.id));
        const defaultCategory = categories[0]?.id || "app";
        
        // Validate required fields
        if (!module.id || !module.name) {
            return NextResponse.json(
                { error: "Missing required fields: id and name" },
                { status: 400 }
            );
        }
        
        // Set defaults
        const now = new Date().toISOString();
        const training: TrainingModuleV2 = {
            ...module,
            slug: module.slug || module.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            coverImage: {
                imageUrl: module.coverImage?.imageUrl || "",
                alt: module.coverImage?.alt || "",
                caption: module.coverImage?.caption || "",
            },
            visibility: module.visibility === "restricted" ? "restricted" : "everyone",
            visibleRoles: normalizeCategoryRoleArray(module.visibleRoles),
            category: module.category && categoryIds.has(module.category) ? module.category : defaultCategory,
            sections: module.sections || [],
            competencyTargets: {
                stages: normalizeStageRoleArray(module.competencyTargets?.stages),
                partNumbers: toStringArray(module.competencyTargets?.partNumbers).map((value) => value.trim().toUpperCase()),
                deviceFamilies: toStringArray(module.competencyTargets?.deviceFamilies),
                qualificationLevel: module.competencyTargets?.qualificationLevel || "trainee",
                relatedIntakeTemplateIds: toStringArray(module.competencyTargets?.relatedIntakeTemplateIds),
            },
            trainingTriggerRules: {
                requiredForStages: normalizeStageRoleArray(module.trainingTriggerRules?.requiredForStages),
                requiredForPartNumbers: toStringArray(module.trainingTriggerRules?.requiredForPartNumbers).map((value) => value.trim().toUpperCase()),
                autoAssignOnMissingCompetency: Boolean(module.trainingTriggerRules?.autoAssignOnMissingCompetency),
            },
            progressTracking: {
                requireAssessment: Boolean(module.progressTracking?.requireAssessment),
                requireLeadReview: Boolean(module.progressTracking?.requireLeadReview),
                milestoneLabels: toStringArray(module.progressTracking?.milestoneLabels),
            },
            enabledStages: module.enabledStages || ["preparation", "buildup", "wiring", "testing"],
            partNumbers: module.partNumbers || [],
            tags: module.tags || [],
            difficulty: module.difficulty || "intermediate",
            status: module.status || "draft",
            version: module.version || 1,
            createdAt: module.createdAt || now,
            updatedAt: now,
        };
        
        // Get the appropriate path based on category/type
        const filePath = getTrainingPath(trainingBaseDir, training);
        await ensureDir(path.dirname(filePath));
        
        await fs.writeFile(filePath, JSON.stringify(training, null, 2));
        
        return NextResponse.json({ training, success: true });
    } catch (error) {
        console.error("Failed to create training:", error);
        return NextResponse.json(
            { error: "Failed to create training" },
            { status: 500 }
        );
    }
}
