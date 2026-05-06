"use client";

/**
 * Wiring Execution Mode Component
 *
 * Interactive section-by-section wiring execution with:
 * - Badge sign-in flow on Start
 * - Table of Contents overview before execution
 * - Fixed section nav on left, scrollable wire table on right
 * - Device-group subsections for single connections
 * - Real-time timer and completion badges
 * - Pause / resume workflow
 * - Section summary cards with est vs actual comparison
 * - Final report on completion
 *
 * Designed for tablet-first responsive layout.
 */

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2,
    Circle,
    Lock,
    Play,
    Pause,
    ChevronRight,
    RotateCcw,
    TrendingUp,
    TrendingDown,
    Minus,
    Timer,
    ArrowRight,
    Zap,
    Trophy,
    ListChecks,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PrintLocationGroup } from "@/lib/wire-list-print/model";
import type { PrintSettings } from "@/lib/wire-list-print/defaults";
import type { WiringColumnSide, WiringSectionExecution, SectionExecutionSummary } from "@/types/d380-wiring-execution";
import { useWiringExecution } from "@/hooks/use-wiring-execution";
import { buildWiringExecutionSession } from "@/lib/wiring-execution/session-builder";
import { ShiftBadgeModal } from "@/components/build-up/shift-badge-modal";
import type { WorkShift } from "@/types/d380-build-up-execution";
import type { SemanticWireListRow } from "@/lib/workbook/types";

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatMinutes(minutes: number): string {
    if (minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
}

function varianceColor(variancePercent: number | null): string {
    if (variancePercent === null) return "text-muted-foreground";
    if (variancePercent <= -10) return "text-green-600 dark:text-green-400";
    if (variancePercent <= 10) return "text-blue-600 dark:text-blue-400";
    if (variancePercent <= 30) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
}

/** Extract unique device groups from a section's rows (preserving order) */
function getDeviceGroups(section: WiringSectionExecution): string[] {
    const seen = new Set<string>();
    const groups: string[] = [];
    for (const row of section.rows) {
        const g = row.deviceGroup;
        if (g && !seen.has(g)) {
            seen.add(g);
            groups.push(g);
        }
    }
    return groups;
}

/** Check if a section is a "single connections" type that should show device groups */
function hasSingleConnectionGroups(section: WiringSectionExecution): boolean {
    return (
        (section.sectionKind === "single_connections" || section.sectionKind === "default") &&
        section.rows.some((r) => !!r.deviceGroup)
    );
}

// ============================================================================
// Live Timer Display
// ============================================================================

function LiveTimer({
    elapsedSeconds,
    estimatedMinutes,
}: {
    elapsedSeconds: number;
    estimatedMinutes: number;
}) {
    const estimatedSeconds = estimatedMinutes * 60;
    const percentUsed = estimatedSeconds > 0 ? Math.min((elapsedSeconds / estimatedSeconds) * 100, 100) : 0;
    const isOverEstimate = elapsedSeconds > estimatedSeconds;

    return (
        <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg border",
            isOverEstimate
                ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                : "bg-muted/50 border-border",
        )}>
            <Timer className={cn("h-5 w-5 flex-shrink-0", isOverEstimate ? "text-red-500" : "text-primary")} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                        "text-sm font-mono font-bold tabular-nums",
                        isOverEstimate ? "text-red-600 dark:text-red-400" : "text-foreground",
                    )}>
                        {formatDuration(elapsedSeconds)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        est. {formatMinutes(estimatedMinutes)}
                    </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            isOverEstimate ? "bg-red-500" : percentUsed > 75 ? "bg-amber-500" : "bg-primary",
                        )}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Section Nav Item (Left Sidebar)
// ============================================================================

