"use client";

import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages";
import type { SwsOperationRecord, SwsTemplateRecord, SwsTemplateSummary, SwsUsageRecord } from "@/types/sws-library";
import type { SwsStageScope, SwsTaskNode, SwsTemplateDefinition, SwsTemplateId } from "@/types/d380-sws";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";
import {
    buildSwsDetectionContextForAssignment,
    mapAssignmentStageToDetectionStage,
    resolveSwsTemplateIdForAssignment,
} from "@/lib/sws/assignment-template-resolution";

export type WorkspaceSwsTemplateRecord = {
    id: string;
    template: SwsTemplateRecord;
    summary: SwsTemplateSummary;
    operations: SwsOperationRecord[];
    usage: SwsUsageRecord | null;
    stageIds: string[];
    stageLabels: string[];
    isRegistryTemplate: boolean;
};

export const SWS_STAGE_OPTIONS: Array<{ id: string; label: string }> = [
    { id: "BUILD_UP", label: "Build Up" },
    { id: "WIRING", label: "Wiring" },
    { id: "BOX_BUILD", label: "Box Build" },
    { id: "CROSS_WIRE", label: "Cross Wire" },
    { id: "PANEL_HANG", label: "Panel Hang" },
];

export function countTemplateTasks(groups: SwsTemplateRecord["groups"]): number {
    return groups.reduce((total, group) => total + countTaskNodes(group.tasks), 0);
}

function countTaskNodes(tasks: SwsTaskNode[]): number {
    return tasks.reduce((total, task) => total + 1 + countTaskNodes(task.children ?? []), 0);
}

export function normalizeStageLabel(stageId: string): string {
    const assignmentStage = ASSIGNMENT_STAGES.find((stage) => stage.id === stageId);
    if (assignmentStage) {
        return assignmentStage.label;
    }

    return stageId
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function stageScopeToAssignmentStageId(scope: SwsStageScope): string {
    switch (scope) {
        case "CROSS_WIRE":
            return "CROSS_WIRE";
        default:
            return scope;
    }
}

export function mapRegistryTemplateToRecord(templateId: SwsTemplateId): SwsTemplateRecord {
    const definition = SWS_TEMPLATE_REGISTRY[templateId];
    const now = new Date().toISOString();

    return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        kind: "standard",
        status: "active",
        version: Number.parseInt(definition.revisionLevel.replace(/[^\d]/g, ""), 10) || 1,
        versionLabel: definition.revisionLevel,
        tags: Array.from(
            new Set([
                definition.category.toLowerCase(),
                ...definition.stageScopes.map((scope) => scope.toLowerCase()),
            ]),
        ),
        memberBadge: "",
        memberName: definition.originator ?? "SWS Registry",
        notes: definition.processDescription,
        prerequisites: [],
        blockers: [],
        reviewRequirements: [],
        accessoryHardwareHints: [],
        reviewCadenceDays: 30,
        groups: definition.sections.map((section, index) => ({
            id: section.id,
            title: section.description,
            description: section.notes?.join(" ") || section.references.join(", "),
            order: typeof section.workElementNumber === "number" ? section.workElementNumber : index,
            tasks: section.processSteps.map((step, stepIndex) => ({
                id: `${section.id}-${step.id || stepIndex + 1}`,
                title: step.text,
                description: step.subSteps?.join(" ") || undefined,
                required: step.requiresCheckOff !== false,
                notes: step.notes?.join(" ") || undefined,
                reviewRequirement: step.verificationType || undefined,
                children: [],
            })),
        })),
        createdAt: now,
        updatedAt: now,
    };
}

export function mapRegistryTemplateToSummary(definition: SwsTemplateDefinition): SwsTemplateSummary {
    return {
        id: definition.id,
        name: definition.name,
        kind: "standard",
        status: "active",
        groupCount: definition.sections.length,
        taskCount: definition.sections.reduce((total, section) => total + section.processSteps.length, 0),
        operationCount: definition.stageScopes.length,
        linkedStageCount: definition.stageScopes.length,
        linkedPartCount: 0,
        linkedTrainingCount: 0,
        updatedAt: definition.revisionDate,
    };
}

export function buildWorkspaceSwsTemplateRecords(options: {
    templates: SwsTemplateRecord[];
    manifest: SwsTemplateSummary[];
    operations: SwsOperationRecord[];
    usage: SwsUsageRecord[];
}): WorkspaceSwsTemplateRecord[] {
    const { templates, manifest, operations, usage } = options;
    const byId = new Map<string, SwsTemplateRecord>();

    templates.forEach((template) => byId.set(template.id, template));

    for (const definition of Object.values(SWS_TEMPLATE_REGISTRY)) {
        if (!byId.has(definition.id)) {
            byId.set(definition.id, mapRegistryTemplateToRecord(definition.id));
        }
    }

    return Array.from(byId.values())
        .map((template) => {
            const registryDefinition = SWS_TEMPLATE_REGISTRY[template.id as SwsTemplateId];
            const summary =
                manifest.find((entry) => entry.id === template.id)
                ?? (registryDefinition
                    ? mapRegistryTemplateToSummary(registryDefinition)
                    : {
                          id: template.id,
                          name: template.name,
                          kind: template.kind,
                          status: template.status,
                          groupCount: template.groups.length,
                          taskCount: countTemplateTasks(template.groups),
                          operationCount: 0,
                          linkedStageCount: 0,
                          linkedPartCount: 0,
                          linkedTrainingCount: 0,
                          updatedAt: template.updatedAt,
                      });
            const templateOperations = operations.filter((operation) => operation.templateId === template.id);
            const usageEntry = usage.find((entry) => entry.templateId === template.id) ?? null;
            const stageIds = Array.from(
                new Set([
                    ...templateOperations
                        .filter((operation) => operation.targetType === "stage")
                        .map((operation) => operation.targetId),
                    ...(usageEntry?.stageIds ?? []),
                    ...(registryDefinition?.stageScopes ?? []).map(stageScopeToAssignmentStageId),
                ]),
            );

            return {
                id: template.id,
                template,
                summary,
                operations: templateOperations,
                usage: usageEntry,
                stageIds,
                stageLabels: stageIds.map(normalizeStageLabel),
                isRegistryTemplate: !templates.some((entry) => entry.id === template.id),
            } satisfies WorkspaceSwsTemplateRecord;
        })
        .sort((left, right) => right.summary.updatedAt.localeCompare(left.summary.updatedAt));
}

export { buildSwsDetectionContextForAssignment, mapAssignmentStageToDetectionStage, resolveSwsTemplateIdForAssignment };
