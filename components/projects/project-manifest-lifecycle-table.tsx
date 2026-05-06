"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

import { ProjectUploadFlow } from "@/components/projects/project-upload-flow";
import type { ProjectActionKey } from "@/components/projects/project-home-card";
import { MultiSheetPrintModal } from "@/components/wire-list/multi-sheet-print-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { activityService } from "@/lib/services/activity-service";
import type { ProjectManifest } from "@/types/project-manifest";
import {
  ProjectLifecycleStepper,
  buildExportHref,
  type ProjectActionStateSummary,
} from "@/components/projects/project-lifecycle-stepper";

type DueFilterKey = "all" | string;

interface ProjectActionStateResponse {
  summary?: ProjectActionStateSummary;
}

interface ProjectManifestLifecycleTableProps {
  projects: ProjectManifest[];
  onAction: (action: ProjectActionKey, project: ProjectManifest) => void;
  onProjectReload?: (projectId: string) => void;
}

interface ProjectGroup {
  key: string;
  name: string;
  pdNumber: string;
  lwcKey: string;
  lwcLabel: string;
  projects: ProjectManifest[];
  dueDate: Date | null;
  primaryProject: ProjectManifest;
}

interface MonthOption {
  key: DueFilterKey;
  label: string;
}

interface FilterStats {
  projectGroups: number;
  units: number;
  lwcSections: number;
  earliestDue: Date | null;
}

function parseProjectDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDueDate(value: Date | null) {
  if (!value) {
    return "No due date";
  }

  return value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getDisplayProjectName(project: ProjectManifest) {
  const name = (project.name ?? "").trim();
  if (!name) {
    return "Untitled Project";
  }

  return name
    .replace(/\s*-\s*Unit\s+\d+\s*$/i, "")
    .replace(/\s*Unit\s+\d+\s*$/i, "")
    .trim();
}

function sortUnitProjects(projects: ProjectManifest[]) {
  return [...projects].sort((left, right) => {
    const leftUnit = Number(left.unitNumber ?? Number.POSITIVE_INFINITY);
    const rightUnit = Number(right.unitNumber ?? Number.POSITIVE_INFINITY);
    if (Number.isFinite(leftUnit) && Number.isFinite(rightUnit) && leftUnit !== rightUnit) {
      return leftUnit - rightUnit;
    }

    return (left.unitNumber ?? "").localeCompare(right.unitNumber ?? "");
  });
}

function buildProjectGroups(projects: ProjectManifest[]): ProjectGroup[] {
  const grouped = new Map<string, ProjectManifest[]>();

  for (const project of projects) {
    const key = [
      project.pdNumber?.trim().toUpperCase() || "NO-PD",
      getDisplayProjectName(project).trim().toUpperCase(),
    ].join("::");
    const current = grouped.get(key) ?? [];
    current.push(project);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([key, groupedProjects]) => {
    const sortedProjects = sortUnitProjects(groupedProjects);
    const dueCandidates = sortedProjects
      .map((project) => parseProjectDate(project.dueDate))
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime());
    const lwcType = sortedProjects.find((project) => project.lwcType)?.lwcType;
    const lwcConfig = lwcType ? LWC_TYPE_REGISTRY[lwcType as LwcType] : null;

    return {
      key,
      name: sortedProjects[0]?.name ?? "Untitled Project",
      pdNumber: sortedProjects[0]?.pdNumber ?? "TBD",
      lwcKey: lwcType ?? "UNSPECIFIED",
      lwcLabel: lwcConfig?.shortLabel ?? lwcType ?? "Unspecified",
      projects: sortedProjects,
      dueDate: dueCandidates[0] ?? null,
      primaryProject: sortedProjects[0],
    };
  }).sort((left, right) => {
    const leftDate = left.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDate = right.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildMonthOptions(groups: ProjectGroup[]): MonthOption[] {
  const monthKeys = Array.from(
    new Set(
      groups
        .map((group) => (group.dueDate ? formatMonthKey(group.dueDate) : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const currentMonthKey = formatMonthKey(new Date());
  const dedupedKeys = monthKeys.includes(currentMonthKey)
    ? monthKeys
    : [currentMonthKey, ...monthKeys];

  return [
    { key: currentMonthKey, label: "Current Month" },
    ...dedupedKeys
      .filter((key) => key !== currentMonthKey)
      .map((key) => ({ key, label: formatMonthLabel(key) })),
    { key: "all", label: "All Projects" },
  ];
}

function getMonthDateRangeLabel(filterKey: DueFilterKey) {
  if (filterKey === "all") {
    return "Showing every project manifest with a due date, plus undated projects.";
  }

  const [year, month] = filterKey.split("-").map(Number);
  const filterStart = new Date(year, (month || 1) - 1, 1);
  const filterEnd = new Date(year, month || 1, 0);
  return `${filterStart.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} - ${filterEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function filterGroupsByMonth(groups: ProjectGroup[], selectedFilter: DueFilterKey): ProjectGroup[] {
  if (selectedFilter === "all") {
    return groups;
  }

  const [year, month] = selectedFilter.split("-").map(Number);
  const filterStart = new Date(year, (month || 1) - 1, 1);
  const filterEnd = new Date(year, month || 1, 0, 23, 59, 59, 999);

  return groups.filter((group) => {
    if (!group.dueDate) {
      return false;
    }

    return group.dueDate >= filterStart && group.dueDate <= filterEnd;
  });
}

function buildFilterStats(groups: ProjectGroup[]): FilterStats {
  const dueDates = groups
    .map((group) => group.dueDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    projectGroups: groups.length,
    units: groups.reduce((sum, group) => sum + group.projects.length, 0),
    lwcSections: new Set(groups.map((group) => group.lwcLabel)).size,
    earliestDue: dueDates[0] ?? null,
  };
}

function ProjectManifestLifecycleRow({
  project,
  familyProjects,
  refreshKey,
  onAction,
  onUpload,
  onBrandReview,
  onDownloadBranding,
  inset = false,
  userBadge,
  userShift,
}: {
  project: ProjectManifest;
  familyProjects: ProjectManifest[];
  refreshKey: number;
  onAction: (action: ProjectActionKey, project: ProjectManifest) => void;
  onUpload: (project: ProjectManifest) => void;
  onBrandReview: (project: ProjectManifest) => void;
  onDownloadBranding: (project: ProjectManifest, relativePath: string) => void;
  inset?: boolean;
  userBadge?: string;
  userShift?: string;
}) {
  const [summary, setSummary] = useState<ProjectActionStateSummary | null>(null);
  const familyTotal = familyProjects.length;
  const actionTargetProject = useMemo(() => {
    if (summary?.stateMemberProjectId) {
      return familyProjects.find((candidate) => candidate.id === summary.stateMemberProjectId) ?? familyProjects[0] ?? project;
    }

    return familyProjects[0] ?? project;
  }, [familyProjects, project, summary?.stateMemberProjectId]);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/projects/${encodeURIComponent(project.id)}/action-state`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json() as Promise<ProjectActionStateResponse>;
      })
      .then((payload) => {
        if (!cancelled) {
          setSummary(payload.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, refreshKey]);

  return (
    <TableRow className={cn("hover:bg-muted/30", inset && "bg-muted/10")}>
      <TableCell>
        <Badge variant="outline" className="w-fit rounded-full font-mono">
          {project.pdNumber || "TBD"}
        </Badge>
      </TableCell>
      <TableCell className="px-4">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-foreground">
            {getDisplayProjectName(project)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">
          {project.unitNumber || project.unitType || "TBD"}
          {familyTotal > 1 ? ` / ${familyTotal}` : ""}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDueDate(parseProjectDate(project.dueDate))}
      </TableCell>
      <TableCell>
        <ProjectLifecycleStepper
          project={project}
          actionTargetProject={actionTargetProject}
          summary={summary}
          onUpload={onUpload}
          onBrandReview={onBrandReview}
          onDownloadBranding={async (nextProject, relativePath) => {
            if (userBadge) {
              const brandingAlreadyStarted = Boolean(summary?.brandingStarted || summary?.brandingReadyGateComplete);
              try {
                await activityService.logAction(userBadge, userShift ?? "1st", {
                  action: brandingAlreadyStarted ? "COMPLETED" : "STARTED",
                  projectId: nextProject.id,
                  performedBy: userBadge,
                  result: "success",
                  metadata: {
                    projectId: nextProject.id,
                    projectName: nextProject.name,
                    pdNumber: nextProject.pdNumber,
                    workflow: "branding",
                    milestone: brandingAlreadyStarted ? "complete" : "download",
                  },
                });
              } catch {
                // Keep download non-blocking.
              }
            }

            onDownloadBranding(nextProject, relativePath);
          }}
        />
      </TableCell>
    </TableRow>
  );
}

function ProjectGroupRows({
  group,
  refreshKey,
  onAction,
  onUpload,
  onBrandReview,
  onDownloadBranding,
  userBadge,
  userShift,
}: {
  group: ProjectGroup;
  refreshKey: number;
  onAction: (action: ProjectActionKey, project: ProjectManifest) => void;
  onUpload: (project: ProjectManifest) => void;
  onBrandReview: (project: ProjectManifest) => void;
  onDownloadBranding: (project: ProjectManifest, relativePath: string) => void;
  userBadge?: string;
  userShift?: string;
}) {
  const [open, setOpen] = useState(false);
  const isMultiUnit = group.projects.length > 1;

  if (!isMultiUnit) {
    return (
      <ProjectManifestLifecycleRow
        project={group.projects[0]}
        familyProjects={group.projects}
        refreshKey={refreshKey}
        onAction={onAction}
        onUpload={onUpload}
        onBrandReview={onBrandReview}
        onDownloadBranding={onDownloadBranding}
        userBadge={userBadge}
        userShift={userShift}
      />
    );
  }

  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/30">
        <TableCell>
          <Badge variant="outline" className="w-fit rounded-full font-mono">
            {group.pdNumber}
          </Badge>
        </TableCell>
        <TableCell className="px-4">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-start gap-3 text-left">
                {open ? <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-foreground">{getDisplayProjectName(group.primaryProject)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {group.projects.length} units grouped under one shared legal package
                  </span>
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent />
          </Collapsible>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <span className="font-medium text-foreground">{group.projects.length}</span>
          <span className="ml-1 text-xs text-muted-foreground">total</span>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDueDate(group.dueDate)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          Expand this project group to manage each unit lifecycle independently.
        </TableCell>
      </TableRow>

      {open
        ? group.projects.map((project) => (
            <ProjectManifestLifecycleRow
              key={project.id}
              project={project}
              familyProjects={group.projects}
              refreshKey={refreshKey}
              onAction={onAction}
              onUpload={onUpload}
              onBrandReview={onBrandReview}
              onDownloadBranding={onDownloadBranding}
              inset
              userBadge={userBadge}
              userShift={userShift}
            />
          ))
        : null}
    </>
  );
}

function LwcSection({
  lwcLabel,
  groups,
  refreshKey,
  onAction,
  onUpload,
  onBrandReview,
  onDownloadBranding,
  userBadge,
  userShift,
}: {
  lwcLabel: string;
  groups: ProjectGroup[];
  refreshKey: number;
  onAction: (action: ProjectActionKey, project: ProjectManifest) => void;
  onUpload: (project: ProjectManifest) => void;
  onBrandReview: (project: ProjectManifest) => void;
  onDownloadBranding: (project: ProjectManifest, relativePath: string) => void;
  userBadge?: string;
  userShift?: string;
}) {
  const [open, setOpen] = useState(true);
  const totalUnits = groups.reduce((sum, group) => sum + group.projects.length, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-[1.35rem] border bg-card/70 shadow-sm">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-4 border-b bg-muted/35 px-4 py-3 text-left">
            <div className="flex items-center gap-3">
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{lwcLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {groups.length} project group{groups.length === 1 ? "" : "s"} · {totalUnits} unit{totalUnits === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full">
              {totalUnits}
            </Badge>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead>PD#</TableHead>
                <TableHead className="w-[28%] px-4">Project</TableHead>
                <TableHead>Unit / Total</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="min-w-[680px]">Project Lifecycle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <ProjectGroupRows
                  key={group.key}
                  group={group}
                  refreshKey={refreshKey}
                  onAction={onAction}
                  onUpload={onUpload}
                  onBrandReview={onBrandReview}
                  onDownloadBranding={onDownloadBranding}
                  userBadge={userBadge}
                  userShift={userShift}
                />
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ProjectManifestLifecycleTable({
  projects,
  onAction,
  onProjectReload,
}: ProjectManifestLifecycleTableProps) {
  const { user } = useSession();
  const [uploadProject, setUploadProject] = useState<ProjectManifest | null>(null);
  const [brandReviewProject, setBrandReviewProject] = useState<ProjectManifest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<DueFilterKey>(() => formatMonthKey(new Date()));
  const [searchQuery, setSearchQuery] = useState("");

  const groupedProjects = useMemo(() => buildProjectGroups(projects), [projects]);
  const monthOptions = useMemo(() => buildMonthOptions(groupedProjects), [groupedProjects]);
  const monthScopedGroups = useMemo(
    () => filterGroupsByMonth(groupedProjects, selectedMonth),
    [groupedProjects, selectedMonth],
  );
  const filteredGroups = useMemo(
    () => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return monthScopedGroups;
      }

      return monthScopedGroups.filter((group) => {
        const projectMatch = group.projects.some((project) => {
          const unitValue = String(project.unitNumber || project.unitType || "").toLowerCase();
          return [
            getDisplayProjectName(project).toLowerCase(),
            (project.pdNumber || "").toLowerCase(),
            unitValue,
            `${project.pdNumber || ""} ${unitValue}`.toLowerCase(),
          ].some((value) => value.includes(query));
        });

        return projectMatch || group.lwcLabel.toLowerCase().includes(query);
      });
    },
    [monthScopedGroups, searchQuery],
  );
  const filteredLwcSections = useMemo(
    () => Array.from(
      filteredGroups.reduce((map, group) => {
        const current = map.get(group.lwcLabel) ?? [];
        current.push(group);
        map.set(group.lwcLabel, current);
        return map;
      }, new Map<string, ProjectGroup[]>()),
    ).sort((left, right) => left[0].localeCompare(right[0])),
    [filteredGroups],
  );
  const filterStats = useMemo(() => buildFilterStats(filteredGroups), [filteredGroups]);
  const activeFilterTitle = selectedMonth === "all"
    ? "All Projects"
    : selectedMonth === formatMonthKey(new Date())
      ? "Due This Month"
      : formatMonthLabel(selectedMonth);
  const activeFilterRange = useMemo(() => getMonthDateRangeLabel(selectedMonth), [selectedMonth]);

  if (projects.length === 0) {
    return null;
  }

  return (
    <>
      <section className="container mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Project Lifecycle</h2>
            <p className="text-sm text-muted-foreground">
              Lifecycle workspaces grouped by LWC, ordered by due date, and rolled up when a project has multiple units.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full">
            {groupedProjects.length} project groups · {projects.length} units
          </Badge>
        </div>

        <div className="rounded-[1.35rem] border bg-card/60 p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Due date filters
              </div>
              <div className="text-sm text-muted-foreground">
                {activeFilterRange}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_minmax(280px,1fr)]">
              <Select value={selectedMonth} onValueChange={(value) => setSelectedMonth(value)}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select due date window" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by PD#, project name, or unit"
                  className="bg-background pl-10"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Projects Due</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{filterStats.projectGroups}</div>
                <div className="text-sm text-muted-foreground">Project groups in this filter</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Units In Scope</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{filterStats.units}</div>
                <div className="text-sm text-muted-foreground">{filterStats.lwcSections} LWC sections represented</div>
              </div>
              <div className="rounded-2xl border bg-background/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Earliest Due</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {filterStats.earliestDue ? filterStats.earliestDue.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "--"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {filterStats.earliestDue ? "Earliest project due in this window" : "No dated projects in this filter"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{activeFilterTitle}</h3>
              <Badge variant="secondary" className="rounded-full">
                {filteredGroups.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedMonth === "all"
                ? "Every manifest-backed project is visible in one place."
                : "Projects due within the selected month range only."}
              {searchQuery.trim() ? ` Filtered by "${searchQuery.trim()}".` : ""}
            </p>
          </div>

          {filteredLwcSections.length ? (
            <div className="flex flex-col gap-4">
              {filteredLwcSections.map(([lwcLabel, sectionGroups]) => (
                <LwcSection
                  key={`${selectedMonth}-${lwcLabel}`}
                  lwcLabel={lwcLabel}
                  groups={sectionGroups}
                  refreshKey={refreshKey}
                  onAction={onAction}
                  onUpload={setUploadProject}
                  onBrandReview={(nextProject) => {
                    onProjectReload?.(nextProject.id);
                    setBrandReviewProject(nextProject);
                  }}
                  onDownloadBranding={(nextProject, relativePath) => {
                    window.open(buildExportHref(nextProject.id, relativePath), "_blank", "noopener,noreferrer");
                  }}
                  userBadge={user?.badge}
                  userShift={user?.currentShift}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
              No projects fall inside the selected month window.
            </div>
          )}
        </section>
      </section>

      {uploadProject ? (
        <Dialog open={Boolean(uploadProject)} onOpenChange={(open) => !open && setUploadProject(null)}>
          <DialogContent className="max-h-[90vh] min-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Legals</DialogTitle>
              <DialogDescription>
                Upload or revise the workbook and layout files for {uploadProject.name}.
              </DialogDescription>
            </DialogHeader>
            <ProjectUploadFlow
              mode="revision"
              projectId={uploadProject.id}
              initialProjectName={uploadProject.name}
              initialPdNumber={uploadProject.pdNumber}
              initialUnitNumber={uploadProject.unitNumber}
              initialRevision={uploadProject.revision}
              onCancel={() => setUploadProject(null)}
              onClose={() => {
                onProjectReload?.(uploadProject.id);
                setRefreshKey((key) => key + 1);
                setUploadProject(null);
              }}
              onRevisionComplete={() => {
                onProjectReload?.(uploadProject.id);
                setRefreshKey((key) => key + 1);
                setUploadProject(null);
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {brandReviewProject ? (
        <MultiSheetPrintModal
          projectId={brandReviewProject.id}
          open={Boolean(brandReviewProject)}
          onOpenChange={(open) => {
            if (!open) {
              onProjectReload?.(brandReviewProject.id);
              setRefreshKey((key) => key + 1);
              setBrandReviewProject(null);
            }
          }}
          showTrigger={false}
          title="Brand List Review"
          description="Approve every project sheet, then combine/export the reviewed brand list workbook."
          combineLabel="Combine & Export Brand List"
          workspaceMode="print"
        />
      ) : null}
    </>
  );
}
