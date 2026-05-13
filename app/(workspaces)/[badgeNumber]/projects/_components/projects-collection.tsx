"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
    WorkspaceCollectionView,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionItem,
    type WorkspaceCollectionTab,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import type { KanbanColumnDefinition } from "@/app/(workspaces)/[badgeNumber]/_components/workspace-collection-kanban";
import { getDashboardProjectStatus } from "@/lib/projects/dashboard-status";
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages";
import type { ProjectManifest } from "@/types/project-manifest";
import { ActiveProjectsLWCChart } from "./projects-lwc-chart";
import { ProjectIcon } from "./project-icon";

// Ordered kanban column definitions matching the canonical ASSIGNMENT_STAGES sequence.
// The ID is derived the same way buildKanbanColumns derives it from a label
// (toLowerCase + spaces → hyphens), so they match automatically.
const STAGE_KANBAN_COLUMNS: KanbanColumnDefinition[] = [
    // Projects not yet in any production stage
    { id: "unknown", label: "Unknown" },
    // Per-assignment production stages in order
    ...ASSIGNMENT_STAGES.map((stage) => ({
        id: stage.label.toLowerCase().replace(/\s+/g, "-"),
        label: stage.label,
    })),
];

type ProjectsCollectionProps = {
    badgeNumber: string;
    projects: ProjectManifest[];
    mode?: ViewMode;
};

