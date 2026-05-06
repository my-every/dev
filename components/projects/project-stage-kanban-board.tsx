"use client";

/**
 * ProjectStageKanbanBoard
 *
 * Renders projects as kanban columns based on ASSIGNMENT_STAGES.
 * Used by the "Priority" dashboard sub-view.
 *
 * Each column represents an assignment stage. Projects appear in the column
 * matching their "furthest-behind" active assignment stage. The project card
 * expands to show only the assignments that are currently at that column's stage.
 *
 * For visual clarity, only the key work stages are shown as columns
 * (queue stages are collapsed into their parent work stage column).
 */

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    type AssignmentStageId,
    STAGE_DISPLAY_CONFIG,
} from "@/types/d380-assignment-stages";
import type { ProjectManifest } from "@/types/project-manifest";
import { ProjectKanbanCard, type KanbanAssignment } from "./project-kanban-card";

// ============================================================================
// Types
// ============================================================================

export interface ProjectStageKanbanBoardProps {
    projects: ProjectManifest[];
    selectedProjectId?: string | null;
    onSelectProject?: (project: ProjectManifest) => void;
    className?: string;
}

// ============================================================================
// Visible kanban columns (subset of all 16 stages — key work stages only)
// ============================================================================

interface StageColumn {
    id: AssignmentStageId;
    label: string;
    color: string;
    headerBg: string;
    /** Queue stages that collapse into this column */
    includesQueues: AssignmentStageId[];
}

const STAGE_COLUMNS: StageColumn[] = [
    {
        id: "READY_TO_LAY",
        label: "Ready to Lay",
        color: "bg-slate-400",
        headerBg: "bg-slate-50 dark:bg-slate-900/40",
        includesQueues: [],
    },
    {
        id: "BUILD_UP",
        label: "Build Up",
        color: "bg-amber-400",
        headerBg: "bg-amber-50 dark:bg-amber-950/30",
        includesQueues: [],
    },
    {
        id: "WIRING",
        label: "Wiring",
        color: "bg-purple-400",
        headerBg: "bg-purple-50 dark:bg-purple-950/30",
        includesQueues: ["READY_TO_WIRE"],
    },
    {
        id: "WIRING_IPV",
        label: "Wire Review",
        color: "bg-sky-400",
        headerBg: "bg-sky-50 dark:bg-sky-950/30",
        includesQueues: ["READY_FOR_VISUAL"],
    },
    {
        id: "BOX_BUILD",
        label: "Box Build",
        color: "bg-fuchsia-400",
        headerBg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
        includesQueues: ["READY_TO_HANG"],
    },
    {
        id: "CROSS_WIRE",
        label: "Cross Wire",
        color: "bg-rose-400",
        headerBg: "bg-rose-50 dark:bg-rose-950/30",
        includesQueues: [],
    },
    {
        id: "CROSS_WIRE_IPV",
        label: "Cross Wire Review",
        color: "bg-red-400",
        headerBg: "bg-red-50 dark:bg-red-950/30",
        includesQueues: [],
    },
    {
        id: "TEST_1ST_PASS",
        label: "Test",
        color: "bg-teal-400",
        headerBg: "bg-teal-50 dark:bg-teal-950/30",
        includesQueues: ["READY_TO_TEST"],
    },
    {
        id: "POWER_CHECK",
        label: "Power Check",
        color: "bg-green-400",
        headerBg: "bg-green-50 dark:bg-green-950/30",
        includesQueues: [],
    },
    {
        id: "BIQ",
        label: "BIQ",
        color: "bg-emerald-400",
        headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
        includesQueues: ["READY_FOR_BIQ"],
    },
    {
        id: "FINISHED_BIQ",
        label: "Done",
        color: "bg-emerald-500",
        headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
        includesQueues: [],
    },
];

// ============================================================================
// Helpers
// ============================================================================

/** Resolve a stage to its visible column. */
function resolveColumnId(stageId: AssignmentStageId): AssignmentStageId {
    for (const col of STAGE_COLUMNS) {
        if (col.id === stageId) return col.id;
        if (col.includesQueues.includes(stageId)) return col.id;
    }
    return "READY_TO_LAY";
}

/**
 * For mock purposes, derive a pseudo-stage for each operational sheet.
 * In real usage, MappedAssignment data would provide `selectedStage`.
 */
