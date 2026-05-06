"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import type { TrainingStage, TrainingSection } from "@/types/training";
import { TRAINING_STAGES, TRAINING_STAGE_INFO } from "@/types/training";
import { cn } from "@/lib/utils";

interface StageTabsProps {
    activeStage: TrainingStage | null;
    onStageChange: (stage: TrainingStage | null) => void;
    enabledStages: TrainingStage[];
    onEnabledStagesChange: (stages: TrainingStage[]) => void;
    sections: TrainingSection[];
    disabled?: boolean;
}

export function StageTabs({
    activeStage,
    onStageChange,
    enabledStages,
    onEnabledStagesChange,
    sections,
    disabled,
}: StageTabsProps) {
    const getSectionCount = (stage: TrainingStage | null) => {
        if (stage === null) {
            return sections.filter(s => s.stage === null).length;
        }
        return sections.filter(s => s.stage === stage).length;
    };

    const toggleStage = (stage: TrainingStage) => {
        if (enabledStages.includes(stage)) {
            onEnabledStagesChange(enabledStages.filter(s => s !== stage));
            if (activeStage === stage) {
                onStageChange(enabledStages.find(s => s !== stage) ?? null);
            }
        } else {
            onEnabledStagesChange([...enabledStages, stage]);
        }
    };

    return (
        <div className="flex items-center gap-2 border-b pb-2 mb-4 overflow-x-auto">
            {/* Global tab - always visible */}
            <button
                type="button"
                onClick={() => onStageChange(null)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                    activeStage === null
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
            >
                Overview
                {getSectionCount(null) > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {getSectionCount(null)}
                    </Badge>
                )}
            </button>

            <div className="h-4 w-px bg-border" />

            {/* Stage tabs */}
            {TRAINING_STAGES.filter(stage => enabledStages.includes(stage)).map((stage) => {
                const info = TRAINING_STAGE_INFO[stage];
                const count = getSectionCount(stage);
                
                return (
                    <button
                        key={stage}
                        type="button"
                        onClick={() => onStageChange(stage)}
                        disabled={disabled}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                            activeStage === stage
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        {info.label}
                        {count > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                {count}
                            </Badge>
                        )}
                    </button>
                );
            })}

            {/* Stage settings popover */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" disabled={disabled}>
                        <Settings2 className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                    <div className="space-y-3">
                        <h4 className="font-medium text-sm">Configure Stages</h4>
                        <p className="text-xs text-muted-foreground">
                            Enable or disable stages for this training module.
                        </p>
                        <div className="space-y-2">
                            {TRAINING_STAGES.map((stage) => {
                                const info = TRAINING_STAGE_INFO[stage];
                                const isEnabled = enabledStages.includes(stage);
                                
                                return (
                                    <div key={stage} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`stage-${stage}`}
                                            checked={isEnabled}
                                            onCheckedChange={() => toggleStage(stage)}
                                        />
                                        <label
                                            htmlFor={`stage-${stage}`}
                                            className="flex-1 text-sm cursor-pointer"
                                        >
                                            {info.label}
                                        </label>
                                        {getSectionCount(stage) > 0 && (
                                            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                                {getSectionCount(stage)}
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
