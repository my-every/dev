"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { DetailSectionCard } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ASSIGNMENT_STAGES,
    STAGE_CATEGORY_COLORS,
    type AssignmentStageCategory,
} from "@/types/d380-assignment-stages";
import type { BoardDataResponse } from "@/lib/board/types";
import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

// ============================================================================
// Types
// ============================================================================

type ProjectStagesBoardProps = BaseStatefulProps & {
    className?: string;
};

interface StageStat {
    id: string;
    label: string;
    shortLabel: string;
    description: string;
    category: AssignmentStageCategory;
    /** All assignments currently at this stage */
    total: number;
    /** Assignments with workflowStatus === "in-progress" */
    active: number;
    /** Assignments with workflowStatus === "completed" */
    completed: number;
}

// ============================================================================
// Helpers
// ============================================================================

function deriveStatusBadge(stat: StageStat): { label: string; colorClass: string } {
    if (stat.total === 0) {
        return { label: "Empty", colorClass: "text-muted-foreground" };
    }
    if (stat.active > 0) {
        return { label: "Active", colorClass: "text-blue-600 dark:text-blue-400" };
    }
    if (stat.completed === stat.total) {
        return { label: "Done", colorClass: "text-emerald-600 dark:text-emerald-400" };
    }
    return { label: "Queued", colorClass: "text-amber-600 dark:text-amber-400" };
}

function formatCount(n: number): string {
    return String(n).padStart(2, "0");
}

// ============================================================================
// Component
// ============================================================================

export function ProjectStagesBoard({ mode = "default", className }: ProjectStagesBoardProps) {
    const [boardData, setBoardData] = useState<BoardDataResponse | null>(null);
    const [fetching, setFetching] = useState(true);
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

    // Mirrors the exact fetch pattern used in project-lifecycle-stepper.tsx
    useEffect(() => {
        let cancelled = false;
        setFetching(true);

        fetch("/api/board/data", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: BoardDataResponse | null) => {
                if (!cancelled) {
                    setBoardData(data);
                    setFetchedAt(new Date());
                }
            })
            .catch(() => {
                if (!cancelled) setBoardData(null);
            })
            .finally(() => {
                if (!cancelled) setFetching(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Derive per-stage stats from live board data, keyed by ASSIGNMENT_STAGES order
    const stageStats = useMemo<StageStat[]>(() => {
        if (!boardData) return [];

        return ASSIGNMENT_STAGES.map((stageDef) => {
            // Use the same direct-match approach as project-lifecycle-stepper.tsx:
            //   assignment.stage === stageId
            const matched = boardData.projects.flatMap((project) =>
                project.assignments.filter((a) => a.stage === stageDef.id),
            );

            return {
                id: stageDef.id,
                label: stageDef.label,
                shortLabel: stageDef.shortLabel,
                description: stageDef.description,
                category: stageDef.category,
                total: matched.length,
                active: matched.filter((a) => a.workflowStatus === "in-progress").length,
                completed: matched.filter((a) => a.workflowStatus === "completed").length,
            };
        });
    }, [boardData]);

    const isLoading = mode === "skeleton" || fetching;

    const updatedLabel = fetchedAt
        ? `Updated ${Math.round((Date.now() - fetchedAt.getTime()) / 60_000)}m ago`
        : null;

    return (
        <DetailSectionCard
            className={className}
            title="Stage Pipeline"
            description="Execution stages, WIP counts, and bottlenecks"
            action={
                isLoading ? (
                    <Skeleton className="h-8 w-24 rounded-full" />
                ) : (
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                        {updatedLabel ?? "Live"}
                    </span>
                )
            }
        >
            <div className="space-y-3">
                {isLoading ? (
                    // ── Skeleton rows ────────────────────────────────────────────
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border bg-background/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-9 w-9 rounded-xl" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-44" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, j) => (
                                    <div
                                        key={j}
                                        className="space-y-1 rounded-lg border border-border bg-card/50 p-3"
                                    >
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-5 w-10" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    // ── Live stage rows ──────────────────────────────────────────
                    stageStats.map((stage) => {
                        const colors = STAGE_CATEGORY_COLORS[stage.category];
                        const status = deriveStatusBadge(stage);
                        const throughput =
                            stage.total > 0
                                ? `${Math.round((stage.completed / stage.total) * 100)}%`
                                : "—";

                        return (
                            <div
                                key={stage.id}
                                className="rounded-xl border border-border bg-background/70 p-4"
                            >
                                {/* Stage header */}
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        {/* Category-colored icon */}
                                        <div
                                            className={cn(
                                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold",
                                                colors.bg,
                                                colors.text,
                                                colors.border,
                                            )}
                                        >
                                            {stage.shortLabel.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="text-sm font-medium text-foreground">
                                                {stage.label}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {stage.description}
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]",
                                            status.colorClass,
                                        )}
                                    >
                                        {status.label}
                                    </span>
                                </div>

                                {/* Stats grid */}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-border bg-card/50 p-3">
                                        <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            In Stage
                                        </div>
                                        <div className="text-base font-medium text-foreground">
                                            {formatCount(stage.total)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card/50 p-3">
                                        <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            Active
                                        </div>
                                        <div className="text-base font-medium text-foreground">
                                            {formatCount(stage.active)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border bg-card/50 p-3">
                                        <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            Throughput
                                        </div>
                                        <div className="text-base font-medium text-foreground">
                                            {throughput}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </DetailSectionCard>
    );
}
