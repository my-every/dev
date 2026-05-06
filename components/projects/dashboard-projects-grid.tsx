"use client";

/**
 * Dashboard Projects Grid
 *
 * A self-contained projects overview for embedding inside dashboard pages.
 * Consumes from ProjectContext, renders the same project cards as the
 * main /projects page, and exposes an onSelectProject callback so
 * the host dashboard can show project details in an aside panel.
 */

import { useState, useMemo, useCallback } from "react";
import {
    FileSpreadsheet,
    Layers,
    Calendar,
    Search,
    LayoutGrid,
    Kanban,
    SlidersHorizontal,
    Clock,
    Trash2,
    Plus,
    Upload,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectContext } from "@/contexts/project-context";
import type { ProjectManifest } from "@/types/project-manifest";
import { useLayoutUI } from "@/components/layout/layout-context";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import { ProjectStageKanbanBoard } from "./project-stage-kanban-board";
import { CreateProjectDialog } from "./create-project-dialog";
import { getDashboardProjectStatus, hasUploadedLegals } from "@/lib/projects/dashboard-status";

// ============================================================================
// Types
// ============================================================================

export type ProjectSubView = "overview" | "upcoming" | "priority" | "blocked" | "completed";

export interface DashboardProjectsGridProps {
    /** Called when a project card is clicked — parent can use for aside */
    onSelectProject?: (project: ProjectManifest | null) => void;
    /** Currently selected project id (highlights the card) */
    selectedProjectId?: string | null;
    /** Active sub-view from side nav */
    activeSubItem?: ProjectSubView | string | null;
}

// ============================================================================
// Compact Project Card (dashboard variant)
// ============================================================================

interface DashboardProjectCardProps {
    project: ProjectManifest;
    isSelected: boolean;
    onSelect: () => void;
    index: number;
}

