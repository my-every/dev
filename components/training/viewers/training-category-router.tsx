"use client";

import type { TrainingModuleV2, TrainingStage } from "@/types/training";
import { AppGuideViewer } from "./app-guide-viewer";
import { DeviceTrainingViewer } from "./device-training-viewer";
import { ToolGuideViewer } from "./tool-guide-viewer";
import { SafetyTrainingViewer } from "./safety-training-viewer";
import { OnboardingViewer } from "./onboarding-viewer";

// ============================================================================
// Types
// ============================================================================

type TrainingCategory = "app" | "device" | "tool" | "safety" | "onboarding";

interface TrainingCategoryRouterProps {
    module: TrainingModuleV2;
    category?: TrainingCategory | string;
    onComplete?: () => void;
    onStageComplete?: (stage: TrainingStage) => void;
    completedStages?: TrainingStage[];
    acknowledgedItems?: string[];
    className?: string;
}

// ============================================================================
// Category Detection
// ============================================================================

function detectCategory(module: TrainingModuleV2): TrainingCategory {
    const category = module.category?.toLowerCase();

    // Direct category match
    if (category === "app") return "app";
    if (category === "device") return "device";
    if (category === "tool") return "tool";
    if (category === "safety") return "safety";
    if (category === "onboarding") return "onboarding";

    // Fallback: detect from tags or name
    const searchText = `${module.name} ${module.tags.join(" ")}`.toLowerCase();

    if (searchText.includes("safety") || searchText.includes("hazard") || searchText.includes("ppe")) {
        return "safety";
    }
    if (searchText.includes("onboard") || searchText.includes("welcome") || searchText.includes("new hire")) {
        return "onboarding";
    }
    if (searchText.includes("tool") || searchText.includes("equipment")) {
        return "tool";
    }
    if (searchText.includes("app") || searchText.includes("software") || searchText.includes("workflow")) {
        return "app";
    }
    if (module.partNumbers.length > 0 || module.enabledStages.length > 0) {
        return "device";
    }

    // Default to app guide format as it's the most versatile
    return "app";
}

// ============================================================================
// Category Info
// ============================================================================

export const TRAINING_CATEGORY_INFO: Record<
    TrainingCategory,
    {
        label: string;
        description: string;
        icon: string;
        color: string;
    }
> = {
    app: {
        label: "App Guide",
        description: "Application workflows and user guides with scrollspy navigation",
        icon: "BookOpen",
        color: "bg-blue-100 text-blue-700",
    },
    device: {
        label: "Device Training",
        description: "Stage-based installation and assembly procedures",
        icon: "Cpu",
        color: "bg-purple-100 text-purple-700",
    },
    tool: {
        label: "Tool Guide",
        description: "Tool setup, usage, and best practices",
        icon: "Wrench",
        color: "bg-amber-100 text-amber-700",
    },
    safety: {
        label: "Safety Training",
        description: "Safety procedures with required acknowledgements",
        icon: "Shield",
        color: "bg-red-100 text-red-700",
    },
    onboarding: {
        label: "Onboarding",
        description: "Step-by-step new team member introduction",
        icon: "GraduationCap",
        color: "bg-emerald-100 text-emerald-700",
    },
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * TrainingCategoryRouter
 * 
 * Dynamically renders the appropriate viewer component based on the training
 * module's category. Each category has a specialized viewer optimized for
 * its educational goals:
 * 
 * - **App**: Scrollspy-styled user guide for navigating app features
 * - **Device**: Stage-based training with tools, hardware, and checklists
 * - **Tool**: Accordion-based setup and usage instructions
 * - **Safety**: Acknowledgement-based safety training with progress tracking
 * - **Onboarding**: Wizard-style step-through introduction flow
 */
export function TrainingCategoryRouter({
    module,
    category: categoryOverride,
    onComplete,
    onStageComplete,
    completedStages,
    acknowledgedItems,
    className,
}: TrainingCategoryRouterProps) {
    const category = (categoryOverride as TrainingCategory) || detectCategory(module);

    switch (category) {
        case "app":
            return (
                <AppGuideViewer
                    module={module}
                    className={className}
                />
            );

        case "device":
            return (
                <DeviceTrainingViewer
                    module={module}
                    onStageComplete={onStageComplete}
                    completedStages={completedStages}
                    className={className}
                />
            );

        case "tool":
            return (
                <ToolGuideViewer
                    module={module}
                    className={className}
                />
            );

        case "safety":
            return (
                <SafetyTrainingViewer
                    module={module}
                    onComplete={(items) => {
                        onComplete?.();
                    }}
                    initialAcknowledged={acknowledgedItems}
                    className={className}
                />
            );

        case "onboarding":
            return (
                <OnboardingViewer
                    module={module}
                    onComplete={onComplete}
                    className={className}
                />
            );

        default:
            // Fallback to app guide
            return (
                <AppGuideViewer
                    module={module}
                    className={className}
                />
            );
    }
}

/**
 * Hook to get category info for a module
 */
export function useTrainingCategoryInfo(module: TrainingModuleV2) {
    const category = detectCategory(module);
    return {
        category,
        ...TRAINING_CATEGORY_INFO[category],
    };
}
