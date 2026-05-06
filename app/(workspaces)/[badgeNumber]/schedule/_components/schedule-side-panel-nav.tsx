"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileQuestion,
  Search,
} from "lucide-react";

import {
  LWCSplitDropdown,
  WorkspaceSidePanelHeader,
  type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { LwcTypeField, RevisionField, UnitNumberField } from "@/components/projects/fields";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LwcType, LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";

import { ProjectIcon } from "../../projects/_components/project-icon";
import type { ScheduleProjectItem } from "./schedule-types";

type MonthOption = {
  value: string;
  label: string;
};

type ScheduleSidePanelNavData = {
  badgeNumber: string;
  monthLabel: string;
  /** Available months for filtering */
  availableMonths: MonthOption[];
  projects: ScheduleProjectItem[];
};

type ScheduleSidePanelNavProps = BaseStatefulProps<ScheduleSidePanelNavData> & {
  onSelectProject?: (project: ScheduleProjectItem) => void;
  selectedProjectId?: string | null;
  isRefreshing?: boolean;
};

type ProjectTab = "active" | "pending" | "complete";
type SidePanelTab = "priority" | "legals";

type GroupedProjects = {
  id: string;
  label: string;
  projects: ScheduleProjectItem[];
};

const PROJECT_TAB_OPTIONS: Array<{
  id: ProjectTab;
  label: string;
  icon: typeof CircleDot;
}> = [
  { id: "active", label: "Active", icon: CircleDot },
  { id: "pending", label: "Pending", icon: Clock3 },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];


export function ScheduleSidePanelNav({
  mode = "default",
  data,
  className,
  onSelectProject,
  selectedProjectId,
  isRefreshing,
}: ScheduleSidePanelNavProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("active");
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("legals");
  const [searchValue, setSearchValue] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const projects = data?.projects ?? [];
  const availableMonths = data?.availableMonths ?? [];

  // Filter projects by month only
  const filteredByMonthAndLwc = useMemo(() => {
    return projects.filter((project) => {
      if (selectedMonth !== "all") {
        const projectMonth = project.dueDate ? String(project.dueDate).slice(0, 7) : "";
        if (projectMonth !== selectedMonth) return false;
      }
      return true;
    });
  }, [projects, selectedMonth]);
  
  const projectBuckets = useMemo(() => bucketProjects(filteredByMonthAndLwc), [filteredByMonthAndLwc]);
  const visibleProjects = projectBuckets[activeTab];

  const filteredProjects = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return visibleProjects;
    }

    return visibleProjects.filter((project) =>
      [
        project.name,
        project.pdNumber,
        project.unitNumber,
        project.revision,
        project.lwcType,
        project.priorityLabel,
        project.dueDate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchValue, visibleProjects]);

  const groupedProjects = useMemo<GroupedProjects[]>(() => {
    return [
      {
        id: activeTab,
        label: normalizeLabel(activeTab),
        projects: filteredProjects,
      },
    ];
  }, [activeTab, filteredProjects]);

  const handleProjectClick = (project: ScheduleProjectItem) => {
    onSelectProject?.(project);
  };

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      <WorkspaceSidePanelHeader
        mode={mode}
        title="Schedule"
        status={mode === "skeleton" ? "Loading" : `${filteredProjects.length} visible`}
      />

      <div className="border-b border-border px-2.5 py-2.5 flex flex-col sm:px-3 sm:py-3">
        {mode === "skeleton" ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 flex-1 rounded-2xl" />
              <Skeleton className="h-10 w-40 rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Tabs value={sidePanelTab} onValueChange={(value) => setSidePanelTab(value as SidePanelTab)}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="priority">Priority</TabsTrigger>
                <TabsTrigger value="legals">Legals</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search..."
                className="h-9 w-full rounded-xl border-border bg-card pl-8 pr-20 text-xs sm:h-11 sm:rounded-2xl sm:pl-9 sm:pr-22 sm:text-sm"
              />
              <LWCSplitDropdown
                selectedId={activeTab}
                onSelect={(id) => setActiveTab(id as ProjectTab)}
                options={PROJECT_TAB_OPTIONS.map((option) => ({
                  ...option,
                  count: projectBuckets[option.id].length,
                }))}
                ariaLabel="Choose project status filter"
                iconOnly
                className="absolute right-1 top-1/2 z-10 h-8 -translate-y-1/2 rounded-lg"
              />
            </div>

            {/* Month filter chips — legals tab only, compact */}
            {sidePanelTab === "legals" && availableMonths.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedMonth("all")}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    selectedMonth === "all"
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  All
                </button>
                {availableMonths.slice(0, 6).map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => setSelectedMonth(month.value)}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      selectedMonth === month.value
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {month.label.split(" ")[0].slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 flex flex-col">
        <div className="space-y-4 px-3 py-3">
          {mode === "skeleton"
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-background/70 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))
            : sidePanelTab === "priority"
              ? groupedProjects.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {group.label}
                      </div>
                      <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {group.projects.length}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.projects.map((project) => (
                        <ProjectCard
                          key={`${group.id}-${project.id}`}
                          project={project}
                          isSelected={selectedProjectId === project.id}
                          onClick={() => handleProjectClick(project)}
                          showDueInRed={false}
                          badgeNumber={data?.badgeNumber ?? ""}
                        />
                      ))}
                    </div>
                  </div>
                ))
              : filteredProjects.length ? (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
                      <ProjectCard
                        key={`legals-${project.id}`}
                        project={project}
                        isSelected={selectedProjectId === project.id}
                        onClick={() => handleProjectClick(project)}
                        showDueInRed={true}
                        badgeNumber={data?.badgeNumber ?? ""}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No project legals matched the current filters.
                  </div>
                )}

          {!filteredProjects.length && mode !== "skeleton" && sidePanelTab === "priority" ? (
            <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No projects matched the current tab and search filters.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProjectCard({
  project,
  isSelected,
  onClick,
  showDueInRed,
  badgeNumber,
}: {
  project: ScheduleProjectItem;
  isSelected: boolean;
  onClick: () => void;
  showDueInRed: boolean;
  badgeNumber: string;
}) {
  const router = useRouter();
  const dueLabel = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString()
    : "No due date";
  const lwcType = toLwcType(project.lwcType);
  const isOverdue = project.daysLate && project.daysLate > 0;
  const hasInstance = project.hasProjectInstance;

  const handleClick = () => {
    if (hasInstance && project.projectId) {
      // Navigate to the existing project page
      router.push(`/${badgeNumber}/projects/${project.projectId}`);
    } else {
      // Select the project in schedule view to create a new instance
      onClick();
    }
  };

  // Get initials for placeholder icon
  const initials = project.name
    .split(/[-\s]+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border bg-background/70 p-2.5 text-left transition-colors hover:bg-accent sm:gap-3 sm:rounded-2xl sm:p-3",
        isSelected
          ? "border-primary ring-1 ring-primary/20"
          : "border-border"
      )}
    >
      {/* Show colored ProjectIcon only if instance exists, otherwise show neutral placeholder */}
      {hasInstance ? (
        <ProjectIcon
          name={project.name}
          color={project.color ?? undefined}
          interactive={false}
        />
      ) : (
        <Avatar className="h-8 w-8 rounded-lg border border-border bg-muted/50 sm:h-10 sm:w-10 sm:rounded-xl">
          <AvatarFallback className="rounded-lg bg-transparent text-[10px] font-medium text-muted-foreground sm:rounded-xl sm:text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground sm:text-sm">
          {project.name}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-1.5">
          {project.unitNumber ? (
            <UnitNumberField
              mode="status"
              value={project.unitNumber}
              className="h-5 text-[10px]"
            />
          ) : null}
          {lwcType ? (
            <LwcTypeField
              mode="status"
              value={lwcType}
              className="h-5 text-[10px]"
            />
          ) : null}
          {project.revision ? (
            <RevisionField
              mode="status"
              value={project.revision}
              className="h-5 text-[10px]"
            />
          ) : null}
          <span
            className={cn(
              "text-[11px]",
              showDueInRed && isOverdue ? "text-red-500" : "text-muted-foreground"
            )}
          >
            Due {dueLabel}
          </span>
        </div>
      </div>
      {hasInstance ? (
        <div className="shrink-0">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="shrink-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

function bucketProjects(projects: ScheduleProjectItem[]) {
  const active: ScheduleProjectItem[] = [];
  const pending: ScheduleProjectItem[] = [];
  const complete: ScheduleProjectItem[] = [];

  projects.forEach((project) => {
    if (project.status === "complete") {
      complete.push(project);
    } else if (project.status === "pending") {
      pending.push(project);
    } else {
      active.push(project);
    }
  });

  return {
    active: active.sort(sortProjects),
    pending: pending.sort(sortProjects),
    complete: complete.sort(sortProjects),
  };
}

function sortProjects(left: ScheduleProjectItem, right: ScheduleProjectItem) {
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
}

function normalizeLabel(value: string) {
  return String(value || "Unassigned")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toLwcType(value?: string | null): LwcType | undefined {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return normalized in LWC_TYPE_REGISTRY ? (normalized as LwcType) : undefined;
}