export function ProjectsCollection({
    badgeNumber,
    projects,
    mode = "default",
}: ProjectsCollectionProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const openProjectIdFromUrl = searchParams.get("openProjectId");

    // Redirect legacy ?openProjectId=X links to the project page
    useEffect(() => {
        if (!openProjectIdFromUrl) {
            return;
        }

        const projectExists = projects.some((project) => project.id === openProjectIdFromUrl);
        if (projectExists) {
            router.replace(`/${badgeNumber}/projects/${encodeURIComponent(openProjectIdFromUrl)}`);
        }
    }, [openProjectIdFromUrl, projects, badgeNumber, router]);

    // Build tabs and filters from all projects for comprehensive filtering
    const tabs = buildTabs(projects);
    const filters = buildFilters(projects);

    // Create items from all projects with enhanced metadata
    const items: WorkspaceCollectionItem[] = projects.map((project) => {
        const status = getDashboardProjectStatus(project);
        const operationalSheets = (project.sheets ?? []).filter(
            (sheet) => sheet.kind === "operational" && sheet.hasData
        ).length;
        const totalAssignments = project.aggregates?.totalAssignments ?? 0;
        const progress = project.aggregates?.overallProgress ?? 0;
        const dueDate = project.dueDate ? new Date(project.dueDate) : null;
        const formattedDueDate = formatDueDate(dueDate);
        const dueMonth = dueDate
            ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`
            : "unscheduled";
        const dominantStageId = deriveDominantStage(project);
        // Resolve to the canonical label so buildKanbanColumns and STAGE_KANBAN_COLUMNS agree
        const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === dominantStageId);
        const dominantStageLabel = stageDef?.label ?? normalizeLabel(dominantStageId);

        return {
            id: project.id,
            // category drives kanban column grouping
           
            thumbnail: (
                <ProjectIcon
                    name={project.name}
                    color={project.color ?? undefined}
                    interactive={false}
                    size="sm"
                />
            ),
            title: project.name,
            subtitle: [
                project.pdNumber,
                project.unitNumber ? `Unit ${project.unitNumber}` : null,
            ]
                .filter(Boolean)
                .join(" • "),
            metadata: [
                { label: "Stage", value: normalizeLabel(status) },
                { label: "LWC", value: project.lwcType || "—" },
                { label: "Due", value: formattedDueDate },
                { label: "Projects", value: `${totalAssignments}` },
                { label: "Progress", value: `${progress}%` },
            ],
            searchText: [
                project.id,
                project.name,
                project.pdNumber,
                project.unitNumber,
                project.filename,
                project.lwcType,
                status,
                formattedDueDate,
            ]
                .filter(Boolean)
                .join(" "),
            filterValues: {
                tab: status,
                status: status,
                lwc: project.lwcType || "unknown",
                month: dueMonth,
                stage: dominantStageId,
            },
            href: `/${badgeNumber}/projects/${encodeURIComponent(project.id)}`,
        };
    });

    const chartProjects = projects
        .map((project) => ({
            lwcType: project.lwcType ?? null,
            dueDate: project.dueDate ?? null,
            status: getDashboardProjectStatus(project),
        }));

    return (
        <div className="w-full max-w-full space-y-2 overflow-hidden sm:space-y-3 md:space-y-4">
            <ActiveProjectsLWCChart projects={chartProjects} />
            <WorkspaceCollectionView
                items={items}
                mode={mode}
                filters={filters}
                searchPlaceholder="Search projects by name, PD number, unit, or LWC type..."
                detailMode="route"
                kanbanColumnDefinitions={STAGE_KANBAN_COLUMNS}
            />
        </div>
    );
}

function buildTabs(projects: ProjectManifest[]): WorkspaceCollectionTab[] {
    const counts = new Map<string, number>();
    projects.forEach((project) => {
        const status = getDashboardProjectStatus(project);
        counts.set(status, (counts.get(status) ?? 0) + 1);
    });

    // Sort tabs with meaningful order: pending, active, complete, then alphabetical
    const tabOrder = ["pending", "active", "complete"];
    const sortedStatuses = Array.from(counts.keys()).sort((a, b) => {
        const aIndex = tabOrder.indexOf(a);
        const bIndex = tabOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    return [
        { id: "all", label: "All", count: projects.length },
        ...sortedStatuses.map((status) => ({
            id: status,
            label: normalizeLabel(status),
            count: counts.get(status) ?? 0,
        })),
    ];
}

function buildFilters(projects: ProjectManifest[]): WorkspaceCollectionFilterDefinition[] {
    const lwcTypes = new Set<string>();
    const statuses = new Set<string>();
    const months = new Set<string>();
    const stages = new Set<string>();

    projects.forEach((project) => {
        lwcTypes.add(project.lwcType || "unknown");
        statuses.add(getDashboardProjectStatus(project));
        const dueDate = project.dueDate ? new Date(project.dueDate) : null;
        if (dueDate) {
            months.add(`${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`);
        } else {
            months.add("unscheduled");
        }
        stages.add(deriveDominantStage(project));
    });

    return [
        {
            id: "status",
            label: "Status",
            options: Array.from(statuses)
                .sort((a, b) => {
                    const order = ["pending", "active", "complete"];
                    const aIndex = order.indexOf(a);
                    const bIndex = order.indexOf(b);
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.localeCompare(b);
                })
                .map((value) => ({ value, label: normalizeLabel(value) })),
        },
        {
            id: "lwc",
            label: "LWC Type",
            options: Array.from(lwcTypes)
                .sort()
                .map((value) => ({ value, label: normalizeLabel(value) })),
        },
        {
            id: "month",
            label: "Due Month",
            options: Array.from(months)
                .sort()
                .map((value) => ({
                    value,
                    label: value === "unscheduled" ? "Unscheduled" : formatMonthLabel(value),
                })),
        },
        {
            id: "stage",
            label: "Stage",
            options: Array.from(stages)
                .sort((a, b) => {
                    // Sort by canonical ASSIGNMENT_STAGES order; unknowns go last
                    const aOrder = ASSIGNMENT_STAGES.findIndex((s) => s.id === a);
                    const bOrder = ASSIGNMENT_STAGES.findIndex((s) => s.id === b);
                    if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
                    if (aOrder !== -1) return -1;
                    if (bOrder !== -1) return 1;
                    return normalizeLabel(a).localeCompare(normalizeLabel(b));
                })
                .map((value) => {
                    const def = ASSIGNMENT_STAGES.find((s) => s.id === value);
                    return { value, label: def?.label ?? normalizeLabel(value) };
                }),
        },
    ];
}

function deriveDominantStage(project: ProjectManifest): string {
    const stageCounts = project.aggregates?.stageCounts;
    if (!stageCounts) return "unknown";

    let dominant: string = "unknown";
    let maxCount = 0;

    Object.entries(stageCounts).forEach(([stage, count]) => {
        const numericCount = Number(count ?? 0);
        if (numericCount > maxCount) {
            dominant = stage;
            maxCount = numericCount;
        }
    });

    return dominant;
}

function formatMonthLabel(monthValue: string): string {
    const date = new Date(`${monthValue}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return monthValue;
    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
    }).format(date);
}

function normalizeLabel(value: string): string {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Format due date as a human-readable string with relative dates for dates within 30 days
 * Examples: "Due in 3 days", "Overdue by 2 days", "Due Jan 15", "—"
 */
function formatDueDate(date: Date | null): string {
    if (!date) return "—";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Relative dates for dates within 30 days
    if (Math.abs(daysUntil) <= 30) {
        if (daysUntil === 0) return "Due today";
        if (daysUntil === 1) return "Due tomorrow";
        if (daysUntil === -1) return "Overdue 1 day";
        if (daysUntil > 1) return `Due in ${daysUntil} days`;
        if (daysUntil < -1) return `Overdue ${Math.abs(daysUntil)} days`;
    }

    // Standard date format for dates beyond 30 days
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
    }).format(date);
}
