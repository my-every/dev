"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Smartphone,
    Users,
    ShieldCheck,
    Cpu,
    Wrench,
    Clock,
    BookOpen,
    ChevronRight,
    Plus,
    Sparkles,
    GraduationCap,
    Play,
    MoreHorizontal,
    Star,
    Eye,
    Edit3,
    Archive,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrainingModuleV2 } from "@/types/training";

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

export type TrainingCategoryType = "app" | "onboarding" | "safety" | "device" | "tool";

interface CategoryConfig {
    id: TrainingCategoryType;
    label: string;
    description: string;
    icon: typeof Smartphone;
    color: string;
    bgGradient: string;
    iconBg: string;
}

const CATEGORY_CONFIGS: Record<TrainingCategoryType, CategoryConfig> = {
    app: {
        id: "app",
        label: "App",
        description: "Application workflows and tools",
        icon: Smartphone,
        color: "text-blue-600",
        bgGradient: "from-blue-50 to-blue-100/50",
        iconBg: "bg-blue-100",
    },
    onboarding: {
        id: "onboarding",
        label: "Onboarding",
        description: "New team member onboarding",
        icon: Users,
        color: "text-emerald-600",
        bgGradient: "from-emerald-50 to-emerald-100/50",
        iconBg: "bg-emerald-100",
    },
    safety: {
        id: "safety",
        label: "Safety",
        description: "Safety procedures and compliance",
        icon: ShieldCheck,
        color: "text-amber-600",
        bgGradient: "from-amber-50 to-amber-100/50",
        iconBg: "bg-amber-100",
    },
    device: {
        id: "device",
        label: "Device",
        description: "Device-specific installation training",
        icon: Cpu,
        color: "text-purple-600",
        bgGradient: "from-purple-50 to-purple-100/50",
        iconBg: "bg-purple-100",
    },
    tool: {
        id: "tool",
        label: "Tool",
        description: "Tool usage and setup guides",
        icon: Wrench,
        color: "text-orange-600",
        bgGradient: "from-orange-50 to-orange-100/50",
        iconBg: "bg-orange-100",
    },
};

function getCategoryConfig(category?: string | null): CategoryConfig {
    const normalized = (category ?? "app").toLowerCase() as TrainingCategoryType;
    return CATEGORY_CONFIGS[normalized] ?? CATEGORY_CONFIGS.app;
}

// ============================================================================
// DIFFICULTY BADGE
// ============================================================================

