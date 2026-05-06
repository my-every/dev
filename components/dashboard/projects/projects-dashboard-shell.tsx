"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Layers,
  ListChecks,
  Search,
} from "lucide-react";

import { DashboardDomainShell } from "@/components/dashboard/shared/dashboard-domain-shell";
import { ProjectScheduleFeatureView } from "@/components/profile/project-schedule/project-schedule-feature-view";
import { LegalDrawingsLibraryPanel } from "@/components/dashboard/projects/legal-drawings-library-panel";
import { useSession } from "@/hooks/use-session";
import { USER_ROLE_LABELS } from "@/types/d380-user-session";
import { useProjectContext } from "@/contexts/project-context";
import type { ProjectManifest } from "@/types/project-manifest";
import { useDashboardAside } from "@/app/profile/[badgeNumber]/(dashboard)/dashboard-aside-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardProjectStatus, hasUploadedLegals } from "@/lib/projects/dashboard-status";

type ProjectsTab =
  | "overview"
  | "priority"
  | "blocked"
  | "completed"
  | "schedule"
  | "legal";

export function ProjectsDashboardShell({
  badgeNumber,
}: {
  badgeNumber: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const { allProjects, isLoading } = useProjectContext();
  const { setSelectedProject } = useDashboardAside();
  const [searchQuery, setSearchQuery] = useState("");

  const activeTab = (searchParams.get("tab") as ProjectsTab) || "overview";

  useEffect(() => {
    setSelectedProject(null);
  }, [setSelectedProject]);

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "priority", label: "Priority" },
      { id: "blocked", label: "Blocked" },
      { id: "completed", label: "Completed" },
      { id: "schedule", label: "Schedule" },
      { id: "legal", label: "Legal Library" },
    ],
    [],
  );

  const handleTabChange = (tabId: string) => {
    router.replace(
      `/profile/${badgeNumber}/projects?tab=${encodeURIComponent(tabId)}`,
    );
  };

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allProjects
      .filter((project) => {
        const status = getDashboardProjectStatus(project);

        const matchesTab =
          activeTab === "overview"
            ? true
            : activeTab === "priority"
              ? status === "brandlist" ||
                status === "branding" ||
                status === "kitting" ||
                status === "active"
              : activeTab === "blocked"
                ? status === "blocked"
                : activeTab === "completed"
                  ? status === "completed" || status === "shipped"
                  : true;

        if (!matchesTab) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          project.name,
          project.filename,
          project.pdNumber ?? "",
          project.unitNumber ?? "",
          project.revision ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }, [activeTab, allProjects, searchQuery]);

  const stats = useMemo(
    () => [
      { label: "Projects", value: allProjects.length },
      {
        label: "Priority",
        value: allProjects.filter((project) => {
          const status = getDashboardProjectStatus(project);
          return (
            status === "brandlist" ||
            status === "branding" ||
            status === "kitting" ||
            status === "active"
          );
        }).length,
      },
      {
        label: "Blocked",
        value: allProjects.filter(
          (project) => getDashboardProjectStatus(project) === "blocked",
        ).length,
      },
      {
        label: "Completed",
        value: allProjects.filter((project) => {
          const status = getDashboardProjectStatus(project);
          return status === "completed" || status === "shipped";
        }).length,
      },
    ],
    [allProjects],
  );

  const summary = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ProjectsSummaryCard
        icon={ListChecks}
        label="Overview"
        description="Browse active projects and open dashboard-native details."
      />
      <ProjectsSummaryCard
        icon={AlertTriangle}
        label="Priority"
        description="Focus the highest-signal projects that still need attention."
      />
      <ProjectsSummaryCard
        icon={CheckCircle2}
        label="Completed"
        description="Review completed work without leaving the dashboard shell."
      />
      <ProjectsSummaryCard
        icon={Layers}
        label="Legal Library"
        description="Launch prebuilt legal packages and creation flows faster."
      />
    </div>
  );

  return (
    <DashboardDomainShell
      title="Projects"
      description="A dashboard-native project surface with focused status tabs and in-route project details."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      stats={stats}
   
      filters={
        activeTab !== "schedule" && activeTab !== "legal" ? (
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search project, PD#, unit, or revision..."
              className="pl-9"
            />
          </div>
        ) : null
      }
    >
      {activeTab === "schedule" ? (
        <ProjectScheduleFeatureView
          roleLabel={user ? USER_ROLE_LABELS[user.role] : "Developer"}
        />
      ) : activeTab === "legal" ? (
        <LegalDrawingsLibraryPanel />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-3xl" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">No projects found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another search or switch tabs to browse a different project slice.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <DashboardProjectRouteCard
              key={project.id}
              badgeNumber={badgeNumber}
              activeTab={activeTab}
              project={project}
            />
          ))}
        </div>
      )}
    </DashboardDomainShell>
  );
}

