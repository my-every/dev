"use client";

import { use, useEffect, useMemo, useState } from "react";

import { FolderKanban, RefreshCw } from "lucide-react";
import { PageContent } from "@/components/layout/page-content";
import { ActivityTimelineContextPanel } from "@/components/activity";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import {
  RecentExportCommandSearch,
  type RecentExportCommandSearchConfig,
} from "@/components/layout/recent-export-command-search";
import { type ViewMode } from "@/app/(workspaces)/[badgeNumber]/_components";
import type {
  LegalDrawingsLibraryManifest,
  LegalProjectRecord,
} from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";
import type { UserSettings } from "@/types/user-settings";
import { useSession } from "@/hooks/use-session";

import {
  ProjectsCollection,
  ProjectsSidePanelNav,
  type DueProjectNavItem,
} from "./_components";

type ProjectsWorkspacePageProps = {
  params: Promise<{
    badgeNumber: string;
  }>;
};

type LoadState = "loading" | "ready";

type ProjectsResponse = {
  manifests?: ProjectManifest[];
};

export default function ProjectsWorkspacePage({
  params: paramsPromise,
}: ProjectsWorkspacePageProps) {
  const params = use(paramsPromise);
  const { user } = useSession();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [legalProjects, setLegalProjects] = useState<LegalProjectRecord[]>([]);
  const [hasLoadedLegalProjects, setHasLoadedLegalProjects] = useState(false);
  const [legalsTabVisited, setLegalsTabVisited] = useState(false);
  const [viewerSettings, setViewerSettings] = useState<UserSettings | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProjects() {
      setState("loading");

      const projectsResponse = await fetch("/api/projects", { cache: "no-store" });
      const payload = await (
        projectsResponse.ok
          ? ((await projectsResponse.json()) as ProjectsResponse)
          : { manifests: [] }
      );
      if (!mounted) {
        return;
      }

      const nextProjects = (payload.manifests ?? []).sort((left, right) => {
        const pdCompare = left.pdNumber.localeCompare(right.pdNumber);
        if (pdCompare !== 0) {
          return pdCompare;
        }
        return (left.unitNumber || "").localeCompare(right.unitNumber || "");
      });

      setProjects(nextProjects);
      setState("ready");
    }

    void loadProjects();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadLegalProjects() {
      const legalResponse = await fetch("/api/legal-drawings", { cache: "no-store" });
      const legalPayload = await (
        legalResponse.ok
          ? ((await legalResponse.json()) as LegalDrawingsLibraryManifest)
          : { projects: [], generatedAt: new Date().toISOString() }
      );

      if (!mounted) {
        return;
      }

      setLegalProjects(legalPayload.projects ?? []);
      setHasLoadedLegalProjects(true);
    }

    if (!legalsTabVisited || hasLoadedLegalProjects) {
      return () => {
        mounted = false;
      };
    }

    void loadLegalProjects();

    return () => {
      mounted = false;
    };
  }, [hasLoadedLegalProjects, legalsTabVisited]);

  useEffect(() => {
    let mounted = true;
    async function loadViewerSettings() {
      if (!user?.badge || !user.currentShift) {
        if (mounted) setViewerSettings(null);
        return;
      }
      try {
        const response = await fetch(
          `/api/users/${encodeURIComponent(user.badge)}/settings?shift=${encodeURIComponent(user.currentShift)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { settings?: UserSettings };
        if (mounted) {
          setViewerSettings(payload.settings ?? null);
        }
      } catch {
        // Keep view permissive when settings cannot be loaded.
      }
    }
    void loadViewerSettings();
    return () => {
      mounted = false;
    };
  }, [user?.badge, user?.currentShift]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const projectsResponse = await fetch("/api/projects", { cache: "no-store" });
      const payload = await (
        projectsResponse.ok
          ? ((await projectsResponse.json()) as { manifests?: ProjectManifest[] })
          : { manifests: [] }
      );
      const nextProjects = (payload.manifests ?? []).sort((left, right) => {
        const pdCompare = left.pdNumber.localeCompare(right.pdNumber);
        if (pdCompare !== 0) return pdCompare;
        return (left.unitNumber || "").localeCompare(right.unitNumber || "");
      });
      setProjects(nextProjects);

      if (hasLoadedLegalProjects) {
        const legalResponse = await fetch("/api/legal-drawings", { cache: "no-store" });
        const legalPayload = await (
          legalResponse.ok
            ? ((await legalResponse.json()) as LegalDrawingsLibraryManifest)
            : { projects: [], generatedAt: new Date().toISOString() }
        );
        setLegalProjects(legalPayload.projects ?? []);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  const mode: ViewMode = state === "loading" ? "skeleton" : "dynamic";
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
            id: "projects-root",
            label: "Projects",
            href: `/${params.badgeNumber}/projects`,
            keywords: ["projects", "manifests", "delivery"],
          },
        ],
      },
      {
        heading: "Projects",
        items: projects.slice(0, 24).map((project) => ({
          id: `project-${project.id}`,
          label: project.name,
          description: [
            project.pdNumber,
            project.unitNumber ? `Unit ${project.unitNumber}` : null,
          ]
            .filter(Boolean)
            .join(" • "),
          href: `/${params.badgeNumber}/projects/${encodeURIComponent(project.id)}`,
          keywords: [
            project.id,
            project.name,
            project.pdNumber,
            project.unitNumber ?? "",
            project.lwcType ?? "",
          ].filter(Boolean),
        })),
      },
    ],
    [params.badgeNumber, projects],
  );

  const recentExportCommandSearchConfig = useMemo<RecentExportCommandSearchConfig>(
    () => ({
      badgeNumber: params.badgeNumber,
      projectLinks: projects.map((project) => ({
        id: project.id,
        pdNumber: project.pdNumber,
        name: project.name,
        href: `/${params.badgeNumber}/projects/${encodeURIComponent(project.id)}`,
        color: project.color ?? null,
      })),
      defaultWindow: "90",
      initialMode: "project-updates",
    }),
    [params.badgeNumber, projects],
  );

  const canViewUpcomingProjects =
    viewerSettings?.dashboardAccess?.projectSchedule ??
    Boolean(user && ["DEVELOPER", "MANAGER", "SUPERVISOR", "TEAM_LEAD"].includes(user.role));

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

  // Priority projects: actual projects from Share/Projects/
  const priorityProjects = useMemo<DueProjectNavItem[]>(() => {
    return projects.map((project) => ({
      id: project.id,
      pdNumber: project.pdNumber,
      name: project.name,
      unitNumber: project.unitNumber ?? null,
      revision: project.revision ?? null,
      dueDate: project.dueDate ?? null,
      lwcType: project.lwcType ?? null,
      color: project.color ?? null,
      daysLate: project.daysLate ?? null,
      priorityLabel: project.aggregates?.highestPriority ?? "scheduled",
      status: deriveNavStatusFromProject(project),
      href: `/${params.badgeNumber}/projects/${encodeURIComponent(project.id)}`,
    })).sort((left, right) => {
      // Sort by days late (most late first), then by due date
      const leftDaysLate = left.daysLate ?? Number.NEGATIVE_INFINITY;
      const rightDaysLate = right.daysLate ?? Number.NEGATIVE_INFINITY;
      if (leftDaysLate !== rightDaysLate) {
        return rightDaysLate - leftDaysLate;
      }
      const leftDate = Date.parse(left.dueDate || "");
      const rightDate = Date.parse(right.dueDate || "");
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
        return leftDate - rightDate;
      }
      return left.name.localeCompare(right.name);
    });
  }, [params.badgeNumber, projects]);

  // Legal projects: from legal drawings library for scheduling (all months, filtering done in side panel)
  const legalNavProjects = useMemo<DueProjectNavItem[]>(() => {
    return legalProjects
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
          lwcType: legalProject.lwcType ?? linkedProject?.lwcType ?? null,
          color: legalProject.color ?? linkedProject?.color ?? null,
          daysLate: legalProject.daysLate ?? linkedProject?.daysLate ?? null,
          priorityLabel:
            linkedProject?.aggregates?.highestPriority ?? "pending",
          status: linkedProject
            ? deriveNavStatusFromProject(linkedProject)
            : "pending",
          href: linkedProject
            ? `/${params.badgeNumber}/projects/${encodeURIComponent(linkedProject.id)}`
            : null,
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
        if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
          return leftDate - rightDate;
        }
        return left.name.localeCompare(right.name);
      });
  }, [legalProjects, params.badgeNumber, projects]);

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

  return (
    <PageContent
      title="Projects"
      variant="wide"
      showPanel={true}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={false}
      showSubHeader={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder="Search projects.."
      renderCommandSearchModal={({ open, onOpenChange }) => (
        <RecentExportCommandSearch
          open={open}
          onOpenChange={onOpenChange}
          placeholder="Search by PD# or project name, then press Enter to refresh"
          config={recentExportCommandSearchConfig}
        />
      )}
      showPanel={false}
      showAside={true}
      asideTitle="Activity"
      aside={
        <ActivityTimelineContextPanel
          badge={params.badgeNumber}
          shift={user?.currentShift || "1st"}
        />
      }
      subHeader={
        <div className="flex flex-col gap-2 border border-border bg-card/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderKanban className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground sm:text-sm">Projects</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                {state === "loading"
                  ? "Loading projects..."
                  : `${projects.length} project${projects.length === 1 ? "" : "s"} across ${new Set(projects.map((p) => p.pdNumber)).size} PD numbers`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CreateProjectDialog
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:px-3"
                  disabled={state === "loading"}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Create Instance</span>
                </Button>
              }
              onCreated={() => {
                void handleRefresh();
              }}
              dialogTitle="Create Project Instance"
              dialogDescription="Create a new project instance from legal drawings or manual input."
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs sm:h-8 sm:px-3"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || state === "loading"}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">Refresh</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex-1 p-2 sm:p-3 md:p-4 lg:p-6">
        <ProjectsCollection
          badgeNumber={params.badgeNumber}
          projects={projects}
          mode={mode}
        />
      </div>
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