function SectionNavItem({
    section,
    isActive,
    onClick,
}: {
    section: WiringSectionExecution;
    isActive: boolean;
    onClick?: () => void;
}) {
    const isCompleted = section.status === "completed";
    const isLocked = section.status === "locked";
    const completionPercent = section.totalRows > 0
        ? Math.round((section.completedRows / section.totalRows) * 100)
        : 0;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLocked}
            className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm",
                "touch-manipulation select-none",
                isActive && "bg-primary text-primary-foreground shadow-sm",
                isCompleted && !isActive && "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30",
                isLocked && "text-muted-foreground/50 cursor-not-allowed",
                !isActive && !isCompleted && !isLocked && "hover:bg-muted/60 text-foreground",
            )}
        >
            <div className="flex items-center gap-2">
                {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                ) : isActive ? (
                    <Circle className="h-4 w-4 flex-shrink-0 fill-current" />
                ) : (
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-[13px] leading-tight">{section.sectionLabel}</div>
                    <div className={cn(
                        "text-[10px] mt-0.5",
                        isActive ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}>
                        {section.totalRows} wires
                        {isCompleted && section.actualMinutes != null && ` · ${formatMinutes(section.actualMinutes)}`}
                        {isActive && completionPercent > 0 && ` · ${completionPercent}%`}
                    </div>
                </div>
            </div>
            {isActive && completionPercent > 0 && (
                <div className="mt-1.5 h-1 bg-primary-foreground/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary-foreground/60 rounded-full transition-all"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
            )}
        </button>
    );
}

// ============================================================================
// Device Group Nav (sub-navigation within single connections)
// ============================================================================

