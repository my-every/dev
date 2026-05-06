"use client";

/**
 * Project Life Cycle Columns
 *
 * Reusable kanban-style component with a fixed Assignments column on the left
 * and horizontally-scrollable queue + completed columns on the right.
 *
 * Layout:
 *  - LEFT (fixed): Assignments column with collapsible work-stage sections
 *  - RIGHT (scroll): Queue columns + Completed column, each with an
 *    interactive progress bar
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    ChevronDown,
    Search,
    Filter,
    CheckCircle2,
    Calendar,
    Clock,
    X,
    MapPin,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { AssignmentStageId, AssignmentStageCategory } from "@/types/d380-assignment-stages";
import type { AssignmentStatus } from "@/types/d380-assignment";
import type { ScheduledSlot } from "@/types/shift-schedule";
import { STAGE_ESTIMATES } from "@/types/floor-layout";
import {
    STAGE_CATEGORY_COLORS,
    getStageDefinition,
} from "@/types/d380-assignment-stages";
import { SWS_TYPE_REGISTRY, type SwsTypeId } from "@/lib/assignment/sws-detection";
import { SwsTypeGrid } from "@/components/projects/sws-type-grid";

// ============================================================================
// Types
// ============================================================================

export interface ProjectLifeCycleColumnsProps {
    assignments: MappedAssignment[];
    projectId: string;
    onAssignmentClick?: (assignment: MappedAssignment) => void;
    /** Called when a card is dragged to a different stage column */
    onStageChange?: (slug: string, newStage: AssignmentStageId) => void;
    /** Compact mode reduces card height for dense views */
    compact?: boolean;
    /** Planned consolidation layout date */
    planConlayDate?: string | Date;
    /** Planned consolidation assembly date */
    planConassyDate?: string | Date;
    /** Project due date */
    dueDate?: string | Date;
    /** Scheduled slots from the timeline — used to show station / time metadata on cards */
    scheduledSlots?: ScheduledSlot[];
}

// ============================================================================
// Column Definitions
// ============================================================================

/** Kanban columns — work stages shown as scrollable columns on the right */
const QUEUE_COLUMNS: { id: AssignmentStageId; label: string }[] = [
    { id: "BUILD_UP", label: "Build Up" },
    { id: "WIRING", label: "Wiring" },
    { id: "BOX_BUILD", label: "Box Build" },
    { id: "CROSS_WIRE", label: "Cross Wire" },
    { id: "TEST_1ST_PASS", label: "Test" },
    { id: "BIQ", label: "BIQ" },
];

/**
 * Progressive column colors — gradient from cool (blue/slate) at the start
 * to success green at completion. Each column index gets progressively greener.
 */
const COLUMN_PROGRESS_COLORS: {
    header: string;
    body: string;
    accent: string;
    bar: string;
    barTrack: string;
    text: string;
}[] = [
        // 0: Build Up — blue
        {
            header: "bg-blue-50 dark:bg-blue-900/30",
            body: "bg-blue-50/20 dark:bg-blue-950/10",
            accent: "bg-blue-400",
            bar: "bg-blue-400",
            barTrack: "bg-blue-100 dark:bg-blue-800/40",
            text: "text-blue-700 dark:text-blue-300",
        },
        // 1: Wiring — teal
        {
            header: "bg-teal-50 dark:bg-teal-900/30",
            body: "bg-teal-50/20 dark:bg-teal-950/10",
            accent: "bg-teal-400",
            bar: "bg-teal-400",
            barTrack: "bg-teal-100 dark:bg-teal-800/40",
            text: "text-teal-700 dark:text-teal-300",
        },
        // 2: Box Build — cyan
        {
            header: "bg-cyan-50 dark:bg-cyan-900/30",
            body: "bg-cyan-50/20 dark:bg-cyan-950/10",
            accent: "bg-cyan-500",
            bar: "bg-cyan-500",
            barTrack: "bg-cyan-100 dark:bg-cyan-800/40",
            text: "text-cyan-700 dark:text-cyan-300",
        },
        // 3: Cross Wire — emerald-light
        {
            header: "bg-emerald-50 dark:bg-emerald-900/30",
            body: "bg-emerald-50/20 dark:bg-emerald-950/10",
            accent: "bg-emerald-400",
            bar: "bg-emerald-400",
            barTrack: "bg-emerald-100 dark:bg-emerald-800/40",
            text: "text-emerald-700 dark:text-emerald-300",
        },
        // 4: Test — green
        {
            header: "bg-green-50 dark:bg-green-900/30",
            body: "bg-green-50/20 dark:bg-green-950/10",
            accent: "bg-green-500",
            bar: "bg-green-500",
            barTrack: "bg-green-100 dark:bg-green-800/40",
            text: "text-green-700 dark:text-green-300",
        },
        // 5: BIQ — green dark / success
        {
            header: "bg-green-100 dark:bg-green-900/40",
            body: "bg-green-50/30 dark:bg-green-950/20",
            accent: "bg-green-600",
            bar: "bg-green-600",
            barTrack: "bg-green-200 dark:bg-green-800/50",
            text: "text-green-800 dark:text-green-200",
        },
        // 6: Completed — success green
        {
            header: "bg-green-200 dark:bg-green-800/50",
            body: "bg-green-50/40 dark:bg-green-950/30",
            accent: "bg-green-700",
            bar: "bg-green-700",
            barTrack: "bg-green-300 dark:bg-green-700/50",
            text: "text-green-900 dark:text-green-100",
        },
    ];

