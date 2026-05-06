"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Loader2,
  Pencil,
  Search,
} from "lucide-react";

import {
  WorkspaceSidePanelHeader,
  type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  type ProjectGroupFilter,
  ProjectGroupedAccordion,
} from "./project-grouped-accordion";
import { ProjectNavCard } from "./project-nav-card";
import { LegalsDetailModal } from "./legals-detail-modal";
import { ProjectCollectionDetailsModal } from "./project-collection-details-modal";
import type { ProjectManifest } from "@/types/project-manifest";

// ─── Priority rank circle ─────────────────────────────────────────────────────

function rankCircleFg(hex: string): string {
  if (!hex || hex.length < 7) return "#1a1a1a";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
}

function PriorityRankCircle({ rank, color }: { rank: number; color?: string | null }) {
  const bg = color ?? "#ffcc61";
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ backgroundColor: bg, color: rankCircleFg(bg) }}
    >
      #{rank}
    </div>
  );
}

// ─── Priority LWC filter ─────────────────────────────────────────────────────

type LwcFilter = "all" | "onskid" | "offskid" | "newflex" | "ntb" | "other";

const LWC_FILTER_OPTIONS: Array<{ id: LwcFilter; label: string; dotColor?: string }> = [
  { id: "all",     label: "All" },
  { id: "onskid",  label: "On Skid",   dotColor: "#3B82F6" },
  { id: "offskid", label: "Off Skid",  dotColor: "#F59E0B" },
  { id: "newflex", label: "New/Flex",  dotColor: "#10B981" },
  { id: "ntb",     label: "NTB",       dotColor: "#8B5CF6" },
  { id: "other",   label: "Other",     dotColor: "#6B7280" },
];

function normalizePriorityLwc(value: string | null | undefined): Exclude<LwcFilter, "all"> {
  const v = String(value ?? "").trim().toUpperCase().replace(/[\s/_-]+/g, "");
  if (!v) return "other";
  if (v === "NTB") return "ntb";
  if (v.includes("NEW") || v.includes("FLEX")) return "newflex";
  if (v.includes("OFFSKID") || v.startsWith("OFF")) return "offskid";
  if (v.includes("ONSKID") || v.startsWith("ON") || v.includes("SKID")) return "onskid";
  return "other";
}

function isProjectLate(project: DueProjectNavItem): boolean {
  if (project.daysLate != null && project.daysLate > 0) return true;
  if (!project.dueDate) return false;
  return Date.parse(project.dueDate) < Date.now();
}

function isGreenChange(project: DueProjectNavItem): boolean {
  return (
    String(project.priorityLabel ?? "").toLowerCase().includes("green") ||
    String(project.status ?? "").toLowerCase().includes("green")
  );
}

// Groups rendered when lwcFilter === "all" — always shown even if empty
const LWC_ALL_GROUPS: ProjectGroupFilter<DueProjectNavItem>[] = [
  { id: "onskid",  label: "On Skid",  dotColor: "#3B82F6", match: (p) => normalizePriorityLwc(p.lwcType) === "onskid" },
  { id: "offskid", label: "Off Skid", dotColor: "#F59E0B", match: (p) => normalizePriorityLwc(p.lwcType) === "offskid" },
  { id: "newflex", label: "New/Flex", dotColor: "#10B981", match: (p) => normalizePriorityLwc(p.lwcType) === "newflex" },
  { id: "ntb",     label: "NTB",      dotColor: "#8B5CF6", match: (p) => normalizePriorityLwc(p.lwcType) === "ntb" },
  { id: "other",   label: "Other",    dotColor: "#6B7280", match: (p) => normalizePriorityLwc(p.lwcType) === "other" },
];

// Sub-groups rendered when a specific LWC is selected
const LWC_STATUS_GROUPS: ProjectGroupFilter<DueProjectNavItem>[] = [
  {
    id: "in-progress",
    label: "In Progress",
    dotColor: "#3B82F6",
    match: (p) => p.status !== "complete" && !isProjectLate(p) && !isGreenChange(p),
  },
  {
    id: "late",
    label: "Late",
    dotColor: "#EF4444",
    match: isProjectLate,
  },
  {
    id: "green-change",
    label: "Green Change",
    dotColor: "#22C55E",
    match: isGreenChange,
  },
  {
    id: "completed",
    label: "Completed",
    dotColor: "#6B7280",
    match: (p) => p.status === "complete",
  },
];

