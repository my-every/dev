"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CircleCheck,
  CircleDot,
  Clock3,
  SlidersHorizontal,
  Search,
  Users,
} from "lucide-react";

import { WorkspaceSidePanelHeader } from "./workspace-side-panel-header";
import { ProjectIcon } from "../projects/_components/project-icon";
import type { BaseStatefulProps } from "./workspace-view-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SidePanelTabId = "team" | "projects";
export type SidePanelShiftFilter = "all" | "1st" | "2nd";
export type SidePanelLwcFilter = "all" | "onskid" | "flex" | "offskid";

export type TeamMemberCardVM = {
  badge: string;
  name: string;
  role: string;
  shift: string;
  lwc: string;
  availability: "OFF_SHIFT" | "AVAILABLE" | "ON_ASSIGNMENT";
  activeAssignmentCount: number;
};

export type PrioritizedProjectCardVM = {
  id: string;
  projectId: string;
  pdNumber: string;
  name: string;
  unitNumber?: string | null;
  revision?: string | null;
  dueDate?: string | null;
  daysLate?: number | null;
  priorityLabel?: string | null;
  status?: string | null;
  lwc: string;
  href?: string | null;
  assignmentCount: number;
  color?: string | null;
};

export type RoleDashboardFilterState = {
  tab: SidePanelTabId;
  search: string;
  shift: SidePanelShiftFilter;
  lwc: SidePanelLwcFilter;
};

type DashboardSidePanelNavData = {
  badgeNumber: string;
  dashboardKind: "team_lead" | "assembler";
  monthScopeLabel: string;
  team: TeamMemberCardVM[];
  projects: PrioritizedProjectCardVM[];
  filters?: Partial<RoleDashboardFilterState>;
  onFiltersChange?: (next: RoleDashboardFilterState) => void;
  onSelectProject?: (projectId: string) => void;
  onSelectMember?: (badge: string | null) => void;
  onOpenBoardAssign?: () => void;
  onOpenMyAssignments?: () => void;
  onViewProject?: (projectId: string) => void;
  onAssignHighestPriority?: (projectId: string, memberBadge: string | null) => void;
};

type DashboardSidePanelNavProps = BaseStatefulProps<DashboardSidePanelNavData>;

