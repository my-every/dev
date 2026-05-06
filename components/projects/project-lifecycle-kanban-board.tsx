"use client";

/**
 * ProjectLifecycleKanbanBoard
 *
 * Renders projects as kanban columns based on PROJECT_LIFECYCLE_GATES.
 * Used by the "Upcoming" dashboard sub-view.
 *
 * Columns:
 *   LEGALS_READY → BRANDLIST_COMPLETE → BRANDING_READY → KITTING_READY → Active
 *
 * Each project card is an accordion that expands to show assignment list.
 */

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROJECT_LIFECYCLE_GATES, type ProjectLifecycleGateId } from "@/types/d380-assignment-stages";
import type { ProjectManifest } from "@/types/project-manifest";
import { ProjectKanbanCard, type KanbanAssignment } from "./project-kanban-card";

// ============================================================================
// Types
// ============================================================================

export interface ProjectLifecycleKanbanBoardProps {
    projects: ProjectManifest[];
    selectedProjectId?: string | null;
    onSelectProject?: (project: ProjectManifest) => void;
    className?: string;
}

// ============================================================================
// Gate column colors
// ============================================================================

const GATE_COLORS: Record<string, { header: string; dot: string }> = {
    LEGALS_READY: { header: "bg-red-50 dark:bg-red-950/30", dot: "bg-red-400" },
    BRANDLIST_COMPLETE: { header: "bg-orange-50 dark:bg-orange-950/30", dot: "bg-orange-400" },
    BRANDING_READY: { header: "bg-yellow-50 dark:bg-yellow-950/30", dot: "bg-yellow-500" },
    KITTING_READY: { header: "bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-400" },
    ACTIVE: { header: "bg-emerald-50 dark:bg-emerald-950/30", dot: "bg-emerald-400" },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive the current lifecycle gate for a project.
 * Looks at `lifecycleGates` on ProjectModel, or derives from status field.
 */
function getProjectGateColumn(project: ProjectManifest): ProjectLifecycleGateId | "ACTIVE" {
    const gates = project.lifecycleGates;
    if (gates && gates.length > 0) {
        // Find the first incomplete gate — that's the current column
        for (const gate of PROJECT_LIFECYCLE_GATES) {
            const state = gates.find(g => g.gateId === gate.id);
            if (!state || state.status !== "COMPLETE") {
                return gate.id;
            }
        }
        return "ACTIVE"; // All gates complete
    }

    // Fallback: derive from status field
    const status = project.status;
    switch (status) {
        case "legals_pending": return "LEGALS_READY";
        case "brandlist": return "BRANDLIST_COMPLETE";
        case "branding": return "BRANDING_READY";
        case "kitting": return "KITTING_READY";
        case "active":
        case "completed":
        case "shipped":
            return "ACTIVE";
        default:
            return "LEGALS_READY"; // Default for projects without status
    }
}

/**
 * Build mock assignments list for a project.
 * In the real implementation, this would come from assignment mapping data.
 */
function getProjectAssignments(project: ProjectManifest): KanbanAssignment[] {
    return project.sheets
        .filter(s => s.kind === "operational")
        .map(sheet => ({
            id: sheet.id,
            sheetName: sheet.name,
            status: "queued" as const,
            estimatedHours: sheet.rowCount > 100 ? 12 : sheet.rowCount > 50 ? 8 : 4,
        }));
}

// ============================================================================
// Column definition
// ============================================================================

interface KanbanColumn {
    id: string;
    label: string;
    shortLabel: string;
    description: string;
}

const COLUMNS: KanbanColumn[] = [
    ...PROJECT_LIFECYCLE_GATES.map(gate => ({
        id: gate.id,
        label: gate.label,
        shortLabel: gate.shortLabel,
        description: gate.description,
    })),
    {
        id: "ACTIVE",
        label: "Active",
        shortLabel: "Active",
        description: "All gates complete — assignments in progress",
    },
];

// ============================================================================
// Component
// ============================================================================

export function ProjectLifecycleKanbanBoard({
    projects,
    selectedProjectId,
    onSelectProject,
    className,
}: ProjectLifecycleKanbanBoardProps) {
    // Group projects by gate column
    const columnMap = useMemo(() => {
        const map: Record<string, ProjectManifest[]> = {};
        for (const col of COLUMNS) {
            map[col.id] = [];
        }
        for (const project of projects) {
            const colId = getProjectGateColumn(project);
            if (map[colId]) {
                map[colId].push(project);
            } else {
                map["LEGALS_READY"]?.push(project);
            }
        }
        return map;
    }, [projects]);

    return (
        <div className={cn("flex gap-3 overflow-x-auto pb-4 h-full", className)}>
            {COLUMNS.map(col => {
                const colProjects = columnMap[col.id] ?? [];
                const colors = GATE_COLORS[col.id] ?? GATE_COLORS.ACTIVE;

                return (
                    <div
                        key={col.id}
                        className="flex-shrink-0 w-72 min-h-[300px] rounded-xl border border-border/50 bg-card/30 overflow-hidden flex flex-col"
                    >
                        {/* Column header */}
                        <div
                            className={cn("px-3 py-2.5 border-b border-border/50 flex items-center gap-2", colors.header)}
                        >
                            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                            <span className="font-semibold text-xs truncate">{col.label}</span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 shrink-0">
                                {colProjects.length}
                            </Badge>
                        </div>

                        {/* Column body */}
                        <div className="p-2 flex flex-col gap-2 overflow-y-auto flex-1">
                            {colProjects.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-xs">
                                    No projects
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {colProjects.map(project => (
                                        <motion.div
                                            key={project.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <ProjectKanbanCard
                                                project={project}
                                                assignments={getProjectAssignments(project)}
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
