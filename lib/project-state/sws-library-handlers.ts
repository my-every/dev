import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";
import type {
    SwsChecklistGroup,
    SwsLibraryManifest,
    SwsLibrarySettings,
    SwsOperationRecord,
    SwsSuggestionRule,
    SwsTaskNode,
    SwsTemplateRecord,
    SwsTemplateSummary,
    SwsUsageRecord,
} from "@/types/sws-library";

function getSwsLibraryDir() {
    return path.join(resolveShareDirectorySync(), "sws-library");
}

function getTemplatesDir() {
    return path.join(getSwsLibraryDir(), "templates");
}

function getManifestPath() {
    return path.join(getSwsLibraryDir(), "manifest.json");
}

function getOperationsPath() {
    return path.join(getSwsLibraryDir(), "operations.json");
}

function getSettingsPath() {
    return path.join(getSwsLibraryDir(), "settings.json");
}

function getTemplateFilePath(templateId: string) {
    const safeId = templateId.replace(/[/\\:*?"<>|]/g, "_");
    return path.join(getTemplatesDir(), `${safeId}.json`);
}

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

async function writeJson(filePath: string, value: unknown) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function normalizeTask(task: SwsTaskNode): SwsTaskNode {
    return {
        ...task,
        title: task.title.trim(),
        description: task.description?.trim() || undefined,
        notes: task.notes?.trim() || undefined,
        accessoryHint: task.accessoryHint?.trim() || undefined,
        blockerHint: task.blockerHint?.trim() || undefined,
        reviewRequirement: task.reviewRequirement?.trim() || undefined,
        children: (task.children ?? []).map(normalizeTask),
        partNumbers: Array.from(new Set((task.partNumbers ?? []).map((value) => value.trim()).filter(Boolean))),
        stageIds: Array.from(new Set((task.stageIds ?? []).map((value) => value.trim()).filter(Boolean))),
    };
}

function normalizeGroups(groups: SwsChecklistGroup[]): SwsChecklistGroup[] {
    return [...groups]
        .map((group, index) => ({
            ...group,
            title: group.title.trim(),
            description: group.description?.trim() || undefined,
            order: typeof group.order === "number" ? group.order : index,
            tasks: (group.tasks ?? []).map(normalizeTask),
        }))
        .sort((left, right) => left.order - right.order)
        .map((group, index) => ({ ...group, order: index }));
}

function countTasks(tasks: SwsTaskNode[]): number {
    return tasks.reduce((total, task) => total + 1 + countTasks(task.children ?? []), 0);
}

function createDefaultSettings(): SwsLibrarySettings {
    return {
        namingPrefix: "SWS",
        requireReviewRequirement: false,
        allowNestedTasks: true,
        defaultChecklistGroupTitle: "Main Checklist",
        suggestionHelpersEnabled: true,
        requirePartOrStageLink: false,
        reviewDefaults: {
            requireStageLink: false,
            requireTrainingLink: false,
        },
        updatedAt: new Date().toISOString(),
    };
}

function createEmptyManifest(): SwsLibraryManifest {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalTemplates: 0,
        templates: [],
    };
}

function sanitizeTemplate(input: SwsTemplateRecord): SwsTemplateRecord {
    const now = new Date().toISOString();
    return {
        ...input,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        tags: Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))),
        notes: input.notes?.trim() || undefined,
        prerequisites: Array.from(new Set((input.prerequisites ?? []).map((value) => value.trim()).filter(Boolean))),
        blockers: Array.from(new Set((input.blockers ?? []).map((value) => value.trim()).filter(Boolean))),
        reviewRequirements: Array.from(new Set((input.reviewRequirements ?? []).map((value) => value.trim()).filter(Boolean))),
        accessoryHardwareHints: Array.from(new Set((input.accessoryHardwareHints ?? []).map((value) => value.trim()).filter(Boolean))),
        groups: normalizeGroups(input.groups ?? []),
        createdAt: input.createdAt || now,
        updatedAt: now,
        status: input.status ?? "draft",
        kind: input.kind ?? "custom",
        version: typeof input.version === "number" && Number.isFinite(input.version) ? input.version : 1,
        versionLabel: input.versionLabel?.trim() || undefined,
        baseTemplateId: input.baseTemplateId ?? null,
        memberBadge: input.memberBadge?.trim() || undefined,
        memberName: input.memberName?.trim() || undefined,
        approvedAt: input.approvedAt || undefined,
        approvedBy: input.approvedBy?.trim() || undefined,
        reviewCadenceDays: typeof input.reviewCadenceDays === "number" && Number.isFinite(input.reviewCadenceDays)
            ? input.reviewCadenceDays
            : null,
        competencyConfig: input.competencyConfig
            ? {
                stageRole: input.competencyConfig.stageRole,
                relatedTrainingModuleIds: Array.from(
                    new Set((input.competencyConfig.relatedTrainingModuleIds ?? []).map((value) => value.trim()).filter(Boolean)),
                ),
                partNumbers: Array.from(
                    new Set((input.competencyConfig.partNumbers ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean)),
                ),
                requireDeviceImage: Boolean(input.competencyConfig.requireDeviceImage),
            }
            : undefined,
    };
}

