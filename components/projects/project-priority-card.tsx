"use client";

import { useMemo } from "react";
import { ArrowUpRight, Target, Hourglass, ListChecks, Activity, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    PRIORITY_STAGE_CONFIG,
    type PriorityEntry,
    type PriorityStage,
} from "@/lib/priority-list/types";
import { PdNumberField } from "@/components/projects/fields/pd-number-field";
import { UnitNumberField } from "@/components/projects/fields/unit-number-field";
import { LwcTypeField } from "@/components/projects/fields/lwc-type-field";
import type { LwcType } from "@/lib/workbook/types";

// ============================================================================
// Types
// ============================================================================

export type ProjectPriorityCardVariant = "full" | "compact" | "grid";

interface ProjectPriorityCardProps {
    entry: PriorityEntry;
    variant?: ProjectPriorityCardVariant;
    /** Total assignment count for the project (denominator) */
    totalAssignments?: number;
    /** Completed assignment count */
    completedAssignments?: number;
    /** Estimated hours */
    estimatedHours?: number;
    /** Override status label */
    statusLabel?: string;
    /** Click handler for View Details */
    onViewDetails?: (entry: PriorityEntry) => void;
    /** Project color from the upload flow (hex string). Falls back to stage color. */
    projectColor?: string;
    className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default accent color when no project color is set */
const DEFAULT_PROJECT_COLOR = "#ffcc61";

// ============================================================================
// Helpers
// ============================================================================

function getStatusLabel(entry: PriorityEntry): string {
    if (entry.stage === "completed") return "COMPLETE";
    if (entry.status) return entry.status.toUpperCase();
    return "HEALTHY";
}

function isOverdue(target: string): boolean {
    if (!target) return false;
    const match = target.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return false;
    let year = match[3];
    if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    const d = new Date(`${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`);
    return !isNaN(d.getTime()) && d < new Date();
}

function formatTargetDisplay(target: string): string {
    if (!target) return "—";
    const match = target.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return target;
    let year = match[3];
    if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    const d = new Date(`${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`);
    if (isNaN(d.getTime())) return target;
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** Map the free-text lwc field to a typed LwcType when possible */
function resolveLwcType(lwc: string): LwcType | undefined {
    const mapping: Record<string, LwcType> = {
        "onskid": "ONSKID",
        "offskid": "OFFSKID",
        "new": "NEW_FLEX",
        "new/flex": "NEW_FLEX",
        "new_flex": "NEW_FLEX",
        "ntb": "NTB",
        "float": "FLOAT",
    };
    return mapping[lwc.toLowerCase().trim()] ?? undefined;
}

// ============================================================================
// Metric Cell
// ============================================================================

interface MetricCellProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    tone?: "default" | "danger" | "success";
    accentColor?: string;
    className?: string;
}

function MetricCell({ label, value, icon, tone = "default", accentColor, className }: MetricCellProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 sm:px-3 sm:py-2.5",
                tone === "danger" && "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20",
                tone === "success" && "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20",
                className,
            )}
        >
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-medium truncate">{label}</span>
                <span className="ml-auto text-muted-foreground/60 shrink-0">{icon}</span>
            </div>
            <span
                className={cn(
                    "text-sm sm:text-base font-semibold tracking-tight truncate",
                    tone === "danger" && "text-red-600 dark:text-red-400",
                    tone === "success" && "text-emerald-600 dark:text-emerald-400",
                )}
                style={
                    tone === "default" && accentColor
                        ? { color: accentColor }
                        : undefined
                }
            >
                {value}
            </span>
        </div>
    );
}

// ============================================================================
// Stage Progression Bar
// ============================================================================

const PROGRESSION_STAGES: PriorityStage[] = [
    "kitting",
    "conlay",
    "conassy",
    "test",
    "pwr-check",
    "biq",
    "completed",
];

