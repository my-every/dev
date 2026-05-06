"use client";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    FileText,
    Image,
    Images,
    Wrench,
    Cpu,
    Package,
    AlertTriangle,
    Video,
    CheckSquare,
    FileEdit,
    Plus,
} from "lucide-react";
import type { TrainingSectionType, TrainingStage } from "@/types/training";
import { SECTION_TYPE_INFO } from "@/types/training";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<TrainingSectionType, React.ComponentType<{ className?: string }>> = {
    "details": FileText,
    "cover-image": Image,
    "photos": Images,
    "required-tools": Wrench,
    "related-devices": Cpu,
    "required-hardware": Package,
    "dos-and-donts": AlertTriangle,
    "video": Video,
    "checklist": CheckSquare,
    "custom": FileEdit,
};

interface SectionPaletteProps {
    onAddSection: (type: TrainingSectionType, stage?: TrainingStage) => void;
    currentStage?: TrainingStage | null;
    disabled?: boolean;
}

export function SectionPalette({ onAddSection, currentStage, disabled }: SectionPaletteProps) {
    const sectionTypes: TrainingSectionType[] = [
        "details",
        "cover-image",
        "photos",
        "required-tools",
        "related-devices",
        "required-hardware",
        "dos-and-donts",
        "checklist",
        "custom",
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Section
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
                <div className="grid grid-cols-2 gap-1">
                    {sectionTypes.map((type) => {
                        const info = SECTION_TYPE_INFO[type];
                        const Icon = SECTION_ICONS[type];
                        
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    onAddSection(type, currentStage ?? undefined);
                                }}
                                className={cn(
                                    "flex items-start gap-3 p-3 rounded-lg text-left",
                                    "hover:bg-muted transition-colors",
                                    "focus:outline-none focus:ring-2 focus:ring-primary"
                                )}
                            >
                                <div className="flex-shrink-0 p-2 bg-primary/10 rounded-md">
                                    <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-sm">{info.label}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {info.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