function DifficultyBadge({ difficulty }: { difficulty?: "beginner" | "intermediate" | "advanced" }) {
    const config = {
        beginner: { label: "Beginner", className: "bg-green-100 text-green-700 border-green-200" },
        intermediate: { label: "Intermediate", className: "bg-amber-100 text-amber-700 border-amber-200" },
        advanced: { label: "Advanced", className: "bg-red-100 text-red-700 border-red-200" },
    };
    const { label, className } = config[difficulty ?? "intermediate"];
    return (
        <Badge variant="outline" className={cn("text-[10px] font-medium", className)}>
            {label}
        </Badge>
    );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status?: "draft" | "published" | "archived" }) {
    const config = {
        draft: { label: "Draft", className: "bg-neutral-100 text-neutral-600 border-neutral-200" },
        published: { label: "Published", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
        archived: { label: "Archived", className: "bg-neutral-100 text-neutral-500 border-neutral-200" },
    };
    const { label, className } = config[status ?? "draft"];
    return (
        <Badge variant="outline" className={cn("text-[10px] font-medium", className)}>
            {label}
        </Badge>
    );
}

// ============================================================================
// TRAINING MODULE CARD (Mobile-First)
// ============================================================================

interface TrainingModuleCardProps {
    module: TrainingModuleV2;
    href?: string;
    onEdit?: () => void;
    onPreview?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    className?: string;
}

export function TrainingModuleCard({
    module,
    href,
    onEdit,
    onPreview,
    onArchive,
    onDelete,
    className,
}: TrainingModuleCardProps) {
    const categoryConfig = getCategoryConfig(module.category);
    const Icon = categoryConfig.icon;

    const content = (
        <div
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all",
                "hover:border-border hover:shadow-md",
                "active:scale-[0.98]",
                className
            )}
        >
            {/* Header with gradient background */}
            <div className={cn("relative h-24 bg-gradient-to-br p-4", categoryConfig.bgGradient)}>
                {/* Category icon */}
                <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", categoryConfig.iconBg)}>
                    <Icon className={cn("h-5 w-5", categoryConfig.color)} />
                </div>

                {/* Cover image overlay (if exists) */}
                {module.coverImage?.imageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent">
                        <img
                            src={module.coverImage.imageUrl}
                            alt={module.coverImage.alt ?? module.name}
                            className="h-full w-full object-cover opacity-30"
                        />
                    </div>
                )}

                {/* Actions dropdown */}
                <div className="absolute right-3 top-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                                onClick={(e) => e.preventDefault()}
                            >
                                <MoreHorizontal className="h-4 w-4 text-neutral-600" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            {onPreview && (
                                <DropdownMenuItem onClick={onPreview}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </DropdownMenuItem>
                            )}
                            {onEdit && (
                                <DropdownMenuItem onClick={onEdit}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {onArchive && (
                                <DropdownMenuItem onClick={onArchive}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive
                                </DropdownMenuItem>
                            )}
                            {onDelete && (
                                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-4">
                {/* Title and status */}
                <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-base font-semibold text-foreground">{module.name}</h3>
                </div>

                {/* Description */}
                {module.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{module.description}</p>
                )}

                {/* Badges row */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                    <StatusBadge status={module.status} />
                    <DifficultyBadge difficulty={module.difficulty} />
                    <Badge variant="outline" className={cn("text-[10px]", categoryConfig.color)}>
                        {categoryConfig.label}
                    </Badge>
                </div>

                {/* Meta info */}
                <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                    {module.totalEstimatedMinutes && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {module.totalEstimatedMinutes} min
                        </span>
                    )}
                    {module.sections?.length > 0 && (
                        <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {module.sections.length} sections
                        </span>
                    )}
                </div>
            </div>

            {/* Touch feedback indicator */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// ============================================================================
// COMPACT TRAINING MODULE CARD (List View)
// ============================================================================

interface CompactTrainingModuleCardProps {
    module: TrainingModuleV2;
    href?: string;
    onSelect?: () => void;
    className?: string;
}

export function CompactTrainingModuleCard({
    module,
    href,
    onSelect,
    className,
}: CompactTrainingModuleCardProps) {
    const categoryConfig = getCategoryConfig(module.category);
    const Icon = categoryConfig.icon;

    const content = (
        <div
            className={cn(
                "group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all",
                "hover:border-border hover:bg-muted/30",
                "active:scale-[0.99]",
                onSelect && "cursor-pointer",
                className
            )}
            onClick={onSelect}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
        >
            {/* Icon */}
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", categoryConfig.iconBg)}>
                <Icon className={cn("h-5 w-5", categoryConfig.color)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium text-foreground">{module.name}</h4>
                    <StatusBadge status={module.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{categoryConfig.label}</span>
                    {module.totalEstimatedMinutes && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {module.totalEstimatedMinutes}m
                        </span>
                    )}
                </div>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// ============================================================================
// CATEGORY DISPLAY CARD
// ============================================================================

interface CategoryDisplayCardProps {
    category: TrainingCategoryType;
    count?: number;
    onClick?: () => void;
    href?: string;
    className?: string;
}

export function CategoryDisplayCard({
    category,
    count = 0,
    onClick,
    href,
    className,
}: CategoryDisplayCardProps) {
    const config = CATEGORY_CONFIGS[category];
    const Icon = config.icon;

    const content = (
        <div
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all",
                "hover:border-border hover:shadow-md",
                "active:scale-[0.98]",
                onClick && "cursor-pointer",
                className
            )}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {/* Icon and count row */}
            <div className="flex items-start justify-between">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", config.iconBg)}>
                    <Icon className={cn("h-6 w-6", config.color)} />
                </div>
                <span className="text-2xl font-bold text-foreground">{count}</span>
            </div>

            {/* Label and description */}
            <div className="mt-4">
                <h3 className="text-base font-semibold text-foreground">{config.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
            </div>

            {/* Hover arrow */}
            <div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// ============================================================================
// CREATE TRAINING CTA CARD
// ============================================================================

interface CreateTrainingCTACardProps {
    onClick?: () => void;
    href?: string;
    variant?: "default" | "compact" | "prominent";
    className?: string;
}

export function CreateTrainingCTACard({
    onClick,
    href,
    variant = "default",
    className,
}: CreateTrainingCTACardProps) {
    if (variant === "compact") {
        const content = (
            <div
                className={cn(
                    "group flex items-center gap-3 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 p-3 transition-all",
                    "hover:border-primary/50 hover:bg-primary/5",
                    "active:scale-[0.99]",
                    onClick && "cursor-pointer",
                    className
                )}
                onClick={onClick}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-foreground">Create New Module</h4>
                    <p className="text-xs text-muted-foreground">Add training content</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
        );

        if (href) {
            return <Link href={href}>{content}</Link>;
        }
        return content;
    }

    if (variant === "prominent") {
        const content = (
            <div
                className={cn(
                    "group relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6 transition-all",
                    "hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10",
                    "active:scale-[0.98]",
                    onClick && "cursor-pointer",
                    className
                )}
                onClick={onClick}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
            >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary" />
                    <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-primary" />
                </div>

                <div className="relative">
                    {/* Icon row */}
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                            <Plus className="h-7 w-7" />
                        </div>
                        <Sparkles className="h-5 w-5 text-primary/60" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold text-foreground">Create New Training Module</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Build interactive training content for your team with our guided configurator.
                    </p>

                    {/* Features */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="gap-1 bg-white/60 text-xs">
                            <GraduationCap className="h-3 w-3" />
                            5 Categories
                        </Badge>
                        <Badge variant="secondary" className="gap-1 bg-white/60 text-xs">
                            <Play className="h-3 w-3" />
                            Live Preview
                        </Badge>
                        <Badge variant="secondary" className="gap-1 bg-white/60 text-xs">
                            <Star className="h-3 w-3" />
                            Smart Suggestions
                        </Badge>
                    </div>

                    {/* Button */}
                    <Button className="mt-5 gap-2" size="lg">
                        Get Started
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );

        if (href) {
            return <Link href={href}>{content}</Link>;
        }
        return content;
    }

    // Default variant
    const content = (
        <div
            className={cn(
                "group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                "active:scale-[0.98]",
                "min-h-[200px]",
                onClick && "cursor-pointer",
                className
            )}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Plus className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Create New Module</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                Add training content for your team
            </p>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// ============================================================================
// TRAINING MODULES GRID
// ============================================================================

interface TrainingModulesGridProps {
    modules: TrainingModuleV2[];
    badgeNumber: string;
    onCreateNew?: () => void;
    showCTA?: boolean;
    emptyState?: React.ReactNode;
    className?: string;
}

export function TrainingModulesGrid({
    modules,
    badgeNumber,
    onCreateNew,
    showCTA = true,
    emptyState,
    className,
}: TrainingModulesGridProps) {
    if (modules.length === 0 && !showCTA) {
        return emptyState ?? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-base font-medium text-foreground">No training modules</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Create your first training module to get started.
                </p>
            </div>
        );
    }

    return (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
            {showCTA && <CreateTrainingCTACard onClick={onCreateNew} />}
            {modules.map((module) => (
                <TrainingModuleCard
                    key={module.id}
                    module={module}
                    href={`/${badgeNumber}/training/${module.id}`}
                />
            ))}
        </div>
    );
}

// ============================================================================
// TRAINING MODULES LIST
// ============================================================================

interface TrainingModulesListProps {
    modules: TrainingModuleV2[];
    badgeNumber: string;
    onCreateNew?: () => void;
    showCTA?: boolean;
    className?: string;
}

export function TrainingModulesList({
    modules,
    badgeNumber,
    onCreateNew,
    showCTA = true,
    className,
}: TrainingModulesListProps) {
    return (
        <div className={cn("space-y-2", className)}>
            {showCTA && <CreateTrainingCTACard variant="compact" onClick={onCreateNew} />}
            {modules.map((module) => (
                <CompactTrainingModuleCard
                    key={module.id}
                    module={module}
                    href={`/${badgeNumber}/training/${module.id}`}
                />
            ))}
        </div>
    );
}

// ============================================================================
// CATEGORY CARDS GRID
// ============================================================================

interface CategoryCardsGridProps {
    categories: Array<{ id: string; label?: string; description?: string; count: number }>;
    onCategoryClick?: (categoryId: string) => void;
    className?: string;
}

export function CategoryCardsGrid({
    categories,
    onCategoryClick,
    className,
}: CategoryCardsGridProps) {
    return (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", className)}>
            {categories.map(({ id, count }) => {
                // Check if this is a known category type
                const isKnownCategory = id in CATEGORY_CONFIGS;
                const categoryId = isKnownCategory ? (id as TrainingCategoryType) : "app";
                
                return (
                    <CategoryDisplayCard
                        key={id}
                        category={categoryId}
                        count={count}
                        onClick={onCategoryClick ? () => onCategoryClick(id) : undefined}
                    />
                );
            })}
        </div>
    );
}
