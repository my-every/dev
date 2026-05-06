/**
 * Training Module Types
 * 
 * Training modules define installation/assembly procedures that can be
 * shared across multiple parts. Each training has stages (preparation,
 * buildup, wiring, cross-wiring, testing, final-inspection) with steps
 * and associated part numbers.
 */

import type { AssignmentStageRole } from "@/lib/board/stage-workspaces";
import type { CompetencyQualification } from "@/lib/users/competency";

// ============================================================================
// TRAINING STAGES
// ============================================================================

export type TrainingStage = 
    | "preparation"
    | "buildup"
    | "wiring"
    | "box-build"
    | "cross-wiring"
    | "testing"
    | "final-inspection";

export const TRAINING_STAGES: TrainingStage[] = [
    "preparation",
    "buildup",
    "wiring",
    "cross-wiring",
    "box-build",
    "testing",
    "final-inspection",
];

export const TRAINING_STAGE_INFO: Record<TrainingStage, {
    label: string;
    description: string;
    color: string;
}> = {
    "preparation": {
        label: "Preparation",
        description: "Initial setup and material gathering",
        color: "bg-blue-100 text-blue-800",
    },
    "buildup": {
        label: "Build Up",
        description: "Assembly and mechanical installation",
        color: "bg-amber-100 text-amber-800",
    },
    "wiring": {
        label: "Wiring",
        description: "Primary wiring connections",
        color: "bg-green-100 text-green-800",
    },
    "box-build": {
        label: "Box Build",
        description: "Properly build ONSKID Boxes",
        color: "bg-gray-100 text-gray-900",
    },
    "cross-wiring": {
        label: "Cross Wiring",
        description: "Inter-component wiring and connections",
        color: "bg-purple-100 text-purple-800",
    },
    "testing": {
        label: "Testing",
        description: "Verification and testing procedures",
        color: "bg-orange-100 text-orange-800",
    },
    "final-inspection": {
        label: "Final Inspection",
        description: "Quality check and sign-off",
        color: "bg-emerald-100 text-emerald-800",
    },
};

// ============================================================================
// SECTION TYPES (for modular builder)
// ============================================================================

export type TrainingSectionType =
    | "details"           // Title, description, difficulty, estimated time
    | "cover-image"       // Hero image for the training
    | "photos"            // Photo gallery with captions
    | "required-tools"    // List of tools needed
    | "related-devices"   // Related part numbers / devices
    | "required-hardware" // Hardware/materials needed
    | "dos-and-donts"     // Best practices and warnings
    | "video"             // Embedded video content
    | "checklist"         // Step completion checklist
    | "custom";           // Custom markdown/rich text

export const SECTION_TYPE_INFO: Record<TrainingSectionType, {
    label: string;
    description: string;
    icon: string;
    defaultTitle: string;
}> = {
    "details": {
        label: "Details",
        description: "Training overview with difficulty and time estimate",
        icon: "FileText",
        defaultTitle: "Training Details",
    },
    "cover-image": {
        label: "Cover Image",
        description: "Hero image for the training module",
        icon: "Image",
        defaultTitle: "Cover Image",
    },
    "photos": {
        label: "Photos",
        description: "Photo gallery with optional captions",
        icon: "Images",
        defaultTitle: "Reference Photos",
    },
    "required-tools": {
        label: "Required Tools",
        description: "List of tools needed for this training",
        icon: "Wrench",
        defaultTitle: "Required Tools",
    },
    "related-devices": {
        label: "Related Devices",
        description: "Part numbers and devices related to this training",
        icon: "Cpu",
        defaultTitle: "Related Devices",
    },
    "required-hardware": {
        label: "Required Hardware",
        description: "Hardware and materials needed",
        icon: "Package",
        defaultTitle: "Required Hardware",
    },
    "dos-and-donts": {
        label: "Do's and Don'ts",
        description: "Best practices and things to avoid",
        icon: "AlertTriangle",
        defaultTitle: "Do's and Don'ts",
    },
    "video": {
        label: "Video",
        description: "Embedded instructional video",
        icon: "Video",
        defaultTitle: "Instructional Video",
    },
    "checklist": {
        label: "Checklist",
        description: "Step-by-step completion checklist",
        icon: "CheckSquare",
        defaultTitle: "Checklist",
    },
    "custom": {
        label: "Custom Content",
        description: "Free-form text or markdown content",
        icon: "FileEdit",
        defaultTitle: "Custom Section",
    },
};

// ============================================================================
// SECTION CONTENT TYPES
// ============================================================================

export interface DetailsContent {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    estimatedMinutes: number;
    tags: string[];
}

export interface TrainingCompetencyTargets {
    stages: AssignmentStageRole[];
    partNumbers: string[];
    deviceFamilies: string[];
    qualificationLevel?: CompetencyQualification;
    relatedIntakeTemplateIds?: string[];
}

export interface TrainingTriggerRules {
    requiredForStages?: AssignmentStageRole[];
    requiredForPartNumbers?: string[];
    autoAssignOnMissingCompetency?: boolean;
}

