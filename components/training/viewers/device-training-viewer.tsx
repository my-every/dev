"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle2,
    Clock,
    Cpu,
    Package,
    Wrench,
    AlertTriangle,
    Image as ImageIcon,
    FileText,
    ChevronRight,
} from "lucide-react";
import type { TrainingModuleV2, TrainingSection, TrainingStage } from "@/types/training";
import { TRAINING_STAGE_INFO } from "@/types/training";

// ============================================================================
// Types
// ============================================================================

interface DeviceTrainingViewerProps {
    module: TrainingModuleV2;
    onStageComplete?: (stage: TrainingStage) => void;
    completedStages?: TrainingStage[];
    className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function PartNumberList({ partNumbers }: { partNumbers: string[] }) {
    if (partNumbers.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {partNumbers.slice(0, 8).map((pn) => (
                <Badge key={pn} variant="secondary" className="font-mono text-xs">
                    {pn}
                </Badge>
            ))}
            {partNumbers.length > 8 && (
                <Badge variant="outline" className="text-xs">
                    +{partNumbers.length - 8} more
                </Badge>
            )}
        </div>
    );
}

function StageCard({
    stage,
    sections,
    isActive,
    isCompleted,
    onActivate,
    onComplete,
}: {
    stage: TrainingStage;
    sections: TrainingSection[];
    isActive: boolean;
    isCompleted: boolean;
    onActivate: () => void;
    onComplete: () => void;
}) {
    const info = TRAINING_STAGE_INFO[stage];

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all",
                isActive && "ring-2 ring-primary",
                isCompleted && "bg-emerald-50/50 dark:bg-emerald-950/10"
            )}
            onClick={onActivate}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <div className={cn("h-2 w-2 rounded-full", info.color.split(" ")[0])} />
                        )}
                        <CardTitle className="text-base">{info.label}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                        {sections.length} section{sections.length !== 1 ? "s" : ""}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{info.description}</p>
                {isActive && !isCompleted && (
                    <Button size="sm" className="mt-3 w-full" onClick={onComplete}>
                        Mark Complete
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function SectionRenderer({ section }: { section: TrainingSection }) {
    switch (section.type) {
        case "required-tools": {
            const content = section.content as { tools?: Array<{ id: string; name: string; quantity?: number; optional?: boolean }> };
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Wrench className="h-4 w-4" />
                            {section.title || "Required Tools"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {content.tools?.map((tool) => (
                                <li key={tool.id} className="flex items-center justify-between text-sm">
                                    <span className={tool.optional ? "text-muted-foreground" : ""}>
                                        {tool.name}
                                        {tool.optional && <span className="ml-1 text-xs">(optional)</span>}
                                    </span>
                                    {tool.quantity && tool.quantity > 1 && (
                                        <Badge variant="outline" className="text-xs">
                                            x{tool.quantity}
                                        </Badge>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            );
        }
        case "required-hardware": {
            const content = section.content as { items?: Array<{ id: string; name: string; partNumber?: string; quantity?: number }> };
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4" />
                            {section.title || "Required Hardware"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {content.items?.map((item) => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium">{item.name}</span>
                                        {item.partNumber && (
                                            <Badge variant="secondary" className="ml-2 font-mono text-xs">
                                                {item.partNumber}
                                            </Badge>
                                        )}
                                    </div>
                                    {item.quantity && item.quantity > 1 && (
                                        <Badge variant="outline" className="text-xs">
                                            x{item.quantity}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            );
        }
        case "related-devices": {
            const content = section.content as { devices?: Array<{ id: string; partNumber: string; name?: string }> };
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Cpu className="h-4 w-4" />
                            {section.title || "Related Devices"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {content.devices?.map((device) => (
                                <Badge key={device.id} variant="secondary" className="font-mono">
                                    {device.partNumber}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            );
        }
        case "dos-and-donts": {
            const content = section.content as {
                dos?: Array<{ id: string; text: string }>;
                donts?: Array<{ id: string; text: string }>;
            };
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            {section.title || "Important Notes"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {content.dos && content.dos.length > 0 && (
                                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                                    <h4 className="mb-2 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                                        Do
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {content.dos.map((item) => (
                                            <li key={item.id} className="flex items-start gap-2 text-xs">
                                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                                                {item.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {content.donts && content.donts.length > 0 && (
                                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                                    <h4 className="mb-2 text-xs font-semibold uppercase text-red-700 dark:text-red-400">
                                        Don&apos;t
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {content.donts.map((item) => (
                                            <li key={item.id} className="flex items-start gap-2 text-xs">
                                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                                                {item.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            );
        }
        case "photos": {
            const content = section.content as { images?: Array<{ id: string; url: string; caption?: string }> };
            if (!content.images?.length) return null;
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <ImageIcon className="h-4 w-4" />
                            {section.title || "Reference Photos"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {content.images.slice(0, 4).map((img) => (
                                <figure key={img.id} className="overflow-hidden rounded-lg border">
                                    <img src={img.url} alt={img.caption || "Reference"} className="aspect-video w-full object-cover" />
                                    {img.caption && (
                                        <figcaption className="bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                                            {img.caption}
                                        </figcaption>
                                    )}
                                </figure>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            );
        }
        case "checklist": {
            const content = section.content as { items?: Array<{ id: string; text: string; required?: boolean }> };
            return (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            {section.title || "Checklist"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-2">
                            {content.items?.map((item, idx) => (
                                <li key={item.id} className="flex items-start gap-2 text-sm">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                        {idx + 1}
                                    </span>
                                    {item.text}
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            );
        }
        default:
            return null;
    }
}

// ============================================================================
// Main Component
// ============================================================================

export function DeviceTrainingViewer({
    module,
    onStageComplete,
    completedStages = [],
    className,
}: DeviceTrainingViewerProps) {
    const [activeStage, setActiveStage] = useState<TrainingStage | null>(
        module.enabledStages[0] || null
    );

    // Group sections by stage
    const sectionsByStage = new Map<TrainingStage, TrainingSection[]>();
    for (const stage of module.enabledStages) {
        sectionsByStage.set(stage, []);
    }
    for (const section of module.sections.filter((s) => s.visible)) {
        if (section.stage && sectionsByStage.has(section.stage)) {
            sectionsByStage.get(section.stage)!.push(section);
        }
    }

    const handleStageComplete = (stage: TrainingStage) => {
        onStageComplete?.(stage);
        // Auto-advance to next stage
        const currentIndex = module.enabledStages.indexOf(stage);
        if (currentIndex < module.enabledStages.length - 1) {
            setActiveStage(module.enabledStages[currentIndex + 1]);
        }
    };

    const activeSections = activeStage ? sectionsByStage.get(activeStage) || [] : [];

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                                Device Training
                            </Badge>
                            <Badge
                                className={cn(
                                    "text-xs",
                                    module.difficulty === "beginner"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : module.difficulty === "intermediate"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-700"
                                )}
                            >
                                {module.difficulty}
                            </Badge>
                        </div>
                        <h1 className="mt-2 text-xl font-semibold">{module.name}</h1>
                        {module.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {module.totalEstimatedMinutes && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {module.totalEstimatedMinutes} min
                            </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                            {completedStages.length} / {module.enabledStages.length} stages
                        </div>
                    </div>
                </div>
                {module.partNumbers.length > 0 && (
                    <div className="mt-4 border-t border-border/50 pt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Applies to devices:</p>
                        <PartNumberList partNumbers={module.partNumbers} />
                    </div>
                )}
            </div>

            {/* Stage Navigation + Content */}
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                {/* Stage List */}
                <div className="space-y-2">
                    <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Training Stages
                    </p>
                    {module.enabledStages.map((stage) => (
                        <StageCard
                            key={stage}
                            stage={stage}
                            sections={sectionsByStage.get(stage) || []}
                            isActive={activeStage === stage}
                            isCompleted={completedStages.includes(stage)}
                            onActivate={() => setActiveStage(stage)}
                            onComplete={() => handleStageComplete(stage)}
                        />
                    ))}
                </div>

                {/* Active Stage Content */}
                <div className="space-y-4">
                    {activeStage && (
                        <>
                            <div className="flex items-center gap-2">
                                <Badge className={TRAINING_STAGE_INFO[activeStage].color}>
                                    {TRAINING_STAGE_INFO[activeStage].label}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {activeSections.length} section{activeSections.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="space-y-4">
                                {activeSections
                                    .sort((a, b) => a.order - b.order)
                                    .map((section) => (
                                        <SectionRenderer key={section.id} section={section} />
                                    ))}
                                {activeSections.length === 0 && (
                                    <Card className="border-dashed">
                                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                            No content for this stage yet.
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
