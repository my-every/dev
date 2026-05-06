"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    CheckCircle2,
    Clock,
    Wrench,
    AlertTriangle,
    Lightbulb,
    Settings,
    Shield,
    Zap,
    Book,
} from "lucide-react";
import type { TrainingModuleV2, TrainingSection } from "@/types/training";

// ============================================================================
// Types
// ============================================================================

interface ToolGuideViewerProps {
    module: TrainingModuleV2;
    className?: string;
}

interface ToolSpecification {
    name: string;
    value: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function SpecificationTable({ specs }: { specs: ToolSpecification[] }) {
    if (specs.length === 0) return null;

    return (
        <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
                <tbody>
                    {specs.map((spec, idx) => (
                        <tr
                            key={spec.name}
                            className={cn(idx % 2 === 0 ? "bg-muted/30" : "bg-background")}
                        >
                            <td className="px-3 py-2 font-medium text-muted-foreground w-1/3">
                                {spec.name}
                            </td>
                            <td className="px-3 py-2">{spec.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function QuickTip({ tip }: { tip: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
            <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900 dark:text-amber-100">{tip}</p>
        </div>
    );
}

function SafetyWarning({ warning }: { warning: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
            <Shield className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-900 dark:text-red-100">{warning}</p>
        </div>
    );
}

function SectionContent({ section }: { section: TrainingSection }) {
    switch (section.type) {
        case "details": {
            const content = section.content as { description?: string; tags?: string[] };
            return (
                <div className="space-y-3">
                    {content.description && (
                        <p className="text-sm leading-relaxed">{content.description}</p>
                    )}
                    {content.tags && content.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {content.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        case "cover-image":
        case "photos": {
            const content = section.content as {
                imageUrl?: string;
                images?: Array<{ id: string; url: string; caption?: string }>;
            };
            const images = content.images || (content.imageUrl ? [{ id: "cover", url: content.imageUrl }] : []);
            if (images.length === 0) return null;

            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    {images.map((img) => (
                        <figure key={img.id} className="overflow-hidden rounded-lg border border-border/50">
                            <img
                                src={img.url}
                                alt={img.caption || "Tool reference"}
                                className="aspect-video w-full object-cover"
                            />
                            {img.caption && (
                                <figcaption className="bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                                    {img.caption}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            );
        }
        case "checklist": {
            const content = section.content as { items?: Array<{ id: string; text: string }> };
            return (
                <ol className="space-y-2">
                    {content.items?.map((item, idx) => (
                        <li key={item.id} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {idx + 1}
                            </span>
                            <span className="text-sm leading-relaxed pt-0.5">{item.text}</span>
                        </li>
                    ))}
                </ol>
            );
        }
        case "dos-and-donts": {
            const content = section.content as {
                dos?: Array<{ id: string; text: string }>;
                donts?: Array<{ id: string; text: string }>;
            };
            return (
                <div className="space-y-4">
                    {content.dos && content.dos.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Best Practices
                            </h4>
                            {content.dos.map((item) => (
                                <div key={item.id} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                    {item.text}
                                </div>
                            ))}
                        </div>
                    )}
                    {content.donts && content.donts.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                                Avoid
                            </h4>
                            {content.donts.map((item) => (
                                <div key={item.id} className="flex items-start gap-2 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                    {item.text}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        case "required-tools": {
            const content = section.content as {
                tools?: Array<{ id: string; name: string; partNumber?: string; notes?: string }>;
            };
            return (
                <div className="space-y-2">
                    {content.tools?.map((tool) => (
                        <div key={tool.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{tool.name}</span>
                                {tool.partNumber && (
                                    <Badge variant="secondary" className="font-mono text-xs">
                                        {tool.partNumber}
                                    </Badge>
                                )}
                            </div>
                            {tool.notes && (
                                <p className="mt-1.5 text-xs text-muted-foreground pl-6">{tool.notes}</p>
                            )}
                        </div>
                    ))}
                </div>
            );
        }
        case "video": {
            const content = section.content as { videoUrl?: string; title?: string };
            if (!content.videoUrl) return null;
            return (
                <div className="aspect-video overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                    {content.videoUrl.includes("youtube") || content.videoUrl.includes("vimeo") ? (
                        <iframe
                            src={content.videoUrl}
                            title={content.title || "Video tutorial"}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <video src={content.videoUrl} controls className="h-full w-full" />
                    )}
                </div>
            );
        }
        case "custom": {
            const content = section.content as { markdown?: string };
            return content.markdown ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">{content.markdown}</div>
            ) : null;
        }
        default:
            return null;
    }
}

// ============================================================================
// Main Component
// ============================================================================

export function ToolGuideViewer({ module, className }: ToolGuideViewerProps) {
    const [expandedSections, setExpandedSections] = useState<string[]>(["overview"]);

    // Extract tool specifications from sections
    const toolsSection = module.sections.find((s) => s.type === "required-tools");
    const toolsList = toolsSection
        ? (toolsSection.content as { tools?: Array<{ id: string; name: string; partNumber?: string }> }).tools || []
        : [];

    // Group visible sections by category
    const visibleSections = module.sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    
    const overviewSections = visibleSections.filter((s) => 
        s.type === "details" || s.type === "cover-image"
    );
    const setupSections = visibleSections.filter((s) =>
        s.type === "required-tools" || s.type === "required-hardware" || s.type === "checklist"
    );
    const usageSections = visibleSections.filter((s) =>
        s.type === "video" || s.type === "photos" || s.type === "custom"
    );
    const safetySections = visibleSections.filter((s) => s.type === "dos-and-donts");

    return (
        <div className={cn("space-y-6", className)}>
            {/* Tool Header Card */}
            <Card className="overflow-hidden">
                <div className="relative">
                    {module.coverImage?.imageUrl && (
                        <div className="h-48 w-full overflow-hidden">
                            <img
                                src={module.coverImage.imageUrl}
                                alt={module.name}
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                        </div>
                    )}
                    <div className={cn("p-5", module.coverImage?.imageUrl && "absolute bottom-0 inset-x-0")}>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="gap-1">
                                <Wrench className="h-3 w-3" /> Tool Guide
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
                        <h1 className="text-2xl font-bold">{module.name}</h1>
                        {module.description && (
                            <p className="mt-1 text-muted-foreground">{module.description}</p>
                        )}
                    </div>
                </div>
                <CardContent className="border-t border-border/50 bg-muted/20 py-3">
                    <div className="flex flex-wrap gap-6 text-sm">
                        {module.totalEstimatedMinutes && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{module.totalEstimatedMinutes} min read</span>
                            </div>
                        )}
                        {toolsList.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                <span>{toolsList.length} related tool{toolsList.length !== 1 ? "s" : ""}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <Book className="h-4 w-4 text-muted-foreground" />
                            <span>{visibleSections.length} section{visibleSections.length !== 1 ? "s" : ""}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-3 sm:grid-cols-3">
                <Button variant="outline" className="justify-start gap-2" onClick={() => setExpandedSections(["setup"])}>
                    <Settings className="h-4 w-4" />
                    Setup Instructions
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={() => setExpandedSections(["usage"])}>
                    <Zap className="h-4 w-4" />
                    How to Use
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={() => setExpandedSections(["safety"])}>
                    <Shield className="h-4 w-4" />
                    Safety Guidelines
                </Button>
            </div>

            {/* Content Accordion */}
            <Accordion
                type="multiple"
                value={expandedSections}
                onValueChange={setExpandedSections}
                className="space-y-3"
            >
                {/* Overview */}
                {overviewSections.length > 0 && (
                    <AccordionItem value="overview" className="rounded-xl border border-border/60 overflow-hidden">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                                    <Book className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold">Overview</h3>
                                    <p className="text-xs text-muted-foreground">Tool description and purpose</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 pt-2">
                            <div className="space-y-4">
                                {overviewSections.map((section) => (
                                    <SectionContent key={section.id} section={section} />
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Setup */}
                {setupSections.length > 0 && (
                    <AccordionItem value="setup" className="rounded-xl border border-border/60 overflow-hidden">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                                    <Settings className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold">Setup & Preparation</h3>
                                    <p className="text-xs text-muted-foreground">Get ready to use the tool</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 pt-2">
                            <div className="space-y-4">
                                {setupSections.map((section) => (
                                    <div key={section.id}>
                                        {section.title && (
                                            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                                                {section.title}
                                            </h4>
                                        )}
                                        <SectionContent section={section} />
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Usage */}
                {usageSections.length > 0 && (
                    <AccordionItem value="usage" className="rounded-xl border border-border/60 overflow-hidden">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                                    <Zap className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold">How to Use</h3>
                                    <p className="text-xs text-muted-foreground">Step-by-step instructions</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 pt-2">
                            <div className="space-y-4">
                                {usageSections.map((section) => (
                                    <div key={section.id}>
                                        {section.title && (
                                            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                                                {section.title}
                                            </h4>
                                        )}
                                        <SectionContent section={section} />
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Safety */}
                {safetySections.length > 0 && (
                    <AccordionItem value="safety" className="rounded-xl border border-border/60 overflow-hidden">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                                    <Shield className="h-4 w-4 text-red-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold">Safety Guidelines</h3>
                                    <p className="text-xs text-muted-foreground">Important safety information</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 pt-2">
                            <div className="space-y-4">
                                {safetySections.map((section) => (
                                    <SectionContent key={section.id} section={section} />
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    );
}
