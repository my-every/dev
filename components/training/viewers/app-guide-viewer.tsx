"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Clock,
    Info,
    Lightbulb,
    Play,
    AlertTriangle,
    ExternalLink,
    ImageIcon,
} from "lucide-react";
import type { TrainingModuleV2, TrainingSection } from "@/types/training";

// ============================================================================
// Types
// ============================================================================

export interface AppGuideSection {
    id: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
    subsections?: Array<{
        id: string;
        title: string;
        content: React.ReactNode;
    }>;
}

interface AppGuideViewerProps {
    module: TrainingModuleV2;
    sections?: AppGuideSection[];
    onSectionChange?: (sectionId: string) => void;
    className?: string;
}

// ============================================================================
// Section Content Renderers
// ============================================================================

function renderSectionFromTraining(section: TrainingSection): React.ReactNode {
    switch (section.type) {
        case "details": {
            const content = section.content as { title?: string; description?: string; tags?: string[] };
            return (
                <div className="space-y-3">
                    {content.description && (
                        <p className="text-base leading-relaxed text-foreground/90">{content.description}</p>
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
        case "cover-image": {
            const content = section.content as { imageUrl?: string; alt?: string; caption?: string };
            if (!content.imageUrl) return null;
            return (
                <figure className="overflow-hidden rounded-xl border border-border/50">
                    <img
                        src={content.imageUrl}
                        alt={content.alt || "Guide illustration"}
                        className="w-full object-cover"
                    />
                    {content.caption && (
                        <figcaption className="bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                            {content.caption}
                        </figcaption>
                    )}
                </figure>
            );
        }
        case "photos": {
            const content = section.content as { images?: Array<{ id: string; url: string; caption?: string }> };
            if (!content.images?.length) return null;
            return (
                <div className="grid gap-4 sm:grid-cols-2">
                    {content.images.map((img) => (
                        <figure key={img.id} className="overflow-hidden rounded-xl border border-border/50">
                            <img src={img.url} alt={img.caption || "Screenshot"} className="w-full object-cover" />
                            {img.caption && (
                                <figcaption className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    {img.caption}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            );
        }
        case "checklist": {
            const content = section.content as { items?: Array<{ id: string; text: string; required?: boolean }> };
            if (!content.items?.length) return null;
            return (
                <ol className="space-y-2">
                    {content.items.map((item, idx) => (
                        <li key={item.id} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {idx + 1}
                            </span>
                            <span className="text-sm leading-relaxed">{item.text}</span>
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
                <div className="grid gap-4 sm:grid-cols-2">
                    {content.dos && content.dos.length > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" /> Do
                            </h4>
                            <ul className="space-y-2">
                                {content.dos.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {content.donts && content.donts.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4" /> Don&apos;t
                            </h4>
                            <ul className="space-y-2">
                                {content.donts.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2 text-sm">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }
        case "video": {
            const content = section.content as { videoUrl?: string; title?: string; description?: string };
            if (!content.videoUrl) return null;
            return (
                <div className="space-y-3">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                        {content.videoUrl.includes("youtube") || content.videoUrl.includes("vimeo") ? (
                            <iframe
                                src={content.videoUrl}
                                title={content.title || "Video"}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video src={content.videoUrl} controls className="h-full w-full" />
                        )}
                    </div>
                    {content.description && (
                        <p className="text-sm text-muted-foreground">{content.description}</p>
                    )}
                </div>
            );
        }
        case "custom": {
            const content = section.content as { markdown?: string };
            if (!content.markdown) return null;
            return (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                    {content.markdown}
                </div>
            );
        }
        default:
            return null;
    }
}

function buildSectionsFromModule(module: TrainingModuleV2): AppGuideSection[] {
    const visibleSections = module.sections
        .filter((s) => s.visible)
        .sort((a, b) => a.order - b.order);

    // Group sections by stage or use global
    const globalSections = visibleSections.filter((s) => !s.stage);
    const stageSections = new Map<string, TrainingSection[]>();

    for (const section of visibleSections) {
        if (section.stage) {
            const existing = stageSections.get(section.stage) || [];
            existing.push(section);
            stageSections.set(section.stage, existing);
        }
    }

    const result: AppGuideSection[] = [];

    // Add intro section if module has description
    if (module.description) {
        result.push({
            id: "intro",
            title: "Introduction",
            description: "Get started with this guide",
            icon: <BookOpen className="h-4 w-4" />,
            content: (
                <div className="space-y-4">
                    <p className="text-base leading-relaxed">{module.description}</p>
                    {module.totalEstimatedMinutes && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Estimated time: {module.totalEstimatedMinutes} minutes
                        </div>
                    )}
                </div>
            ),
        });
    }

    // Add global sections
    for (const section of globalSections) {
        const content = renderSectionFromTraining(section);
        if (!content) continue;

        result.push({
            id: section.id,
            title: section.title || section.type,
            icon: getSectionIcon(section.type),
            content,
        });
    }

    // Add stage-grouped sections
    for (const [stage, sections] of stageSections) {
        const subsections = sections
            .map((s) => ({
                id: s.id,
                title: s.title || s.type,
                content: renderSectionFromTraining(s),
            }))
            .filter((s) => s.content);

        if (subsections.length === 0) continue;

        result.push({
            id: `stage-${stage}`,
            title: formatStageLabel(stage),
            description: `${subsections.length} section${subsections.length > 1 ? "s" : ""}`,
            icon: <Play className="h-4 w-4" />,
            content: subsections.length === 1 ? subsections[0].content : null,
            subsections: subsections.length > 1 ? subsections : undefined,
        });
    }

    return result;
}

function getSectionIcon(type: string): React.ReactNode {
    switch (type) {
        case "details":
            return <Info className="h-4 w-4" />;
        case "cover-image":
        case "photos":
            return <ImageIcon className="h-4 w-4" />;
        case "checklist":
            return <CheckCircle2 className="h-4 w-4" />;
        case "dos-and-donts":
            return <Lightbulb className="h-4 w-4" />;
        case "video":
            return <Play className="h-4 w-4" />;
        default:
            return <BookOpen className="h-4 w-4" />;
    }
}

function formatStageLabel(stage: string): string {
    return stage
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// ============================================================================
// Main Component
// ============================================================================

export function AppGuideViewer({
    module,
    sections: customSections,
    onSectionChange,
    className,
}: AppGuideViewerProps) {
    const sections = customSections || buildSectionsFromModule(module);
    const [activeSection, setActiveSection] = useState(sections[0]?.id || "");
    const [activeSubsection, setActiveSubsection] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

    // Scroll spy effect
    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        const id = entry.target.getAttribute("data-section-id");
                        if (id && id !== activeSection) {
                            setActiveSection(id);
                            onSectionChange?.(id);
                        }
                    }
                }
            },
            {
                root: container,
                rootMargin: "-20% 0px -60% 0px",
                threshold: [0.5],
            }
        );

        for (const el of sectionRefs.current.values()) {
            observer.observe(el);
        }

        return () => observer.disconnect();
    }, [activeSection, onSectionChange, sections]);

    const scrollToSection = useCallback((sectionId: string, subsectionId?: string) => {
        const targetId = subsectionId || sectionId;
        const el = sectionRefs.current.get(targetId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveSection(sectionId);
            setActiveSubsection(subsectionId || null);
        }
    }, []);

    const registerRef = useCallback((id: string, el: HTMLElement | null) => {
        if (el) {
            sectionRefs.current.set(id, el);
        } else {
            sectionRefs.current.delete(id);
        }
    }, []);

    return (
        <div className={cn("flex h-full", className)}>
            {/* Scrollspy Navigation */}
            <nav className="sticky top-0 hidden w-64 shrink-0 border-r border-border/50 bg-card/50 p-4 lg:block">
                <div className="space-y-1">
                    <div className="mb-4 px-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Contents
                        </h3>
                    </div>
                    {sections.map((section) => (
                        <div key={section.id}>
                            <button
                                type="button"
                                onClick={() => scrollToSection(section.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                    activeSection === section.id
                                        ? "bg-primary/10 font-medium text-primary"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                {section.icon}
                                <span className="truncate">{section.title}</span>
                                {section.subsections && (
                                    <ChevronRight
                                        className={cn(
                                            "ml-auto h-4 w-4 transition-transform",
                                            activeSection === section.id && "rotate-90"
                                        )}
                                    />
                                )}
                            </button>
                            {/* Subsections */}
                            {section.subsections && activeSection === section.id && (
                                <div className="ml-6 mt-1 space-y-1 border-l border-border/50 pl-3">
                                    {section.subsections.map((sub) => (
                                        <button
                                            key={sub.id}
                                            type="button"
                                            onClick={() => scrollToSection(section.id, sub.id)}
                                            className={cn(
                                                "block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                                activeSubsection === sub.id
                                                    ? "font-medium text-primary"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {sub.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </nav>

            {/* Content Area */}
            <div ref={contentRef} className="flex-1 overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {module.category || "Guide"}
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
                            <h1 className="mt-1 text-xl font-semibold">{module.name}</h1>
                        </div>
                        {module.totalEstimatedMinutes && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {module.totalEstimatedMinutes} min
                            </div>
                        )}
                    </div>
                </header>

                {/* Sections */}
                <div className="space-y-12 p-6">
                    {sections.map((section, index) => (
                        <section
                            key={section.id}
                            ref={(el) => registerRef(section.id, el)}
                            data-section-id={section.id}
                            className="scroll-mt-20"
                        >
                            {/* Section Header */}
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    {section.icon || <span className="text-sm font-medium">{index + 1}</span>}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">{section.title}</h2>
                                    {section.description && (
                                        <p className="text-sm text-muted-foreground">{section.description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Section Content */}
                            {section.content && (
                                <div className="rounded-xl border border-border/50 bg-card p-5">
                                    {section.content}
                                </div>
                            )}

                            {/* Subsections */}
                            {section.subsections && (
                                <div className="mt-4 space-y-4 pl-4">
                                    {section.subsections.map((sub) => (
                                        <div
                                            key={sub.id}
                                            ref={(el) => registerRef(sub.id, el)}
                                            data-section-id={sub.id}
                                            className="scroll-mt-20 rounded-xl border border-border/40 bg-card/50 p-4"
                                        >
                                            <h3 className="mb-3 text-base font-medium">{sub.title}</h3>
                                            {sub.content}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}

                    {/* Completion Footer */}
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                        <h3 className="text-lg font-semibold">You&apos;ve reached the end!</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Review any section by clicking on it in the navigation.
                        </p>
                        <div className="mt-4 flex justify-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => scrollToSection(sections[0]?.id)}>
                                Back to Top
                            </Button>
                            {module.swsTemplateIds?.[0] && (
                                <Button size="sm" className="gap-1.5">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Related Operation
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
