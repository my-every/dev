"use client";

/**
 * ProjectKanbanCard
 *
 * Accordion-style project card for kanban board views.
 * Collapsed: shows project summary (name, PD#, unit, revision, progress).
 * Expanded: lists assignments in this kanban column / stage.
 */

import { useState, useCallback } from "react";
import {
    ChevronDown,
    FileSpreadsheet,
    Layers,
    Calendar,
    ExternalLink,
    User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";

// ============================================================================
// Types
// ============================================================================

export interface KanbanAssignment {
    id: string;
    sheetName: string;
    status: "queued" | "active" | "blocked" | "complete";
    assignees?: string[];
    estimatedHours?: number;
    elapsedHours?: number;
}

export interface ProjectKanbanCardProps {
    project: ProjectManifest;
    /** Assignments to display when expanded */
    assignments?: KanbanAssignment[];
    isSelected?: boolean;
    onSelect?: () => void;
    /** Show expand toggle (default true) */
    expandable?: boolean;
    /** Compact variant for smaller columns */
    compact?: boolean;
    className?: string;
}

// ============================================================================
// Status pill colors
// ============================================================================

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    queued: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
    active: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400" },
    blocked: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400" },
    complete: { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-600 dark:text-emerald-400" },
};

// ============================================================================
// Component
// ============================================================================

export function ProjectKanbanCard({
    project,
    assignments = [],
    isSelected,
    onSelect,
    expandable = true,
    compact,
    className,
}: ProjectKanbanCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const sheetCount = project.sheets.length;
    const operationalCount = project.sheets.filter(s => s.kind === "operational").length;
    const projectColor = project.color || "#ffcc61";
    const lwcConfig = project.lwcType
        ? LWC_TYPE_REGISTRY[project.lwcType]
        : null;

    const handleToggle = useCallback(() => {
        if (expandable && assignments.length > 0) {
            setIsExpanded(prev => !prev);
        }
        onSelect?.();
    }, [expandable, assignments.length, onSelect]);

    const activeCount = assignments.filter(a => a.status === "active").length;
    const blockedCount = assignments.filter(a => a.status === "blocked").length;
    const completeCount = assignments.filter(a => a.status === "complete").length;

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-200 cursor-pointer",
                "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm",
                "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700",
                isSelected && "ring-2 ring-offset-0",
                className,
            )}
            style={{
                ...(isSelected ? { "--tw-ring-color": projectColor } as React.CSSProperties : {}),
            }}
            onClick={handleToggle}
        >
            {/* Color accent bar */}
            <div
                className="h-full w-1 rounded-r-sm absolute top-0 left-0"
                style={{ backgroundColor: projectColor }}
            />

            <CardHeader className={cn("pb-1 pl-4", compact ? "pt-2 pr-2" : "pt-2.5 pr-3")}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                            className="rounded-md p-1 shrink-0 flex items-center justify-center"
                            style={{
                                backgroundColor: `${projectColor}15`,
                                border: `1px solid ${projectColor}30`,
                            }}
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: projectColor }} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold truncate leading-tight">
                                    {project.name}
                                </span>
                                {lwcConfig && (
                                    <div
                                        className="h-1.5 w-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: lwcConfig.dotColor }}
                                        title={lwcConfig.label}
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-muted-foreground font-mono truncate">
                                    {project.pdNumber || project.filename}
                                    {project.unitNumber && ` / Unit ${project.unitNumber}`}
                                </span>
                                {project.revision && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono border-slate-300 dark:border-slate-700">
                                        Rev {project.revision}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {assignments.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {assignments.length}
                            </Badge>
                        )}
                        {expandable && assignments.length > 0 && (
                            <ChevronDown
                                className={cn(
                                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                    isExpanded && "rotate-180"
                                )}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className={cn("pt-0 pl-4", compact ? "pb-1.5 pr-2" : "pb-2 pr-3")}>
                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-1 mb-1">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4.5 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium rounded border-0">
                        <Layers className="h-2.5 w-2.5 mr-0.5 opacity-70" />
                        {operationalCount} sheets
                    </Badge>
                    {activeCount > 0 && (
                        <Badge className="text-[10px] px-1 py-0 h-4.5 font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
                            {activeCount} active
                        </Badge>
                    )}
                    {blockedCount > 0 && (
                        <Badge className="text-[10px] px-1 py-0 h-4.5 font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">
                            {blockedCount} blocked
                        </Badge>
                    )}
                </div>

                {/* Date row */}
                {(project.dueDate || project.planConlayDate) && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                        {project.dueDate && (
                            <span className="flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                Due {new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                        )}
                        {project.planConlayDate && (
                            <span className="flex items-center gap-0.5">
                                ConLay {new Date(project.planConlayDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Accordion content — assignment list */}
            <AnimatePresence initial={false}>
                {isExpanded && assignments.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-t border-slate-100 dark:border-slate-800 mx-3 pt-2 pb-2 space-y-1">
                            {assignments.map((assignment, index) => {
                                const style = STATUS_STYLES[assignment.status] ?? STATUS_STYLES.queued;
                                return (
                                    <div
                                        key={assignment.id || `assignment-${index}`}
                                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[12px] font-medium truncate block">
                                                {assignment.sheetName}
                                            </span>
                                            {assignment.assignees && assignment.assignees.length > 0 && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                                    <User className="h-2.5 w-2.5" />
                                                    {assignment.assignees.join(", ")}
                                                </span>
                                            )}
                                        </div>
                                        <Badge
                                            className={cn(
                                                "text-[9px] px-1.5 py-0 h-4 font-medium rounded border-0 shrink-0",
                                                style.bg,
                                                style.text,
                                            )}
                                        >
                                            {assignment.status}
                                        </Badge>
                                    </div>
                                );
                            })}

                            {/* Link to full project */}
                            <div className="pt-1">
                                <Button variant="ghost" size="sm" className="w-full justify-center gap-1 h-6 text-[11px] text-muted-foreground" asChild>
                                    <Link href={`/projects/${project.id}`}>
                                        <ExternalLink className="h-3 w-3" />
                                        Open Project
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
