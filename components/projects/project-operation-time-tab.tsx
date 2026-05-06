"use client";

import { useState, useCallback, useMemo } from "react";
import {
    Clock,
    Play,
    Plus,
    Timer,
    BarChart3,
    User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useOperationTime } from "@/hooks/use-operation-time";
import {
    OPERATION_CODES,
    getOperationCode,
    type OperationTimeEntry,
    type ProjectOperationSummary,
} from "@/types/d380-operation-codes";
import { OperationTimeLogDialog } from "@/components/projects/operation-time-log-dialog";

// ============================================================================
// Props
// ============================================================================

interface ProjectOperationTimeTabProps {
    projectId: string;
}

// ============================================================================
// Component
// ============================================================================

export function ProjectOperationTimeTab({
    projectId,
}: ProjectOperationTimeTabProps) {
    const { summary, isLoading, error, log, remove } = useOperationTime({
        projectId,
    });
    const [logOpen, setLogOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="space-y-4 p-1">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                    Failed to load operation time data.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Operation Time</h3>
                    <p className="text-xs text-muted-foreground">
                        {summary
                            ? `${summary.entries.length} entries · ${formatMinutes(summary.totalMinutes)} total`
                            : "No entries yet"}
                    </p>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setLogOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Log Time
                </Button>
            </div>

            {summary && summary.entries.length > 0 ? (
                <>
                    {/* Stage breakdown */}
                    <StageSummarySection summary={summary} />

                    <Separator />

                    {/* By badge */}
                    {summary.byBadge.length > 0 && (
                        <BadgeSummarySection summary={summary} />
                    )}

                    <Separator />

                    {/* Recent entries */}
                    <RecentEntriesSection
                        entries={summary.entries}
                        onDelete={(id) => remove(id)}
                    />
                </>
            ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                    <Timer className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                        No time logged yet. Click &quot;Log Time&quot; to start.
                    </p>
                </div>
            )}

            <OperationTimeLogDialog
                open={logOpen}
                onOpenChange={setLogOpen}
                projectId={projectId}
                onLog={async (params) => {
                    await log(params);
                    setLogOpen(false);
                }}
            />
        </div>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

function StageSummarySection({ summary }: { summary: ProjectOperationSummary }) {
    const maxMinutes = Math.max(
        ...summary.byStage.map((s) => s.totalMinutes),
        1,
    );

    return (
        <div className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                By Stage
            </div>
            <div className="space-y-1.5">
                {summary.byStage.map((stage) => (
                    <div key={stage.stageId} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="truncate">{stage.stageId}</span>
                            <span className="text-muted-foreground tabular-nums">
                                {formatMinutes(stage.totalMinutes)}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{
                                    width: `${(stage.totalMinutes / maxMinutes) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BadgeSummarySection({ summary }: { summary: ProjectOperationSummary }) {
    return (
        <div className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                By Badge
            </div>
            <div className="space-y-1">
                {summary.byBadge.map((b) => (
                    <div
                        key={b.badge}
                        className="flex items-center justify-between text-xs"
                    >
                        <span className="font-mono">{b.badge}</span>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {b.entryCount} entries
                            </Badge>
                            <span className="text-muted-foreground tabular-nums w-16 text-right">
                                {formatMinutes(b.totalMinutes)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RecentEntriesSection({
    entries,
    onDelete,
}: {
    entries: OperationTimeEntry[];
    onDelete: (id: string) => void;
}) {
    // Show latest 10
    const recent = useMemo(
        () =>
            [...entries]
                .sort(
                    (a, b) =>
                        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
                )
                .slice(0, 10),
        [entries],
    );

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
                Recent Entries
            </h4>
            <div className="space-y-1">
                {recent.map((entry) => {
                    const op = getOperationCode(entry.opCode);
                    return (
                        <div
                            key={entry.id}
                            className="flex items-center gap-2 rounded-md border bg-card/40 px-2.5 py-1.5 text-xs group"
                        >
                            <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                                {entry.opCode}
                            </Badge>
                            <span className="truncate flex-1">
                                {op?.label ?? entry.opCode}
                            </span>
                            <span className="text-muted-foreground font-mono shrink-0">
                                {entry.badge}
                            </span>
                            <span className="text-muted-foreground tabular-nums shrink-0">
                                {formatMinutes(entry.actualMinutes)}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => onDelete(entry.id)}
                            >
                                ×
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// Helpers
// ============================================================================

function formatMinutes(minutes: number): string {
    if (minutes === 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
