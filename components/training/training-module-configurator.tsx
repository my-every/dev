"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Smartphone,
    Users,
    ShieldAlert,
    Cpu,
    Wrench,
    Play,
    RotateCcw,
    Eye,
    Sparkles,
    ChevronRight,
    Check,
    ArrowLeft,
    BookOpen,
    Clock,
    Tag,
    FileText,
    Image as ImageIcon,
    Lightbulb,
    AlertCircle,
} from "lucide-react";
import type { TrainingModuleV2, TrainingCategory } from "@/types/training";
import { createEmptyTrainingModuleV2 } from "@/types/training";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConfigStep = "cover" | "category" | "details" | "content" | "preview";

interface CategoryOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    illustration: React.ReactNode;
    color: string;
    suggestedTags: string[];
    suggestedSections: string[];
}

interface ConfiguratorState {
    step: ConfigStep;
    category: string | null;
    draft: Partial<TrainingModuleV2>;
    hasExistingDraft: boolean;
}

interface TrainingModuleConfiguratorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existingDraft?: Partial<TrainingModuleV2> | null;
    categories: TrainingCategory[];
    onSave: (module: TrainingModuleV2) => void;
    onPreview?: (module: Partial<TrainingModuleV2>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Illustrations
// ─────────────────────────────────────────────────────────────────────────────

function AppIllustration({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="relative h-48 w-40">
                {/* Phone frame */}
                <div className="absolute inset-0 rounded-3xl border-4 border-neutral-200 bg-gradient-to-b from-neutral-50 to-white shadow-xl" />
                {/* Screen content */}
                <div className="absolute inset-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 p-3">
                    <div className="mb-2 h-2 w-12 rounded-full bg-blue-200" />
                    <div className="mb-3 h-1.5 w-20 rounded-full bg-blue-100" />
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-blue-300" />
                            <div className="h-2 flex-1 rounded-full bg-blue-200" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-indigo-300" />
                            <div className="h-2 flex-1 rounded-full bg-indigo-200" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-violet-300" />
                            <div className="h-2 flex-1 rounded-full bg-violet-200" />
                        </div>
                    </div>
                </div>
                {/* Floating elements */}
                <div className="absolute -right-4 top-8 h-8 w-8 rounded-xl bg-blue-400 shadow-lg" />
                <div className="absolute -left-3 bottom-12 h-6 w-6 rounded-lg bg-indigo-400 shadow-lg" />
            </div>
        </div>
    );
}

function OnboardingIllustration({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="relative">
                {/* Main card */}
                <div className="h-40 w-48 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-xl">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-emerald-200" />
                        <div className="flex-1">
                            <div className="mb-1 h-2 w-16 rounded-full bg-emerald-300" />
                            <div className="h-1.5 w-12 rounded-full bg-emerald-200" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <div className="h-1.5 w-20 rounded-full bg-emerald-200" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <div className="h-1.5 w-16 rounded-full bg-emerald-200" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full border-2 border-emerald-300" />
                            <div className="h-1.5 w-24 rounded-full bg-emerald-200" />
                        </div>
                    </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -right-4 -top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                </div>
            </div>
        </div>
    );
}

function SafetyIllustration({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="relative">
                {/* Shield */}
                <div className="flex h-44 w-36 items-center justify-center rounded-t-full rounded-b-[40%] bg-gradient-to-b from-amber-100 to-orange-200 shadow-xl">
                    <div className="flex h-32 w-24 items-center justify-center rounded-t-full rounded-b-[40%] bg-gradient-to-b from-amber-200 to-orange-300">
                        <ShieldAlert className="h-12 w-12 text-orange-600" />
                    </div>
                </div>
                {/* Warning badges */}
                <div className="absolute -left-4 top-8 h-8 w-8 rounded-lg bg-red-400 shadow-lg" />
                <div className="absolute -right-3 bottom-8 h-6 w-6 rounded-lg bg-yellow-400 shadow-lg" />
            </div>
        </div>
    );
}

function DeviceIllustration({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="relative">
                {/* Circuit board */}
                <div className="h-40 w-52 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 p-3 shadow-xl">
                    {/* Chip */}
                    <div className="mx-auto mb-3 h-12 w-12 rounded-lg bg-slate-600 shadow-inner">
                        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-1.5">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="rounded-sm bg-cyan-400/60" />
                            ))}
                        </div>
                    </div>
                    {/* Traces */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1">
                            <div className="h-1 w-8 rounded-full bg-cyan-500/40" />
                            <div className="h-2 w-2 rounded-full bg-green-400" />
                            <div className="h-1 flex-1 rounded-full bg-cyan-500/40" />
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-1 w-12 rounded-full bg-cyan-500/40" />
                            <div className="h-2 w-2 rounded-full bg-yellow-400" />
                            <div className="h-1 flex-1 rounded-full bg-cyan-500/40" />
                        </div>
                    </div>
                </div>
                {/* Floating component */}
                <div className="absolute -right-4 top-4 h-10 w-10 rounded-xl bg-cyan-500 shadow-lg" />
            </div>
        </div>
    );
}

