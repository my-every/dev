"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
    ChevronDown,
    ChevronRight,
    Clock,
    AlertTriangle,
    GraduationCap,
    Loader2,
    ExternalLink,
    Check,
    CheckCircle2,
    XCircle,
    Wrench,
    Package,
    Cpu,
    BookOpen,
    FileDown,
    Presentation,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type {
    TrainingModuleV2,
    TrainingSection,
    TrainingStage,
    DetailsContent,
    CoverImageContent,
    PhotosContent,
    ToolsContent,
    HardwareContent,
    RelatedDevicesContent,
    DosAndDontsContent,
    ChecklistContent,
} from "@/types/training";
import { TRAINING_STAGE_INFO } from "@/types/training";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TrainingStepsViewerProps {
    partNumber: string;
    badgeNumber?: string;
}

/**
 * Renders training installation instructions for a part,
 * organized by stages with section-based content
 */
export function TrainingStepsViewer({ partNumber, badgeNumber }: TrainingStepsViewerProps) {
    const { user } = useSession();
    const resolvedBadge = badgeNumber || user?.badge;
    const role = user?.role;
    const [modalTrainingId, setModalTrainingId] = useState<string | null>(null);

    const linksUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set("partNumber", partNumber);
        if (resolvedBadge) params.set("badgeNumber", resolvedBadge);
        if (role) params.set("role", role);
        return `/api/training/install-links?${params.toString()}`;
    }, [partNumber, resolvedBadge, role]);

    const { data, isLoading, error } = useSWR<{ modules: Array<{ id: string; name: string; openPageUrl: string; openModalToken: string; pdfDownloadHint: string; difficulty?: string; stageCount: number; estimatedMinutes: number | null }> }>(
        linksUrl,
        fetcher
    );
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (error || !data?.modules || data.modules.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No published training modules are linked to this part yet.</p>
                <p className="text-xs mt-1">Link this part number in the Training Module Builder under related devices or part assignments.</p>
                {resolvedBadge && (
                    <Button
                        variant="link"
                        size="sm"
                        className="mt-2"
                        asChild
                    >
                        <a href={`/profile/${resolvedBadge}/training`}>
                            Create Training
                            <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                    </Button>
                )}
            </div>
        );
    }

    const activeTrainingId = modalTrainingId || data.modules[0]?.id;

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                {data.modules.map((module) => (
                    <Card key={module.id} className="border-muted">
                        <CardContent className="pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">{module.name}</p>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                        {module.difficulty ? <span>{module.difficulty}</span> : null}
                                        <span>{module.stageCount} stages</span>
                                        {module.estimatedMinutes ? <span>{module.estimatedMinutes} min</span> : null}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={module.openPageUrl} target="_blank" rel="noreferrer">
                                            <BookOpen className="h-3.5 w-3.5 mr-1" />
                                            Open Page
                                        </a>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setModalTrainingId(module.openModalToken)}
                                    >
                                        <Presentation className="h-3.5 w-3.5 mr-1" />
                                        Open Modal
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={module.pdfDownloadHint} target="_blank" rel="noreferrer">
                                            <FileDown className="h-3.5 w-3.5 mr-1" />
                                            PDF
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {data.modules[0] ? <TrainingDetail trainingId={data.modules[0].id} /> : null}

            <Dialog open={!!modalTrainingId} onOpenChange={(open) => !open && setModalTrainingId(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
                    <DialogHeader className="px-5 pt-4 pb-2 border-b">
                        <DialogTitle>Training Module Walkthrough</DialogTitle>
                        <DialogDescription>
                            Interactive multi-step training view for installation workflow.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-auto p-5">
                        {activeTrainingId ? <TrainingDetail trainingId={activeTrainingId} /> : null}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TrainingDetail({ trainingId }: { trainingId: string }) {
    const { data, isLoading } = useSWR<{ training: TrainingModuleV2 }>(
        `/api/training/${trainingId}`,
        fetcher
    );
    const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
    const [expandedStages, setExpandedStages] = useState<Set<TrainingStage | "overview">>(
        new Set(["overview"])
    );
    
    if (isLoading || !data?.training) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    const training = data.training;
    const overviewSections = training.sections.filter(s => s.stage === null && s.visible);
    const stagesWithSections = training.enabledStages.filter(stage =>
        training.sections.some(s => s.stage === stage && s.visible)
    );
    
    const toggleStage = (stage: TrainingStage | "overview") => {
        setExpandedStages(prev => {
            const next = new Set(prev);
            if (next.has(stage)) {
                next.delete(stage);
            } else {
                next.add(stage);
            }
            return next;
        });
    };
    
    const toggleItem = (itemId: string) => {
        setCompletedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };
    
    // Calculate total checkable items and progress
    const getAllChecklistItems = () => {
        return training.sections
            .filter(s => s.type === "checklist" && s.visible)
            .flatMap(s => (s.content as ChecklistContent).items);
    };
    
    const totalChecklistItems = getAllChecklistItems().length;
    const completedCount = completedItems.size;
    const progressPercent = totalChecklistItems > 0 
        ? Math.round((completedCount / totalChecklistItems) * 100) 
        : 0;
    
    if (training.sections.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">This training has no content yet.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {/* Training Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium text-sm">{training.name}</h4>
                    {training.description && (
                        <p className="text-xs text-muted-foreground">{training.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-[10px]",
                            training.difficulty === "beginner" && "bg-green-100 text-green-800",
                            training.difficulty === "intermediate" && "bg-yellow-100 text-yellow-800",
                            training.difficulty === "advanced" && "bg-red-100 text-red-800"
                        )}
                    >
                        {training.difficulty}
                    </Badge>
                    {training.totalEstimatedMinutes && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            {training.totalEstimatedMinutes} min
                        </Badge>
                    )}
                </div>
            </div>
            
            {/* Progress Bar (only if there are checklists) */}
            {totalChecklistItems > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{completedCount} of {totalChecklistItems} items completed</span>
                        <span>{progressPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}
            
            {/* Overview Sections */}
            {overviewSections.length > 0 && (
                <Card>
                    <Collapsible 
                        open={expandedStages.has("overview")} 
                        onOpenChange={() => toggleStage("overview")}
                    >
                        <CollapsibleTrigger asChild>
                            <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {expandedStages.has("overview") ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                        <CardTitle className="text-sm font-medium">Overview</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">
                                        {overviewSections.length} sections
                                    </Badge>
                                </div>
                            </CardHeader>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                            <CardContent className="pt-0 pb-4 space-y-4">
                                {overviewSections
                                    .sort((a, b) => a.order - b.order)
                                    .map(section => (
                                        <SectionRenderer
                                            key={section.id}
                                            section={section}
                                            completedItems={completedItems}
                                            onToggleItem={toggleItem}
                                        />
                                    ))}
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            )}
            
            {/* Stage Sections */}
            {stagesWithSections.map((stage, stageIdx) => {
                const stageInfo = TRAINING_STAGE_INFO[stage];
                const stageSections = training.sections
                    .filter(s => s.stage === stage && s.visible)
                    .sort((a, b) => a.order - b.order);
                const isExpanded = expandedStages.has(stage);
                
                // Count completed checklist items in this stage
                const stageChecklistItems = stageSections
                    .filter(s => s.type === "checklist")
                    .flatMap(s => (s.content as ChecklistContent).items);
                const stageCompleted = stageChecklistItems.filter(item => 
                    completedItems.has(item.id)
                ).length;
                const isStageComplete = stageChecklistItems.length > 0 && 
                    stageCompleted === stageChecklistItems.length;
                
                return (
                    <Card 
                        key={stage} 
                        className={cn(isStageComplete && "border-green-500/30")}
                    >
                        <Collapsible 
                            open={isExpanded} 
                            onOpenChange={() => toggleStage(stage)}
                        >
                            <CollapsibleTrigger asChild>
                                <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            <div className={cn(
                                                "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium",
                                                isStageComplete
                                                    ? "bg-green-500 text-white"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {isStageComplete ? (
                                                    <Check className="h-3.5 w-3.5" />
                                                ) : (
                                                    stageIdx + 1
                                                )}
                                            </div>
                                            <CardTitle className="text-sm font-medium">
                                                {stageInfo.label}
                                            </CardTitle>
                                            <Badge className={cn("text-[10px]", stageInfo.color)}>
                                                {stageInfo.description}
                                            </Badge>
                                        </div>
                                        <Badge variant="outline" className="text-[10px]">
                                            {stageSections.length} sections
                                        </Badge>
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                                <CardContent className="pt-0 pb-4 space-y-4">
                                    {stageSections.map(section => (
                                        <SectionRenderer
                                            key={section.id}
                                            section={section}
                                            completedItems={completedItems}
                                            onToggleItem={toggleItem}
                                        />
                                    ))}
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>
                );
            })}
        </div>
    );
}

function SectionRenderer({
    section,
    completedItems,
    onToggleItem,
}: {
    section: TrainingSection;
    completedItems: Set<string>;
    onToggleItem: (id: string) => void;
}) {
    switch (section.type) {
        case "cover-image": {
            const content = section.content as CoverImageContent;
            if (!content.imageUrl) return null;
            return (
                <div className="rounded-lg overflow-hidden">
                    <img
                        src={content.imageUrl}
                        alt={content.alt || ""}
                        className="w-full h-32 object-cover"
                    />
                    {content.caption && (
                        <p className="text-xs text-muted-foreground mt-1">{content.caption}</p>
                    )}
                </div>
            );
        }
        
        case "photos": {
            const content = section.content as PhotosContent;
            if (content.images.length === 0) return null;
            return (
                <div>
                    {section.title && (
                        <h5 className="text-xs font-medium mb-2">{section.title}</h5>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                        {content.images.map(img => (
                            <div key={img.id} className="relative rounded overflow-hidden">
                                <img
                                    src={img.url}
                                    alt={img.caption || ""}
                                    className="w-full h-20 object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        case "required-tools": {
            const content = section.content as ToolsContent;
            if (content.tools.length === 0) return null;
            return (
                <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <h5 className="text-xs font-medium">{section.title || "Required Tools"}</h5>
                    </div>
                    <ul className="space-y-1">
                        {content.tools.map(tool => (
                            <li key={tool.id} className="text-xs flex items-center justify-between">
                                <span className={tool.optional ? "text-muted-foreground" : ""}>
                                    {tool.name}
                                    {tool.optional && " (optional)"}
                                </span>
                                {tool.quantity && tool.quantity > 1 && (
                                    <Badge variant="outline" className="text-[10px]">x{tool.quantity}</Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        
        case "required-hardware": {
            const content = section.content as HardwareContent;
            if (content.items.length === 0) return null;
            return (
                <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <h5 className="text-xs font-medium">{section.title || "Required Hardware"}</h5>
                    </div>
                    <ul className="space-y-1">
                        {content.items.map(item => (
                            <li key={item.id} className="text-xs flex items-center justify-between">
                                <span>
                                    {item.name}
                                    {item.specification && ` (${item.specification})`}
                                </span>
                                {item.quantity && item.quantity > 1 && (
                                    <Badge variant="outline" className="text-[10px]">x{item.quantity}</Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        
        case "related-devices": {
            const content = section.content as RelatedDevicesContent;
            if (content.devices.length === 0) return null;
            return (
                <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <h5 className="text-xs font-medium">{section.title || "Related Devices"}</h5>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {content.devices.map(device => (
                            <Badge key={device.id} variant="secondary" className="text-[10px] font-mono">
                                {device.partNumber}
                            </Badge>
                        ))}
                    </div>
                </div>
            );
        }
        
        case "dos-and-donts": {
            const content = section.content as DosAndDontsContent;
            if (content.dos.length === 0 && content.donts.length === 0) return null;
            return (
                <div className="grid grid-cols-2 gap-3">
                    {content.dos.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                            <div className="flex items-center gap-1 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <h5 className="text-xs font-medium text-green-800 dark:text-green-200">Do</h5>
                            </div>
                            <ul className="space-y-1">
                                {content.dos.map(item => (
                                    <li key={item.id} className="text-xs text-green-800 dark:text-green-200 flex gap-1">
                                        <span>-</span>
                                        <span>{item.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {content.donts.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                            <div className="flex items-center gap-1 mb-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <h5 className="text-xs font-medium text-red-800 dark:text-red-200">Don&apos;t</h5>
                            </div>
                            <ul className="space-y-1">
                                {content.donts.map(item => (
                                    <li key={item.id} className="text-xs text-red-800 dark:text-red-200 flex gap-1">
                                        <span>-</span>
                                        <span>{item.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }
        
        case "checklist": {
            const content = section.content as ChecklistContent;
            if (content.items.length === 0) return null;
            return (
                <div className="space-y-2">
                    {section.title && (
                        <h5 className="text-xs font-medium">{section.title}</h5>
                    )}
                    {content.items.map((item, idx) => {
                        const isCompleted = completedItems.has(item.id);
                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    "flex gap-3 p-2 rounded-lg border transition-colors",
                                    isCompleted && "bg-green-50 border-green-200 dark:bg-green-950/30"
                                )}
                            >
                                <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => onToggleItem(item.id)}
                                />
                                <span className={cn(
                                    "text-sm",
                                    isCompleted && "line-through text-muted-foreground"
                                )}>
                                    {item.text}
                                    {!item.required && (
                                        <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        
        case "details": {
            const content = section.content as DetailsContent;
            if (!content.title && !content.description) return null;
            return (
                <div className="space-y-1">
                    {content.title && (
                        <h5 className="text-sm font-medium">{content.title}</h5>
                    )}
                    {content.description && (
                        <p className="text-xs text-muted-foreground">{content.description}</p>
                    )}
                </div>
            );
        }
        
        default:
            return null;
    }
}
