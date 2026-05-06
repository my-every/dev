"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, Filter, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";
import {
    ProjectLifecycleStepper,
    ProjectLifecycleStepperSkeleton,
    buildProjectLifecycleSteps,
    type ProjectActionStateSummary,
} from "./project-lifecycle-stepper";

// ============================================================================
// Types
// ============================================================================

type SortKey = "due" | "name" | "pdNumber";
type FilterKey = "all" | "legals-pending" | "brand-list-pending" | "branding-pending";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "due", label: "Due Date" },
    { key: "name", label: "Name" },
    { key: "pdNumber", label: "PD Number" },
];

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All branding" },
    { key: "legals-pending", label: "Legals pending" },
    { key: "brand-list-pending", label: "Brand list pending" },
    { key: "branding-pending", label: "Branding pending" },
];

export type ProjectBrandingTrackerProps = {
    /** Full project manifests to filter and display */
    projects: ProjectManifest[];
    /** Optional per-project action state summaries, keyed by project id */
    summaries?: Record<string, ProjectActionStateSummary>;
    /** When true, renders skeleton rows instead of real data */
    isLoading?: boolean;
    /** Number of skeleton rows to show while loading */
    skeletonRowCount?: number;
    className?: string;
};

// ============================================================================
// Helpers
// ============================================================================

/** Returns true when the project still has pending work in the branding pipeline
 *  (legals → brand-list-reviewed → branding-ready). A project exits this
 *  pipeline once its kitting gate is complete. */
function isInBrandingPipeline(
    project: ProjectManifest,
    summary: ProjectActionStateSummary | null,
): boolean {
    const steps = buildProjectLifecycleSteps(project, summary);
    const kittedStep = steps.find((s) => s.id === "kitted");
    return kittedStep?.status !== "complete";
}

function stepStatus(
    project: ProjectManifest,
    summary: ProjectActionStateSummary | null,
    stepId: "legals" | "brand-list-reviewed" | "branding-ready",
) {
    const steps = buildProjectLifecycleSteps(project, summary);
    return steps.find((s) => s.id === stepId)?.status ?? "locked";
}

// ============================================================================
// Component
// ============================================================================

export function ProjectBrandingTracker({
    projects,
    summaries,
    isLoading = false,
    skeletonRowCount = 3,
    className,
}: ProjectBrandingTrackerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [sortKey, setSortKey] = useState<SortKey>("due");
    const [filterKey, setFilterKey] = useState<FilterKey>("all");

    const brandingProjects = useMemo(
        () =>
            projects.filter((project) =>
                isInBrandingPipeline(project, summaries?.[project.id] ?? null),
            ),
        [projects, summaries],
    );

    const filteredProjects = useMemo(() => {
        let result = brandingProjects;

        if (filterKey !== "all") {
            result = result.filter((project) => {
                const summary = summaries?.[project.id] ?? null;
                switch (filterKey) {
                    case "legals-pending":
                        return stepStatus(project, summary, "legals") !== "complete";
                    case "brand-list-pending":
                        return stepStatus(project, summary, "brand-list-reviewed") !== "complete";
                    case "branding-pending":
                        return stepStatus(project, summary, "branding-ready") !== "complete";
                }
            });
        }

        return [...result].sort((a, b) => {
            switch (sortKey) {
                case "due": {
                    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    return aTime - bTime;
                }
                case "name":
                    return (a.name ?? "").localeCompare(b.name ?? "");
                case "pdNumber":
                    return (a.pdNumber ?? "").localeCompare(b.pdNumber ?? "");
                default:
                    return 0;
            }
        });
    }, [brandingProjects, filterKey, sortKey, summaries]);

    return (
        <div className={cn("min-w-sm max-w-min flex  flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
            {/* ── Card header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                    <div className="text-sm font-semibold text-foreground">Branding Tracker</div>
                    <div className="text-[11px] text-muted-foreground">
                        {filteredProjects.length} project
                        {filteredProjects.length !== 1 ? "s" : ""}
                        {filterKey !== "all" && (
                            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                                filtered
                            </span>
                        )}
                    </div>
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" side="bottom" className="w-52 p-3">
                        <div className="space-y-3">
                            {/* Sort */}
                            <div>
                                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <ArrowUpDown className="h-3 w-3" />
                                    Sort by
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {SORT_OPTIONS.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setSortKey(key)}
                                            className={cn(
                                                "rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                                                sortKey === key
                                                    ? "bg-primary/10 font-medium text-primary"
                                                    : "text-foreground hover:bg-muted",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Filter */}
                            <div>
                                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <Filter className="h-3 w-3" />
                                    Show
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {FILTER_OPTIONS.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFilterKey(key)}
                                            className={cn(
                                                "rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                                                filterKey === key
                                                    ? "bg-primary/10 font-medium text-primary"
                                                    : "text-foreground hover:bg-muted",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* ── Column headers ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2">
                <span className="text-[10px] min-w-24 max-w-40 flex-start items-center font-semibold uppercase tracking-wider text-muted-foreground">
                    Project
                </span>
                <span className="text-[10px] max-w-50 flex-1 flex items-center flex-start font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                </span>
            </div>

            {/* ── Project rows ────────────────────────────────────────── */}
            <div className="divide-y divide-border/50">
                {isLoading ? (
                    Array.from({ length: skeletonRowCount }).map((_, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            {/* PD # + name skeleton */}
                            <div className="min-w-24 max-w-40 flex flex-col gap-1.5">
                                <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                            </div>
                            {/* Stepper skeleton */}
                            <div className="shrink-0 max-w-50 flex-1">
                                <ProjectLifecycleStepperSkeleton stepCount={3} />
                            </div>
                        </div>
                    ))
                ) : filteredProjects.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No projects in branding stages
                    </div>
                ) : (
                    filteredProjects.map((project) => (
                        <div
                            key={project.id}
                            className="flex flex-wrap items-center gap-3 px-4 py-3"
                        >
                            {/* PD # + Project name stacked */}
                            <div className="min-w-24 max-w-40 flex flex-col gap-0.5">
                                <div className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
                                    {project.pdNumber ?? "—"}
                                </div>
                                <div className="truncate text-xs font-semibold text-foreground">
                                    {project.name}
                                </div>
                            </div>

                            {/* Status — lifecycle stepper scoped to branding range */}
                            <div className="shrink-0 max-w-50 flex-1">
                                <ProjectLifecycleStepper
                                    project={project}
                                    summary={summaries?.[project.id] ?? null}
                                    fromStep="legals"
                                    toStep="branding-ready"
                                    orientation="horizontal"
                                    horizontalScroll={false}
                                    visibleStepCount={3}
                                    onBrandReview={(nextProject) => {
                                        const basePath = pathname.replace(/\/$/, "");
                                        const href = `${basePath}/${encodeURIComponent(nextProject.id)}?action=brand-workspace`;
                                        router.push(href);
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