// ─── Shared types ─────────────────────────────────────────────────────────────

type MonthOption = {
  value: string;
  label: string;
};

type ProjectsSidePanelNavData = {
  badgeNumber: string;
  monthLabel: string;
  /** Available months for filtering legal projects */
  availableMonths: MonthOption[];
  /** Actual projects from Share/Projects/ */
  priorityProjects: DueProjectNavItem[];
  /** Legal drawings for scheduling (all, not filtered) */
  legalProjects: DueProjectNavItem[];
};

type ProjectsSidePanelNavProps =
  BaseStatefulProps<ProjectsSidePanelNavData>;

type ProjectTab = "active" | "pending" | "complete";
type SidePanelTab = "priority" | "legals";

export type DueProjectNavItem = {
  id: string;
  pdNumber: string;
  name: string;
  unitNumber?: string | null;
  revision?: string | null;
  dueDate?: string | null;
  lwcType?: string | null;
  color?: string | null;
  daysLate?: number | null;
  priorityLabel?: string | null;
  status: ProjectTab;
  href?: string | null;
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

export function ProjectsSidePanelNav({
  mode = "default",
  data,
  className,
}: ProjectsSidePanelNavProps) {
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("priority");
  const [lwcFilter, setLwcFilter] = useState<LwcFilter>("all");
  // Legals-only status tab
  const [activeTab, setActiveTab] = useState<ProjectTab>("active");
  const [searchValue, setSearchValue] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedLegal, setSelectedLegal] = useState<DueProjectNavItem | null>(null);
  const [selectedPriorityProjectId, setSelectedPriorityProjectId] = useState<string | null>(null);
  const [selectedPriorityProject, setSelectedPriorityProject] = useState<ProjectManifest | null>(null);
  const [priorityEditMode, setPriorityEditMode] = useState(false);
  const [prioritySaveBusy, setPrioritySaveBusy] = useState(false);
  const [manualPriorityOrder, setManualPriorityOrder] = useState<string[]>([]);

  const priorityProjects = data?.priorityProjects ?? [];
  const legalProjects = data?.legalProjects ?? [];
  const availableMonths = data?.availableMonths ?? [];

  useEffect(() => {
    let cancelled = false;
    async function loadPriorityOrder() {
      try {
        const response = await fetch("/api/project-priority", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as { manualOrder?: string[] };
        if (!cancelled) {
          setManualPriorityOrder(Array.isArray(payload.manualOrder) ? payload.manualOrder : []);
        }
      } catch {
        // Leave priority queue in computed mode when load fails.
      }
    }
    void loadPriorityOrder();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedPriorityProjectId) {
      setSelectedPriorityProject(null);
      return;
    }

    let cancelled = false;

    async function loadProjectDetails() {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(selectedPriorityProjectId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) {
            setSelectedPriorityProject(null);
          }
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { manifest?: ProjectManifest };
        if (!cancelled) {
          setSelectedPriorityProject(payload.manifest ?? null);
        }
      } catch {
        if (!cancelled) {
          setSelectedPriorityProject(null);
        }
      }
    }

    void loadProjectDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedPriorityProjectId]);

  const savePriorityOrder = useCallback(async (nextOrder: string[]) => {
    setPrioritySaveBusy(true);
    try {
      await fetch("/api/project-priority", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualOrder: nextOrder }),
      });
    } finally {
      setPrioritySaveBusy(false);
    }
  }, []);

  const computedPriorityProjects = useMemo(
    () => [...priorityProjects].sort(sortProjects),
    [priorityProjects],
  );

  const orderedPriorityProjects = useMemo(
    () => applyManualPriorityOrder(computedPriorityProjects, manualPriorityOrder),
    [computedPriorityProjects, manualPriorityOrder],
  );

  // ── Priority data pipeline ────────────────────────────────────────────────

  const prioritySearchFiltered = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return orderedPriorityProjects;
    return orderedPriorityProjects.filter((p) =>
      [p.name, p.pdNumber, p.unitNumber, p.revision, p.lwcType, p.priorityLabel, p.dueDate]
        .filter(Boolean).join(" ").toLowerCase().includes(query),
    );
  }, [orderedPriorityProjects, searchValue]);

  // When a specific LWC is selected, filter to that type
  const priorityDisplayProjects = useMemo(() => {
    if (lwcFilter === "all") return prioritySearchFiltered;
    return prioritySearchFiltered.filter((p) => normalizePriorityLwc(p.lwcType) === lwcFilter);
  }, [prioritySearchFiltered, lwcFilter]);

  // Global rank map — position in the full ordered list, unaffected by LWC filter
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    orderedPriorityProjects.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [orderedPriorityProjects]);

  const movePriorityProject = useCallback(
    (projectId: string, direction: "up" | "down") => {
      const allIds = orderedPriorityProjects.map((p) => p.id);
      const idx = allIds.indexOf(projectId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allIds.length) return;
      const nextOrder = swapManualPriorityIds(
        manualPriorityOrder,
        computedPriorityProjects.map((p) => p.id),
        projectId,
        allIds[swapIdx],
      );
      setManualPriorityOrder(nextOrder);
      void savePriorityOrder(nextOrder);
    },
    [orderedPriorityProjects, computedPriorityProjects, manualPriorityOrder, savePriorityOrder],
  );

  const renderPriorityCard = useCallback(
    (project: DueProjectNavItem) => {
      const rank = rankMap.get(project.id);
      const globalIdx = orderedPriorityProjects.findIndex((p) => p.id === project.id);
      const canMoveUp = globalIdx > 0;
      const canMoveDown = globalIdx >= 0 && globalIdx < orderedPriorityProjects.length - 1;

      return (
        <ProjectNavCard
          project={{ ...project, href: null }}
          onClick={() => {
            if (priorityEditMode) return;
            setSelectedPriorityProjectId(project.id);
          }}
          leading={<PriorityRankCircle rank={rank ?? 0} color={project.color} />}
          trailing={
            priorityEditMode ? (
              <div className="mt-2 flex justify-end gap-1">
                <div
                  role="button"
                  tabIndex={canMoveUp ? 0 : -1}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground",
                    canMoveUp ? "hover:bg-accent hover:text-foreground cursor-pointer" : "cursor-not-allowed opacity-40",
                  )}
                  aria-disabled={!canMoveUp}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (canMoveUp) movePriorityProject(project.id, "up"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (canMoveUp) movePriorityProject(project.id, "up"); } }}
                  aria-label={`Move ${project.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </div>
                <div
                  role="button"
                  tabIndex={canMoveDown ? 0 : -1}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground",
                    canMoveDown ? "hover:bg-accent hover:text-foreground cursor-pointer" : "cursor-not-allowed opacity-40",
                  )}
                  aria-disabled={!canMoveDown}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (canMoveDown) movePriorityProject(project.id, "down"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (canMoveDown) movePriorityProject(project.id, "down"); } }}
                  aria-label={`Move ${project.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              </div>
            ) : undefined
          }
        />
      );
    },
    [rankMap, orderedPriorityProjects, priorityEditMode, movePriorityProject],
  );

  const priorityGroups = useMemo((): ProjectGroupFilter<DueProjectNavItem>[] => {
    if (lwcFilter !== "all") return LWC_STATUS_GROUPS;

    const rank1 = orderedPriorityProjects[0];
    if (!rank1) return LWC_ALL_GROUPS;

    const rank1Lwc = normalizePriorityLwc(rank1.lwcType);

    return LWC_ALL_GROUPS.map((group) => {
      if (group.id !== rank1Lwc) return group;
      return {
        ...group,
        pinnedContent: renderPriorityCard(rank1),
        pinnedProjectId: rank1.id,
      };
    });
  }, [lwcFilter, orderedPriorityProjects, renderPriorityCard]);

  // ── Legals data pipeline ──────────────────────────────────────────────────

  const filteredLegalsByMonth = useMemo(() => {
    if (selectedMonth === "all") return legalProjects;
    return legalProjects.filter((p) => p.dueDate?.slice(0, 7) === selectedMonth);
  }, [legalProjects, selectedMonth]);

  const legalsSearchFiltered = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return filteredLegalsByMonth;
    return filteredLegalsByMonth.filter((p) =>
      [p.name, p.pdNumber, p.unitNumber, p.revision, p.lwcType, p.priorityLabel, p.dueDate]
        .filter(Boolean).join(" ").toLowerCase().includes(query),
    );
  }, [filteredLegalsByMonth, searchValue]);

  const legalsProjectBuckets = useMemo(
    () => bucketProjects(legalsSearchFiltered, {}),
    [legalsSearchFiltered],
  );
  const legalsSortedProjects = useMemo(
    () => [...legalsProjectBuckets[activeTab]].sort(sortProjects),
    [legalsProjectBuckets, activeTab],
  );

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      <LegalsDetailModal
        open={selectedLegal !== null}
        onOpenChange={(open) => { if (!open) setSelectedLegal(null); }}
        project={selectedLegal}
      />
      <ProjectCollectionDetailsModal
        open={selectedPriorityProjectId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPriorityProjectId(null);
            setSelectedPriorityProject(null);
          }
        }}
        badgeNumber={data?.badgeNumber ?? ""}
        project={selectedPriorityProject}
      />
      <WorkspaceSidePanelHeader
        mode={mode}
        title="Projects"
        status={
          mode === "skeleton"
            ? "Loading"
            : sidePanelTab === "priority"
              ? `${orderedPriorityProjects.length} active`
              : `${legalProjects.length} scheduled`
        }
      />

      <div className="border-b border-border px-3 py-3 flex flex-col">
        {mode === "skeleton" ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 flex-1 rounded-2xl" />
              <Skeleton className="h-10 w-40 rounded-2xl" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Tabs
              value={sidePanelTab}
              onValueChange={(value) => {
                const next = value as SidePanelTab;
                setSidePanelTab(next);
                if (next !== "priority") setPriorityEditMode(false);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="priority">Priority</TabsTrigger>
                <TabsTrigger value="legals">Legals</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Priority: queue order bar */}
            {sidePanelTab === "priority" && (
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-2.5 py-1.5">
                <div className="text-[11px] text-muted-foreground">
                  Queue order:{" "}
                  <span className="font-medium text-foreground">1..{orderedPriorityProjects.length}</span>
                </div>
                <Button
                  variant={priorityEditMode ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setPriorityEditMode((prev) => !prev)}
                >
                  {prioritySaveBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : priorityEditMode ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                  {priorityEditMode ? "Done" : "Edit Queue"}
                </Button>
              </div>
            )}

            {/* Legals: month filter */}
            {sidePanelTab === "legals" && availableMonths.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 rounded-xl">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" index={0}>All Months</SelectItem>
                  {availableMonths.map((month, index) => (
                    <SelectItem key={month.value} value={month.value} index={index + 1}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search..."
                className={cn(
                  "h-11 w-full rounded-2xl border-border bg-card pl-9",
                  sidePanelTab === "legals" ? "pr-22" : "pr-4",
                )}
              />
              {sidePanelTab === "legals" && (
                <LegalsStatusDropdown
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  buckets={legalsProjectBuckets}
                />
              )}
            </div>

            {/* Priority: LWC filter pills */}
            {sidePanelTab === "priority" && (
              <div className="flex flex-wrap gap-1.5">
                {LWC_FILTER_OPTIONS.map((opt) => {
                  const isActive = lwcFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLwcFilter(opt.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      )}
                    >
                      {opt.dotColor && !isActive && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: opt.dotColor }}
                        />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 flex flex-col">
        <div className="space-y-4 px-3 py-3">
          {mode === "skeleton" ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background/70 p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))
          ) : sidePanelTab === "priority" ? (
            <ProjectGroupedAccordion
              projects={priorityDisplayProjects}
              groups={priorityGroups}
              mode={lwcFilter === "all" ? "exclusive" : "overlap"}
              defaultOpenIds={[]}
              hideEmpty={lwcFilter !== "all"}
              renderProject={renderPriorityCard}
              emptyGroupMessage="No projects in this group."
            />
          ) : legalsSortedProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No project legals matched the current filters.
            </div>
          ) : (
            <ProjectGroupedAccordion
              projects={legalsSortedProjects}
              groups={LEGALS_GROUP_FILTERS}
              mode="overlap"
              defaultOpenIds={[]}
              renderProject={(project) => (
                <ProjectNavCard
                  project={project}
                  variant="due-emphasis"
                  onClick={() => setSelectedLegal(project)}
                />
              )}
              emptyGroupMessage="No projects in this group."
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const LEGALS_GROUP_FILTERS: ProjectGroupFilter<DueProjectNavItem>[] = [
  {
    id: "late",
    label: "Late",
    dotColor: "#EF4444",
    match: (p) => {
      if (p.daysLate != null && p.daysLate > 0) return true;
      if (!p.dueDate) return false;
      return Date.parse(p.dueDate) < Date.now();
    },
  },
  {
    id: "upcoming",
    label: "Upcoming",
    dotColor: "#F59E0B",
    match: (p) => {
      if (!p.dueDate) return false;
      const due = Date.parse(p.dueDate);
      if (!Number.isFinite(due)) return false;
      const now = Date.now();
      return due >= now && due <= now + 14 * 24 * 60 * 60 * 1000;
    },
  },
  {
    id: "active",
    label: "Active",
    dotColor: "#3B82F6",
    match: (p) => p.status === "active",
  },
  {
    id: "pending",
    label: "Pending",
    dotColor: "#6B7280",
    match: (p) => p.status === "pending",
  },
  {
    id: "complete",
    label: "Complete",
    dotColor: "#10B981",
    match: (p) => p.status === "complete",
  },
];

// Small dropdown for legals status filter — keeps LWCSplitDropdown out of priority
function LegalsStatusDropdown({
  activeTab,
  setActiveTab,
  buckets,
}: {
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
  buckets: ReturnType<typeof bucketProjects>;
}) {
  return (
    <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 flex items-center overflow-hidden rounded-lg border border-input bg-background">
      {PROJECT_TAB_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setActiveTab(opt.id)}
          className={cn(
            "h-8 px-2.5 text-[10px] font-medium transition-colors",
            activeTab === opt.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {opt.label}
          <span className={cn(
            "ml-1 tabular-nums",
            activeTab === opt.id ? "text-background/70" : "text-muted-foreground/60",
          )}>
            {buckets[opt.id].length}
          </span>
        </button>
      ))}
    </div>
  );
}

function bucketProjects(
  projects: DueProjectNavItem[],
  options?: { preserveOrder?: boolean },
) {
  const active: DueProjectNavItem[] = [];
  const pending: DueProjectNavItem[] = [];
  const complete: DueProjectNavItem[] = [];

  projects.forEach((project) => {
    if (project.status === "complete") {
      complete.push(project);
    } else if (project.status === "pending") {
      pending.push(project);
    } else {
      active.push(project);
    }
  });

  if (options?.preserveOrder) {
    return {
      active,
      pending,
      complete,
    };
  }

  return {
    active: active.sort(sortProjects),
    pending: pending.sort(sortProjects),
    complete: complete.sort(sortProjects),
  };
}

function applyManualPriorityOrder(
  computedProjects: DueProjectNavItem[],
  manualOrder: string[],
): DueProjectNavItem[] {
  if (computedProjects.length === 0) return [];
  if (manualOrder.length === 0) return computedProjects;

  const byId = new Map(computedProjects.map((project) => [project.id, project]));
  const ordered: DueProjectNavItem[] = [];

  for (const id of manualOrder) {
    const project = byId.get(id);
    if (!project) continue;
    ordered.push(project);
    byId.delete(id);
  }

  for (const project of computedProjects) {
    if (byId.has(project.id)) {
      ordered.push(project);
    }
  }

  return ordered;
}

function swapManualPriorityIds(
  manualOrder: string[],
  computedOrder: string[],
  sourceId: string,
  targetId: string,
): string[] {
  const baseOrder = Array.from(new Set([...manualOrder, ...computedOrder]));
  const sourceIndex = baseOrder.indexOf(sourceId);
  const targetIndex = baseOrder.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return baseOrder;
  }

  const next = [...baseOrder];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function sortProjects(left: DueProjectNavItem, right: DueProjectNavItem) {
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

  const leftPriority = priorityWeight(left.priorityLabel || "scheduled");
  const rightPriority = priorityWeight(right.priorityLabel || "scheduled");
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.name.localeCompare(right.name);
}

function priorityWeight(priority: string) {
  switch (String(priority).toLowerCase()) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}