function StageProgressionBar({ currentStage, entry, accentColor }: { currentStage: PriorityStage; entry: PriorityEntry; accentColor?: string }) {
    const activeIndex = PROGRESSION_STAGES.indexOf(currentStage);

    return (
        <div className="mt-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Stage Progression
            </div>
            {/* Scroll horizontally on very small screens */}
            <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex items-center gap-0 min-w-0">
                    {PROGRESSION_STAGES.map((stage, i) => {
                        const config = PRIORITY_STAGE_CONFIG[stage];
                        const isActive = i <= activeIndex;
                        const isCurrent = stage === currentStage;

                        return (
                            <div key={stage} className="flex items-center shrink-0">
                                {i > 0 && (
                                    <ChevronRight
                                        className={cn(
                                            "h-3 w-3 shrink-0",
                                            isActive ? "text-emerald-500" : "text-muted-foreground/30",
                                        )}
                                        style={isCurrent && accentColor ? { color: accentColor } : undefined}
                                    />
                                )}
                                <div className="flex flex-col items-center gap-0.5">
                                    <span
                                        className={cn(
                                            "text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold px-0.5 sm:px-1 whitespace-nowrap",
                                            isCurrent ? config.color : isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40",
                                        )}
                                        style={isCurrent && accentColor ? { color: accentColor } : undefined}
                                    >
                                        {config.label}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-[9px] tabular-nums",
                                            isCurrent ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/30",
                                        )}
                                    >
                                        {isCurrent && !entry.planConlay && (
                                            <span className="inline-flex items-center" style={accentColor ? { color: accentColor } : undefined}>&#10003;</span>
                                        )}
                                        {isCurrent && entry.planConlay ? entry.planConlay : !isCurrent ? "-" : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Card Variants
// ============================================================================

/**
 * Full variant - includes stage progression bar
 */
function FullCard({ entry, totalAssignments = 18, completedAssignments = 0, estimatedHours = 95, statusLabel, onViewDetails, projectColor }: ProjectPriorityCardProps) {
    const overdue = isOverdue(entry.target);
    const status = statusLabel || getStatusLabel(entry);
    const accent = projectColor || DEFAULT_PROJECT_COLOR;

    return (
        <>
            <ProjectInfoHeader entry={entry} onViewDetails={onViewDetails} accentColor={accent} />
            <ProjectMetadataRow entry={entry} />

            {/* Metrics Row - 2 cols mobile → 4 cols desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <MetricCell
                    label="Target"
                    value={formatTargetDisplay(entry.target)}
                    icon={<Target className="h-3.5 w-3.5" />}
                    tone={overdue ? "danger" : "default"}
                />
                <MetricCell
                    label="Est. Time"
                    value={estimatedHours ? `${estimatedHours}HRS` : "—"}
                    icon={<Hourglass className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Assignments"
                    value={`${completedAssignments}/${totalAssignments}`}
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Status"
                    value={status}
                    icon={<Activity className="h-3.5 w-3.5" />}
                    tone={status === "COMPLETE" ? "success" : overdue ? "danger" : "default"}
                />
            </div>

            <StageProgressionBar currentStage={entry.stage} entry={entry} accentColor={accent} />
        </>
    );
}

/**
 * Compact variant - metrics in a responsive row, no progression bar
 */
function CompactCard({ entry, totalAssignments = 18, completedAssignments = 0, estimatedHours = 95, statusLabel, onViewDetails, projectColor }: ProjectPriorityCardProps) {
    const overdue = isOverdue(entry.target);
    const status = statusLabel || getStatusLabel(entry);
    const accent = projectColor || DEFAULT_PROJECT_COLOR;

    return (
        <>
            <ProjectInfoHeader entry={entry} onViewDetails={onViewDetails} accentColor={accent} />
            <ProjectMetadataRow entry={entry} />

            {/* Metrics Row - 2 cols mobile → 4 cols desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <MetricCell
                    label="Target"
                    value={formatTargetDisplay(entry.target)}
                    icon={<Target className="h-3.5 w-3.5" />}
                    tone={overdue ? "danger" : "default"}
                />
                <MetricCell
                    label="Est. Time"
                    value={estimatedHours ? `${estimatedHours}HRS` : "—"}
                    icon={<Hourglass className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Assignments"
                    value={`${completedAssignments}/${totalAssignments}`}
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Status"
                    value={status}
                    icon={<Activity className="h-3.5 w-3.5" />}
                    tone={status === "COMPLETE" ? "success" : overdue ? "danger" : "default"}
                />
            </div>
        </>
    );
}

/**
 * Grid variant - metrics in 2x2 grid layout
 */
function GridCard({ entry, totalAssignments = 18, completedAssignments = 0, estimatedHours = 95, statusLabel, onViewDetails, projectColor }: ProjectPriorityCardProps) {
    const overdue = isOverdue(entry.target);
    const status = statusLabel || getStatusLabel(entry);
    const accent = projectColor || DEFAULT_PROJECT_COLOR;

    return (
        <>
            <ProjectInfoHeader entry={entry} onViewDetails={onViewDetails} accentColor={accent} />
            <ProjectMetadataRow entry={entry} />

            {/* Metrics 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3">
                <MetricCell
                    label="Target"
                    value={formatTargetDisplay(entry.target)}
                    icon={<Target className="h-3.5 w-3.5" />}
                    tone={overdue ? "danger" : "default"}
                />
                <MetricCell
                    label="Assignments"
                    value={`${completedAssignments}/${totalAssignments}`}
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Est. Time"
                    value={estimatedHours ? `${estimatedHours}HRS` : "—"}
                    icon={<Hourglass className="h-3.5 w-3.5" />}
                    accentColor={accent}
                />
                <MetricCell
                    label="Status"
                    value={status}
                    icon={<Activity className="h-3.5 w-3.5" />}
                    tone={status === "COMPLETE" ? "success" : overdue ? "danger" : "default"}
                />
            </div>
        </>
    );
}

// ============================================================================
// Shared Sub-components
// ============================================================================

function ProjectInfoHeader({ entry, onViewDetails, accentColor }: { entry: PriorityEntry; onViewDetails?: (entry: PriorityEntry) => void; accentColor?: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    Project/Customer:
                </div>
                <h3
                    className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-0.5 truncate"
                    style={accentColor ? { color: accentColor } : undefined}
                >
                    {entry.customer || entry.pd || "Untitled"}
                </h3>
            </div>
            {onViewDetails && (
                <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-lg text-xs font-medium hidden sm:inline-flex"
                    onClick={() => onViewDetails(entry)}
                >
                    View Details
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
            )}
            {onViewDetails && (
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-8 w-8 rounded-lg sm:hidden"
                    onClick={() => onViewDetails(entry)}
                >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    );
}

function ProjectMetadataRow({ entry }: { entry: PriorityEntry }) {
    const lwcType = useMemo(() => resolveLwcType(entry.lwc), [entry.lwc]);

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
            {entry.cmNumber && (
                <Badge variant="secondary" className="text-[10px] font-mono gap-1 px-1.5 py-0 h-5">
                    CM# {entry.cmNumber}
                </Badge>
            )}
            {entry.pd && (
                <PdNumberField mode="status" value={entry.pd} />
            )}
            {entry.unit && (
                <UnitNumberField mode="status" value={entry.unit} />
            )}
            {lwcType ? (
                <LwcTypeField mode="status" value={lwcType} />
            ) : entry.lwc ? (
                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 h-5">
                    REV: {entry.lwc}
                </Badge>
            ) : null}
        </div>
    );
}

// ============================================================================
// Main Export
// ============================================================================

export function ProjectPriorityCard({
    entry,
    variant = "compact",
    totalAssignments = 18,
    completedAssignments = 0,
    estimatedHours = 95,
    statusLabel,
    onViewDetails,
    projectColor,
    className,
}: ProjectPriorityCardProps) {
    const overdue = isOverdue(entry.target);
    const accent = projectColor || DEFAULT_PROJECT_COLOR;

    const cardProps: ProjectPriorityCardProps = {
        entry,
        variant,
        totalAssignments,
        completedAssignments,
        estimatedHours,
        statusLabel,
        onViewDetails,
        projectColor,
    };

    return (
        <article
            className={cn(
                "relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md",
                overdue && "border-red-300/70 ring-1 ring-red-200/50",
                className,
            )}
        >
            {/* Left accent bar — uses project color */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{
                    backgroundColor: overdue ? undefined : accent,
                }}
            >
                {overdue && <div className="absolute inset-0 bg-red-500 rounded-l-xl" />}
            </div>

            <div className="pl-2">
                {variant === "full" && <FullCard {...cardProps} />}
                {variant === "compact" && <CompactCard {...cardProps} />}
                {variant === "grid" && <GridCard {...cardProps} />}
            </div>
        </article>
    );
}