export interface TrainingProgressTrackingConfig {
    requireAssessment?: boolean;
    requireLeadReview?: boolean;
    milestoneLabels?: string[];
}

export interface CoverImageContent {
    imageUrl: string;
    alt?: string;
    caption?: string;
}

export interface PhotosContent {
    images: Array<{
        id: string;
        url: string;
        caption?: string;
        order: number;
    }>;
}

export interface ToolsContent {
    tools: Array<{
        id: string;
        name: string;
        partNumber?: string;
        quantity?: number;
        optional?: boolean;
        notes?: string;
    }>;
    stackIds?: string[];
}

export interface HardwareContent {
    items: Array<{
        id: string;
        name: string;
        partNumber?: string;
        quantity?: number;
        specification?: string;
        notes?: string;
    }>;
    stackIds?: string[];
}

export interface RelatedDevicesContent {
    devices: Array<{
        id: string;
        partNumber: string;
        name?: string;
        description?: string;
    }>;
}

export interface DosAndDontsContent {
    dos: Array<{
        id: string;
        text: string;
        priority?: "high" | "medium" | "low";
    }>;
    donts: Array<{
        id: string;
        text: string;
        severity?: "critical" | "warning" | "info";
    }>;
}

export interface VideoContent {
    videoUrl: string;
    embedType: "youtube" | "vimeo" | "direct";
    title?: string;
    description?: string;
}

export interface ChecklistContent {
    items: Array<{
        id: string;
        text: string;
        order: number;
        required: boolean;
    }>;
}

export interface CustomContent {
    markdown: string;
}

export type SectionContent =
    | DetailsContent
    | CoverImageContent
    | PhotosContent
    | ToolsContent
    | HardwareContent
    | RelatedDevicesContent
    | DosAndDontsContent
    | VideoContent
    | ChecklistContent
    | CustomContent;

// ============================================================================
// TRAINING SECTION
// ============================================================================

export interface TrainingSection {
    /** Unique section ID */
    id: string;
    /** Section type */
    type: TrainingSectionType;
    /** Display order */
    order: number;
    /** Custom title (overrides default) */
    title?: string;
    /** Which stage this section belongs to (null = global/header) */
    stage?: TrainingStage | null;
    /** Section content (type-specific) */
    content: SectionContent;
    /** Is this section visible? */
    visible: boolean;
    /** Collapsed by default in preview? */
    collapsedByDefault?: boolean;
}

// ============================================================================
// TRAINING STEP
// ============================================================================

export interface TrainingStep {
    /** Step ID */
    id: string;
    /** Step order within the stage */
    order: number;
    /** Step title */
    title: string;
    /** Detailed instructions */
    description?: string;
    /** Warning message if any */
    warning?: string;
    /** Helpful tip */
    tip?: string;
    /** Duration estimate in minutes */
    estimatedMinutes?: number;
    /** Required tools */
    tools?: string[];
    /** Image URLs for visual guidance */
    images?: string[];
    /** Is this step optional? */
    optional?: boolean;
}

// ============================================================================
// TRAINING STAGE CONTENT
// ============================================================================

export interface TrainingStageContent {
    /** Stage type */
    stage: TrainingStage;
    /** Steps in this stage */
    steps: TrainingStep[];
    /** Part numbers associated with this stage */
    partNumbers: string[];
    /** Notes for this stage */
    notes?: string;
}

// ============================================================================
// TRAINING MODULE
// ============================================================================

export interface TrainingModule {
    /** Unique ID (slug) */
    id: string;
    /** Display name */
    name: string;
    /** Description */
    description?: string;
    /** Category (e.g., devices, terminals) */
    category?: string;
    /** Type within category */
    type?: string;
    /** All part numbers this training applies to */
    partNumbers: string[];
    /** Content organized by stage */
    stages: TrainingStageContent[];
    /** Total estimated time in minutes */
    totalEstimatedMinutes?: number;
    /** Difficulty level */
    difficulty?: "beginner" | "intermediate" | "advanced";
    /** Tags for searching */
    tags?: string[];
    /** Version number */
    version: number;
    /** Timestamps */
    createdAt: string;
    updatedAt: string;
    /** Created by (badge number) */
    createdBy?: string;
}

// ============================================================================
// TRAINING PROGRESS (for tracking user progress)
// ============================================================================

export interface TrainingProgress {
    /** Training module ID */
    trainingId: string;
    /** Part number being worked on */
    partNumber: string;
    /** User badge number */
    badgeNumber: string;
    /** Completed step IDs by stage */
    completedSteps: Record<TrainingStage, string[]>;
    /** Current stage */
    currentStage: TrainingStage;
    /** Started at */
    startedAt: string;
    /** Completed at (if finished) */
    completedAt?: string;
    /** Notes from the user */
    userNotes?: string;
}

// ============================================================================
// TRAINING SUMMARY (for list views)
// ============================================================================

export interface TrainingSummary {
    id: string;
    name: string;
    description?: string;
    category?: string;
    coverImageUrl?: string;
    visibility?: "everyone" | "restricted";
    status: "draft" | "published" | "archived";
    difficulty?: "beginner" | "intermediate" | "advanced";
    partCount: number;
    stageCount: number;
    sectionCount?: number;
    totalEstimatedMinutes?: number;
    updatedAt: string;
}