function DeviceGroupNav({
    groups,
    activeGroup,
    section,
    onSelect,
}: {
    groups: string[];
    activeGroup: string | null;
    section: WiringSectionExecution;
    onSelect: (group: string) => void;
}) {
    const groupCompletion = useMemo(() => {
        const map = new Map<string, { total: number; completed: number }>();
        for (const row of section.rows) {
            const g = row.deviceGroup;
            if (!g) continue;
            const entry = map.get(g) ?? { total: 0, completed: 0 };
            entry.total++;
            if (row.fromCompletedAt && row.toCompletedAt) entry.completed++;
            map.set(g, entry);
        }
        return map;
    }, [section.rows]);

    return (
        <div className="flex flex-wrap gap-1.5 px-1">
            {groups.map((group) => {
                const info = groupCompletion.get(group);
                const isActive = activeGroup === group;
                const isGroupComplete = info ? info.completed === info.total : false;

                return (
                    <button
                        key={group}
                        type="button"
                        onClick={() => onSelect(group)}
                        className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                            "touch-manipulation select-none border",
                            isActive && "bg-primary text-primary-foreground border-primary shadow-sm",
                            isGroupComplete && !isActive && "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
                            !isActive && !isGroupComplete && "bg-background text-foreground border-border hover:bg-muted/60",
                        )}
                    >
                        {isGroupComplete && <CheckCircle2 className="h-3 w-3" />}
                        <span>{group}</span>
                        {info && (
                            <span className={cn(
                                "text-[10px]",
                                isActive ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}>
                                {info.completed}/{info.total}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================================
// Active Section Table
// ============================================================================

function ActiveSectionTable({
    section,
    rows,
    badge,
    onToggle,
    activeDeviceGroup,
}: {
    section: WiringSectionExecution;
    rows: SemanticWireListRow[];
    badge: string;
    onToggle: (rowId: string, side: WiringColumnSide) => void;
    activeDeviceGroup?: string | null;
}) {
    const completionMap = useMemo(() => {
        const map = new Map<string, (typeof section.rows)[number]>();
        for (const r of section.rows) {
            map.set(r.rowId, r);
        }
        return map;
    }, [section.rows]);

    const visibleRows = useMemo(() => {
        if (!activeDeviceGroup) return rows;
        return rows.filter((row) => {
            const completion = completionMap.get(row.__rowId);
            return completion?.deviceGroup === activeDeviceGroup;
        });
    }, [rows, activeDeviceGroup, completionMap]);

    return (
        <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_1fr_auto] gap-0 bg-muted/80 border-b text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="px-2 py-2.5 text-center border-r border-border/50 min-w-[52px]">From</div>
                <div className="px-2 py-2.5 border-r border-border/50">Device ID</div>
                <div className="px-2 py-2.5 text-center border-r border-border/50 hidden sm:block min-w-[60px]">Wire ID</div>
                <div className="px-2 py-2.5 text-center border-r border-border/50 hidden sm:block min-w-[50px]">Size</div>
                <div className="px-2 py-2.5 border-r border-border/50">Device ID</div>
                <div className="px-2 py-2.5 text-center min-w-[52px]">To</div>
            </div>

            <div className="divide-y divide-border/50">
                {visibleRows.map((row) => {
                    const completion = completionMap.get(row.__rowId);
                    const fromDone = !!completion?.fromCompletedAt;
                    const toDone = !!completion?.toCompletedAt;
                    const rowComplete = fromDone && toDone;

                    return (
                        <div
                            key={row.__rowId}
                            className={cn(
                                "grid grid-cols-[auto_1fr_auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_1fr_auto] gap-0 transition-colors",
                                rowComplete
                                    ? "bg-green-50/80 dark:bg-green-950/10"
                                    : "bg-background hover:bg-muted/30",
                            )}
                        >
                            <div className="flex items-center justify-center px-2 py-2 border-r border-border/30 min-w-[52px]">
                                <button
                                    type="button"
                                    onClick={() => onToggle(row.__rowId, "from")}
                                    className={cn(
                                        "h-8 w-8 rounded-md flex items-center justify-center transition-all",
                                        "touch-manipulation active:scale-95",
                                        fromDone
                                            ? "bg-green-500 text-white shadow-sm"
                                            : "border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/5",
                                    )}
                                    aria-label={`Mark from ${fromDone ? "incomplete" : "complete"}`}
                                >
                                    {fromDone && <CheckCircle2 className="h-5 w-5" />}
                                </button>
                            </div>

                            <div className="flex items-center px-2 py-2 border-r border-border/30 min-w-0">
                                <span className={cn(
                                    "text-sm font-medium truncate",
                                    fromDone && "text-green-700 dark:text-green-400",
                                )}>
                                    {row.fromDeviceId}
                                </span>
                            </div>

                            <div className="hidden sm:flex items-center justify-center px-2 py-2 border-r border-border/30 min-w-[60px]">
                                <span className="text-xs text-muted-foreground font-mono">{row.wireId}</span>
                            </div>

                            <div className="hidden sm:flex items-center justify-center px-2 py-2 border-r border-border/30 min-w-[50px]">
                                <span className="text-xs text-muted-foreground">{row.gaugeSize}</span>
                            </div>

                            <div className="flex items-center px-2 py-2 border-r border-border/30 min-w-0">
                                <span className={cn(
                                    "text-sm font-medium truncate",
                                    toDone && "text-green-700 dark:text-green-400",
                                )}>
                                    {row.toDeviceId}
                                </span>
                            </div>

                            <div className="flex items-center justify-center px-2 py-2 min-w-[52px]">
                                <button
                                    type="button"
                                    onClick={() => onToggle(row.__rowId, "to")}
                                    className={cn(
                                        "h-8 w-8 rounded-md flex items-center justify-center transition-all",
                                        "touch-manipulation active:scale-95",
                                        toDone
                                            ? "bg-green-500 text-white shadow-sm"
                                            : "border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/5",
                                    )}
                                    aria-label={`Mark to ${toDone ? "incomplete" : "complete"}`}
                                >
                                    {toDone && <CheckCircle2 className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// Section Summary Card
// ============================================================================

function SectionSummaryCard({ summary }: { summary: SectionExecutionSummary }) {
    const VarianceIcon = summary.variancePercent === null
        ? Minus
        : summary.variancePercent <= 0 ? TrendingDown : TrendingUp;

    return (
        <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
            summary.status === "completed" ? "bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-800" : "bg-muted/30 border-border",
        )}>
            {summary.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : summary.status === "active" ? (
                <Circle className="h-4 w-4 text-primary flex-shrink-0 fill-primary" />
            ) : (
                <Lock className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{summary.sectionLabel}</div>
                <div className="text-[10px] text-muted-foreground">{summary.location} · {summary.totalRows} wires</div>
            </div>
            {summary.status === "completed" && summary.actualMinutes != null && (
                <div className="flex items-center gap-2 flex-shrink-0 text-right">
                    <div>
                        <div className="text-xs font-mono font-semibold">{formatMinutes(summary.actualMinutes)}</div>
                        <div className="text-[10px] text-muted-foreground">est. {formatMinutes(summary.estimatedMinutes)}</div>
                    </div>
                    <div className={cn("flex items-center gap-0.5 text-xs font-semibold", varianceColor(summary.variancePercent))}>
                        <VarianceIcon className="h-3 w-3" />
                        <span>{summary.variancePercent !== null ? `${Math.abs(summary.variancePercent)}%` : "—"}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Final Report
// ============================================================================

function CompletionReport({
    report,
    onReset,
}: {
    report: NonNullable<ReturnType<typeof useWiringExecution>["report"]>;
    onReset: () => void;
}) {
    const totalVarianceColor = varianceColor(report.totalVariancePercent);
    const underEstimate = report.totalVariancePercent <= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="rounded-xl border-2 border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 p-6 sm:p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 mb-4">
                    <Trophy className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Wiring Complete</h2>
                <p className="text-sm text-muted-foreground">{report.sheetName} · {report.sections.length} sections · {report.sections.reduce((s, sec) => s + sec.totalRows, 0)} wires</p>

                <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto">
                    <div>
                        <div className="text-2xl font-bold font-mono">{formatMinutes(report.totalActualMinutes)}</div>
                        <div className="text-xs text-muted-foreground">Actual</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-mono text-muted-foreground">{formatMinutes(report.totalEstimatedMinutes)}</div>
                        <div className="text-xs text-muted-foreground">Estimated</div>
                    </div>
                    <div>
                        <div className={cn("text-2xl font-bold font-mono", totalVarianceColor)}>
                            {underEstimate ? "-" : "+"}{Math.abs(report.totalVariancePercent)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Variance</div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Section Breakdown</h3>
                {report.sections.map(s => (
                    <SectionSummaryCard key={s.sectionId} summary={s} />
                ))}
            </div>

            <Button onClick={onReset} variant="outline" className="w-full h-11 touch-manipulation">
                <RotateCcw className="h-4 w-4 mr-2" /> Start New Session
            </Button>
        </motion.div>
    );
}

// ============================================================================
// Table of Contents Screen
// ============================================================================

function TableOfContentsScreen({
    sections,
    sheetName,
    badge,
    name,
    shift,
    totalEstimatedMinutes,
    onBegin,
    onBack,
}: {
    sections: { sectionLabel: string; location: string; totalRows: number; estimatedMinutes: number; sectionKind?: string }[];
    sheetName: string;
    badge: string;
    name: string;
    shift: string;
    totalEstimatedMinutes: number;
    onBegin: () => void;
    onBack: () => void;
}) {
    const totalRows = sections.reduce((s, sec) => s + sec.totalRows, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto px-4 py-6 space-y-6"
        >
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                    <ListChecks className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{sheetName}</h2>
                <p className="text-sm text-muted-foreground">Table of Contents</p>
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">({badge})</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize">{shift}</Badge>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg border bg-background px-3 py-3">
                    <div className="text-2xl font-bold">{sections.length}</div>
                    <div className="text-xs text-muted-foreground">Sections</div>
                </div>
                <div className="rounded-lg border bg-background px-3 py-3">
                    <div className="text-2xl font-bold">{totalRows}</div>
                    <div className="text-xs text-muted-foreground">Wires</div>
                </div>
                <div className="rounded-lg border bg-background px-3 py-3">
                    <div className="text-2xl font-bold">{formatMinutes(totalEstimatedMinutes)}</div>
                    <div className="text-xs text-muted-foreground">Est. Time</div>
                </div>
            </div>

            <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Execution Order
                </h3>
                <div className="rounded-lg border divide-y">
                    {sections.map((section, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                                {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{section.sectionLabel}</div>
                                <div className="text-[10px] text-muted-foreground">{section.location}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-xs font-mono">{section.totalRows} wires</div>
                                <div className="text-[10px] text-muted-foreground">~{formatMinutes(section.estimatedMinutes)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <Button variant="outline" onClick={onBack} className="h-11 px-6 touch-manipulation">
                    Back
                </Button>
                <Button onClick={onBegin} size="lg" className="flex-1 h-11 text-base gap-2 touch-manipulation">
                    <Play className="h-5 w-5" /> Begin Wiring
                </Button>
            </div>
        </motion.div>
    );
}

// ============================================================================
// Start Screen (pre-badge)
// ============================================================================

function StartScreen({
    sectionCount,
    totalRows,
    totalEstimatedMinutes,
    sheetName,
    onStart,
    onResume,
    hasExistingSession,
    isLoading,
}: {
    sectionCount: number;
    totalRows: number;
    totalEstimatedMinutes: number;
    sheetName: string;
    onStart: () => void;
    onResume: () => void;
    hasExistingSession: boolean;
    isLoading: boolean;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-2">
                <Zap className="h-10 w-10 text-primary" />
            </div>

            <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Wiring Execution</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Work through each section one at a time. Check off each wire as you complete it.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-6 max-w-sm">
                <div>
                    <div className="text-2xl font-bold">{sectionCount}</div>
                    <div className="text-xs text-muted-foreground">Sections</div>
                </div>
                <div>
                    <div className="text-2xl font-bold">{totalRows}</div>
                    <div className="text-xs text-muted-foreground">Wires</div>
                </div>
                <div>
                    <div className="text-2xl font-bold">{formatMinutes(totalEstimatedMinutes)}</div>
                    <div className="text-xs text-muted-foreground">Est. Time</div>
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                    onClick={onStart}
                    size="lg"
                    className="w-full h-12 text-base gap-2 touch-manipulation"
                >
                    <Play className="h-5 w-5" /> Start Wiring
                </Button>
                {hasExistingSession && (
                    <Button
                        onClick={onResume}
                        variant="outline"
                        size="lg"
                        className="w-full h-12 text-base gap-2 touch-manipulation"
                        disabled={isLoading}
                    >
                        <ArrowRight className="h-5 w-5" /> {isLoading ? "Loading..." : "Resume Previous"}
                    </Button>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Main Export
// ============================================================================

export type WiringExecutionPhase = "start" | "badge" | "toc" | "executing" | "completed";

export interface WiringExecutionModeProps {
    projectId: string;
    sheetSlug: string;
    sheetName: string;
    swsType: string;
    /** Pre-filled badge (optional — if empty, badge modal will be shown) */
    badge?: string;
    /** Pre-filled shift (optional) */
    shift?: string;
    locationGroups: PrintLocationGroup[];
    settings: PrintSettings;
    /** Map from rowId → SemanticWireListRow for rendering the active section table */
    rowMap: Map<string, SemanticWireListRow>;
    onClose?: () => void;
}

export function WiringExecutionMode({
    projectId,
    sheetSlug,
    sheetName,
    swsType,
    badge: initialBadge = "",
    shift: initialShift = "",
    locationGroups,
    settings,
    rowMap,
    onClose,
}: WiringExecutionModeProps) {
    // Badge / shift state (may be set via badge modal)
    const [badge, setBadge] = useState(initialBadge);
    const [shift, setShift] = useState(initialShift);
    const [employeeName, setEmployeeName] = useState("");
    const [showBadgeModal, setShowBadgeModal] = useState(false);
    const [phase, setPhase] = useState<WiringExecutionPhase>("start");
    const [activeDeviceGroup, setActiveDeviceGroup] = useState<string | null>(null);

    const execution = useWiringExecution({
        projectId,
        sheetSlug,
        sheetName,
        swsType,
        badge,
        shift,
        locationGroups,
        settings,
    });

    const {
        session,
        activeSection,
        isStarted,
        isComplete,
        isPaused,
        isSaving,
        isLoading,
        error,
        progress,
        sectionProgress,
        canAdvance,
        elapsedSeconds,
        sectionSummaries,
        report,
        startSession,
        resumeSession,
        pauseSession,
        toggleRowColumn,
        completeActiveSection,
        resetSession,
    } = execution;

    // Resolve rows for the active section from the rowMap
    const activeSectionRows = useMemo(() => {
        if (!activeSection) return [];
        return activeSection.rows
            .map(r => rowMap.get(r.rowId))
            .filter((r): r is SemanticWireListRow => !!r);
    }, [activeSection, rowMap]);

    // Pre-compute stats for start screen
    const previewStats = useMemo(() => {
        const tempSession = buildWiringExecutionSession({
            projectId, sheetName, sheetSlug, swsType, badge: badge || "preview", shift: shift || "day", locationGroups, settings,
        });
        return {
            sectionCount: tempSession.sections.length,
            totalRows: tempSession.sections.reduce((s, sec) => s + sec.totalRows, 0),
            totalEstimated: tempSession.totalEstimatedMinutes,
            sections: tempSession.sections.map(s => ({
                sectionLabel: s.sectionLabel,
                location: s.location,
                totalRows: s.totalRows,
                estimatedMinutes: s.estimatedMinutes,
                sectionKind: s.sectionKind,
            })),
        };
    }, [projectId, sheetName, sheetSlug, swsType, badge, shift, locationGroups, settings]);

    // Check for existing session on mount
    const [hasExisting, setHasExisting] = useState(false);
    useEffect(() => {
        if (projectId && sheetSlug) {
            fetch(`/api/projects/${projectId}/wiring-execution?sheet=${encodeURIComponent(sheetSlug)}`)
                .then(res => { if (res.ok) setHasExisting(true); })
                .catch(() => { });
        }
    }, [projectId, sheetSlug]);

    // Sync phase with execution state
    useEffect(() => {
        if (isComplete) setPhase("completed");
        else if (isStarted) setPhase("executing");
    }, [isStarted, isComplete]);

    // Device groups for active section
    const deviceGroups = useMemo(() => {
        if (!activeSection) return [];
        if (!hasSingleConnectionGroups(activeSection)) return [];
        return getDeviceGroups(activeSection);
    }, [activeSection]);

    // Auto-select first device group when section changes
    useEffect(() => {
        if (deviceGroups.length > 0) {
            setActiveDeviceGroup(deviceGroups[0]);
        } else {
            setActiveDeviceGroup(null);
        }
    }, [deviceGroups]);

    // ── Handlers ────────────────────────────────────────────────────────

    const handleStartClick = useCallback(() => {
        setShowBadgeModal(true);
    }, []);

    const handleResumeClick = useCallback(() => {
        resumeSession();
    }, [resumeSession]);

    const handleBadgeSubmit = useCallback((badgeId: string, name: string, selectedShift: WorkShift) => {
        setBadge(badgeId);
        setEmployeeName(name);
        setShift(selectedShift);
        setShowBadgeModal(false);
        setPhase("toc");
    }, []);

    const handleBeginWiring = useCallback(() => {
        startSession();
        setPhase("executing");
    }, [startSession]);

    const handleBackToStart = useCallback(() => {
        setPhase("start");
    }, []);

    const handleSectionClick = useCallback((_index: number) => {
        // Allow clicking completed/active sections — navigation handled by hook
    }, []);

    const handleReset = useCallback(() => {
        resetSession();
        setBadge(initialBadge);
        setShift(initialShift);
        setEmployeeName("");
        setPhase("start");
    }, [resetSession, initialBadge, initialShift]);

    const handleCompleteSection = useCallback(async () => {
        await completeActiveSection();
        setActiveDeviceGroup(null);
    }, [completeActiveSection]);

    // ── Render ────────────────────────────────────────────────────────────

    // Start screen (pre-badge)
    if (phase === "start" && !isStarted && !isComplete) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base font-bold truncate">{sheetName}</h1>
                        </div>
                        {onClose && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 touch-manipulation text-muted-foreground" onClick={onClose}>
                                ✕
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <StartScreen
                        sectionCount={previewStats.sectionCount}
                        totalRows={previewStats.totalRows}
                        totalEstimatedMinutes={previewStats.totalEstimated}
                        sheetName={sheetName}
                        onStart={handleStartClick}
                        onResume={handleResumeClick}
                        hasExistingSession={hasExisting}
                        isLoading={isLoading}
                    />
                </div>

                <ShiftBadgeModal
                    open={showBadgeModal}
                    onClose={() => setShowBadgeModal(false)}
                    onSubmit={handleBadgeSubmit}
                    title="Start Wiring Session"
                    description="Enter your badge to begin the wiring process"
                    requireShift={true}
                />
            </div>
        );
    }

    // TOC screen (post-badge, pre-execution)
    if (phase === "toc" && !isStarted) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base font-bold truncate">{sheetName}</h1>
                        </div>
                        {onClose && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 touch-manipulation text-muted-foreground" onClick={onClose}>
                                ✕
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <TableOfContentsScreen
                        sections={previewStats.sections}
                        sheetName={sheetName}
                        badge={badge}
                        name={employeeName}
                        shift={shift}
                        totalEstimatedMinutes={previewStats.totalEstimated}
                        onBegin={handleBeginWiring}
                        onBack={handleBackToStart}
                    />
                </div>
            </div>
        );
    }

    // Completed → show report
    if (phase === "completed" || isComplete) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base font-bold truncate">{sheetName}</h1>
                            <span className="text-[11px] text-muted-foreground">Completed</span>
                        </div>
                        {onClose && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 touch-manipulation text-muted-foreground" onClick={onClose}>
                                ✕
                            </Button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4">
                        {report && <CompletionReport report={report} onReset={handleReset} />}
                    </div>
                </div>
            </div>
        );
    }

    // ── Active Execution: Split Layout ────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header bar */}
            <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h1 className="text-sm sm:text-base font-bold truncate">{sheetName}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                                Section {progress.completed + (isComplete ? 0 : 1)} of {progress.total}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {progress.percent}%
                            </Badge>
                            {employeeName && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    <User className="h-2.5 w-2.5 mr-0.5" />
                                    {employeeName}
                                </Badge>
                            )}
                            {isSaving && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 animate-pulse">
                                    Saving...
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!isComplete && (
                            <Button
                                variant={isPaused ? "default" : "outline"}
                                size="sm"
                                className="h-8 px-3 gap-1.5 touch-manipulation"
                                onClick={isPaused ? () => resumeSession() : pauseSession}
                            >
                                {isPaused ? (
                                    <><Play className="h-4 w-4" /> Resume</>
                                ) : (
                                    <><Pause className="h-4 w-4" /> Pause</>
                                )}
                            </Button>
                        )}
                        {onClose && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 touch-manipulation text-muted-foreground" onClick={onClose}>
                                ✕
                            </Button>
                        )}
                    </div>
                </div>

                <Progress value={progress.percent} className="h-1 mt-2" />
            </div>

            {/* Error */}
            {error && (
                <div className="flex-shrink-0 mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Paused overlay */}
            {isPaused ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/20 mb-2">
                        <Pause className="h-10 w-10 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Session Paused</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeSection?.sectionLabel} · {sectionProgress.completed}/{sectionProgress.total} wires done
                        </p>
                    </div>
                    <Button
                        onClick={() => resumeSession()}
                        size="lg"
                        className="h-12 px-8 gap-2 touch-manipulation"
                    >
                        <Play className="h-5 w-5" /> Resume Wiring
                    </Button>
                </div>
            ) : (
                /* Split layout: Section nav (left) + Wire table (right) */
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Section Navigation (fixed) */}
                    <div className="hidden md:flex flex-col w-[220px] lg:w-[260px] flex-shrink-0 border-r bg-muted/10 overflow-y-auto">
                        <div className="p-2 space-y-0.5">
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Sections
                            </div>
                            {session?.sections.map((section, idx) => (
                                <SectionNavItem
                                    key={section.sectionId}
                                    section={section}
                                    isActive={idx === session.activeSectionIndex && section.status === "active"}
                                    onClick={() => handleSectionClick(idx)}
                                />
                            ))}
                        </div>

                        {/* Completed sections summary at bottom */}
                        {sectionSummaries.some(s => s.status === "completed") && (
                            <div className="mt-auto border-t p-2 space-y-1">
                                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Completed
                                </div>
                                {sectionSummaries.filter(s => s.status === "completed").map(s => (
                                    <div key={s.sectionId} className="px-2 py-1 text-[10px]">
                                        <div className="flex justify-between">
                                            <span className="text-foreground font-medium truncate">{s.sectionLabel}</span>
                                            <span className="text-muted-foreground ml-1 flex-shrink-0">
                                                {s.actualMinutes != null ? formatMinutes(s.actualMinutes) : "—"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Active Section Content (scrollable) */}
                    <div className="flex-1 overflow-y-auto">
                        {activeSection && (
                            <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-6 space-y-4">
                                {/* Mobile: Section stepper (horizontal, shown on small screens) */}
                                <div className="md:hidden w-full overflow-x-auto">
                                    <div className="flex items-center gap-1 min-w-max px-1 py-2">
                                        {session?.sections.map((section, idx) => {
                                            const isActive = idx === session.activeSectionIndex && section.status === "active";
                                            const isCompleted = section.status === "completed";
                                            const isLocked = section.status === "locked";

                                            return (
                                                <React.Fragment key={section.sectionId}>
                                                    {idx > 0 && (
                                                        <div className={cn(
                                                            "h-px w-4 flex-shrink-0",
                                                            isCompleted || isActive ? "bg-primary" : "bg-border",
                                                        )} />
                                                    )}
                                                    <div
                                                        className={cn(
                                                            "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium flex-shrink-0",
                                                            isActive && "bg-primary text-primary-foreground shadow-sm",
                                                            isCompleted && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                                                            isLocked && "bg-muted text-muted-foreground/60",
                                                        )}
                                                    >
                                                        {isCompleted ? (
                                                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                                        ) : isActive ? (
                                                            <Circle className="h-3.5 w-3.5 flex-shrink-0 fill-current" />
                                                        ) : (
                                                            <Lock className="h-3 w-3 flex-shrink-0" />
                                                        )}
                                                        <span className="truncate max-w-[80px]">{section.sectionLabel}</span>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Section header + timer */}
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                            {activeSection.location}
                                        </div>
                                        <h2 className="text-lg sm:text-xl font-bold">{activeSection.sectionLabel}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] h-5">
                                                {activeSection.totalRows} wires
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px] h-5">
                                                {sectionProgress.completed} / {sectionProgress.total} done
                                            </Badge>
                                        </div>
                                    </div>

                                    <LiveTimer
                                        elapsedSeconds={elapsedSeconds}
                                        estimatedMinutes={activeSection.estimatedMinutes}
                                    />

                                    <Progress value={sectionProgress.percent} className="h-2" />
                                </div>

                                {/* Device group navigation (for single connections) */}
                                {deviceGroups.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                            Device Groups
                                        </div>
                                        <DeviceGroupNav
                                            groups={deviceGroups}
                                            activeGroup={activeDeviceGroup}
                                            section={activeSection}
                                            onSelect={setActiveDeviceGroup}
                                        />
                                    </div>
                                )}

                                {/* Wire table */}
                                <ActiveSectionTable
                                    section={activeSection}
                                    rows={activeSectionRows}
                                    badge={badge}
                                    onToggle={toggleRowColumn}
                                    activeDeviceGroup={activeDeviceGroup}
                                />

                                {/* Complete section button */}
                                <div className="sticky bottom-0 pb-2 pt-2 bg-gradient-to-t from-background via-background to-transparent">
                                    <Button
                                        onClick={handleCompleteSection}
                                        disabled={!canAdvance}
                                        size="lg"
                                        className={cn(
                                            "w-full h-12 text-base gap-2 touch-manipulation transition-all",
                                            canAdvance && "animate-pulse shadow-lg",
                                        )}
                                    >
                                        {session && session.activeSectionIndex >= session.sections.length - 1
                                            ? <><Trophy className="h-5 w-5" /> Finish Wiring</>
                                            : <><ChevronRight className="h-5 w-5" /> Complete Section</>
                                        }
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
