"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    GraduationCap,
    Rocket,
    Star,
    Users,
    Play,
    Book,
    Target,
} from "lucide-react";
import type { TrainingModuleV2, TrainingSection } from "@/types/training";

// ============================================================================
// Types
// ============================================================================

interface OnboardingViewerProps {
    module: TrainingModuleV2;
    onComplete?: () => void;
    className?: string;
}

interface OnboardingStep {
    id: string;
    title: string;
    content: React.ReactNode;
    isCompleted?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function StepIndicator({
    steps,
    currentIndex,
    onStepClick,
}: {
    steps: OnboardingStep[];
    currentIndex: number;
    onStepClick: (index: number) => void;
}) {
    return (
        <div className="flex items-center gap-1">
            {steps.map((step, idx) => (
                <button
                    key={step.id}
                    type="button"
                    onClick={() => onStepClick(idx)}
                    className={cn(
                        "h-2 rounded-full transition-all",
                        idx === currentIndex
                            ? "w-8 bg-primary"
                            : idx < currentIndex
                            ? "w-2 bg-primary/60"
                            : "w-2 bg-muted-foreground/30"
                    )}
                    aria-label={`Go to step ${idx + 1}`}
                />
            ))}
        </div>
    );
}

function WelcomeCard({ module }: { module: TrainingModuleV2 }) {
    return (
        <div className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-10 w-10 text-primary" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">{module.name}</h2>
                {module.description && (
                    <p className="mt-2 text-muted-foreground max-w-md mx-auto">{module.description}</p>
                )}
            </div>
            <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                {module.totalEstimatedMinutes && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {module.totalEstimatedMinutes} min
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    {module.sections.filter((s) => s.visible).length} sections
                </div>
            </div>
        </div>
    );
}

function SectionContent({ section }: { section: TrainingSection }) {
    switch (section.type) {
        case "details": {
            const content = section.content as { title?: string; description?: string; tags?: string[] };
            return (
                <div className="space-y-4 text-center">
                    {content.title && <h3 className="text-xl font-semibold">{content.title}</h3>}
                    {content.description && (
                        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                            {content.description}
                        </p>
                    )}
                    {content.tags && content.tags.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                            {content.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
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
                <figure className="overflow-hidden rounded-2xl border border-border/50 mx-auto max-w-2xl">
                    <img
                        src={content.imageUrl}
                        alt={content.alt || "Onboarding illustration"}
                        className="w-full aspect-video object-cover"
                    />
                    {content.caption && (
                        <figcaption className="bg-muted/30 px-4 py-2 text-sm text-center text-muted-foreground">
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
                <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
                    {content.images.map((img) => (
                        <figure key={img.id} className="overflow-hidden rounded-xl border border-border/50">
                            <img src={img.url} alt={img.caption || "Reference"} className="aspect-video w-full object-cover" />
                            {img.caption && (
                                <figcaption className="bg-muted/30 px-3 py-2 text-xs text-center text-muted-foreground">
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
                <div className="max-w-md mx-auto space-y-3">
                    {content.items?.map((item, idx) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4"
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {idx + 1}
                            </div>
                            <span className="text-sm">{item.text}</span>
                        </div>
                    ))}
                </div>
            );
        }
        case "dos-and-donts": {
            const content = section.content as {
                dos?: Array<{ id: string; text: string }>;
                donts?: Array<{ id: string; text: string }>;
            };
            return (
                <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
                    {content.dos && content.dos.length > 0 && (
                        <Card className="border-emerald-200 dark:border-emerald-900">
                            <CardHeader className="pb-2 bg-emerald-50 dark:bg-emerald-950/30">
                                <CardTitle className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Best Practices
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3">
                                <ul className="space-y-2">
                                    {content.dos.map((item) => (
                                        <li key={item.id} className="flex items-start gap-2 text-sm">
                                            <Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                            {item.text}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {content.donts && content.donts.length > 0 && (
                        <Card className="border-amber-200 dark:border-amber-900">
                            <CardHeader className="pb-2 bg-amber-50 dark:bg-amber-950/30">
                                <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                                    <Book className="h-4 w-4" />
                                    Things to Know
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-3">
                                <ul className="space-y-2">
                                    {content.donts.map((item) => (
                                        <li key={item.id} className="text-sm">
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
            const content = section.content as { videoUrl?: string; title?: string; description?: string };
            if (!content.videoUrl) return null;
            return (
                <div className="max-w-2xl mx-auto space-y-3">
                    <div className="aspect-video overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                        {content.videoUrl.includes("youtube") || content.videoUrl.includes("vimeo") ? (
                            <iframe
                                src={content.videoUrl}
                                title={content.title || "Onboarding Video"}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video src={content.videoUrl} controls className="h-full w-full" />
                        )}
                    </div>
                    {content.description && (
                        <p className="text-sm text-center text-muted-foreground">{content.description}</p>
                    )}
                </div>
            );
        }
        case "custom": {
            const content = section.content as { markdown?: string };
            return content.markdown ? (
                <div className="prose prose-sm max-w-none dark:prose-invert mx-auto text-center">
                    {content.markdown}
                </div>
            ) : null;
        }
        default:
            return null;
    }
}

function CompletionCard({ onComplete }: { onComplete?: () => void }) {
    return (
        <div className="text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <GraduationCap className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">Congratulations!</h2>
                <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                    You&apos;ve completed the onboarding. You&apos;re now ready to get started!
                </p>
            </div>
            <div className="flex justify-center gap-3">
                <Button size="lg" onClick={onComplete}>
                    <Play className="mr-2 h-4 w-4" />
                    Get Started
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function OnboardingViewer({ module, onComplete, className }: OnboardingViewerProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const visibleSections = module.sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);

    // Build steps: Welcome + Sections + Completion
    const steps: OnboardingStep[] = [
        {
            id: "welcome",
            title: "Welcome",
            content: <WelcomeCard module={module} />,
        },
        ...visibleSections.map((section) => ({
            id: section.id,
            title: section.title || section.type,
            content: <SectionContent section={section} />,
        })),
        {
            id: "completion",
            title: "Complete",
            content: <CompletionCard onComplete={onComplete} />,
        },
    ];

    const progress = ((currentStep + 1) / steps.length) * 100;
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;
    const currentStepData = steps[currentStep];

    const goNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const goPrev = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    return (
        <div className={cn("flex flex-col min-h-[600px]", className)}>
            {/* Progress Header */}
            <div className="shrink-0 border-b border-border/50 bg-card/50 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            Onboarding
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                    </div>
                    <StepIndicator steps={steps} currentIndex={currentStep} onStepClick={setCurrentStep} />
                </div>
                <Progress value={progress} className="h-1" />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-3xl py-8">
                    {/* Step Title */}
                    {currentStepData.title && currentStep !== 0 && currentStep !== steps.length - 1 && (
                        <h2 className="mb-6 text-center text-lg font-semibold text-muted-foreground">
                            {currentStepData.title}
                        </h2>
                    )}

                    {/* Step Content */}
                    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        {currentStepData.content}
                    </div>
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="shrink-0 border-t border-border/50 bg-card/50 px-6 py-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={goPrev}
                        disabled={isFirstStep}
                        className="gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>

                    <span className="text-sm text-muted-foreground">
                        {Math.round(progress)}% complete
                    </span>

                    {!isLastStep && (
                        <Button onClick={goNext} className="gap-2">
                            {currentStep === steps.length - 2 ? "Finish" : "Continue"}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}

                    {isLastStep && (
                        <Button onClick={onComplete} className="gap-2">
                            <Play className="h-4 w-4" />
                            Get Started
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