function ToolIllustration({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="relative">
                {/* Tool box */}
                <div className="h-36 w-48 rounded-xl bg-gradient-to-br from-red-100 to-rose-200 shadow-xl">
                    <div className="flex h-8 items-center justify-center rounded-t-xl bg-gradient-to-r from-red-400 to-rose-400">
                        <div className="h-3 w-16 rounded-full bg-red-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-3">
                        <div className="flex h-10 items-center justify-center rounded-lg bg-white/60">
                            <Wrench className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex h-10 items-center justify-center rounded-lg bg-white/60">
                            <div className="h-6 w-1.5 rounded-full bg-red-400" />
                        </div>
                        <div className="flex h-10 items-center justify-center rounded-lg bg-white/60">
                            <div className="h-5 w-5 rounded bg-red-300" />
                        </div>
                    </div>
                </div>
                {/* Floating wrench */}
                <div className="absolute -left-4 -top-2 flex h-10 w-10 rotate-[-20deg] items-center justify-center rounded-xl bg-rose-400 shadow-lg">
                    <Wrench className="h-5 w-5 text-white" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Options
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: CategoryOption[] = [
    {
        id: "app",
        label: "App Guide",
        description: "Application workflows, features, and navigation guides",
        icon: <Smartphone className="h-5 w-5" />,
        illustration: <AppIllustration className="h-full w-full" />,
        color: "bg-blue-50 border-blue-200 hover:border-blue-400",
        suggestedTags: ["app", "workflow", "navigation", "features"],
        suggestedSections: ["overview", "getting-started", "features", "tips", "faq"],
    },
    {
        id: "onboarding",
        label: "Onboarding",
        description: "New team member orientation and training paths",
        icon: <Users className="h-5 w-5" />,
        illustration: <OnboardingIllustration className="h-full w-full" />,
        color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
        suggestedTags: ["onboarding", "orientation", "new-hire", "training-path"],
        suggestedSections: ["welcome", "milestones", "contacts", "resources"],
    },
    {
        id: "safety",
        label: "Safety",
        description: "Safety procedures, PPE requirements, and compliance",
        icon: <ShieldAlert className="h-5 w-5" />,
        illustration: <SafetyIllustration className="h-full w-full" />,
        color: "bg-amber-50 border-amber-200 hover:border-amber-400",
        suggestedTags: ["safety", "compliance", "ppe", "hazard", "emergency"],
        suggestedSections: ["hazards", "ppe", "procedures", "emergency", "compliance"],
    },
    {
        id: "device",
        label: "Device",
        description: "Device-specific installation and configuration training",
        icon: <Cpu className="h-5 w-5" />,
        illustration: <DeviceIllustration className="h-full w-full" />,
        color: "bg-slate-50 border-slate-200 hover:border-slate-400",
        suggestedTags: ["device", "installation", "configuration", "setup"],
        suggestedSections: ["overview", "specs", "installation", "troubleshooting"],
    },
    {
        id: "tool",
        label: "Tool Guide",
        description: "Tool usage, maintenance, and safety guidelines",
        icon: <Wrench className="h-5 w-5" />,
        illustration: <ToolIllustration className="h-full w-full" />,
        color: "bg-rose-50 border-rose-200 hover:border-rose-400",
        suggestedTags: ["tool", "equipment", "maintenance", "usage"],
        suggestedSections: ["overview", "usage", "maintenance", "safety"],
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cover Page Component
// ─────────────────────────────────────────────────────────────────────────────

interface CoverPageProps {
    hasExistingDraft: boolean;
    draftName?: string;
    draftCategory?: string;
    onStart: () => void;
    onResume: () => void;
    onPreview: () => void;
}

function CoverPage({ hasExistingDraft, draftName, draftCategory, onStart, onResume, onPreview }: CoverPageProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center px-8 py-12">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-neutral-100 to-neutral-200 shadow-lg">
                <BookOpen className="h-10 w-10 text-neutral-600" />
            </div>

            <h2 className="mb-2 text-2xl font-semibold text-foreground">Training Module Configurator</h2>
            <p className="mb-8 max-w-md text-center text-muted-foreground">
                Create comprehensive training modules with guided setup, live preview, and intelligent suggestions.
            </p>

            <div className="flex flex-col items-center gap-3">
                {hasExistingDraft ? (
                    <>
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                            <p className="text-sm font-medium text-amber-800">You have an existing draft</p>
                            <p className="text-xs text-amber-600">
                                {draftName || "Untitled"} - {draftCategory || "No category"}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onResume} className="gap-2">
                                <RotateCcw className="h-4 w-4" />
                                Resume Draft
                            </Button>
                            <Button variant="outline" onClick={onPreview} className="gap-2">
                                <Eye className="h-4 w-4" />
                                Preview
                            </Button>
                        </div>
                        <Button onClick={onStart} className="mt-2 gap-2">
                            <Play className="h-4 w-4" />
                            Start Fresh
                        </Button>
                    </>
                ) : (
                    <Button onClick={onStart} size="lg" className="gap-2">
                        <Play className="h-4 w-4" />
                        Start Configuration
                    </Button>
                )}
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-3 gap-6 text-center">
                <div>
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Smart suggestions</p>
                </div>
                <div>
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                        <Eye className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Live preview</p>
                </div>
                <div>
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                        <FileText className="h-5 w-5 text-violet-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">Category templates</p>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Selection Component
// ─────────────────────────────────────────────────────────────────────────────

interface CategorySelectionProps {
    selected: string | null;
    onSelect: (categoryId: string) => void;
    onNext: () => void;
    onBack: () => void;
}

function CategorySelection({ selected, onSelect, onNext, onBack }: CategorySelectionProps) {
    const selectedOption = CATEGORY_OPTIONS.find((opt) => opt.id === selected);

    return (
        <div className="flex h-full">
            {/* Left: Category Cards */}
            <div className="flex flex-1 flex-col border-r border-border/50 p-6">
                <div className="mb-6">
                    <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1 text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <h3 className="text-lg font-semibold">Choose Training Category</h3>
                    <p className="text-sm text-muted-foreground">
                        Select the type of training module you want to create
                    </p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                    {CATEGORY_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.id)}
                            className={cn(
                                "group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                                option.color,
                                selected === option.id && "ring-2 ring-offset-2"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                                    selected === option.id ? "bg-foreground text-background" : "bg-white/80"
                                )}
                            >
                                {option.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{option.label}</span>
                                    {selected === option.id && (
                                        <Check className="h-4 w-4 text-emerald-600" />
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                    {option.description}
                                </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
                        </button>
                    ))}
                </div>

                <div className="mt-6 flex justify-end">
                    <Button onClick={onNext} disabled={!selected} className="gap-2">
                        Continue
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Right: Illustration Preview */}
            <div className="flex w-80 flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 p-8">
                <div className="transition-all duration-500">
                    {selectedOption ? (
                        <>
                            {selectedOption.illustration}
                            <div className="mt-6 text-center">
                                <Badge variant="secondary" className="mb-2">
                                    {selectedOption.label}
                                </Badge>
                                <p className="text-sm text-muted-foreground">
                                    {selectedOption.suggestedSections.length} suggested sections
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <BookOpen className="mx-auto mb-4 h-16 w-16 opacity-30" />
                            <p className="text-sm">Select a category to see preview</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Details Form Component
// ─────────────────────────────────────────────────────────────────────────────

interface DetailsFormProps {
    draft: Partial<TrainingModuleV2>;
    categoryOption: CategoryOption | undefined;
    onUpdate: (patch: Partial<TrainingModuleV2>) => void;
    onNext: () => void;
    onBack: () => void;
}

function DetailsForm({ draft, categoryOption, onUpdate, onNext, onBack }: DetailsFormProps) {
    const [showSuggestions, setShowSuggestions] = useState(true);

    const handleAddSuggestedTag = (tag: string) => {
        const currentTags = draft.tags ?? [];
        if (!currentTags.includes(tag)) {
            onUpdate({ tags: [...currentTags, tag] });
        }
    };

    const handleRemoveTag = (tag: string) => {
        onUpdate({ tags: (draft.tags ?? []).filter((t) => t !== tag) });
    };

    return (
        <div className="flex h-full">
            {/* Left: Form Fields */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
                <div className="mb-6">
                    <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1 text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <h3 className="text-lg font-semibold">Module Details</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure the basic information for your training module
                    </p>
                </div>

                <div className="flex-1 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Module Name
                        </Label>
                        <Input
                            id="name"
                            value={draft.name ?? ""}
                            onChange={(e) => onUpdate({ name: e.target.value })}
                            placeholder="e.g., PLC Panel Installation Guide"
                            className="h-11"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={draft.description ?? ""}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder="Provide a brief overview of what this training covers..."
                            className="min-h-[100px] resize-none"
                        />
                    </div>

                    {/* Difficulty & Time */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                                Difficulty
                            </Label>
                            <Select
                                value={draft.difficulty ?? "intermediate"}
                                onValueChange={(value) => onUpdate({ difficulty: value as TrainingModuleV2["difficulty"] })}
                            >
                                <SelectTrigger className="h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="beginner">Beginner</SelectItem>
                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                    <SelectItem value="advanced">Advanced</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                Estimated Time (minutes)
                            </Label>
                            <Input
                                type="number"
                                value={draft.totalEstimatedMinutes ?? 30}
                                onChange={(e) => onUpdate({ totalEstimatedMinutes: parseInt(e.target.value) || 30 })}
                                min={5}
                                step={5}
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            Tags
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {(draft.tags ?? []).map((tag) => (
                                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                                    >
                                        <span className="sr-only">Remove {tag}</span>
                                        &times;
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        {showSuggestions && categoryOption && (
                            <div className="mt-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-3">
                                <div className="mb-2 flex items-center gap-2 text-xs text-blue-600">
                                    <Lightbulb className="h-3.5 w-3.5" />
                                    Suggested tags for {categoryOption.label}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {categoryOption.suggestedTags
                                        .filter((tag) => !(draft.tags ?? []).includes(tag))
                                        .map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => handleAddSuggestedTag(tag)}
                                                className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs text-blue-700 transition-colors hover:bg-blue-100"
                                            >
                                                + {tag}
                                            </button>
                                        ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSuggestions(false)}
                                    className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Dismiss suggestions
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
                        <div>
                            <Label className="font-medium">Restricted Access</Label>
                            <p className="text-sm text-muted-foreground">
                                Limit visibility to specific roles
                            </p>
                        </div>
                        <Switch
                            checked={draft.visibility === "restricted"}
                            onCheckedChange={(checked) =>
                                onUpdate({ visibility: checked ? "restricted" : "everyone" })
                            }
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button onClick={onNext} className="gap-2">
                        Continue to Content
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Right: Live Preview Card */}
            <div className="flex w-80 flex-col bg-gradient-to-br from-muted/30 to-muted/50 p-6">
                <div className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Live Preview
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    {draft.coverImage?.imageUrl ? (
                        <img
                            src={draft.coverImage.imageUrl}
                            alt="Cover"
                            className="mb-3 h-24 w-full rounded-xl object-cover"
                        />
                    ) : (
                        <div className="mb-3 flex h-24 w-full items-center justify-center rounded-xl bg-muted">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                    )}
                    <h4 className="mb-1 font-medium line-clamp-1">
                        {draft.name || "Untitled Module"}
                    </h4>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                        {draft.description || "No description provided"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-xs">
                            {draft.difficulty ?? "intermediate"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {draft.totalEstimatedMinutes ?? 30} min
                        </Badge>
                        {categoryOption && (
                            <Badge variant="secondary" className="text-xs">
                                {categoryOption.label}
                            </Badge>
                        )}
                    </div>
                </div>

                {draft.tags && draft.tags.length > 0 && (
                    <div className="mt-4">
                        <div className="mb-2 text-xs text-muted-foreground">Tags</div>
                        <div className="flex flex-wrap gap-1">
                            {draft.tags.slice(0, 5).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                            {draft.tags.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                    +{draft.tags.length - 5} more
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Builder Component (Simplified)
// ─────────────────────────────────────────────────────────────────────────────

interface ContentBuilderProps {
    draft: Partial<TrainingModuleV2>;
    categoryOption: CategoryOption | undefined;
    onUpdate: (patch: Partial<TrainingModuleV2>) => void;
    onFinish: () => void;
    onBack: () => void;
    onPreview: () => void;
}

function ContentBuilder({ draft, categoryOption, onUpdate, onFinish, onBack, onPreview }: ContentBuilderProps) {
    return (
        <div className="flex h-full flex-col p-6">
            <div className="mb-6">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <h3 className="text-lg font-semibold">Content Configuration</h3>
                <p className="text-sm text-muted-foreground">
                    Configure the content sections for your training module
                </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
                {/* Suggested Sections */}
                {categoryOption && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">Suggested Sections</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {categoryOption.suggestedSections.map((section) => (
                                <Badge key={section} variant="secondary" className="capitalize">
                                    {section.replace(/-/g, " ")}
                                </Badge>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            These sections are recommended for {categoryOption.label} modules.
                            You can customize them after creation.
                        </p>
                    </div>
                )}

                {/* Cover Image */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        Cover Image URL
                    </Label>
                    <Input
                        value={draft.coverImage?.imageUrl ?? ""}
                        onChange={(e) =>
                            onUpdate({
                                coverImage: {
                                    ...draft.coverImage,
                                    imageUrl: e.target.value,
                                    alt: draft.coverImage?.alt ?? "",
                                },
                            })
                        }
                        placeholder="https://example.com/image.jpg"
                        className="h-11"
                    />
                </div>

                {/* Part Numbers */}
                <div className="space-y-2">
                    <Label>Related Part Numbers</Label>
                    <Textarea
                        value={(draft.partNumbers ?? []).join(", ")}
                        onChange={(e) =>
                            onUpdate({
                                partNumbers: e.target.value
                                    .split(",")
                                    .map((p) => p.trim())
                                    .filter(Boolean),
                            })
                        }
                        placeholder="Enter part numbers separated by commas..."
                        className="min-h-[80px]"
                    />
                </div>

                {/* Info Box */}
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium">Continue in Editor</p>
                        <p className="mt-1 text-blue-600">
                            After saving, you can add detailed content sections, media, checklists, and more
                            in the full training editor.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={onPreview} className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                </Button>
                <Button onClick={onFinish} className="gap-2">
                    <Check className="h-4 w-4" />
                    Create Module
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Component
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewPanelProps {
    draft: Partial<TrainingModuleV2>;
    categoryOption: CategoryOption | undefined;
    onBack: () => void;
    onFinish: () => void;
}

function PreviewPanel({ draft, categoryOption, onBack, onFinish }: PreviewPanelProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-border/50 p-4">
                <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Editor
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-2xl">
                    {/* Cover */}
                    {draft.coverImage?.imageUrl ? (
                        <img
                            src={draft.coverImage.imageUrl}
                            alt="Cover"
                            className="mb-6 h-48 w-full rounded-2xl object-cover"
                        />
                    ) : (
                        <div className="mb-6 flex h-48 w-full items-center justify-center rounded-2xl bg-muted">
                            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                    )}

                    {/* Header */}
                    <div className="mb-6">
                        {categoryOption && (
                            <Badge variant="secondary" className="mb-2">
                                {categoryOption.label}
                            </Badge>
                        )}
                        <h1 className="mb-2 text-2xl font-bold">
                            {draft.name || "Untitled Module"}
                        </h1>
                        <p className="text-muted-foreground">
                            {draft.description || "No description provided"}
                        </p>
                    </div>

                    {/* Meta */}
                    <div className="mb-6 flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{draft.difficulty ?? "intermediate"}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{draft.totalEstimatedMinutes ?? 30} minutes</span>
                        </div>
                        {draft.visibility === "restricted" && (
                            <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2">
                                <ShieldAlert className="h-4 w-4 text-amber-600" />
                                <span className="text-sm text-amber-700">Restricted</span>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    {draft.tags && draft.tags.length > 0 && (
                        <div className="mb-6">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {draft.tags.map((tag) => (
                                    <Badge key={tag} variant="outline">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Part Numbers */}
                    {draft.partNumbers && draft.partNumbers.length > 0 && (
                        <div className="mb-6">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                                Related Part Numbers
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {draft.partNumbers.map((pn) => (
                                    <Badge key={pn} variant="secondary">
                                        {pn}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested Sections Preview */}
                    {categoryOption && (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6">
                            <h3 className="mb-3 text-sm font-medium">Content Sections (to be configured)</h3>
                            <div className="space-y-2">
                                {categoryOption.suggestedSections.map((section, index) => (
                                    <div
                                        key={section}
                                        className="flex items-center gap-3 rounded-lg bg-background/60 p-3"
                                    >
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                            {index + 1}
                                        </div>
                                        <span className="text-sm capitalize">{section.replace(/-/g, " ")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-border/50 p-4">
                <div className="flex justify-end">
                    <Button onClick={onFinish} className="gap-2">
                        <Check className="h-4 w-4" />
                        Create Module
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function TrainingModuleConfigurator({
    open,
    onOpenChange,
    existingDraft,
    categories,
    onSave,
    onPreview,
}: TrainingModuleConfiguratorProps) {
    const [state, setState] = useState<ConfiguratorState>({
        step: "cover",
        category: null,
        draft: {},
        hasExistingDraft: false,
    });

    // Initialize state when modal opens
    useEffect(() => {
        if (open) {
            const hasExisting = Boolean(existingDraft && (existingDraft.name || existingDraft.category));
            setState({
                step: "cover",
                category: existingDraft?.category ?? null,
                draft: existingDraft ?? {},
                hasExistingDraft: hasExisting,
            });
        }
    }, [open, existingDraft]);

    const categoryOption = useMemo(
        () => CATEGORY_OPTIONS.find((opt) => opt.id === state.category),
        [state.category]
    );

    const handleUpdateDraft = useCallback((patch: Partial<TrainingModuleV2>) => {
        setState((prev) => ({
            ...prev,
            draft: { ...prev.draft, ...patch },
        }));
    }, []);

    const handleSelectCategory = useCallback((categoryId: string) => {
        setState((prev) => ({
            ...prev,
            category: categoryId,
            draft: { ...prev.draft, category: categoryId },
        }));
    }, []);

    const handleStart = useCallback(() => {
        setState((prev) => ({
            ...prev,
            step: "category",
            draft: {},
            category: null,
        }));
    }, []);

    const handleResume = useCallback(() => {
        setState((prev) => ({
            ...prev,
            step: prev.category ? "details" : "category",
        }));
    }, []);

    const handleFinish = useCallback(() => {
        const now = new Date().toISOString();
        const id = `training-${Date.now()}`;
        const slug = (state.draft.name ?? "untitled")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const module: TrainingModuleV2 = {
            ...createEmptyTrainingModuleV2(id, state.draft.name ?? "Untitled"),
            ...state.draft,
            id,
            slug,
            category: state.category ?? undefined,
            createdAt: now,
            updatedAt: now,
        };

        onSave(module);
        onOpenChange(false);
    }, [state.draft, state.category, onSave, onOpenChange]);

    const goTo = useCallback((step: ConfigStep) => {
        setState((prev) => ({ ...prev, step }));
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Training Module Configurator</DialogTitle>
                </DialogHeader>

                <div className="h-[80vh]">
                    {state.step === "cover" && (
                        <CoverPage
                            hasExistingDraft={state.hasExistingDraft}
                            draftName={state.draft.name}
                            draftCategory={categoryOption?.label}
                            onStart={handleStart}
                            onResume={handleResume}
                            onPreview={() => {
                                if (onPreview) onPreview(state.draft);
                            }}
                        />
                    )}

                    {state.step === "category" && (
                        <CategorySelection
                            selected={state.category}
                            onSelect={handleSelectCategory}
                            onNext={() => goTo("details")}
                            onBack={() => goTo("cover")}
                        />
                    )}

                    {state.step === "details" && (
                        <DetailsForm
                            draft={state.draft}
                            categoryOption={categoryOption}
                            onUpdate={handleUpdateDraft}
                            onNext={() => goTo("content")}
                            onBack={() => goTo("category")}
                        />
                    )}

                    {state.step === "content" && (
                        <ContentBuilder
                            draft={state.draft}
                            categoryOption={categoryOption}
                            onUpdate={handleUpdateDraft}
                            onFinish={handleFinish}
                            onBack={() => goTo("details")}
                            onPreview={() => goTo("preview")}
                        />
                    )}

                    {state.step === "preview" && (
                        <PreviewPanel
                            draft={state.draft}
                            categoryOption={categoryOption}
                            onBack={() => goTo("content")}
                            onFinish={handleFinish}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