export interface TrainingCategory {
    id: string;
    label: string;
    visibleRoles: import("@/types/d380-user-session").UserRole[];
    description?: string;
    order: number;
}

// ============================================================================
// TRAINING MODULE V2 (Section-based)
// ============================================================================

export interface TrainingModuleV2 {
    /** Unique ID */
    id: string;
    /** Display name */
    name: string;
    /** URL-friendly slug */
    slug: string;
    /** Description */
    description?: string;
    /** Module-level cover image used by cards/details by default */
    coverImage?: {
        imageUrl: string;
        alt?: string;
        caption?: string;
    };
    /** Who can preview/open this module */
    visibility?: "everyone" | "restricted";
    /** Roles allowed when visibility is restricted */
    visibleRoles?: import("@/types/d380-user-session").UserRole[];
    /** Category (e.g., devices, terminals) */
    category?: string;
    /** Type within category */
    type?: string;
    /** All part numbers this training applies to */
    partNumbers: string[];
    /** Reusable SWS templates this training supports or satisfies */
    swsTemplateIds?: string[];
    /** Competency targeting rules used by assignment readiness and intake */
    competencyTargets?: TrainingCompetencyTargets;
    /** When and how this training should be assigned automatically */
    trainingTriggerRules?: TrainingTriggerRules;
    /** How completion should be tracked and reviewed */
    progressTracking?: TrainingProgressTrackingConfig;
    /** Module sections (ordered) */
    sections: TrainingSection[];
    /** Enabled stages in order */
    enabledStages: TrainingStage[];
    /** Total estimated time in minutes */
    totalEstimatedMinutes?: number;
    /** Difficulty level */
    difficulty: "beginner" | "intermediate" | "advanced";
    /** Tags for searching */
    tags: string[];
    /** Version number */
    version: number;
    /** Status */
    status: "draft" | "published" | "archived";
    /** Timestamps */
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    /** Created by (badge number) */
    createdBy?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createEmptyTrainingModuleV2(id: string, name: string): TrainingModuleV2 {
    const now = new Date().toISOString();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
        id,
        name,
        slug,
        coverImage: { imageUrl: "", alt: "", caption: "" },
        visibility: "everyone",
        visibleRoles: [
            "DEVELOPER",
            "MANAGER",
            "SUPERVISOR",
            "TEAM_LEAD",
            "QA",
            "BRANDER",
            "ASSEMBLER",
        ],
        partNumbers: [],
        swsTemplateIds: [],
        competencyTargets: {
            stages: [],
            partNumbers: [],
            deviceFamilies: [],
            qualificationLevel: "trainee",
            relatedIntakeTemplateIds: [],
        },
        trainingTriggerRules: {
            requiredForStages: [],
            requiredForPartNumbers: [],
            autoAssignOnMissingCompetency: false,
        },
        progressTracking: {
            requireAssessment: false,
            requireLeadReview: false,
            milestoneLabels: [],
        },
        sections: [],
        enabledStages: ["preparation", "buildup", "wiring", "testing"],
        difficulty: "intermediate",
        tags: [],
        version: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
    };
}

export function createEmptySection(type: TrainingSectionType, order: number, stage?: TrainingStage): TrainingSection {
    const info = SECTION_TYPE_INFO[type];
    const id = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const getDefaultContent = (): SectionContent => {
        switch (type) {
            case "details":
                return { title: "", description: "", difficulty: "intermediate", estimatedMinutes: 30, tags: [] } as DetailsContent;
            case "cover-image":
                return { imageUrl: "", alt: "" } as CoverImageContent;
            case "photos":
                return { images: [] } as PhotosContent;
            case "required-tools":
                return { tools: [], stackIds: [] } as ToolsContent;
            case "required-hardware":
                return { items: [], stackIds: [] } as HardwareContent;
            case "related-devices":
                return { devices: [] } as RelatedDevicesContent;
            case "dos-and-donts":
                return { dos: [], donts: [] } as DosAndDontsContent;
            case "video":
                return { videoUrl: "", embedType: "youtube" } as VideoContent;
            case "checklist":
                return { items: [] } as ChecklistContent;
            case "custom":
                return { markdown: "" } as CustomContent;
            default:
                return { markdown: "" } as CustomContent;
        }
    };
    
    return {
        id,
        type,
        order,
        title: info.defaultTitle,
        stage: stage ?? null,
        content: getDefaultContent(),
        visible: true,
    };
}

export function createEmptyTrainingModule(id: string, name: string): TrainingModule {
    const now = new Date().toISOString();
    return {
        id,
        name,
        partNumbers: [],
        stages: [],
        version: 1,
        createdAt: now,
        updatedAt: now,
    };
}

export function createEmptyStageContent(stage: TrainingStage): TrainingStageContent {
    return {
        stage,
        steps: [],
        partNumbers: [],
    };
}

export function createEmptyStep(order: number): TrainingStep {
    return {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order,
        title: "",
    };
}