function DashboardProjectRouteCard({
  badgeNumber,
  activeTab,
  project,
}: {
  badgeNumber: string;
  activeTab: ProjectsTab;
  project: ProjectManifest;
}) {
  const router = useRouter();
  const status = getDashboardProjectStatus(project);
  const assignments = Object.values(project.assignments ?? {});
  const operationalSheets = project.sheets.filter((sheet) => sheet.kind === "operational");
  const statusTone = getStatusTone(status);

  return (
    <button
      type="button"
      onClick={() =>
        router.push(
          `/profile/${badgeNumber}/projects/${encodeURIComponent(project.id)}?fromTab=${encodeURIComponent(activeTab)}`,
        )
      }
      className="w-full text-left"
    >
      <Card className="h-full rounded-3xl border-border/60 bg-card/80 transition-transform duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{project.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {[project.pdNumber, project.unitNumber ? `Unit ${project.unitNumber}` : null]
                  .filter(Boolean)
                  .join(" / ") || project.filename}
              </p>
            </div>
            {project.revision ? (
              <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-1 font-mono text-xs">
                {project.revision}
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Status" value={statusTone.label} toneClassName={statusTone.className} />
            <MetricTile
              label="Legals"
              value={hasUploadedLegals(project) ? "Ready" : "Missing"}
            />
            <MetricTile label="Sheets" value={String(project.sheets.length)} />
            <MetricTile label="Assignments" value={String(assignments.length)} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              {operationalSheets.length} active sheets
            </Badge>
            {assignments.some((assignment) => assignment.status === "BLOCKED") ? (
              <Badge variant="outline" className="rounded-full border-red-300 text-red-600">
                Blocked work
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Created {new Date(project.createdAt).toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              Open details
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function MetricTile({
  label,
  value,
  toneClassName,
}: {
  label: string;
  value: string;
  toneClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={toneClassName ? `mt-1 text-lg font-semibold ${toneClassName}` : "mt-1 text-lg font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function getStatusTone(status: ReturnType<typeof getDashboardProjectStatus>) {
  switch (status) {
    case "blocked":
      return { label: "Blocked", className: "text-red-600" };
    case "completed":
      return { label: "Completed", className: "text-emerald-600" };
    case "shipped":
      return { label: "Shipped", className: "text-slate-600" };
    case "brandlist":
      return { label: "Brand List", className: "text-orange-600" };
    case "branding":
      return { label: "Branding", className: "text-violet-600" };
    case "kitting":
      return { label: "Kitting", className: "text-blue-600" };
    case "active":
      return { label: "Active", className: "text-emerald-600" };
    default:
      return { label: "Awaiting Legals", className: "text-amber-600" };
  }
}

function ProjectsSummaryCard({
  icon: Icon,
  label,
  description,
}: {
  icon: ElementType;
  label: string;
  description: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-semibold">{description}</p>
      </CardContent>
    </Card>
  );
}