function deriveSheetStage(
    _sheet: { slug: string; name: string; rowCount: number },
    projectIndex: number,
    sheetIndex: number,
): AssignmentStageId {
    // Deterministic mock distribution based on indices
    const stages: AssignmentStageId[] = [
        "READY_TO_LAY", "BUILD_UP", "WIRING", "WIRING_IPV",
        "BOX_BUILD", "CROSS_WIRE", "TEST_1ST_PASS", "POWER_CHECK", "BIQ", "FINISHED_BIQ",
    ];
    return stages[(projectIndex + sheetIndex) % stages.length];
}

/**
 * Determine a project's "display column" — the furthest-behind active stage.
 */
function getProjectDisplayColumn(
    project: ProjectManifest,
    projectIndex: number,
): AssignmentStageId {
    const sheets = project.sheets.filter(s => s.kind === "operational");
    if (sheets.length === 0) return "READY_TO_LAY";

    // Find the earliest stage across all sheets
    let earliestOrder = Infinity;
    let earliestId: AssignmentStageId = "READY_TO_LAY";

    sheets.forEach((sheet, si) => {
        const stage = deriveSheetStage(sheet, projectIndex, si);
        const config = STAGE_DISPLAY_CONFIG[stage];
        if (config) {
            const order = STAGE_COLUMNS.findIndex(c => c.id === resolveColumnId(stage));
            if (order < earliestOrder) {
                earliestOrder = order;
                earliestId = resolveColumnId(stage);
            }
        }
    });

    return earliestId;
}

/**
 * Build assignment list for a specific column.
 */
function getAssignmentsForColumn(
    project: ProjectManifest,
    columnId: AssignmentStageId,
    projectIndex: number,
): KanbanAssignment[] {
    const col = STAGE_COLUMNS.find(c => c.id === columnId);
    if (!col) return [];

    const matchStages = [col.id, ...col.includesQueues];

    return project.sheets
        .filter(s => s.kind === "operational")
        .map((sheet, si) => {
            const stage = deriveSheetStage(sheet, projectIndex, si);
            return { sheet, stage, si };
        })
        .filter(({ stage }) => matchStages.includes(stage))
        .map(({ sheet, stage }) => ({
            id: sheet.slug,
            sheetName: sheet.name,
            status: stage === "FINISHED_BIQ" ? ("complete" as const) : ("active" as const),
            estimatedHours: sheet.rowCount > 100 ? 12 : sheet.rowCount > 50 ? 8 : 4,
        }));
}

// ============================================================================
// Component
// ============================================================================

export function ProjectStageKanbanBoard({
    projects,
    selectedProjectId,
    onSelectProject,
    className,
}: ProjectStageKanbanBoardProps) {
    // Group projects by their display column
    const columnMap = useMemo(() => {
        const map: Record<string, { project: ProjectManifest; index: number }[]> = {};
        for (const col of STAGE_COLUMNS) {
            map[col.id] = [];
        }
        projects.forEach((project, index) => {
            const colId = getProjectDisplayColumn(project, index);
            map[colId]?.push({ project, index });
        });
        return map;
    }, [projects]);

    return (
        <div className={cn("flex gap-2.5 overflow-x-auto pb-4 h-full", className)}>
            {STAGE_COLUMNS.map(col => {
                const entries = columnMap[col.id] ?? [];

                return (
                    <div
                        key={col.id}
                        className="flex-shrink-0 w-64 min-h-[300px] rounded-xl border border-border/50 bg-card/30 overflow-hidden flex flex-col"
                    >
                        {/* Column header */}
                        <div className={cn("px-3 py-2 border-b border-border/50 flex items-center gap-2", col.headerBg)}>
                            <div className={cn("h-2 w-2 rounded-full shrink-0", col.color)} />
                            <span className="font-semibold text-xs truncate">{col.label}</span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 shrink-0">
                                {entries.length}
                            </Badge>
                        </div>

                        {/* Column body */}
                        <div className="p-1.5 flex flex-col gap-1.5 overflow-y-auto flex-1">
                            {entries.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-xs">
                                    No projects
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {entries.map(({ project, index }) => (
                                        <motion.div
                                            key={project.id}
                                            layout
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <ProjectKanbanCard
                                                project={project}
                                                assignments={getAssignmentsForColumn(project, col.id, index)}
                                                isSelected={project.id === selectedProjectId}
                                                onSelect={() => onSelectProject?.(project)}
                                                compact
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
