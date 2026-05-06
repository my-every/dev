"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import type {
  LegalDrawingsLibraryManifest,
  LegalProjectRecord,
} from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";
import { useSession } from "@/hooks/use-session";
import { useWorkspaceAccess } from "../../layout";

import {
  ScheduleSidePanelNav,
  ScheduleContent,
  type ScheduleProjectItem,
} from "./_components";

type ScheduleWorkspacePageProps = {
  params: Promise<{
    badgeNumber: string;
  }>;
};

type LoadState = "loading" | "ready";

type ProjectsResponse = {
  manifests?: ProjectManifest[];
};

export default function ScheduleWorkspacePage({
  params: paramsPromise,
}: ScheduleWorkspacePageProps) {
  const params = use(paramsPromise);
  const { user } = useSession();
  const { hasAccess, dashboardAccess } = useWorkspaceAccess();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [legalProjects, setLegalProjects] = useState<LegalProjectRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [selectedProject, setSelectedProject] = useState<ScheduleProjectItem | null>(null);

  // Manual refresh handler for project creation callback
  const refreshData = useCallback(async () => {
    setState("loading");
    try {
      const [projectsResponse, legalResponse] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/legal-drawings", { cache: "no-store" }),
      ]);
      const [payload, legalPayload] = await Promise.all([
        projectsResponse.ok
          ? ((await projectsResponse.json()) as ProjectsResponse)
          : { manifests: [] },
        legalResponse.ok
          ? ((await legalResponse.json()) as LegalDrawingsLibraryManifest)
          : { projects: [], generatedAt: new Date().toISOString() },
      ]);
      const nextProjects = (payload.manifests ?? []).sort((left, right) => {
        const pdCompare = left.pdNumber.localeCompare(right.pdNumber);
        if (pdCompare !== 0) return pdCompare;
        return (left.unitNumber || "").localeCompare(right.unitNumber || "");
      });
      setProjects(nextProjects);
      setLegalProjects(legalPayload.projects ?? []);
      setState("ready");
    } catch (error) {
      console.error("[v0] Failed to refresh schedule data:", error);
      setState("ready");
    }
  }, []);

  // Initial load only - no auto-refresh
  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // User settings are now provided via useWorkspaceAccess context

  const mode = state === "loading" ? "skeleton" : "dynamic";
  
  const commandSearchGroups = useMemo<CommandSearchGroup[]>(
    () => [
      {
        heading: "Workspace",
        items: [
          {
            id: "workspace-home",
            label: "Workspace Home",
            href: `/${params.badgeNumber}`,
            keywords: ["workspace", "home"],
          },
          {
            id: "schedule-root",
            label: "Schedule",
            href: `/${params.badgeNumber}/schedule`,
            keywords: ["schedule", "legals", "planning"],
          },
          {
            id: "projects-root",
            label: "Projects",
            href: `/${params.badgeNumber}/projects`,
            keywords: ["projects", "manifests", "delivery"],
          },
        ],
      },
      {
        heading: "Legal Projects",
        items: legalProjects.slice(0, 24).map((project) => ({
          id: `legal-${project.pdNumber}`,
          label: project.projectName || project.projectNameHint || project.pdNumber,
          description: [
            project.pdNumber,
            project.latestRevision ? `Rev ${project.latestRevision}` : null,
          ]
            .filter(Boolean)
            .join(" • "),
          keywords: [
            project.pdNumber,
            project.projectName ?? "",
            project.projectNameHint ?? "",
            project.lwcType ?? "",
          ].filter(Boolean),
        })),
      },
    ],
    [params.badgeNumber, legalProjects],
  );

  const canViewUpcomingProjects = hasAccess("projectSchedule");

  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7);
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
      }).format(new Date(`${currentMonthKey}-01T00:00:00`)),
    [currentMonthKey],
  );

  // Compute available months from legal projects
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    legalProjects.forEach((project) => {
      if (project.dueDate) {
        const monthKey = String(project.dueDate).slice(0, 7);
        monthSet.add(monthKey);
      }
    });
    
    return Array.from(monthSet)
      .sort()
      .map((monthKey) => ({
        value: monthKey,
        label: new Intl.DateTimeFormat(undefined, {
          month: "long",
          year: "numeric",
        }).format(new Date(`${monthKey}-01T00:00:00`)),
      }));
  }, [legalProjects]);

  // Transform ALL legal projects into schedule items (no month filtering - done in side panel)
  const scheduleProjects = useMemo<ScheduleProjectItem[]>(() => {
    return legalProjects
      .filter((project) => Boolean(project.dueDate))
      .map((legalProject) => {
        const linkedProject = projects.find(
          (project) => project.pdNumber === legalProject.pdNumber,
        );
        return {
          id: linkedProject?.id ?? legalProject.pdNumber,
          pdNumber: legalProject.pdNumber,
          name:
            legalProject.projectName ||
            legalProject.projectNameHint ||
            linkedProject?.name ||
            legalProject.pdNumber,
          unitNumber: linkedProject?.unitNumber ?? null,
          revision: legalProject.latestRevision ?? null,
          dueDate: legalProject.dueDate ?? null,
          planConlayDate: legalProject.planConlayDate ?? linkedProject?.planConlayDate ?? null,
          planConassyDate: legalProject.planConassyDate ?? linkedProject?.planConassyDate ?? null,
          shipDate: legalProject.shipDate ?? linkedProject?.shipDate ?? null,
          lwcType: legalProject.lwcType ?? linkedProject?.lwcType ?? null,
          color: legalProject.color ?? linkedProject?.color ?? null,
          daysLate: legalProject.daysLate ?? linkedProject?.daysLate ?? null,
          priorityLabel:
            linkedProject?.aggregates?.highestPriority ??
            (legalProject.hasWorkbook && legalProject.hasLayout
              ? "scheduled"
              : "pending"),
          status: linkedProject
            ? deriveNavStatusFromProject(linkedProject)
            : legalProject.hasWorkbook || legalProject.hasLayout
              ? "active"
              : "pending",
          href: linkedProject
            ? `/${params.badgeNumber}/projects/${encodeURIComponent(linkedProject.id)}`
            : null,
          hasWorkbook: legalProject.hasWorkbook,
          hasLayout: legalProject.hasLayout,
          hasProjectInstance: Boolean(linkedProject),
          projectId: linkedProject?.id ?? null,
          revisions: legalProject.revisions ?? [],
          createdAt: linkedProject?.createdAt ?? null,
        };
      })
      .sort((left, right) => {
        const leftDaysLate = left.daysLate ?? Number.NEGATIVE_INFINITY;
        const rightDaysLate = right.daysLate ?? Number.NEGATIVE_INFINITY;
        if (leftDaysLate !== rightDaysLate) {
          return rightDaysLate - leftDaysLate;
        }

        const leftDate = Date.parse(left.dueDate || "");
        const rightDate = Date.parse(right.dueDate || "");
        if (
          Number.isFinite(leftDate) &&
          Number.isFinite(rightDate) &&
          leftDate !== rightDate
        ) {
          return leftDate - rightDate;
        }

        return left.name.localeCompare(right.name);
      });
  }, [legalProjects, params.badgeNumber, projects]);

  const handleSelectProject = useCallback((project: ScheduleProjectItem) => {
    setSelectedProject(project);
  }, []);

  const handleProjectCreated = useCallback(() => {
    setSelectedProject(null);
    void refreshData();
  }, [refreshData]);

  return (
    <PageContent
      title="Schedule"
      variant="wide"
      showPanel={true}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={false}
      showSubHeader={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder="Search schedule..."
      sidePanel={
        <ScheduleSidePanelNav
          mode={mode}
          data={{
            badgeNumber: params.badgeNumber,
            monthLabel: canViewUpcomingProjects
              ? `${currentMonthLabel} + Upcoming`
              : currentMonthLabel,
            availableMonths: availableMonths,
            projects: scheduleProjects,
          }}
          onSelectProject={handleSelectProject}
          selectedProjectId={selectedProject?.id ?? null}
          isRefreshing={state === "loading"}
        />
      }
      showAside={false}
    >
      <ScheduleContent
        badgeNumber={params.badgeNumber}
        projects={scheduleProjects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onProjectCreated={handleProjectCreated}
        mode={mode}
      />
    </PageContent>
  );
}

function deriveNavStatusFromProject(
  project: ProjectManifest,
): "active" | "pending" | "complete" {
  if (
    project.status === "completed" ||
    project.status === "shipped" ||
    (project.aggregates?.overallProgress ?? 0) >= 100
  ) {
    return "complete";
  }
  if (project.status === "legals_pending") {
    return "pending";
  }
  return "active";
}
