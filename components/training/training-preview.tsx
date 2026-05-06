"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Clock,
    ChevronDown,
    CheckCircle2,
    XCircle,
    Wrench,
    Package,
    Cpu,
    AlertTriangle,
} from "lucide-react";
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
    CustomContent,
} from "@/types/training";
import { TRAINING_STAGE_INFO } from "@/types/training";
import { cn } from "@/lib/utils";

interface TrainingPreviewProps {
    module: TrainingModuleV2;
    highlightedSectionId?: string;
}

export function TrainingPreview({ module, highlightedSectionId }: TrainingPreviewProps) {
    const globalSections = module.sections.filter(s => s.stage === null);
    const stagesWithSections = module.enabledStages.filter(stage =>
        module.sections.some(s => s.stage === stage)
    );

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case "beginner": return "bg-green-100 text-green-800";
            case "intermediate": return "bg-amber-100 text-amber-800";
            case "advanced": return "bg-red-100 text-red-800";
            default: return "bg-muted text-muted-foreground";
        }
    };

    const renderSection = (section: TrainingSection) => {
        const isHighlighted = section.id === highlightedSectionId;

        return (
            <div
                key={section.id}
                id={`preview-${section.id}`}
                className={cn(
                    "transition-all duration-200",
                    isHighlighted && "ring-2 ring-primary ring-offset-2 rounded-lg"
                )}
            >
                {section.type === "details" && (
                    <DetailsPreview content={section.content as DetailsContent} />
                )}
                {section.type === "cover-image" && (
                    <CoverImagePreview content={section.content as CoverImageContent} />
                )}
                {section.type === "photos" && (
                    <PhotosPreview content={section.content as PhotosContent} />
                )}
                {section.type === "required-tools" && (
                    <ToolsPreview content={section.content as ToolsContent} title={section.title} />
                )}
                {section.type === "required-hardware" && (
                    <HardwarePreview content={section.content as HardwareContent} title={section.title} />
                )}
                {section.type === "related-devices" && (
                    <RelatedDevicesPreview content={section.content as RelatedDevicesContent} title={section.title} />
                )}
                {section.type === "dos-and-donts" && (
                    <DosAndDontsPreview content={section.content as DosAndDontsContent} title={section.title} />
                )}
                {section.type === "checklist" && (
                    <ChecklistPreview content={section.content as ChecklistContent} title={section.title} />
                )}
                {section.type === "custom" && (
                    <CustomPreview content={section.content as CustomContent} title={section.title} />
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 p-4">
            {/* Module Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Badge className={getDifficultyColor(module.difficulty)}>
                        {module.difficulty}
                    </Badge>
                    {module.totalEstimatedMinutes && (
                        <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {module.totalEstimatedMinutes} min
                        </Badge>
                    )}
                    <Badge variant="outline">{module.status}</Badge>
                </div>
                <h1 className="text-2xl font-bold">{module.name || "Untitled Training"}</h1>
                {module.description && (
                    <p className="text-muted-foreground">{module.description}</p>
                )}
                {(module.swsTemplateIds?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {(module.swsTemplateIds ?? []).map((templateId) => (
                            <Badge key={templateId} variant="outline">
                                SWS {templateId}
                            </Badge>
                        ))}
                    </div>
                ) : null}
                {(module.competencyTargets?.stages?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {(module.competencyTargets?.stages ?? []).map((stage) => (
                            <Badge key={stage} variant="outline">
                                {stage.replace(/_/g, " ")}
                            </Badge>
                        ))}
                        {module.competencyTargets?.qualificationLevel ? (
                            <Badge variant="secondary">
                                {module.competencyTargets.qualificationLevel}
                            </Badge>
                        ) : null}
                        {module.trainingTriggerRules?.autoAssignOnMissingCompetency ? (
                            <Badge variant="outline">Auto-assign on missing competency</Badge>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {module.coverImage?.imageUrl ? (
                <div className="relative rounded-lg overflow-hidden">
                    <img
                        src={module.coverImage.imageUrl}
                        alt={module.coverImage.alt || "Training cover"}
                        className="w-full aspect-video object-cover"
                    />
                    {module.coverImage.caption ? (
                        <p className="text-sm text-muted-foreground mt-1 italic">{module.coverImage.caption}</p>
                    ) : null}
                </div>
            ) : null}

            {/* Global Sections */}
            {globalSections.length > 0 && (
                <div className="space-y-4">
                    {globalSections
                        .filter(s => s.visible)
                        .sort((a, b) => a.order - b.order)
                        .map(renderSection)}
                </div>
            )}

            {/* Stage Sections */}
            {stagesWithSections.map((stage) => {
                const info = TRAINING_STAGE_INFO[stage];
                const stageSections = module.sections
                    .filter(s => s.stage === stage && s.visible)
                    .sort((a, b) => a.order - b.order);

                if (stageSections.length === 0) return null;

                return (
                    <Collapsible key={stage} defaultOpen>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Badge className={info.color}>{info.label}</Badge>
                                            <CardTitle className="text-lg">{info.description}</CardTitle>
                                        </div>
                                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="space-y-4 pt-0">
                                    {stageSections.map(renderSection)}
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                );
            })}

            {module.sections.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">
                        Add sections to see a preview of your training module
                    </p>
                </div>
            )}
        </div>
    );
}

// Individual section preview components

function DetailsPreview({ content }: { content: DetailsContent }) {
    if (!content.title && !content.description) {
        return null;
    }

    return (
        <div className="space-y-2">
            {content.title && <h2 className="text-xl font-semibold">{content.title}</h2>}
            {content.description && <p className="text-muted-foreground">{content.description}</p>}
            {content.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {content.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function CoverImagePreview({ content }: { content: CoverImageContent }) {
    if (!content.imageUrl) {
        return (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground text-sm">No cover image</p>
            </div>
        );
    }

    return (
        <div className="relative rounded-lg overflow-hidden">
            <img
                src={content.imageUrl}
                alt={content.alt || "Cover"}
                className="w-full aspect-video object-cover"
            />
            {content.caption && (
                <p className="text-sm text-muted-foreground mt-1 italic">{content.caption}</p>
            )}
        </div>
    );
}

function PhotosPreview({ content }: { content: PhotosContent }) {
    if (content.images.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {content.images.map(image => (
                <div key={image.id} className="relative rounded-lg overflow-hidden">
                    <img
                        src={image.url}
                        alt={image.caption || "Photo"}
                        className="w-full aspect-square object-cover"
                    />
                    {image.caption && (
                        <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs">{image.caption}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function ToolsPreview({ content, title }: { content: ToolsContent; title?: string }) {
    if (content.tools.length === 0 && (content.stackIds?.length ?? 0) === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {title || "Required Tools"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {(content.stackIds?.length ?? 0) > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                            {content.stackIds?.length} linked stack{content.stackIds?.length === 1 ? "" : "s"}
                        </Badge>
                    </div>
                ) : null}
                <ul className="space-y-2">
                    {content.tools.map(tool => (
                        <li key={tool.id} className="flex items-center justify-between">
                            <span className={tool.optional ? "text-muted-foreground" : ""}>
                                {tool.name}
                                {tool.optional && <span className="text-xs ml-1">(optional)</span>}
                            </span>
                            {tool.quantity && tool.quantity > 1 && (
                                <Badge variant="outline">x{tool.quantity}</Badge>
                            )}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function HardwarePreview({ content, title }: { content: HardwareContent; title?: string }) {
    if (content.items.length === 0 && (content.stackIds?.length ?? 0) === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {title || "Required Hardware"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {(content.stackIds?.length ?? 0) > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                            {content.stackIds?.length} linked stack{content.stackIds?.length === 1 ? "" : "s"}
                        </Badge>
                    </div>
                ) : null}
                <div className="space-y-2">
                    {content.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                            <div>
                                <span className="font-medium">{item.name}</span>
                                {item.specification && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                        ({item.specification})
                                    </span>
                                )}
                            </div>
                            {item.quantity && item.quantity > 1 && (
                                <Badge variant="outline">x{item.quantity}</Badge>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function RelatedDevicesPreview({ content, title }: { content: RelatedDevicesContent; title?: string }) {
    if (content.devices.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    {title || "Related Devices"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {content.devices.map(device => (
                        <Badge key={device.id} variant="secondary" className="font-mono">
                            {device.partNumber}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function DosAndDontsPreview({ content, title }: { content: DosAndDontsContent; title?: string }) {
    if (content.dos.length === 0 && content.donts.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {title || "Do's and Don'ts"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                    {content.dos.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-medium text-green-700 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Do
                            </h4>
                            <ul className="space-y-1">
                                {content.dos.map(item => (
                                    <li key={item.id} className="text-sm flex items-start gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {content.donts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-700 flex items-center gap-1">
                                <XCircle className="h-4 w-4" /> Don&apos;t
                            </h4>
                            <ul className="space-y-1">
                                {content.donts.map(item => (
                                    <li key={item.id} className="text-sm flex items-start gap-2">
                                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
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

function ChecklistPreview({ content, title }: { content: ChecklistContent; title?: string }) {
    if (content.items.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title || "Checklist"}</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {content.items.map((item, index) => (
                        <li key={item.id} className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded border flex items-center justify-center text-xs text-muted-foreground">
                                {index + 1}
                            </div>
                            <span className={!item.required ? "text-muted-foreground" : ""}>
                                {item.text}
                                {!item.required && <span className="text-xs ml-1">(optional)</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function CustomPreview({ content, title }: { content: CustomContent; title?: string }) {
    if (!content.markdown) {
        return null;
    }

    return (
        <Card>
            {title && (
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent className={title ? "" : "pt-4"}>
                <div className="prose prose-sm max-w-none">
                    {content.markdown}
                </div>
            </CardContent>
        </Card>
    );
}
