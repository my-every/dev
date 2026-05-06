import type { AssignmentStageRole } from "@/lib/board/stage-workspaces";

export type SwsTemplateKind = "standard" | "custom" | "competency-intake";
export type SwsTemplateStatus = "draft" | "active" | "archived" | "deprecated";
export type SwsOperationStatus = "active" | "draft" | "blocked";
export type SwsLinkTargetType =
    | "stage"
    | "part-number"
    | "part-family"
    | "stack"
    | "training-module"
    | "assignment-sws";

export interface SwsTaskNode {
    id: string;
    title: string;
    description?: string;
    required?: boolean;
    completedByDefault?: boolean;
    notes?: string;
    accessoryHint?: string;
    blockerHint?: string;
    reviewRequirement?: string;
    partNumbers?: string[];
    stageIds?: string[];
    children?: SwsTaskNode[];
}

export interface SwsChecklistGroup {
    id: string;
    title: string;
    description?: string;
    order: number;
    tasks: SwsTaskNode[];
}

export interface SwsTemplateRecord {
    id: string;
    name: string;
    description?: string;
    kind: SwsTemplateKind;
    status: SwsTemplateStatus;
    version: number;
    versionLabel?: string;
    tags: string[];
    baseTemplateId?: string | null;
    memberBadge?: string;
    memberName?: string;
    approvedAt?: string;
    approvedBy?: string;
    reviewCadenceDays?: number | null;
    notes?: string;
    prerequisites?: string[];
    blockers?: string[];
    reviewRequirements?: string[];
    accessoryHardwareHints?: string[];
    competencyConfig?: {
        stageRole: AssignmentStageRole;
        relatedTrainingModuleIds: string[];
        partNumbers: string[];
        requireDeviceImage?: boolean;
    };
    groups: SwsChecklistGroup[];
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
}

export interface SwsOperationRecord {
    id: string;
    templateId: string;
    targetType: SwsLinkTargetType;
    targetId: string;
    targetLabel: string;
    status?: SwsOperationStatus;
    note?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SwsTemplateSummary {
    id: string;
    name: string;
    kind: SwsTemplateKind;
    status: SwsTemplateStatus;
    groupCount: number;
    taskCount: number;
    operationCount: number;
    linkedStageCount: number;
    linkedPartCount: number;
    linkedTrainingCount: number;
    updatedAt: string;
}

export interface SwsSuggestionRule {
    id: string;
    kind: "warning" | "suggestion" | "ready";
    title: string;
    description: string;
    templateId?: string;
    actionLabel?: string;
}

export interface SwsUsageRecord {
    templateId: string;
    trainingModuleIds: string[];
    stackIds: string[];
    stageIds: string[];
    partNumbers: string[];
}

export interface SwsLibrarySettings {
    namingPrefix: string;
    requireReviewRequirement: boolean;
    allowNestedTasks: boolean;
    defaultChecklistGroupTitle: string;
    suggestionHelpersEnabled: boolean;
    requirePartOrStageLink?: boolean;
    reviewDefaults: {
        requireStageLink: boolean;
        requireTrainingLink: boolean;
    };
    updatedAt: string;
}

export interface SwsLibraryManifest {
    version: number;
    updatedAt: string;
    totalTemplates: number;
    templates: SwsTemplateSummary[];
}