function sanitizeRelation(input: SwsOperationRecord): SwsOperationRecord {
    const now = new Date().toISOString();
    return {
        ...input,
        targetLabel: input.targetLabel.trim(),
        status: input.status ?? "active",
        note: input.note?.trim() || undefined,
        createdAt: input.createdAt || now,
        updatedAt: now,
    };
}

async function readTemplateFiles(): Promise<SwsTemplateRecord[]> {
    await ensureDir(getTemplatesDir());
    const entries = await fs.readdir(getTemplatesDir(), { withFileTypes: true }).catch(() => []);
    const templates: SwsTemplateRecord[] = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
        }

        const template = await readJson<SwsTemplateRecord | null>(path.join(getTemplatesDir(), entry.name), null);
        if (template?.id && template?.name) {
            templates.push(sanitizeTemplate(template));
        }
    }

    return templates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listSwsOperations(): Promise<SwsOperationRecord[]> {
    const operations = await readJson<SwsOperationRecord[]>(getOperationsPath(), []);
    return operations.map(sanitizeRelation).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getSwsLibrarySettings(): Promise<SwsLibrarySettings> {
    return readJson<SwsLibrarySettings>(getSettingsPath(), createDefaultSettings());
}

function buildTemplateSummary(template: SwsTemplateRecord, operations: SwsOperationRecord[]): SwsTemplateSummary {
    const templateOperations = operations.filter((operation) => operation.templateId === template.id);
    return {
        id: template.id,
        name: template.name,
        kind: template.kind,
        status: template.status,
        groupCount: template.groups.length,
        taskCount: template.groups.reduce((total, group) => total + countTasks(group.tasks), 0),
        operationCount: templateOperations.length,
        linkedStageCount: templateOperations.filter((operation) => operation.targetType === "stage").length,
        linkedPartCount: templateOperations.filter((operation) => operation.targetType === "part-number" || operation.targetType === "part-family").length,
        linkedTrainingCount: templateOperations.filter((operation) => operation.targetType === "training-module").length,
        updatedAt: template.updatedAt,
    };
}

async function rebuildManifest(): Promise<SwsLibraryManifest> {
    const [templates, operations] = await Promise.all([readTemplateFiles(), listSwsOperations()]);
    const manifest: SwsLibraryManifest = {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalTemplates: templates.length,
        templates: templates.map((template) => buildTemplateSummary(template, operations)),
    };
    await writeJson(getManifestPath(), manifest);
    return manifest;
}

export async function getSwsLibraryManifest(): Promise<SwsLibraryManifest> {
    return readJson<SwsLibraryManifest>(getManifestPath(), createEmptyManifest());
}

export async function listSwsTemplates(): Promise<SwsTemplateRecord[]> {
    return readTemplateFiles();
}

export async function getSwsTemplate(templateId: string): Promise<SwsTemplateRecord | null> {
    return readJson<SwsTemplateRecord | null>(getTemplateFilePath(templateId), null);
}

export async function createSwsTemplate(input: SwsTemplateRecord): Promise<SwsTemplateRecord> {
    const template = sanitizeTemplate(input);
    await writeJson(getTemplateFilePath(template.id), template);
    await rebuildManifest();
    return template;
}

export async function updateSwsTemplate(input: SwsTemplateRecord): Promise<SwsTemplateRecord> {
    const existing = await getSwsTemplate(input.id);
    if (!existing) {
        throw new Error(`SWS template ${input.id} not found`);
    }
    const next = sanitizeTemplate({
        ...existing,
        ...input,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
    });
    await writeJson(getTemplateFilePath(next.id), next);
    await rebuildManifest();
    return next;
}

export async function saveSwsTemplateTasks(templateId: string, groups: SwsChecklistGroup[]): Promise<SwsTemplateRecord> {
    const existing = await getSwsTemplate(templateId);
    if (!existing) {
        throw new Error(`SWS template ${templateId} not found`);
    }
    return updateSwsTemplate({
        ...existing,
        groups,
    });
}

export async function deleteSwsTemplate(templateId: string): Promise<boolean> {
    try {
        await fs.unlink(getTemplateFilePath(templateId));
        const operations = await listSwsOperations();
        const filtered = operations.filter((operation) => operation.templateId !== templateId);
        await writeJson(getOperationsPath(), filtered);
        await rebuildManifest();
        return true;
    } catch {
        return false;
    }
}

export async function upsertSwsOperation(input: SwsOperationRecord): Promise<SwsOperationRecord> {
    const operations = await listSwsOperations();
    const next = sanitizeRelation(input);
    const existingIndex = operations.findIndex((operation) => operation.id === next.id);
    const duplicate = operations.find((operation) =>
        operation.id !== next.id
        && operation.templateId === next.templateId
        && operation.targetType === next.targetType
        && operation.targetId === next.targetId,
    );

    if (duplicate) {
        throw new Error("An SWS operation already exists for this template and target");
    }

    if (existingIndex >= 0) {
        operations[existingIndex] = next;
    } else {
        operations.unshift(next);
    }

    await writeJson(getOperationsPath(), operations);
    await rebuildManifest();
    return next;
}

export async function deleteSwsOperation(operationId: string): Promise<boolean> {
    const operations = await listSwsOperations();
    const filtered = operations.filter((operation) => operation.id !== operationId);
    if (filtered.length === operations.length) {
        return false;
    }
    await writeJson(getOperationsPath(), filtered);
    await rebuildManifest();
    return true;
}

export async function updateSwsLibrarySettings(input: Partial<SwsLibrarySettings>): Promise<SwsLibrarySettings> {
    const current = await getSwsLibrarySettings();
    const next: SwsLibrarySettings = {
        ...current,
        ...input,
        reviewDefaults: {
            ...current.reviewDefaults,
            ...(input.reviewDefaults ?? {}),
        },
        updatedAt: new Date().toISOString(),
    };
    await writeJson(getSettingsPath(), next);
    return next;
}

export async function listSwsSuggestions(): Promise<SwsSuggestionRule[]> {
    const [templates, operations, settings] = await Promise.all([
        listSwsTemplates(),
        listSwsOperations(),
        getSwsLibrarySettings(),
    ]);
    const suggestions: SwsSuggestionRule[] = [];

    for (const template of templates) {
        const summary = buildTemplateSummary(template, operations);
        const templateOperations = operations.filter((operation) => operation.templateId === template.id);
        const hasStageLink = templateOperations.some((operation) => operation.targetType === "stage");
        const hasTrainingLink = templateOperations.some((operation) => operation.targetType === "training-module");
        const hasPartOrStageLink = templateOperations.some((operation) =>
            operation.targetType === "stage"
            || operation.targetType === "part-number"
            || operation.targetType === "part-family",
        );

        if (summary.taskCount === 0) {
            suggestions.push({
                id: `${template.id}-tasks`,
                kind: "warning",
                title: `${template.name} has no tasks yet`,
                description: "Add at least one checklist group and task so this template can drive real SWS work.",
                templateId: template.id,
                actionLabel: "Add Tasks",
            });
        } else if (summary.operationCount === 0) {
            suggestions.push({
                id: `${template.id}-operations`,
                kind: "suggestion",
                title: `${template.name} is not linked`,
                description: "Link this template to stages, stacks, parts, or training modules so teams can reuse it in context.",
                templateId: template.id,
                actionLabel: "Review Operations",
            });
        } else if (settings.reviewDefaults.requireStageLink && !hasStageLink) {
            suggestions.push({
                id: `${template.id}-missing-stage`,
                kind: "warning",
                title: `${template.name} is missing a stage link`,
                description: "The current SWS settings require every template to be linked to at least one stage.",
                templateId: template.id,
                actionLabel: "Link Stage",
            });
        } else if (settings.reviewDefaults.requireTrainingLink && !hasTrainingLink) {
            suggestions.push({
                id: `${template.id}-missing-training`,
                kind: "suggestion",
                title: `${template.name} is missing a training link`,
                description: "Link a training module so this template is easier to discover in role-based learning flows.",
                templateId: template.id,
                actionLabel: "Link Training",
            });
        } else if (settings.requirePartOrStageLink && !hasPartOrStageLink) {
            suggestions.push({
                id: `${template.id}-missing-part-or-stage`,
                kind: "warning",
                title: `${template.name} needs a part or stage link`,
                description: "The current library settings require at least one part-family, part-number, or stage operation.",
                templateId: template.id,
                actionLabel: "Link Context",
            });
        } else if (template.status === "deprecated" && summary.operationCount > 0) {
            suggestions.push({
                id: `${template.id}-deprecated-in-use`,
                kind: "warning",
                title: `${template.name} is deprecated but still linked`,
                description: "This template should either be archived from active operations or replaced by a newer standard.",
                templateId: template.id,
                actionLabel: "Review Usage",
            });
        }
    }

    if (suggestions.length === 0) {
        suggestions.push({
            id: "all-good",
            kind: "ready",
            title: "SWS library is connected",
            description: "Templates, tasks, and operations are all in a healthy state right now.",
            actionLabel: "View Overview",
        });
    }

    return suggestions;
}

export async function listSwsUsage(): Promise<SwsUsageRecord[]> {
    const operations = await listSwsOperations();
    const usage = new Map<string, SwsUsageRecord>();

    for (const operation of operations) {
        const current = usage.get(operation.templateId) ?? {
            templateId: operation.templateId,
            trainingModuleIds: [],
            stackIds: [],
            stageIds: [],
            partNumbers: [],
        };

        if (operation.targetType === "training-module" && !current.trainingModuleIds.includes(operation.targetId)) {
            current.trainingModuleIds.push(operation.targetId);
        }
        if (operation.targetType === "stack" && !current.stackIds.includes(operation.targetId)) {
            current.stackIds.push(operation.targetId);
        }
        if (operation.targetType === "stage" && !current.stageIds.includes(operation.targetId)) {
            current.stageIds.push(operation.targetId);
        }
        if (operation.targetType === "part-number" && !current.partNumbers.includes(operation.targetId)) {
            current.partNumbers.push(operation.targetId);
        }

        usage.set(operation.templateId, current);
    }

    return Array.from(usage.values());
}
