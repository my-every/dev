"use client";

import {
    CheckCircle2,
    AlertTriangle,
    BarChart3,
    FileSpreadsheet,
    Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InitializePipelineResult } from "@/lib/project-state/project-initialize-pipeline";

// ============================================================================
// Props
// ============================================================================

interface InitializePipelineResultCardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    result: InitializePipelineResult;
}

// ============================================================================
// Component
// ============================================================================

export function InitializePipelineResultCard({
    open,
    onOpenChange,
    result,
}: InitializePipelineResultCardProps) {
    const totalHours = (result.totalEstimatedMinutes / 60).toFixed(1);
    const hasWarnings = result.warnings.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        Pipeline Initialized
                    </DialogTitle>
                    <DialogDescription>
                        Project <span className="font-mono">{result.projectId}</span> has
                        been initialized with {result.mappings.length} assignment
                        {result.mappings.length !== 1 ? "s" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-4 py-2 pr-4">
                        {/* Summary row */}
                        <div className="grid grid-cols-3 gap-3">
                            <SummaryTile
                                icon={FileSpreadsheet}
                                label="Assignments"
                                value={result.mappings.length}
                            />
                            <SummaryTile
                                icon={Clock}
                                label="Est. Hours"
                                value={totalHours}
                            />
                            <SummaryTile
                                icon={BarChart3}
                                label="Sheets"
                                value={result.sheetBreakdowns.length}
                            />
                        </div>

                        {/* Stage hours */}
                        {result.stageHours.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Stage Breakdown
                                </h4>
                                <div className="space-y-1.5">
                                    {result.stageHours.map((sh) => {
                                        const pct =
                                            result.totalEstimatedMinutes > 0
                                                ? (sh.estimatedMinutes / result.totalEstimatedMinutes) *
                                                100
                                                : 0;
                                        return (
                                            <div key={sh.stageId} className="space-y-0.5">
                                                <div className="flex justify-between text-xs">
                                                    <span>{sh.label}</span>
                                                    <span className="tabular-nums text-muted-foreground">
                                                        {(sh.estimatedMinutes / 60).toFixed(1)}h
                                                    </span>
                                                </div>
                                                <Progress value={pct} className="h-1.5" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Sheet breakdowns */}
                        {result.sheetBreakdowns.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Sheet Details
                                </h4>
                                <div className="rounded-lg border divide-y">
                                    {result.sheetBreakdowns.map((sb) => (
                                        <div
                                            key={sb.sheetSlug}
                                            className="p-2 flex items-center justify-between text-xs"
                                        >
                                            <div className="space-y-0.5">
                                                <p className="font-medium">{sb.sheetName}</p>
                                                <p className="text-muted-foreground">
                                                    {sb.rowCount} rows &middot;{" "}
                                                    <span className="font-mono">{sb.detectedSwsType}</span>{" "}
                                                    ({Math.round(sb.detectedConfidence * 100)}%)
                                                </p>
                                            </div>
                                            <span className="tabular-nums text-muted-foreground">
                                                {(sb.estimatedMinutes / 60).toFixed(1)}h
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warnings */}
                        {hasWarnings && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Warnings ({result.warnings.length})
                                </h4>
                                <ul className="space-y-1">
                                    {result.warnings.map((w, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1"
                                        >
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Helpers
// ============================================================================

function SummaryTile({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
}) {
    return (
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
            <Icon className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {label}
            </p>
        </div>
    );
}