/** Queue stages rendered as collapsible sections inside the Assignments column */
const WORK_STAGE_SECTIONS: { id: AssignmentStageId; label: string }[] = [
    { id: "READY_TO_LAY", label: "Ready To Lay" },
    { id: "READY_TO_WIRE", label: "Ready To Wire" },
    { id: "READY_FOR_VISUAL", label: "Ready for Review" },
    { id: "READY_TO_HANG", label: "Ready for Box Build" },
    { id: "READY_TO_CROSS_WIRE", label: "Ready for Cross Wire" },
    { id: "READY_TO_TEST", label: "Ready To Test" },
    { id: "READY_FOR_BIQ", label: "Ready For BIQ" },
];

// ============================================================================
// Stage Column Colors (dark-mode aware)
// ============================================================================

const COLUMN_COLORS: Record<AssignmentStageCategory, {
    header: string;
    body: string;
    accent: string;
    bar: string;
    barTrack: string;
}> = {
    queue: {
        header: "bg-slate-100 dark:bg-slate-800/60",
        body: "bg-slate-50/50 dark:bg-slate-900/30",
        accent: "bg-slate-400",
        bar: "bg-slate-400",
        barTrack: "bg-slate-200 dark:bg-slate-700/50",
    },
    build: {
        header: "bg-blue-100 dark:bg-blue-900/40",
        body: "bg-blue-50/30 dark:bg-blue-950/20",
        accent: "bg-blue-500",
        bar: "bg-blue-500",
        barTrack: "bg-blue-200 dark:bg-blue-800/50",
    },
    verify: {
        header: "bg-amber-100 dark:bg-amber-900/40",
        body: "bg-amber-50/30 dark:bg-amber-950/20",
        accent: "bg-amber-500",
        bar: "bg-amber-500",
        barTrack: "bg-amber-200 dark:bg-amber-800/50",
    },
    test: {
        header: "bg-emerald-100 dark:bg-emerald-900/40",
        body: "bg-emerald-50/30 dark:bg-emerald-950/20",
        accent: "bg-emerald-500",
        bar: "bg-emerald-500",
        barTrack: "bg-emerald-200 dark:bg-emerald-800/50",
    },
    final: {
        header: "bg-sky-100 dark:bg-sky-900/40",
        body: "bg-sky-50/30 dark:bg-sky-950/20",
        accent: "bg-sky-500",
        bar: "bg-sky-500",
        barTrack: "bg-sky-200 dark:bg-sky-800/50",
    },
};

// ============================================================================
// Progress Bar
// ============================================================================

interface ColumnProgressBarProps {
    count: number;
    total: number;
    barClass: string;
    trackClass: string;
}

function ColumnProgressBar({ count, total, barClass, trackClass }: ColumnProgressBarProps) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    return (
        <div className="flex items-center gap-2 px-3 pb-2">
            <div className={cn("flex-1 h-1.5 rounded-full overflow-hidden", trackClass)}>
                <motion.div
                    className={cn("h-full rounded-full", barClass)}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                />
            </div>
            <span className="text-[9px] font-medium tabular-nums text-muted-foreground w-8 text-right">
                {pct}%
            </span>
        </div>
    );
}

// ============================================================================
// Assignment Mini Card
// ============================================================================