function DashboardProjectCard({ project, isSelected, onSelect, index }: DashboardProjectCardProps) {
    const sheetCount = project.sheets.length;
    const operationalCount = project.sheets.filter(s => s.kind === "operational").length;
    const referenceCount = project.sheets.filter(s => s.kind === "reference").length;
    const totalRows = project.sheets.reduce((sum, s) => sum + s.rowCount, 0);
    const createdDate = new Date(project.createdAt).toLocaleDateString();
    const projectColor = project.color || "#ffcc61";
    const hasLegals = hasUploadedLegals(project);

    const lwcConfig = project.lwcType
        ? LWC_TYPE_REGISTRY[project.lwcType]
        : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.04 }}
            className="relative rounded-xl"
        >
            <Card
                className={`
          group relative overflow-hidden transition-all duration-200 cursor-pointer
          bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm
          hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5
          ${isSelected ? "ring-2 ring-offset-0" : ""}
        `}
                style={{
                    ...(isSelected ? { "--tw-ring-color": projectColor } as React.CSSProperties : {}),
                }}
                onClick={onSelect}
            >
                <CardHeader className="pb-1 pt-2.5">
                    <div className="flex items-start justify-between gap-4 text-card-foreground">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                                className="rounded-md p-1.5 shrink-0 flex items-center justify-center shadow-sm"
                                style={{
                                    backgroundColor: `${projectColor}15`,
                                    border: `1px solid ${projectColor}30`,
                                }}
                            >
                                <FileSpreadsheet className="h-4 w-4" style={{ color: projectColor }} strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <CardTitle className="text-[13px] font-semibold truncate text-foreground leading-tight">
                                        {project.name}
                                    </CardTitle>
                                    {lwcConfig && (
                                        <div
                                            className="h-1.5 w-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: lwcConfig.dotColor }}
                                            title={lwcConfig.label}
                                        />
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <CardDescription className="text-[11px] truncate text-muted-foreground">
                                        {project.pdNumber && (
                                            <span className="font-mono">{project.pdNumber}</span>
                                        )}
                                        {project.pdNumber && project.unitNumber && " / "}
                                        {project.unitNumber && (
                                            <span>Unit {project.unitNumber}</span>
                                        )}
                                        {!project.pdNumber && !project.unitNumber && project.filename}
                                    </CardDescription>
                                    {project.revision && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono border-slate-300 dark:border-slate-700">
                                            Rev {project.revision}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 pb-2 px-4">
                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      
                   
                     
                        {hasLegals && (
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 font-medium rounded">
                                Legals uploaded
                            </Badge>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 opacity-60" />
                                <span>{createdDate}</span>
                            </div>
                            {project.dueDate && (
                                <div className="flex items-center gap-1" title="Due date">
                                    <span className="text-muted-foreground/70">Due:</span>
                                    <span className="font-medium text-foreground/80">
                                        {new Date(project.dueDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <span className="tabular-nums font-medium text-muted-foreground/80">{totalRows.toLocaleString()} rows</span>
                    </div>
                </CardContent>
            </Card>

            {/* Color accent bar */}
            <div
                className="h-8 w-1 rounded-xl absolute top-4 left-0"
                style={{ backgroundColor: projectColor }}
            />
        </motion.div>
    );
}

// ============================================================================
// List Item (Upcoming / Completed / Blocked views)
// ============================================================================

interface DashboardProjectListItemProps {
    project: ProjectManifest;
    isSelected: boolean;
    onSelect: () => void;
    index: number;
    variant: "upcoming" | "priority" | "blocked" | "completed";
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    legals_pending: { label: "Awaiting Legals", className: "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30" },
    brandlist: { label: "BrandList", className: "text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950/30" },
    branding: { label: "Branding", className: "text-purple-600 border-purple-300 bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:bg-purple-950/30" },
    kitting: { label: "Kitting", className: "text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/30" },
    active: { label: "Active", className: "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30" },
    blocked: { label: "Blocked", className: "text-red-600 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950/30" },
    completed: { label: "Completed", className: "text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30" },
    shipped: { label: "Shipped", className: "text-slate-600 border-slate-300 bg-slate-50 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900/30" },
};

function DashboardProjectListItem({ project, isSelected, onSelect, index, variant }: DashboardProjectListItemProps) {
    const model = project;
    const projectColor = model.color || "#ffcc61";
    const lwcConfig = model.lwcType ? LWC_TYPE_REGISTRY[model.lwcType] : null;
    const effectiveStatus = getDashboardProjectStatus(model);
    const statusCfg = STATUS_CONFIG[effectiveStatus];

    // Slot / target dates from lifecycle gates
    const legalsGate = model.lifecycleGates?.find(g => g.gateId === "LEGALS_READY");
    const slotDate = legalsGate?.targetDate
        ?? (model.dueDate ? (model.dueDate instanceof Date ? model.dueDate.toISOString() : String(model.dueDate)) : null);

    const sheetCount = model.sheets.length;
    const hasLegals = hasUploadedLegals(model);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ delay: index * 0.025 }}
        >
            <div
                className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer
                    transition-all duration-150
                    ${isSelected
                        ? "bg-accent/60 border-primary/30 shadow-sm"
                        : "bg-card/60 border-border/40 hover:bg-accent/30 hover:border-border/60"
                    }
                `}
                onClick={onSelect}
            >
                {/* Color accent */}
                <div
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: projectColor }}
                />

                {/* Project identity */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{project.name}</span>
                        {lwcConfig && (
                            <div
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: lwcConfig.dotColor }}
                                title={lwcConfig.label}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {model.pdNumber && (
                            <span className="text-[11px] font-mono text-muted-foreground">{model.pdNumber}</span>
                        )}
                        {model.pdNumber && model.unitNumber && (
                            <span className="text-[11px] text-muted-foreground/50">/</span>
                        )}
                        {model.unitNumber && (
                            <span className="text-[11px] text-muted-foreground">Unit {model.unitNumber}</span>
                        )}
                        {model.revision && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono border-slate-300 dark:border-slate-700">
                                Rev {model.revision}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* View-specific indicators */}
                {variant === "upcoming" && (
                    <div className="flex items-center gap-2.5 shrink-0">
                        {!hasLegals ? (
                            <div className="flex items-center gap-1 text-amber-500">
                                <Upload className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-medium">No legals</span>
                            </div>
                        ) : (
                            <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                                {sheetCount} sheets
                            </Badge>
                        )}
                        {slotDate ? (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Slot date">
                                <Calendar className="h-3 w-3 opacity-60" />
                                <span className="tabular-nums">
                                    {new Date(slotDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-muted-foreground/60 italic">No slot</span>
                        )}
                    </div>
                )}

                {variant === "priority" && (
                    <div className="flex items-center gap-2 shrink-0">
                        {sheetCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                                {model.sheets.filter(s => s.kind === "operational").length} active
                            </Badge>
                        )}
                        {statusCfg && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 h-4.5 ${statusCfg.className}`}>
                                {statusCfg.label}
                            </Badge>
                        )}
                    </div>
                )}

                {variant === "blocked" && (
                    <div className="flex items-center gap-1.5 shrink-0 text-red-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Blocked</span>
                    </div>
                )}

                {variant === "completed" && (
                    <div className="flex items-center gap-1.5 shrink-0 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">
                            {effectiveStatus === "shipped" ? "Shipped" : "Done"}
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// Dashboard Projects Grid
// ============================================================================

export function DashboardProjectsGrid({
    onSelectProject,
    selectedProjectId,
    activeSubItem = "overview",
}: DashboardProjectsGridProps) {
    const { allProjects, isLoading } = useProjectContext();
    const { openAside, closeAside, isAsideOpen } = useLayoutUI();

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "name" | "sheets">("recent");
    const [viewMode, setViewMode] = useState<"grid" | "kanban">("grid");

    const filteredProjects = useMemo(() => {
        let projects = [...allProjects];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            projects = projects.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.filename.toLowerCase().includes(query) ||
                (p.pdNumber?.toLowerCase().includes(query))
            );
        }

        switch (sortBy) {
            case "name":
                projects.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "sheets":
                projects.sort((a, b) => b.sheets.length - a.sheets.length);
                break;
            case "recent":
            default:
                projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return projects;
    }, [allProjects, searchQuery, sortBy]);

    // Sub-view filtered projects
    const subViewProjects = useMemo(() => {
        switch (activeSubItem) {
            case "upcoming":
                return filteredProjects.filter((p) => !hasUploadedLegals(p));
            case "priority":
                return filteredProjects.filter(p => {
                    const s = getDashboardProjectStatus(p);
                    return s === "brandlist" || s === "branding" || s === "kitting" || s === "active";
                });
            case "blocked":
                return filteredProjects.filter((p) => getDashboardProjectStatus(p) === "blocked");
            case "completed":
                return filteredProjects.filter((p) => {
                    const status = getDashboardProjectStatus(p);
                    return status === "completed" || status === "shipped";
                });
            default:
                return filteredProjects;
        }
    }, [filteredProjects, activeSubItem]);

    const handleSelect = useCallback((project: ProjectManifest) => {
        if (selectedProjectId === project.id && isAsideOpen) {
            onSelectProject?.(null);
            closeAside();
            return;
        }
        onSelectProject?.(project);
        openAside();
    }, [onSelectProject, selectedProjectId, isAsideOpen, openAside, closeAside]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-1">
                <div className="flex gap-3">
                    <Skeleton className="h-9 flex-1 max-w-xs" />
                    <Skeleton className="h-9 w-24" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-36 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 flex-1 h-full">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-card/50 border-border/50 focus:bg-card h-9"
                        />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex rounded-lg border border-border/50 overflow-hidden bg-card/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`rounded-none px-2.5 h-9 ${viewMode === "grid" ? "bg-accent" : ""}`}
                            onClick={() => setViewMode("grid")}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`rounded-none px-2.5 h-9 ${viewMode === "kanban" ? "bg-accent" : ""}`}
                            onClick={() => setViewMode("kanban")}
                        >
                            <Kanban className="h-4 w-4" />
                        </Button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 bg-card/50 border-border/50 h-9">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                {sortBy === "recent" ? "Recent" : sortBy === "name" ? "Name" : "Sheets"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSortBy("recent")}>
                                <Clock className="mr-2 h-4 w-4" />
                                Most Recent
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("name")}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Project Name
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("sheets")}>
                                <Layers className="mr-2 h-4 w-4" />
                                Sheet Count
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

             
            </div>

            {/* Content */}
            {allProjects.length === 0 ? (
                <Card className="border-dashed border-border/50 bg-card/30">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                        <div className="text-center max-w-md">
                            <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Create a project or upload an Excel workbook to get started.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <CreateProjectDialog />
                            <Link href="/projects/upload">
                                <Button size="sm" variant="outline" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Upload Legals
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : activeSubItem === "upcoming" || activeSubItem === "blocked" || activeSubItem === "completed" ? (
                /* List views — upcoming / blocked / completed */
                subViewProjects.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-muted-foreground text-sm">
                            {activeSubItem === "upcoming"
                                ? "No upcoming projects awaiting legals."
                                : activeSubItem === "blocked"
                                    ? "No blocked projects."
                                    : "No completed projects yet."
                            }
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between px-1 pb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                {subViewProjects.length} {subViewProjects.length === 1 ? "project" : "projects"}
                            </span>
                        </div>
                        <AnimatePresence mode="popLayout">
                            {subViewProjects.map((project, index) => (
                                <DashboardProjectListItem
                                    key={project.id}
                                    project={project}
                                    isSelected={project.id === selectedProjectId}
                                    onSelect={() => handleSelect(project)}
                                    index={index}
                                    variant={activeSubItem as "upcoming" | "blocked" | "completed"}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )
            ) : activeSubItem === "priority" ? (
                /* Assignment stage kanban board */
                subViewProjects.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-muted-foreground text-sm">No active projects in progress.</p>
                    </div>
                ) : (
                    <ProjectStageKanbanBoard
                        projects={subViewProjects}
                        selectedProjectId={selectedProjectId}
                        onSelectProject={handleSelect}
                    />
                )
            ) : subViewProjects.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No projects match your search.</p>
                    {searchQuery && (
                        <Button variant="link" size="sm" onClick={() => setSearchQuery("")}>
                            Clear search
                        </Button>
                    )}
                </div>
            ) : viewMode === "kanban" ? (
                <div className="flex gap-3 overflow-x-auto pb-4 h-full">
                    {Object.values(LWC_TYPE_REGISTRY).map((lwcConfig) => {
                        const lwcProjects = subViewProjects.filter(
                            (p) => p.lwcType === lwcConfig.id
                        );
                        return (
                            <div
                                key={lwcConfig.id}
                                className="shrink-0 w-72 min-h-[300px] rounded-xl border border-border/50 bg-card/30 overflow-hidden"
                            >
                                <div
                                    className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2"
                                    style={{ backgroundColor: `${lwcConfig.dotColor}10` }}
                                >
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lwcConfig.dotColor }} />
                                    <span className="font-semibold text-xs">{lwcConfig.label}</span>
                                    <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                        {lwcProjects.length}
                                    </Badge>
                                </div>
                                <div className="p-2 flex flex-col gap-2  overflow-y-auto">
                                    {lwcProjects.length === 0 ? (
                                        <div className="text-center py-6 text-muted-foreground text-xs">No projects</div>
                                    ) : (
                                        <AnimatePresence mode="popLayout">
                                            {lwcProjects.map((project, index) => (
                                                <DashboardProjectCard
                                                    key={project.id}
                                                    project={project}
                                                    isSelected={project.id === selectedProjectId}
                                                    onSelect={() => handleSelect(project)}
                                                    index={index}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Grid View */
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {subViewProjects.map((project, index) => (
                            <DashboardProjectCard
                                key={project.id}
                                project={project}
                                isSelected={project.id === selectedProjectId}
                                onSelect={() => handleSelect(project)}
                                index={index}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
