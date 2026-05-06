"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Eye,
    Hand,
    Flame,
    Zap,
    ChevronRight,
} from "lucide-react";
import type { TrainingModuleV2, TrainingSection } from "@/types/training";

// ============================================================================
// Types
// ============================================================================

interface SafetyTrainingViewerProps {
    module: TrainingModuleV2;
    onComplete?: (acknowledgedItems: string[]) => void;
    initialAcknowledged?: string[];
    className?: string;
}

interface SafetyItem {
    id: string;
    text: string;
    severity: "critical" | "warning" | "info";
    icon?: React.ReactNode;
}

// ============================================================================
// Helper Components
// ============================================================================

function getSeverityIcon(severity: string): React.ReactNode {
    switch (severity) {
        case "critical":
            return <AlertOctagon className="h-5 w-5 text-red-500" />;
        case "warning":
            return <AlertTriangle className="h-5 w-5 text-amber-500" />;
        default:
            return <Shield className="h-5 w-5 text-blue-500" />;
    }
}

function SafetyCard({
    item,
    isAcknowledged,
    onToggle,
}: {
    item: SafetyItem;
    isAcknowledged: boolean;
    onToggle: () => void;
}) {
    return (
        <Card
            className={cn(
                "transition-all",
                isAcknowledged && "bg-emerald-50/50 dark:bg-emerald-950/10",
                item.severity === "critical" && !isAcknowledged && "border-red-200 dark:border-red-900"
            )}
        >
            <CardContent className="flex items-start gap-4 py-4">
                <Checkbox
                    checked={isAcknowledged}
                    onCheckedChange={onToggle}
                    className={cn(
                        "mt-1",
                        item.severity === "critical" && "border-red-500 data-[state=checked]:bg-red-500"
                    )}
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {item.icon || getSeverityIcon(item.severity)}
                        <Badge
                            variant={item.severity === "critical" ? "destructive" : "outline"}
                            className="text-xs uppercase"
                        >
                            {item.severity}
                        </Badge>
                    </div>
                    <p className={cn("text-sm", isAcknowledged && "text-muted-foreground line-through")}>
                        {item.text}
                    </p>
                </div>
                {isAcknowledged && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            </CardContent>
        </Card>
    );
}

function PPEBadge({ ppe }: { ppe: string }) {
    const icons: Record<string, React.ReactNode> = {
        "safety glasses": <Eye className="h-4 w-4" />,
        "gloves": <Hand className="h-4 w-4" />,
        "fire resistant": <Flame className="h-4 w-4" />,
        "esd": <Zap className="h-4 w-4" />,
    };

    const icon = Object.entries(icons).find(([key]) =>
        ppe.toLowerCase().includes(key)
    )?.[1] || <Shield className="h-4 w-4" />;

    return (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            {icon}
            <span className="text-sm font-medium">{ppe}</span>
        </div>
    );
}

function SectionContent({ section }: { section: TrainingSection }) {
    switch (section.type) {
        case "checklist": {
            const content = section.content as { items?: Array<{ id: string; text: string }> };
            return (
                <div className="space-y-2">
                    {content.items?.map((item, idx) => (
                        <div
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3"
                        >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {idx + 1}
                            </span>
                            <span className="text-sm">{item.text}</span>
                        </div>
                    ))}
                </div>
            );
        }
        case "dos-and-donts": {
            const content = section.content as {
                dos?: Array<{ id: string; text: string }>;
                donts?: Array<{ id: string; text: string; severity?: string }>;
            };
            return (
                <div className="space-y-4">
                    {content.donts && content.donts.length > 0 && (
                        <Card className="border-red-200 dark:border-red-900">
                            <CardHeader className="pb-2 bg-red-50 dark:bg-red-950/30">
                                <CardTitle className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                                    <ShieldAlert className="h-4 w-4" />
                                    Critical Safety Warnings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3">
                                <ul className="space-y-2">
                                    {content.donts.map((item) => (
                                        <li key={item.id} className="flex items-start gap-2 text-sm">
                                            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                            {item.text}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {content.dos && content.dos.length > 0 && (
                        <Card className="border-emerald-200 dark:border-emerald-900">
                            <CardHeader className="pb-2 bg-emerald-50 dark:bg-emerald-950/30">
                                <CardTitle className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                    <ShieldCheck className="h-4 w-4" />
                                    Required Safety Practices
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3">
                                <ul className="space-y-2">
                                    {content.dos.map((item) => (
                                        <li key={item.id} className="flex items-start gap-2 text-sm">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                            {item.text}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            );
        }
        case "video": {
            const content = section.content as { videoUrl?: string; title?: string };
            if (!content.videoUrl) return null;
            return (
                <div className="aspect-video overflow-hidden rounded-lg border border-border/50">
                    {content.videoUrl.includes("youtube") || content.videoUrl.includes("vimeo") ? (
                        <iframe
                            src={content.videoUrl}
                            title={content.title || "Safety Video"}
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
        case "photos": {
            const content = section.content as { images?: Array<{ id: string; url: string; caption?: string }> };
            if (!content.images?.length) return null;
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    {content.images.map((img) => (
                        <figure key={img.id} className="overflow-hidden rounded-lg border border-border/50">
                            <img src={img.url} alt={img.caption || "Safety reference"} className="aspect-video w-full object-cover" />
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

export function SafetyTrainingViewer({
    module,
    onComplete,
    initialAcknowledged = [],
    className,
}: SafetyTrainingViewerProps) {
    const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set(initialAcknowledged));
    const [currentSection, setCurrentSection] = useState(0);

    // Extract safety items from dos-and-donts sections
    const safetyItems: SafetyItem[] = [];
    const visibleSections = module.sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);

    for (const section of visibleSections) {
        if (section.type === "dos-and-donts") {
            const content = section.content as {
                dos?: Array<{ id: string; text: string }>;
                donts?: Array<{ id: string; text: string; severity?: string }>;
            };

            for (const dont of content.donts || []) {
                safetyItems.push({
                    id: dont.id,
                    text: dont.text,
                    severity: (dont.severity as "critical" | "warning") || "critical",
                });
            }

            for (const doItem of content.dos || []) {
                safetyItems.push({
                    id: doItem.id,
                    text: doItem.text,
                    severity: "info",
                });
            }
        }
    }

    const criticalItems = safetyItems.filter((i) => i.severity === "critical");
    const progress = safetyItems.length > 0 ? (acknowledged.size / safetyItems.length) * 100 : 0;
    const allCriticalAcknowledged = criticalItems.every((i) => acknowledged.has(i.id));
    const allAcknowledged = safetyItems.length > 0 && acknowledged.size === safetyItems.length;

    const toggleAcknowledge = (id: string) => {
        setAcknowledged((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleComplete = () => {
        if (allCriticalAcknowledged) {
            onComplete?.(Array.from(acknowledged));
        }
    };

    // Extract PPE requirements from tags or details
    const ppeRequirements = module.tags.filter(
        (tag) =>
            tag.toLowerCase().includes("ppe") ||
            tag.toLowerCase().includes("safety") ||
            tag.toLowerCase().includes("glove") ||
            tag.toLowerCase().includes("glasses")
    );

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header with Alert Styling */}
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                <CardContent className="py-5">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                            <Shield className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                    Safety Training
                                </Badge>
                                <Badge variant="outline">{module.difficulty}</Badge>
                            </div>
                            <h1 className="text-xl font-bold">{module.name}</h1>
                            {module.description && (
                                <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                            )}
                        </div>
                        {module.totalEstimatedMinutes && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {module.totalEstimatedMinutes} min
                            </div>
                        )}
                    </div>

                    {/* PPE Requirements */}
                    {ppeRequirements.length > 0 && (
                        <div className="mt-4 border-t border-amber-200 pt-4 dark:border-amber-800">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Required PPE
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {ppeRequirements.map((ppe) => (
                                    <PPEBadge key={ppe} ppe={ppe} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Progress */}
                    {safetyItems.length > 0 && (
                        <div className="mt-4 border-t border-amber-200 pt-4 dark:border-amber-800">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-medium">Acknowledgement Progress</span>
                                <span className="text-muted-foreground">
                                    {acknowledged.size} / {safetyItems.length} items
                                </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Content Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {visibleSections.map((section, idx) => (
                    <Button
                        key={section.id}
                        variant={currentSection === idx ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentSection(idx)}
                        className="shrink-0"
                    >
                        {section.title || section.type}
                    </Button>
                ))}
            </div>

            {/* Current Section Content */}
            {visibleSections[currentSection] && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-amber-500" />
                                {visibleSections[currentSection].title || "Safety Information"}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                Section {currentSection + 1} of {visibleSections.length}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SectionContent section={visibleSections[currentSection]} />
                    </CardContent>
                </Card>
            )}

            {/* Safety Acknowledgements */}
            {safetyItems.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Required Acknowledgements</h2>
                        <Badge variant="outline">
                            {criticalItems.length} critical item{criticalItems.length !== 1 ? "s" : ""}
                        </Badge>
                    </div>

                    <div className="space-y-3">
                        {safetyItems.map((item) => (
                            <SafetyCard
                                key={item.id}
                                item={item}
                                isAcknowledged={acknowledged.has(item.id)}
                                onToggle={() => toggleAcknowledge(item.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Completion Action */}
            <Card className={cn(allAcknowledged ? "border-emerald-200 bg-emerald-50/50" : "border-dashed")}>
                <CardContent className="py-6 text-center">
                    {allAcknowledged ? (
                        <>
                            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                            <h3 className="text-lg font-semibold">All Safety Items Acknowledged</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                You have reviewed and acknowledged all safety requirements.
                            </p>
                            <Button className="mt-4" onClick={handleComplete}>
                                Complete Safety Training
                            </Button>
                        </>
                    ) : (
                        <>
                            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
                            <h3 className="text-lg font-semibold">Review Required</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Please acknowledge all safety items before completing this training.
                            </p>
                            {!allCriticalAcknowledged && (
                                <p className="mt-2 text-sm text-red-600">
                                    {criticalItems.filter((i) => !acknowledged.has(i.id)).length} critical item(s) remaining
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