interface LifeCycleAssignmentCardProps {
    assignment: MappedAssignment;
    compact?: boolean;
    onClick?: () => void;
    /** Scheduled slot from timeline, if any */
    scheduledSlot?: ScheduledSlot;
    /** Whether drag is enabled */
    draggable?: boolean;
}

function LifeCycleAssignmentCard({
    assignment,
    compact,
    onClick,
    scheduledSlot,
    draggable: isDraggable,
}: LifeCycleAssignmentCardProps) {
    const swsInfo = SWS_TYPE_REGISTRY[assignment.selectedSwsType as SwsTypeId];
    const statusColor =
        assignment.selectedStatus === "COMPLETE"
            ? "bg-emerald-500"
            : assignment.selectedStatus === "IN_PROGRESS"
                ? "bg-blue-500"
                : assignment.selectedStatus === "INCOMPLETE"
                    ? "bg-amber-500"
                    : "bg-slate-300 dark:bg-slate-600";

    // Display-friendly name: strip commas, carets, and special chars
    const displayName = assignment.sheetName
        .replace(/[^A-Za-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            draggable={!!isDraggable}
            onDragStart={(e) => {
                if (!isDraggable) return;
                const de = e as unknown as React.DragEvent;
                de.dataTransfer?.setData("text/plain", assignment.sheetSlug);
            }}
        >
            <Card
                className={cn(
                    "cursor-pointer border border-border/40 bg-card shadow-sm hover:shadow-md hover:border-border/60 transition-all duration-150 group overflow-hidden",
                    compact ? "py-1" : "py-2",
                )}
                onClick={onClick}
            >
                <div className={cn("flex items-center relative gap-2 px-3   justify-between", compact ? "pb-1" : "pb-2")}>
                    <div
                        className={cn(
                            "font-medium truncate py-1.5  text-foreground flex items-center gap-1",
                            compact ? "text-xs" : "text-sm",
                        )}
                        title={assignment.sheetName}
                    >
                        {displayName}
                    </div>
                    {/* Status dot */}
                    <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full position absolute top-0 right-2.5", statusColor)} />

                </div>


                <CardContent className={cn("flex items-start gap-2.5", compact ? "p-2" : "p-3")}>

                    <div className="flex-1 min-w-0">

                        <div className="flex items-center gap-2 mt-0.5">
                            {swsInfo && (
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] h-4 px-1.5 font-medium bg-muted/60 text-muted-foreground border-0"
                                >
                                    {swsInfo.shortLabel}
                                </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                {assignment.rowCount} rows
                            </span>
                        </div>

                        {/* Schedule metadata from timeline */}
                        {scheduledSlot && (
                            <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5 border-t border-border/20">
                                {scheduledSlot.workstation && (
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">{scheduledSlot.workstation}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                    <Clock className="h-2.5 w-2.5 shrink-0" />
                                    <span>{scheduledSlot.scheduledStart}</span>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span>{(() => {
                                        const est = STAGE_ESTIMATES[assignment.selectedStage];
                                        return est?.label ?? `${Math.round(scheduledSlot.scheduledDuration / 60)}h`;
                                    })()}</span>
                                </div>
                                {scheduledSlot.assignedBadges.length > 0 && (
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                        <Users className="h-2.5 w-2.5 shrink-0" />
                                        <span>{scheduledSlot.assignedBadges.length} assigned</span>
                                    </div>
                                )}
                            </div>
                        )}


                    </div>

                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
            </Card>
        </motion.div>
    );
}

// ============================================================================
// Kanban Column (queue / completed — with progress bar)
// ============================================================================

interface KanbanColumnProps {
    stageId: AssignmentStageId;
    label: string;
    assignments: MappedAssignment[];
    totalAssignments: number;
    compact?: boolean;
    onAssignmentClick?: (assignment: MappedAssignment) => void;
    /** Called when a card is dropped into this column */
    onDrop?: (slug: string) => void;
    /** Whether cards should be draggable */
    draggable?: boolean;
    /** Override category (for completed column) */
    categoryOverride?: AssignmentStageCategory;
    /** Progressive color index (0–6) for gradient headers */
    colorIndex?: number;
    /** Scheduled slots keyed by assignment slug */
    slotsBySlug?: Map<string, ScheduledSlot>;
}

function KanbanColumn({
    stageId,
    label,
    assignments,
    totalAssignments,
    compact,
    onAssignmentClick,
    onDrop,
    draggable: isDraggable,
    categoryOverride,
    colorIndex,
    slotsBySlug,
}: KanbanColumnProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const stageDef = getStageDefinition(stageId);
    const category = categoryOverride ?? stageDef?.category ?? "queue";
    const colors = typeof colorIndex === "number" && COLUMN_PROGRESS_COLORS[colorIndex]
        ? COLUMN_PROGRESS_COLORS[colorIndex]
        : COLUMN_COLORS[category];
    const textColor = typeof colorIndex === "number" && COLUMN_PROGRESS_COLORS[colorIndex]
        ? COLUMN_PROGRESS_COLORS[colorIndex].text
        : STAGE_CATEGORY_COLORS[category].text;

    return (
        <div className="flex flex-col snap-start shrink-0 w-[220px] min-w-[220px] max-w-[220px]">
            {/* Column header — stepper-style with chevron shape */}
            <div className={cn("relative overflow-hidden rounded-t-lg", colors.header)}>
                <div className={cn("absolute top-0 left-0 right-0 h-1", colors.accent)} />
                {/* Chevron arrow on the right side */}
                <div className="absolute right-0 top-0 bottom-0 w-4 overflow-hidden">
                    <div
                        className={cn("absolute inset-y-0 -right-2 w-8 rotate-[20deg] origin-bottom-right", colors.header)}
                        style={{ opacity: 0.6 }}
                    />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 pt-3.5">
                    <h3 className={cn("font-semibold text-xs tracking-tight", textColor)}>
                        {label}
                    </h3>
                    <span className={cn("text-[10px] font-medium tabular-nums opacity-70", textColor)}>
                        {assignments.length}
                    </span>
                </div>
                {/* Interactive progress bar — fills based on completed assignments */}
                <ColumnProgressBar
                    count={assignments.filter((a) => a.selectedStatus === "COMPLETE").length}
                    total={assignments.length}
                    barClass={colors.bar}
                    trackClass={colors.barTrack}
                />
            </div>

            {/* Column body */}
            <div
                className={cn(
                    "flex-1 rounded-b-lg border-x border-b border-border/20 overflow-y-auto transition-colors",
                    colors.body,
                    isDragOver && "ring-2 ring-primary/40 bg-primary/5",
                )}
                style={{ maxHeight: "calc(100% - 56px)" }}
                onDragOver={(e) => {
                    if (!onDrop) return;
                    e.preventDefault();
                    setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const slug = e.dataTransfer.getData("text/plain");
                    if (slug && onDrop) onDrop(slug);
                }}
            >
                <div className="flex flex-col gap-2 p-2">
                    <AnimatePresence mode="popLayout">
                        {assignments.length === 0 ? (
                            <div className="text-[10px] text-muted-foreground/50 text-center py-8 italic">
                                No assignments
                            </div>
                        ) : (
                            assignments.map((a) => (
                                <LifeCycleAssignmentCard
                                    key={a.sheetSlug}
                                    assignment={a}
                                    compact={compact}
                                    onClick={() => onAssignmentClick?.(a)}
                                    scheduledSlot={slotsBySlug?.get(a.sheetSlug)}
                                    draggable={isDraggable}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// SWS Filter Dropdown (inline split-button style)
// ============================================================================

function SwsFilterDropdown({
    selected,
    onToggle,
    onClear,
}: {
    selected: Set<SwsTypeId>;
    onToggle: (id: SwsTypeId) => void;
    onClear: () => void;
}) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "flex items-center justify-center h-7 w-7 border-l transition-colors hover:bg-accent",
                    selected.size > 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground",
                )}
                title={`SWS filter${selected.size > 0 ? ` (${selected.size})` : ""}`}
            >
                <Filter className="h-3 w-3" />
                {selected.size > 0 && (
                    <span className="absolute -top-1 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
                        {selected.size}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
                    <div className="absolute top-full right-0 mt-1 z-[101] rounded-md border bg-popover p-2 shadow-md">
                        <SwsTypeGrid
                            selected={selected}
                            onSelect={onToggle}
                        />
                        {selected.size > 0 && (
                            <>
                                <div className="my-1.5 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => { onClear(); setOpen(false); }}
                                    className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                    Clear
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================================
// Milestone Date Helpers
// ============================================================================

/** Stages considered "past Build Up" (at or beyond BUILD_UP in the pipeline) */
export const BUILD_UP_OR_LATER: AssignmentStageId[] = [
    "BUILD_UP", "WIRING", "BOX_BUILD", "CROSS_WIRE", "TEST_1ST_PASS", "BIQ",
    "FINISHED_BIQ" as AssignmentStageId,
];

/** Stages at or beyond TEST */
export const TEST_OR_LATER: AssignmentStageId[] = [
    "TEST_1ST_PASS", "BIQ", "FINISHED_BIQ" as AssignmentStageId,
];

export function toDate(v: string | Date | undefined): Date | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function daysRemaining(target: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const t = new Date(target);
    t.setHours(0, 0, 0, 0);
    return Math.ceil((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeRemainingLabel(days: number): string {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    return `${days}d remaining`;
}

/** Animated success checkmark */
function MilestoneCheck() {
    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
        >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </motion.div>
    );
}

// ============================================================================
// Milestone Dates Strip
// ============================================================================

export interface MilestoneDatesProps {
    planConlayDate?: Date | null;
    planConassyDate?: Date | null;
    dueDate?: Date | null;
    conlayMet: boolean;
    conassyMet: boolean;
    completeMet: boolean;
}

export function MilestoneDates({
    planConlayDate,
    planConassyDate,
    dueDate,
    conlayMet,
    conassyMet,
    completeMet,
}: MilestoneDatesProps) {
    const items: {
        label: string;
        date: Date;
        met: boolean;
        days: number;
    }[] = [];

    if (planConlayDate) {
        const days = daysRemaining(planConlayDate);
        items.push({ label: "Plan ConLay", date: planConlayDate, met: conlayMet, days });
    }
    if (planConassyDate) {
        const days = daysRemaining(planConassyDate);
        items.push({ label: "Plan ConAssy", date: planConassyDate, met: conassyMet, days });
    }
    if (dueDate) {
        const days = daysRemaining(dueDate);
        items.push({ label: "Due Date", date: dueDate, met: completeMet, days });
    }

    if (items.length === 0) return null;

    return (
        <div className="flex items-center gap-4 flex-wrap">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                >
                    {item.met ? (
                        <MilestoneCheck />
                    ) : (
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                    <span className="font-medium">{item.label}:</span>
                    <span className="tabular-nums">{formatDate(item.date)}</span>
                    <span className={cn(
                        "tabular-nums",
                        item.met
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.days < 0
                                ? "text-red-500"
                                : item.days <= 7
                                    ? "text-amber-500"
                                    : "text-muted-foreground/70",
                    )}>
                        ({item.met ? "met" : timeRemainingLabel(item.days)})
                    </span>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// Status Filter Dropdown (inline split-button style)
// ============================================================================

const STATUS_FILTER_OPTIONS: { id: AssignmentStatus; label: string; color: string }[] = [
    { id: "NOT_STARTED", label: "Not Started", color: "bg-slate-300 dark:bg-slate-600" },
    { id: "IN_PROGRESS", label: "In Progress", color: "bg-sky-500" },
    { id: "INCOMPLETE", label: "Incomplete", color: "bg-amber-500" },
    { id: "COMPLETE", label: "Complete", color: "bg-green-500" },
];

function StatusFilterDropdown({
    selected,
    onToggle,
    onClear,
}: {
    selected: Set<AssignmentStatus>;
    onToggle: (id: AssignmentStatus) => void;
    onClear: () => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "flex items-center justify-center h-7 w-7 border-l transition-colors hover:bg-accent",
                    selected.size > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                )}
                title={`Status filter${selected.size > 0 ? ` (${selected.size})` : ""}`}
            >
                <Clock className="h-3 w-3" />
                {selected.size > 0 && (
                    <span className="absolute -top-1 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                        {selected.size}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
                    <div className="absolute top-full right-0 mt-1 z-[101] min-w-[140px] rounded-md border bg-popover p-1 shadow-md">
                        {STATUS_FILTER_OPTIONS.map((opt) => {
                            const active = selected.has(opt.id);
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => onToggle(opt.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                                        active && "bg-accent",
                                    )}
                                >
                                    <div className={cn("h-2 w-2 rounded-full shrink-0", opt.color)} />
                                    <span className="flex-1 text-left">{opt.label}</span>
                                    {active && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                </button>
                            );
                        })}
                        {selected.size > 0 && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => { onClear(); setOpen(false); }}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                    Clear filter
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================================================
// Assignments Column (fixed, collapsible work-stage sections + search/filter)
// ============================================================================

interface AssignmentsColumnProps {
    grouped: Map<AssignmentStageId, MappedAssignment[]>;
    compact?: boolean;
    onAssignmentClick?: (assignment: MappedAssignment) => void;
}

/** Skeleton cards shown during search transition */
function AssignmentCardSkeleton() {
    return (
        <div className="rounded-lg border border-border/40 bg-card shadow-sm p-3">
            <div className="flex items-start gap-2.5">
                <Skeleton className="mt-1 h-2 w-2 rounded-full" />
                <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10 rounded" />
                        <Skeleton className="h-3 w-14" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssignmentsColumn({
    grouped,
    compact,
    onAssignmentClick,
}: AssignmentsColumnProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [swsFilter, setSwsFilter] = useState<Set<SwsTypeId>>(new Set());
    const [statusFilter, setStatusFilter] = useState<Set<AssignmentStatus>>(new Set());
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggleSwsFilter = useCallback((id: SwsTypeId) => {
        setSwsFilter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSwsFilter = useCallback(() => setSwsFilter(new Set()), []);

    const toggleStatusFilter = useCallback((id: AssignmentStatus) => {
        setStatusFilter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearStatusFilter = useCallback(() => setStatusFilter(new Set()), []);

    // Show skeleton briefly when search query changes
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        if (value.trim()) {
            setIsSearching(true);
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => setIsSearching(false), 250);
        } else {
            setIsSearching(false);
        }
    }, []);

    // Apply search and filter to all sections
    const filteredGrouped = useMemo(() => {
        const result = new Map<AssignmentStageId, MappedAssignment[]>();
        const q = searchQuery.trim().toLowerCase();
        for (const s of WORK_STAGE_SECTIONS) {
            const items = grouped.get(s.id) ?? [];
            const filtered = items.filter((a) => {
                if (q && !a.sheetName.toLowerCase().includes(q)) return false;
                if (swsFilter.size > 0 && !swsFilter.has(a.selectedSwsType as SwsTypeId)) return false;
                if (statusFilter.size > 0 && !statusFilter.has((a.selectedStatus || "NOT_STARTED") as AssignmentStatus)) return false;
                return true;
            });
            result.set(s.id, filtered);
        }
        return result;
    }, [grouped, searchQuery, swsFilter, statusFilter]);

    const totalCount = WORK_STAGE_SECTIONS.reduce(
        (sum, s) => sum + (filteredGrouped.get(s.id)?.length ?? 0),
        0,
    );

    const unfilteredTotal = WORK_STAGE_SECTIONS.reduce(
        (sum, s) => sum + (grouped.get(s.id)?.length ?? 0),
        0,
    );

    // Completion progress
    const allAssignments = useMemo(() => {
        const all: MappedAssignment[] = [];
        for (const s of WORK_STAGE_SECTIONS) {
            all.push(...(grouped.get(s.id) ?? []));
        }
        return all;
    }, [grouped]);

    const completedCount = allAssignments.filter((a) => a.selectedStatus === "COMPLETE").length;
    const completionPct = unfilteredTotal > 0 ? Math.round((completedCount / unfilteredTotal) * 100) : 0;

    const isFiltered = searchQuery.trim() !== "" || swsFilter.size > 0 || statusFilter.size > 0;

    // Accordion: track which single section is expanded (null = all collapsed)
    const [expandedSection, setExpandedSection] = useState<AssignmentStageId | null>(() => {
        // Auto-expand the first section that has items
        for (const s of WORK_STAGE_SECTIONS) {
            if ((grouped.get(s.id)?.length ?? 0) > 0) return s.id;
        }
        return null;
    });

    const toggle = (id: AssignmentStageId) => {
        setExpandedSection((prev) => (prev === id ? null : id));
    };

    // Compute display order: expanded section floats to top, rest in default order
    const orderedSections = useMemo(() => {
        if (!expandedSection) return WORK_STAGE_SECTIONS;
        const expanded = WORK_STAGE_SECTIONS.find((s) => s.id === expandedSection);
        if (!expanded) return WORK_STAGE_SECTIONS;
        const rest = WORK_STAGE_SECTIONS.filter((s) => s.id !== expandedSection);
        return [expanded, ...rest];
    }, [expandedSection]);

    return (
        <div className="flex flex-col h-full w-[280px] min-w-[280px] shrink-0">
            {/* Column header */}
            <div className="relative overflow-hidden rounded-t-lg bg-background border/20">

                <div className="flex items-center justify-between px-3 py-2.5 pt-3.5">
                    <h3 className="font-semibold text-xs tracking-tight text-blue-700 dark:text-blue-300">
                        Panels / Assignments
                    </h3>
                    <span className="text-[10px] font-medium tabular-nums opacity-70 text-blue-700 dark:text-blue-300">
                        {isFiltered ? `${totalCount}/${unfilteredTotal}` : totalCount}
                    </span>
                </div>
                {/* Progress bar */}
                <ColumnProgressBar
                    count={completedCount}
                    total={unfilteredTotal}
                    barClass="bg-blue-500"
                    trackClass="bg-blue-200 dark:bg-blue-800/50"
                />
            </div>

            {/* Search + Filter bar — inline split-button group */}
            <div className="px-2 py-2 border-x border-border/20 bg-background/80 shrink-0">
                <div className="flex items-center rounded-md border border-border overflow-visible">
                    {/* Search icon */}
                    <div className="flex items-center justify-center h-7 w-7 shrink-0 text-muted-foreground/50">
                        <Search className="h-3 w-3" />
                    </div>
                    {/* Search input */}
                    <input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search..."
                        className="flex-1 h-7 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 min-w-0"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="flex items-center justify-center h-7 w-6 shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                    {/* SWS filter split button */}
                    <SwsFilterDropdown
                        selected={swsFilter}
                        onToggle={toggleSwsFilter}
                        onClear={clearSwsFilter}
                    />
                    {/* Status filter split button */}
                    <StatusFilterDropdown
                        selected={statusFilter}
                        onToggle={toggleStatusFilter}
                        onClear={clearStatusFilter}
                    />
                </div>
            </div>

            {/* Column body with collapsible sections */}
            <div className="flex-1 rounded-b-lg border-x border-b border-border/20 overflow-y-auto bg-blue-50/30 dark:bg-blue-950/20">
                {isSearching ? (
                    <div className="flex flex-col gap-2 p-2">
                        <AssignmentCardSkeleton />
                        <AssignmentCardSkeleton />
                        <AssignmentCardSkeleton />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {orderedSections.map((section) => {
                            const items = filteredGrouped.get(section.id) ?? [];
                            const isExpanded = expandedSection === section.id;
                            const stageDef = getStageDefinition(section.id);
                            const category = stageDef?.category ?? "build";
                            const categoryColors = STAGE_CATEGORY_COLORS[category];

                            // Hide empty sections when filtering
                            if (isFiltered && items.length === 0) return null;

                            return (
                                <motion.div
                                    key={section.id}
                                    layout
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="border-b border-border/10 last:border-b-0"
                                >
                                    {/* Section header */}
                                    <button
                                        onClick={() => toggle(section.id)}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {!isExpanded ? (
                                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            <span className={cn("text-xs font-semibold", categoryColors.text)}>
                                                {section.label}
                                            </span>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] h-4 px-1.5 font-medium bg-muted/60 border-0"
                                        >
                                            {items.length}
                                        </Badge>
                                    </button>

                                    {/* Section body */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="flex flex-col gap-1.5 px-2 pb-2">
                                                    {items.length === 0 ? (
                                                        <div className="text-[10px] text-muted-foreground/50 text-center py-3 italic">
                                                            Empty
                                                        </div>
                                                    ) : (
                                                        items.map((a) => (
                                                            <LifeCycleAssignmentCard
                                                                key={a.sheetSlug}
                                                                assignment={a}
                                                                compact={compact}
                                                                onClick={() => onAssignmentClick?.(a)}
                                                            />
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectLifeCycleColumns({
    assignments,
    projectId,
    // planConlayDate, planConassyDate, dueDate — kept in interface
    // but milestone rendering has moved to the parent header (ProjectDetailsModal).
    onAssignmentClick,
    onStageChange,
    compact,
    scheduledSlots,
}: ProjectLifeCycleColumnsProps) {
    // Group assignments by selectedStage
    const grouped = useMemo(() => {
        const map = new Map<AssignmentStageId, MappedAssignment[]>();
        for (const a of assignments) {
            const stage = a.selectedStage as AssignmentStageId;
            if (!map.has(stage)) map.set(stage, []);
            map.get(stage)!.push(a);
        }
        return map;
    }, [assignments]);

    // ── Load schedule for today from timeline API ──
    const [loadedSlots, setLoadedSlots] = useState<ScheduledSlot[]>([]);

    useEffect(() => {
        if (scheduledSlots) return; // use prop if provided
        if (!projectId) return;
        let cancelled = false;
        const dateStr = new Date().toISOString().slice(0, 10);
        fetch(`/api/schedule/timeline/${encodeURIComponent(projectId)}?date=${dateStr}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (cancelled || !data) return;
                setLoadedSlots(data.slots ?? []);
            })
            .catch(() => { /* no schedule data */ });
        return () => { cancelled = true; };
    }, [projectId, scheduledSlots]);

    const effectiveSlots = scheduledSlots ?? loadedSlots;

    // Map slug → ScheduledSlot for quick card lookup
    const slotsBySlug = useMemo(() => {
        const map = new Map<string, ScheduledSlot>();
        for (const s of effectiveSlots) map.set(s.assignmentSlug, s);
        return map;
    }, [effectiveSlots]);

    const totalAssignments = assignments.length;

    const scrollRef = useRef<HTMLDivElement>(null);
    const COLUMN_WIDTH = 220 + 12; // column width + gap

    /** Redirect vertical wheel → horizontal scroll when hovering the kanban area */
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el) return;
        // Only redirect when there's vertical delta and the container can scroll horizontally
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
            e.preventDefault();
            el.scrollBy({ left: e.deltaY, behavior: "auto" });
        }
    }, []);

    /** Keyboard left/right arrow snap-scroll between columns */
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el) return;
        if (e.key === "ArrowRight") {
            e.preventDefault();
            el.scrollBy({ left: COLUMN_WIDTH, behavior: "smooth" });
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            el.scrollBy({ left: -COLUMN_WIDTH, behavior: "smooth" });
        }
    }, []);

    /** Auto-focus the scroll container when the mouse enters so arrow keys work immediately */
    const handleMouseEnter = useCallback(() => {
        scrollRef.current?.focus({ preventScroll: true });
    }, []);

    return (
        <div className="flex flex-col h-full w-full gap-2">
            {/* Milestone dates strip removed — rendered in parent header */}

            <div className="flex flex-1 min-h-0 w-full">
                {/* Fixed Assignments column on the left */}
                <AssignmentsColumn
                    grouped={grouped}
                    compact={compact}
                    onAssignmentClick={onAssignmentClick}
                />

                {/* Border separator */}
                <div className="w-px bg-border shrink-0 mx-3" />

                {/* Scrollable kanban columns on the right */}
                <div className="flex-1 overflow-hidden min-w-0">
                    <div
                        ref={scrollRef}
                        tabIndex={0}
                        onWheel={handleWheel}
                        onKeyDown={handleKeyDown}
                        onMouseEnter={handleMouseEnter}
                        className="flex gap-3 h-full overflow-x-auto snap-x snap-mandatory pb-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent outline-none"
                        style={{ WebkitOverflowScrolling: "touch" }}
                    >
                        {/* Queue columns — progressive color gradient */}
                        {QUEUE_COLUMNS.map((col, i) => (
                            <KanbanColumn
                                key={col.id}
                                stageId={col.id}
                                label={col.label}
                                assignments={grouped.get(col.id) ?? []}
                                totalAssignments={totalAssignments}
                                compact={compact}
                                onAssignmentClick={onAssignmentClick}
                                onDrop={onStageChange ? (slug) => onStageChange(slug, col.id) : undefined}
                                draggable={!!onStageChange}
                                colorIndex={i}
                                slotsBySlug={slotsBySlug}
                            />
                        ))}

                        {/* Completed column — final green */}
                        <KanbanColumn
                            stageId={"FINISHED_BIQ" as AssignmentStageId}
                            label="Completed"
                            assignments={grouped.get("FINISHED_BIQ" as AssignmentStageId) ?? []}
                            totalAssignments={totalAssignments}
                            compact={compact}
                            onAssignmentClick={onAssignmentClick}
                            onDrop={onStageChange ? (slug) => onStageChange(slug, "FINISHED_BIQ" as AssignmentStageId) : undefined}
                            draggable={!!onStageChange}
                            categoryOverride="final"
                            colorIndex={6}
                            slotsBySlug={slotsBySlug}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