export function DashboardSidePanelNav({ mode = "default", data, className }: DashboardSidePanelNavProps) {
  const [tab, setTab] = useState<SidePanelTabId>(data?.filters?.tab ?? "team");
  const [search, setSearch] = useState(data?.filters?.search ?? "");
  const [shift, setShift] = useState<SidePanelShiftFilter>(data?.filters?.shift ?? "all");
  const [lwc, setLwc] = useState<SidePanelLwcFilter>(data?.filters?.lwc ?? "all");
  const [selectedMemberBadge, setSelectedMemberBadge] = useState<string | null>(null);

  const isLead = data?.dashboardKind === "team_lead";
  const team = data?.team ?? [];
  const projects = data?.projects ?? [];

  const filteredTeam = useMemo(() => {
    const query = search.trim().toLowerCase();
    return team.filter((member) => {
      if (shift !== "all" && normalizeShift(member.shift) !== shift) return false;
      if (lwc !== "all" && normalizeLwc(member.lwc) !== lwc) return false;
      if (!query) return true;
      return [member.name, member.badge, member.role, member.shift, member.lwc].join(" ").toLowerCase().includes(query);
    });
  }, [lwc, search, shift, team]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (lwc !== "all" && normalizeLwc(project.lwc) !== lwc) return false;
      if (!query) return true;
      return [
        project.name,
        project.pdNumber,
        project.unitNumber,
        project.revision,
        project.priorityLabel,
        project.status,
        project.lwc,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [lwc, projects, search]);

  const projectGroups = useMemo(() => {
    const buckets = new Map<string, PrioritizedProjectCardVM[]>();
    filteredProjects.forEach((project) => {
      const key = normalizePriorityLabel(project.priorityLabel);
      const list = buckets.get(key) ?? [];
      list.push(project);
      buckets.set(key, list);
    });
    return Array.from(buckets.entries()).map(([label, list]) => ({
      label,
      projects: list,
    }));
  }, [filteredProjects]);

  const publishFilters = (next: Partial<RoleDashboardFilterState>) => {
    const merged: RoleDashboardFilterState = {
      tab,
      search,
      shift,
      lwc,
      ...next,
    };
    data?.onFiltersChange?.(merged);
  };

  const topPriorityProject = filteredProjects[0] ?? null;
  const filtersAreDefault = shift === "all" && lwc === "all" && search.trim().length === 0;

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      <WorkspaceSidePanelHeader
        mode={mode}
        eyebrow={isLead ? "Team Lead workspace" : "Assembler workspace"}
        title={isLead ? "Team Lead" : "Assigned Projects"}
        subtitle={isLead ? "Team and monthly project routing" : "Shift-focused team and project visibility"}
        status={mode === "skeleton" ? "Loading" : `${tab === "team" ? filteredTeam.length : filteredProjects.length} visible`}
      />

      <div className="space-y-3 border-b border-border px-3 py-3 sm:px-4">
        {mode === "skeleton" ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 rounded-xl" />
              <Skeleton className="h-8 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            <Tabs
              value={tab}
              onValueChange={(value) => {
                const next = value as SidePanelTabId;
                setTab(next);
                publishFilters({ tab: next });
              }}
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="team" className="text-xs"><Users className="mr-1 h-4 w-4" /> Team</TabsTrigger>
                <TabsTrigger value="projects" className="text-xs"><BriefcaseBusiness className="mr-1 h-4 w-4" /> Projects</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearch(next);
                  publishFilters({ search: next });
                }}
                placeholder={tab === "team" ? "Search team by badge, role, shift..." : "Search projects by PD, unit, priority..."}
                className="h-10 rounded-2xl border-border bg-card pl-9 pr-12"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 rounded-xl border border-border/60 bg-background/90"
                    aria-label="Open filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-[320px] rounded-2xl border-border/60 p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Filters
                      </div>
                      {!filtersAreDefault ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => {
                            setSearch("");
                            setShift("all");
                            setLwc("all");
                            publishFilters({ search: "", shift: "all", lwc: "all" });
                          }}
                        >
                          Reset
                        </Button>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Shift</div>
                      <ToggleGroup
                        type="single"
                        value={shift}
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl border border-border bg-card"
                        onValueChange={(nextValue) => {
                          if (!nextValue) return;
                          const next = nextValue as SidePanelShiftFilter;
                          setShift(next);
                          publishFilters({ shift: next });
                        }}
                      >
                        <ToggleGroupItem value="all" className="px-3 text-xs">All shifts</ToggleGroupItem>
                        <ToggleGroupItem value="1st" className="px-3 text-xs">1st shift</ToggleGroupItem>
                        <ToggleGroupItem value="2nd" className="px-3 text-xs">2nd shift</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">LWC</div>
                      <ToggleGroup
                        type="single"
                        value={lwc}
                        variant="outline"
                        size="sm"
                        className="grid w-full grid-cols-2 rounded-xl border border-border bg-card"
                        onValueChange={(nextValue) => {
                          if (!nextValue) return;
                          const next = nextValue as SidePanelLwcFilter;
                          setLwc(next);
                          publishFilters({ lwc: next });
                        }}
                      >
                        <ToggleGroupItem value="all" className="px-3 text-xs">All LWC</ToggleGroupItem>
                        <ToggleGroupItem value="onskid" className="px-3 text-xs">Onskid</ToggleGroupItem>
                        <ToggleGroupItem value="flex" className="px-3 text-xs">Flex</ToggleGroupItem>
                        <ToggleGroupItem value="offskid" className="px-3 text-xs">Offskid</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Month scope</span>
                      <span className="font-medium text-foreground">{data?.monthScopeLabel ?? "Current + Next"}</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              {isLead ? (
                <>
                  {topPriorityProject ? (
                    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-muted/30 px-3 py-2">
                      <ProjectIcon
                        interactive={false}
                        name={topPriorityProject.name}
                        color={topPriorityProject.color ?? "#FFCC61"}
                        className="h-8 w-8 shrink-0 text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Top Priority</div>
                        <div className="truncate text-sm font-medium">{topPriorityProject.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {topPriorityProject.pdNumber}
                          {topPriorityProject.revision ? ` • ${topPriorityProject.revision}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      size="sm"
                      className="h-10 rounded-full sm:col-span-2"
                      onClick={() => data?.onAssignHighestPriority?.(topPriorityProject?.projectId ?? "", selectedMemberBadge)}
                      disabled={!topPriorityProject}
                    >
                      Assign Highest Priority
                    </Button>
                    <Button size="sm" variant="outline" className="h-10 rounded-full" onClick={() => data?.onOpenBoardAssign?.()}>
                      Open Board Assign
                    </Button>
                    <Button size="sm" variant="outline" className="h-10 rounded-full" onClick={() => publishFilters({ shift, lwc })}>
                      Bulk Plan Month
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button size="sm" variant="outline" className="h-10 rounded-full" onClick={() => data?.onOpenMyAssignments?.()}>
                    Open My Assignments
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-full"
                    onClick={() => {
                      if (topPriorityProject?.projectId) {
                        data?.onViewProject?.(topPriorityProject.projectId);
                      }
                    }}
                    disabled={!topPriorityProject}
                  >
                    View Project
                  </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-3 py-3">
          {mode === "skeleton" ? (
            Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
          ) : tab === "team" ? (
            <div className="space-y-2">
              {filteredTeam.map((member) => {
                const isSelected = selectedMemberBadge === member.badge;
                return (
                  <button
                    key={member.badge}
                    type="button"
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      isSelected ? "border-primary/60 bg-primary/10" : "border-border bg-background/70 hover:bg-accent",
                    )}
                    onClick={() => {
                      const nextBadge = selectedMemberBadge === member.badge ? null : member.badge;
                      setSelectedMemberBadge(nextBadge);
                      data?.onSelectMember?.(nextBadge);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{member.name}</div>
                      <Badge className="rounded-full text-[10px]">{member.shift || "Unknown"}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{member.badge} • {member.role} • {member.lwc}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <AvailabilityPill availability={member.availability} />
                      <span className="text-muted-foreground">Active {member.activeAssignmentCount}</span>
                    </div>
                  </button>
                );
              })}
              {filteredTeam.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No team members match current shift/LWC/search filters.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {projectGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{group.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{group.projects.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.projects.map((project) => (
                      <div key={project.id} className="rounded-2xl border border-border bg-background/70 p-3">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => data?.onSelectProject?.(project.projectId)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <ProjectIcon
                                interactive={false}
                                name={project.name}
                                color={project.color ?? "#FFCC61"}
                                className="h-8 w-8 shrink-0 text-[10px]"
                              />
                              <div className="truncate text-sm font-medium">{project.name}</div>
                            </div>
                            <Badge className="rounded-full text-[10px]">{project.lwc}</Badge>
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {project.pdNumber}
                            {project.unitNumber ? ` • Unit ${project.unitNumber}` : ""}
                            {project.revision ? ` • Rev ${project.revision}` : ""}
                          </div>
                          <div className="mt-2 flex items-center gap-2 truncate text-xs text-muted-foreground">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>{project.priorityLabel ?? "normal"}</span>
                            <span>•</span>
                            <span className="truncate">{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "No due"}</span>
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => data?.onViewProject?.(project.projectId)}>
                            View Project
                          </Button>
                          {project.href ? (
                            <Button asChild size="sm" variant="ghost" className="h-7 rounded-full text-xs">
                              <Link href={project.href}>Open</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No projects match current monthly scope and filters.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function TeamLeadSidePanel({ mode = "default", data, className }: DashboardSidePanelNavProps) {
  return (
    <DashboardSidePanelNav
      mode={mode}
      className={className}
      data={data ? { ...data, dashboardKind: "team_lead" } : data}
    />
  );
}

export function AssemblerSidePanel({ mode = "default", data, className }: DashboardSidePanelNavProps) {
  return (
    <DashboardSidePanelNav
      mode={mode}
      className={className}
      data={data ? { ...data, dashboardKind: "assembler" } : data}
    />
  );
}

function normalizeShift(input: string | null | undefined): SidePanelShiftFilter {
  const value = String(input ?? "").toLowerCase();
  if (value.includes("1") || value.includes("first")) return "1st";
  if (value.includes("2") || value.includes("second")) return "2nd";
  return "all";
}

function normalizeLwc(input: string | null | undefined): SidePanelLwcFilter {
  const value = String(input ?? "").toLowerCase();
  if (value.includes("off")) return "offskid";
  if (value.includes("flex")) return "flex";
  if (value.includes("on") || value.includes("skid")) return "onskid";
  return "all";
}

function normalizePriorityLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "normal").trim().toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("critical")) return "Urgent";
  if (normalized.includes("high")) return "High";
  if (normalized.includes("normal") || normalized.includes("medium")) return "Normal";
  return "Scheduled";
}

function AvailabilityPill({ availability }: { availability: TeamMemberCardVM["availability"] }) {
  if (availability === "ON_ASSIGNMENT") {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700"><CircleCheck className="h-3 w-3" /> Working</span>;
  }
  if (availability === "AVAILABLE") {
    return <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700"><CircleDot className="h-3 w-3" /> Available</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><Clock3 className="h-3 w-3" /> Off shift</span>;
}
