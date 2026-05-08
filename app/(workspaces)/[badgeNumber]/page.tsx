"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Filter, GraduationCap, LayoutDashboard, Plus, Settings, Trophy, User } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SlotItemMapArray } from "swapy";

import { PageContent } from "@/components/layout/page-content";
import { ProfileHeader } from "@/components/profile/profile-header";
import { OverviewTimerCard } from "@/components/projects/overview-timer-card";
import { SwapyLayout, SwapySlot, SwapyItem, DragHandle } from "@/components/swap";
import { ProjectIcon } from "./projects/_components/project-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import { useSession } from "@/hooks/use-session";
import type { BoardDataResponse } from "@/lib/board/types";
import {
  AssemblerSidePanel,
  TeamLeadSidePanel,
  buildDashboardSeedBundle,
  type DashboardSeedBundle,
  type PriorityBucket,
  type ProjectLoadBarPoint,
  type PrioritizedProjectCardVM,
  type RoleDashboardFilterState,
  type SidePanelLwcFilter,
  type SidePanelShiftFilter,
  type TeamMemberCardVM,
} from "./_components";
import type { LegalDrawingsLibraryManifest, LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectManifest } from "@/types/project-manifest";
import type { UserRole } from "@/types/d380-user-session";
import type { TrainingSummary } from "@/types/training";
import type { ResolvedWidget, WorkspaceLayout, WorkspaceRole } from "@/types/workspace-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleDashboardKind = "team_lead" | "assembler";
export type DashboardWidgetState<T> = {
  status: "loading" | "ready" | "empty" | "error";
  data?: T;
  message?: string;
};

type BoardAssignment = BoardDataResponse["projects"][number]["assignments"][number];

/**
 * Data bundle passed to all widget components — avoids prop drilling
 * through the registry dispatch.
 */
type DashboardDataBundle = {
  badgeNumber: string;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  // Board
  boardData: BoardDataResponse | null;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  filteredAssignments: BoardAssignment[];
  assignmentsFilter: "all" | "active" | "upcoming";
  setAssignmentsFilter: (f: "all" | "active" | "upcoming") => void;
  assignmentsState: DashboardWidgetState<BoardAssignment[]>;
  // Overview chart
  projectLoadBars: ProjectLoadBarPoint[];
  overviewState: DashboardWidgetState<ProjectLoadBarPoint[]>;
  priorityMix: Record<PriorityBucket, number>;
  monthScopeLabel: string;
  // Skills / training
  skillsSentiment: string;
  training: TrainingSummary[];
  trainingState: DashboardWidgetState<TrainingSummary[]>;
  // Role
  dashboardKind: RoleDashboardKind;
};

type WidgetComponentProps = DashboardDataBundle & { widget: ResolvedWidget };

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_REQUIRED_TEAM = 3;
const MIN_REQUIRED_PROJECTS = 3;

/** Tailwind col-span lookup — avoids unsafe dynamic class generation. */
const COL_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function roleToDashboardKind(role: UserRole): RoleDashboardKind {
  return role === "TEAM_LEAD" || role === "SUPERVISOR" || role === "MANAGER" || role === "DEVELOPER"
    ? "team_lead"
    : "assembler";
}

function normalizeShift(value: string | null | undefined): SidePanelShiftFilter {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("1") || normalized.includes("first")) return "1st";
  if (normalized.includes("2") || normalized.includes("second")) return "2nd";
  return "all";
}

function normalizeLwc(value: string | null | undefined): SidePanelLwcFilter {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("off")) return "offskid";
  if (normalized.includes("flex")) return "flex";
  if (normalized.includes("on") || normalized.includes("skid")) return "onskid";
  return "all";
}

function priorityRank(value: string | null | undefined): number {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("critical")) return 3;
  if (normalized.includes("high")) return 2;
  if (normalized.includes("normal") || normalized.includes("medium")) return 1;
  return 0;
}

function priorityBucketFromProject(project: {
  dueDate?: string | null;
  daysLate?: number | null;
  priorityLabel?: string | null;
}): PriorityBucket {
  const label = String(project.priorityLabel ?? "").toLowerCase();
  if (label.includes("urgent") || label.includes("critical")) return "urgent";
  if (label.includes("high")) return "high";
  const daysLate = project.daysLate ?? 0;
  if (daysLate > 0) return "urgent";
  const dueTime = Date.parse(project.dueDate ?? "");
  if (!Number.isFinite(dueTime)) return "scheduled";
  const daysUntilDue = Math.ceil((dueTime - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue <= 2) return "high";
  if (daysUntilDue <= 8) return "normal";
  return "scheduled";
}

function priorityScoreFromBucket(bucket: PriorityBucket, daysLate?: number | null): number {
  const late = Math.max(0, daysLate ?? 0);
  if (bucket === "urgent") return 100 + late * 3;
  if (bucket === "high") return 70 + late;
  if (bucket === "normal") return 40;
  return 20;
}

function lwcColorFromValue(value: string | null | undefined): string {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("flex")) return LWC_TYPE_REGISTRY.NEW_FLEX.dotColor;
  if (normalized.includes("off")) return LWC_TYPE_REGISTRY.OFFSKID.dotColor;
  if (normalized.includes("on") || normalized.includes("skid")) return LWC_TYPE_REGISTRY.ONSKID.dotColor;
  if (normalized.includes("ntb")) return LWC_TYPE_REGISTRY.NTB.dotColor;
  if (normalized.includes("float")) return LWC_TYPE_REGISTRY.FLOAT.dotColor;
  return "#94A3B8";
}

// ─── Shared WidgetShell ───────────────────────────────────────────────────────

function WidgetShell({
  title,
  description,
  state,
  onRetry,
  children,
  emptyLabel = "No data yet",
}: {
  title: string;
  description: string;
  state: DashboardWidgetState<unknown>;
  onRetry?: () => void;
  children: React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-[80%]" />
            <Skeleton className="h-6 w-[65%]" />
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
            <div>{state.message ?? "Unable to load this widget."}</div>
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
            ) : null}
          </div>
        ) : null}
        {state.status === "empty" ? (
          <div className="rounded-lg border border-dashed border-border/80 p-3 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : null}
        {state.status === "ready" ? children : null}
      </CardContent>
    </Card>
  );
}

// ─── Widget components ────────────────────────────────────────────────────────
// Each maps to one widgetType key in WORKSPACE_WIDGET_COMPONENT_REGISTRY.

function OverviewTimerWidget({ badgeNumber, selectedProjectId, loading, onRetry }: WidgetComponentProps) {
  if (selectedProjectId) {
    return (
      <OverviewTimerCard
        projectId={selectedProjectId}
        defaultBadge={badgeNumber}
        onStatusChange={onRetry}
      />
    );
  }
  return (
    <WidgetShell
      title="Time Badge In"
      description="Use badge credentials to control assignment clock state."
      state={loading ? { status: "loading" } : { status: "empty" }}
      emptyLabel="No selected project yet. Assign work or open a project to enable badge timing."
    >
      <></>
    </WidgetShell>
  );
}

function ProjectOverviewChartWidget({
  projectLoadBars,
  overviewState,
  priorityMix,
  onRetry,
  dashboardKind,
}: WidgetComponentProps) {
  const chartHeight = dashboardKind === "team_lead" ? 280 : 240;
  const dataSlice = dashboardKind === "team_lead" ? projectLoadBars : projectLoadBars.slice(0, 8);

  return (
    <WidgetShell
      title="Overview"
      description="Project load and priority by LWC with due-date weighted urgency."
      state={overviewState}
      onRetry={onRetry}
      emptyLabel="No contribution events yet for this period."
    >
      <div className="space-y-3">
        <div style={{ height: chartHeight }} className="w-full">
          <ChartContainer
            className="h-full w-full [&_.recharts-cartesian-axis-tick_text]:text-[11px]"
            config={{ assignmentCount: { label: "Assignments", color: "#111827" } }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataSlice} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="pdNumber" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={52} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                  formatter={(value: number) => [`${value} assignments`, "Load"]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ProjectLoadBarPoint | undefined;
                    if (!row) return "";
                    const due = row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "No due date";
                    return `${row.projectName} • ${row.priorityBucket.toUpperCase()} • Due ${due}`;
                  }}
                />
                <Bar dataKey="assignmentCount" radius={[8, 8, 0, 0]}>
                  {dataSlice.map((row) => (
                    <Cell key={row.projectId} fill={row.lwcColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-md border p-2">Projects: <strong>{projectLoadBars.length}</strong></div>
          <div className="rounded-md border p-2">Assignments: <strong>{projectLoadBars.reduce((sum, row) => sum + row.assignmentCount, 0)}</strong></div>
          {dashboardKind === "team_lead" ? (
            <div className="rounded-md border p-2">
              Urgent/High/Normal/Sched: <strong>{priorityMix.urgent}/{priorityMix.high}/{priorityMix.normal}/{priorityMix.scheduled}</strong>
            </div>
          ) : null}
        </div>
        {dashboardKind === "team_lead" ? (
          <div className="max-h-44 space-y-2 overflow-auto pr-1">
            {projectLoadBars.slice(0, 10).map((row) => (
              <div key={row.projectId} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <ProjectIcon
                    interactive={false}
                    name={row.projectName}
                    color={row.color ?? "#FFCC61"}
                    className="h-7 w-7 shrink-0 text-[9px]"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.pdNumber} • {row.projectName}</div>
                    <div className="truncate text-muted-foreground">{row.lwc} • {row.priorityBucket}</div>
                  </div>
                </div>
                <div className="font-semibold">{row.assignmentCount}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </WidgetShell>
  );
}

function AssignmentsListWidget({
  filteredAssignments,
  assignmentsState,
  assignmentsFilter,
  setAssignmentsFilter,
  onRetry,
}: WidgetComponentProps) {
  return (
    <WidgetShell
      title="Assignments"
      description="Filter active and upcoming assigned projects."
      state={assignmentsState}
      onRetry={onRetry}
      emptyLabel="No assignments in this filter."
    >
      <div className="space-y-2">
        <div className="flex justify-end">
          <Select value={assignmentsFilter} onValueChange={(value) => setAssignmentsFilter(value as "all" | "active" | "upcoming")}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" index={0}>All</SelectItem>
              <SelectItem value="active" index={1}>Active</SelectItem>
              <SelectItem value="upcoming" index={2}>Upcoming</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filteredAssignments.slice(0, 8).map((assignment) => (
          <div key={assignment.assignmentId} className="rounded-lg border border-border/60 p-2 text-sm">
            <div className="font-medium">{assignment.projectName} · {assignment.sheetName}</div>
            <div className="text-xs text-muted-foreground">{assignment.stageRole} · {assignment.workflowStatus}</div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

function LeaderboardWidget(_: WidgetComponentProps) {
  return (
    <WidgetShell title="Leaderboard" description="Leadership ranking and throughput benchmark." state={{ status: "ready" }}>
      <div className="rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
        <div className="mb-2 inline-flex items-center gap-2"><Trophy className="h-4 w-4" /> Placeholder</div>
        Leaderboard widget is reserved for service integration.
      </div>
    </WidgetShell>
  );
}

function SkillsSentimentWidget({ skillsSentiment }: WidgetComponentProps) {
  return (
    <WidgetShell title="Skills Sentiment" description="Skill matrix health for coaching and readiness." state={{ status: "ready" }}>
      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
        <span className="text-sm">Sentiment</span>
        <Badge>{skillsSentiment}</Badge>
      </div>
    </WidgetShell>
  );
}

function TrainingInventoryWidget({ training, trainingState, onRetry }: WidgetComponentProps) {
  return (
    <WidgetShell
      title="Training"
      description="Published/draft training inventory."
      state={trainingState}
      onRetry={onRetry}
      emptyLabel="No training modules available yet."
    >
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <span className="inline-flex items-center gap-1"><GraduationCap className="h-4 w-4" /> Published</span>
          <span className="font-semibold">{training.filter((item) => item.status === "published").length}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <span>Draft</span>
          <span className="font-semibold">{training.filter((item) => item.status === "draft").length}</span>
        </div>
      </div>
    </WidgetShell>
  );
}

// ─── Widget component registry ────────────────────────────────────────────────
// Maps widgetType string (from WidgetDescriptor) → React component.
// Never store React components in config/JSON — resolve here on the client.

const WORKSPACE_WIDGET_COMPONENT_REGISTRY: Record<string, React.FC<WidgetComponentProps>> = {
  OverviewTimerCard: OverviewTimerWidget,
  ProjectOverviewChart: ProjectOverviewChartWidget,
  AssignmentsList: AssignmentsListWidget,
  Leaderboard: LeaderboardWidget,
  SkillsSentiment: SkillsSentimentWidget,
  TrainingInventory: TrainingInventoryWidget,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type WorkspaceHomeProps = {
  params: Promise<{ badgeNumber: string }>;
};

export default function WorkspaceHome({ params: paramsPromise }: WorkspaceHomeProps) {
  const params = use(paramsPromise);
  const targetBadge = params.badgeNumber;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useSession();

  // ── UI tabs ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"dashboard" | "profile" | "settings">(
    (searchParams.get("tab") as "dashboard" | "profile" | "settings") || "dashboard",
  );

  // ── Data state ──────────────────────────────────────────────────────────────
  const [boardData, setBoardData] = useState<BoardDataResponse | null>(null);
  const [projectManifests, setProjectManifests] = useState<ProjectManifest[]>([]);
  const [legalProjects, setLegalProjects] = useState<LegalProjectRecord[]>([]);
  const [training, setTraining] = useState<TrainingSummary[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(sessionUser?.role ?? "ASSEMBLER");
  const [assignmentsFilter, setAssignmentsFilter] = useState<"all" | "active" | "upcoming">("all");
  const [selectedMemberBadge, setSelectedMemberBadge] = useState<string | null>(null);
  const [panelFilters, setPanelFilters] = useState<RoleDashboardFilterState>({
    tab: "team",
    search: "",
    shift: "all",
    lwc: "all",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Widget system state ─────────────────────────────────────────────────────
  const [resolvedWidgets, setResolvedWidgets] = useState<ResolvedWidget[]>([]);
  const [widgetLayout, setWidgetLayout] = useState<WorkspaceLayout | null>(null);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  const shift = sessionUser?.currentShift ?? "1st";

  // ── Load dashboard data + workspace widgets ─────────────────────────────────

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [boardRes, trainingRes, userRes, projectsRes, legalRes, widgetsRes] = await Promise.all([
        fetch("/api/board/data", { cache: "no-store" }),
        fetch("/api/training", { cache: "no-store" }),
        fetch(`/api/session/users?badge=${encodeURIComponent(params.badgeNumber)}`, { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/legal-drawings", { cache: "no-store" }),
        fetch(
          `/api/workspaces/${encodeURIComponent(params.badgeNumber)}/widgets?shift=${encodeURIComponent(shift)}`,
          { cache: "no-store" },
        ),
      ]);

      if (!boardRes.ok) throw new Error("Board data unavailable");
      const boardPayload = (await boardRes.json()) as BoardDataResponse;
      setBoardData(boardPayload);

      if (trainingRes.ok) {
        const trainingPayload = (await trainingRes.json()) as { trainings?: TrainingSummary[] };
        setTraining(trainingPayload.trainings ?? []);
      } else {
        setTraining([]);
      }

      if (userRes.ok) {
        const userPayload = (await userRes.json()) as { user?: { role?: UserRole } | null };
        if (!sessionUser?.role) {
          setUserRole(userPayload.user?.role ?? "ASSEMBLER");
        }
      }

      if (projectsRes.ok) {
        const projectsPayload = (await projectsRes.json()) as { manifests?: ProjectManifest[] };
        setProjectManifests(projectsPayload.manifests ?? []);
      } else {
        setProjectManifests([]);
      }

      if (legalRes.ok) {
        const legalPayload = (await legalRes.json()) as LegalDrawingsLibraryManifest;
        setLegalProjects(legalPayload.projects ?? []);
      } else {
        setLegalProjects([]);
      }

      if (widgetsRes.ok) {
        const widgetsPayload = (await widgetsRes.json()) as {
          widgets?: ResolvedWidget[];
          layout?: WorkspaceLayout;
          role?: WorkspaceRole;
        };
        setResolvedWidgets(widgetsPayload.widgets ?? []);
        if (widgetsPayload.layout) setWidgetLayout(widgetsPayload.layout);
        if (widgetsPayload.role) {
          // Sync role from workspace API when session role not set
          const wsRole = widgetsPayload.role as UserRole;
          if (!sessionUser?.role) setUserRole(wsRole);
        }
      }

      const member = boardPayload.members.find((item) => item.badge === params.badgeNumber);
      const activeProject = member?.activeAssignments[0]?.projectId;
      setSelectedMemberBadge(member?.badge ?? null);
      setSelectedProjectId(activeProject ?? boardPayload.projects[0]?.id ?? "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setWidgetsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.badgeNumber]);

  // Sync role from session context (for role switching)
  useEffect(() => {
    if (sessionUser?.role) {
      setUserRole(sessionUser.role);
    }
  }, [sessionUser?.role]);

  useEffect(() => {
    setTab(((searchParams.get("tab") as "dashboard" | "profile" | "settings") || "dashboard"));
  }, [searchParams]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const dashboardKind = roleToDashboardKind(userRole);

  const allAssignments = useMemo(() => {
    if (!boardData) return [];
    return boardData.projects.flatMap((project) => project.assignments);
  }, [boardData]);

  const myAssignments = useMemo(
    () => allAssignments.filter((assignment) => assignment.assignedBadge === params.badgeNumber),
    [allAssignments, params.badgeNumber],
  );

  const filteredAssignments = useMemo(() => {
    const sourceAssignments = dashboardKind === "team_lead" ? allAssignments : myAssignments;
    return sourceAssignments.filter((assignment) => {
      if (assignmentsFilter === "active" && assignment.workflowStatus !== "in-progress") return false;
      if (
        assignmentsFilter === "upcoming"
        && assignment.workflowStatus !== "pending"
        && assignment.workflowStatus !== "scheduled"
      ) return false;
      if (panelFilters.shift !== "all") {
        if (normalizeShift(assignment.shiftId ?? null) !== panelFilters.shift) return false;
      }
      if (panelFilters.lwc !== "all") {
        const projectLwc = boardData?.projects.find((project) => project.id === assignment.projectId)?.lwcType;
        if (normalizeLwc(projectLwc) !== panelFilters.lwc) return false;
      }
      if (selectedMemberBadge && assignment.assignedBadge && assignment.assignedBadge !== selectedMemberBadge) return false;
      return true;
    });
  }, [allAssignments, assignmentsFilter, boardData?.projects, dashboardKind, myAssignments, panelFilters.lwc, panelFilters.shift, selectedMemberBadge]);

  const skillsSentiment = useMemo(() => {
    const member = boardData?.members.find((item) => item.badge === params.badgeNumber);
    const values = Object.values(member?.skills ?? {});
    if (values.length === 0) return "No skills data";
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (avg >= 3) return "Strong";
    if (avg >= 2) return "Developing";
    return "Needs support";
  }, [boardData, params.badgeNumber]);

  const monthScopeLabel = useMemo(() => {
    const now = new Date();
    const current = new Intl.DateTimeFormat(undefined, { month: "short" }).format(now);
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const next = new Intl.DateTimeFormat(undefined, { month: "short" }).format(nextDate);
    return `${current} + ${next}`;
  }, []);

  const teamCards = useMemo<TeamMemberCardVM[]>(() => {
    if (!boardData) return [];
    return boardData.members
      .map((member) => ({
        badge: member.badge,
        name: member.preferredName || member.fullName || member.badge,
        role: member.role,
        shift: member.shift,
        lwc: member.primaryLwc,
        availability: member.availabilityStatus,
        activeAssignmentCount: member.activeAssignments.length,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [boardData]);

  const prioritizedProjects = useMemo<PrioritizedProjectCardVM[]>(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

    const mapped = legalProjects
      .filter((project) => {
        const dueMonth = project.dueMonth || String(project.dueDate || "").slice(0, 7);
        return dueMonth === currentMonth || dueMonth === nextMonth;
      })
      .map((project) => {
        const linked = projectManifests.find((item) => item.pdNumber === project.pdNumber);
        const boardProject = boardData?.projects.find((item) => item.pdNumber === project.pdNumber);
        const name = project.projectName || project.projectNameHint || linked?.name || project.pdNumber;
        const status = linked?.status ?? null;
        const priorityLabel = linked?.aggregates?.highestPriority ?? (project.daysLate && project.daysLate > 0 ? "urgent" : "normal");
        return {
          id: linked?.id ?? `${project.pdNumber}-${project.latestRevision ?? "latest"}`,
          projectId: linked?.id ?? boardProject?.id ?? "",
          pdNumber: project.pdNumber,
          name,
          unitNumber: linked?.unitNumber ?? null,
          revision: project.latestRevision ?? null,
          dueDate: project.dueDate ?? null,
          daysLate: project.daysLate ?? null,
          priorityLabel,
          status,
          lwc: project.lwcType ?? linked?.lwcType ?? boardProject?.lwcType ?? "unassigned",
          color: project.color ?? linked?.color ?? "#FFCC61",
          href: linked?.id ? `/${params.badgeNumber}/projects/${encodeURIComponent(linked.id)}` : null,
          assignmentCount: boardProject?.assignments.length ?? 0,
        } satisfies PrioritizedProjectCardVM;
      })
      .filter((item) => Boolean(item.projectId));

    return mapped.sort((left, right) => {
      const leftLate = left.daysLate ?? Number.NEGATIVE_INFINITY;
      const rightLate = right.daysLate ?? Number.NEGATIVE_INFINITY;
      if (leftLate !== rightLate) return rightLate - leftLate;
      const leftDue = Date.parse(left.dueDate ?? "");
      const rightDue = Date.parse(right.dueDate ?? "");
      if (Number.isFinite(leftDue) && Number.isFinite(rightDue) && leftDue !== rightDue) return leftDue - rightDue;
      const leftPriority = priorityRank(left.priorityLabel);
      const rightPriority = priorityRank(right.priorityLabel);
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return left.name.localeCompare(right.name);
    });
  }, [boardData?.projects, legalProjects, params.badgeNumber, projectManifests]);

  const seedBundle = useMemo<DashboardSeedBundle>(() => buildDashboardSeedBundle(), []);
  const usingSeedFallback = teamCards.length < MIN_REQUIRED_TEAM || prioritizedProjects.length < MIN_REQUIRED_PROJECTS;
  const sidePanelTeam = usingSeedFallback ? seedBundle.team : teamCards;
  const sidePanelProjects = usingSeedFallback ? seedBundle.projects : prioritizedProjects;

  const projectLoadBars = useMemo<ProjectLoadBarPoint[]>(() => {
    const source = usingSeedFallback ? sidePanelProjects : prioritizedProjects;
    if (source.length === 0) return [];
    return source.map((project) => {
      const bucket = priorityBucketFromProject(project);
      return {
        projectId: project.projectId,
        projectName: project.name,
        pdNumber: project.pdNumber,
        lwc: project.lwc,
        lwcColor: lwcColorFromValue(project.lwc),
        assignmentCount: project.assignmentCount,
        dueDate: project.dueDate,
        daysLate: project.daysLate,
        priorityBucket: bucket,
        priorityScore: priorityScoreFromBucket(bucket, project.daysLate),
        color: project.color,
        revision: project.revision,
      } satisfies ProjectLoadBarPoint;
    });
  }, [prioritizedProjects, sidePanelProjects, usingSeedFallback]);

  const priorityMix = useMemo(() => {
    const mix: Record<PriorityBucket, number> = { urgent: 0, high: 0, normal: 0, scheduled: 0 };
    for (const row of projectLoadBars) {
      mix[row.priorityBucket] += 1;
    }
    return mix;
  }, [projectLoadBars]);

  // ── Widget states ─────────────────────────────────────────────────────────────

  const assignmentsState: DashboardWidgetState<BoardAssignment[]> = loading
    ? { status: "loading" }
    : loadError
      ? { status: "error", message: loadError }
      : filteredAssignments.length === 0
        ? { status: "empty" }
        : { status: "ready", data: filteredAssignments };

  const trainingState: DashboardWidgetState<TrainingSummary[]> = loading
    ? { status: "loading" }
    : loadError
      ? { status: "error", message: loadError }
      : training.length === 0
        ? { status: "empty" }
        : { status: "ready", data: training };

  const overviewState: DashboardWidgetState<ProjectLoadBarPoint[]> = loading
    ? { status: "loading" }
    : loadError
      ? { status: "error", message: loadError }
      : projectLoadBars.length === 0
        ? { status: "empty" }
        : { status: "ready", data: projectLoadBars };

  // ── Data bundle (passed to all widget components) ────────────────────────────

  const dataBundle = useMemo<DashboardDataBundle>(
    () => ({
      badgeNumber: params.badgeNumber,
      loading,
      loadError,
      onRetry: loadDashboard,
      boardData,
      selectedProjectId,
      setSelectedProjectId,
      filteredAssignments,
      assignmentsFilter,
      setAssignmentsFilter,
      assignmentsState,
      projectLoadBars,
      overviewState,
      priorityMix,
      monthScopeLabel,
      skillsSentiment,
      training,
      trainingState,
      dashboardKind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      params.badgeNumber, loading, loadError, boardData, selectedProjectId,
      filteredAssignments, assignmentsFilter, assignmentsState,
      projectLoadBars, overviewState, priorityMix, monthScopeLabel,
      skillsSentiment, training, trainingState, dashboardKind,
    ],
  );

  // ── Swapy swap handler ───────────────────────────────────────────────────────

  const handleSwap = useCallback(
    ({ newSlotItemMap }: { newSlotItemMap: { asArray: SlotItemMapArray } }) => {
      const snapshot = resolvedWidgets;

      // Build new slot assignments from Swapy's result
      const newSlotAssignments = new Map<string, string>(); // slotId → widgetId
      for (const { slotId, itemId } of newSlotItemMap.asArray) {
        if (slotId && itemId) newSlotAssignments.set(slotId, itemId);
      }

      // Remap each widget to its new slotId based on the swap result
      const updated: ResolvedWidget[] = resolvedWidgets.map((widget) => {
        const newSlotId = [...newSlotAssignments.entries()].find(([, wId]) => wId === widget.id)?.[0];
        if (!newSlotId || newSlotId === widget.slot.slotId) return widget;
        // Find the order of the slot this widget is moving into
        const targetSlotWidget = resolvedWidgets.find((w) => w.slot.slotId === newSlotId);
        return {
          ...widget,
          slot: { ...widget.slot, slotId: newSlotId, order: targetSlotWidget?.slot.order ?? widget.slot.order },
        };
      });

      setResolvedWidgets(updated);

      // Persist to API — rollback on failure
      const slotOverrides = updated.map((widget, idx) => ({
        slotId: widget.slot.slotId,
        widgetId: widget.id,
        colSpan: widget.slot.colSpan,
        rowSpan: widget.slot.rowSpan,
        size: widget.slot.size,
        viewMode: widget.slot.viewMode,
        visible: widget.slot.visible,
        collapsed: widget.slot.collapsed,
        pinned: widget.slot.pinned,
        order: idx,
      }));

      void (async () => {
        try {
          const res = await fetch(`/api/workspaces/${encodeURIComponent(targetBadge)}/widgets/layout`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-shift": shift },
            body: JSON.stringify({ slotOverrides }),
          });
          if (!res.ok) setResolvedWidgets(snapshot);
        } catch {
          setResolvedWidgets(snapshot);
        }
      })();
    },
    [resolvedWidgets, targetBadge, shift],
  );

  // ── Resolved widget lists ────────────────────────────────────────────────────

  /** Timer widget renders at the top, outside the drag grid */
  const timerWidget = resolvedWidgets.find(
    (w) => w.widgetType === "OverviewTimerCard" && w.visible,
  );

  /** Draggable, visible widgets sorted by slot order — drive the swapy grid */
  const gridWidgets = useMemo(
    () =>
      resolvedWidgets
        .filter((w) => w.widgetType !== "OverviewTimerCard" && w.visible)
        .sort((a, b) => a.slot.order - b.slot.order),
    [resolvedWidgets],
  );

  /** Whether the drag feature is active for this session */
  const swapEnabled = gridWidgets.some((w) => w.draggable);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const onTabChange = (nextTab: "dashboard" | "profile" | "settings") => {
    setTab(nextTab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", nextTab);
    router.replace(`/${params.badgeNumber}?${next.toString()}`);
  };

  const handleAssignHighestPriority = async (projectId: string, memberBadge: string | null) => {
    if (!projectId || !memberBadge || !boardData) return;
    const targetProject = boardData.projects.find((project) => project.id === projectId);
    const targetAssignment = targetProject?.assignments.find(
      (assignment) =>
        assignment.workflowStatus !== "completed"
        && (!assignment.assignedBadge || assignment.assignedBadge === memberBadge),
    );
    if (!targetAssignment) return;
    await fetch("/api/board/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorBadge: params.badgeNumber,
        actorPin: "",
        assignmentId: targetAssignment.assignmentId,
        memberBadge,
      }),
    });
    await loadDashboard();
  };

  const commandSearchGroups = [
    {
      heading: "Workspace",
      items: [
        { id: "workspace-home", label: "Workspace Home", href: `/${params.badgeNumber}`, keywords: ["workspace", "home", params.badgeNumber] },
        { id: "workspace-profile", label: "Profile", href: `/${params.badgeNumber}?tab=profile`, keywords: ["profile"] },
        { id: "workspace-settings", label: "Settings", href: `/${params.badgeNumber}?tab=settings`, keywords: ["settings", "preferences"] },
        { id: "workspace-training", label: "Training", href: `/${params.badgeNumber}/training`, keywords: ["training", "modules"] },
      ],
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageContent
      variant="default"
      showPanel={true}
      showAside={true}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={true}
      showHeaderTitleInline={false}
      showSubHeader={true}
      showStartUpButton={false}
      showSidePanelToggle={true}
      showAsideToggle={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder={`Search workspace ${params.badgeNumber}`}
      sidePanel={
        dashboardKind === "team_lead" ? (
          <TeamLeadSidePanel
            mode={loading ? "skeleton" : "dynamic"}
            data={{
              badgeNumber: params.badgeNumber,
              dashboardKind,
              monthScopeLabel,
              team: sidePanelTeam,
              projects: sidePanelProjects,
              filters: panelFilters,
              onFiltersChange: (next) => setPanelFilters(next),
              onSelectProject: (projectId) => setSelectedProjectId(projectId),
              onSelectMember: (badge) => setSelectedMemberBadge(badge),
              onOpenBoardAssign: () => router.push("/board"),
              onOpenMyAssignments: () => {
                setAssignmentsFilter("active");
                setPanelFilters((prev) => ({ ...prev, tab: "projects" }));
              },
              onViewProject: (projectId) => {
                router.push(`/${params.badgeNumber}/projects/${encodeURIComponent(projectId)}`);
              },
              onAssignHighestPriority: handleAssignHighestPriority,
            }}
          />
        ) : (
          <AssemblerSidePanel
            mode={loading ? "skeleton" : "dynamic"}
            data={{
              badgeNumber: params.badgeNumber,
              dashboardKind,
              monthScopeLabel,
              team: sidePanelTeam,
              projects: sidePanelProjects,
              filters: panelFilters,
              onFiltersChange: (next) => setPanelFilters(next),
              onSelectProject: (projectId) => setSelectedProjectId(projectId),
              onSelectMember: (badge) => setSelectedMemberBadge(badge),
              onOpenMyAssignments: () => {
                setAssignmentsFilter("active");
                setPanelFilters((prev) => ({ ...prev, tab: "projects" }));
              },
              onViewProject: (projectId) => {
                router.push(`/${params.badgeNumber}/projects/${encodeURIComponent(projectId)}`);
              },
              onAssignHighestPriority: handleAssignHighestPriority,
            }}
          />
        )
      }
      subHeader={
        <div className="space-y-3 px-3 py-2 sm:px-4 lg:px-5">
          {tab === "profile" || tab === "settings" ? (
            <ProfileHeader
              badgeNumber={targetBadge}
              compact
              isEditable={true}
              layout="horizontal"
              className="bg-transparent"
            />
          ) : null}
          <Tabs value={tab} onValueChange={(value) => onTabChange(value as "dashboard" | "profile" | "settings")}>
            <TabsList className="h-10 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="dashboard" className="h-8 rounded-lg px-3 text-xs"><LayoutDashboard className="mr-1 h-4 w-4" /> Dashboard</TabsTrigger>
              <TabsTrigger value="profile" className="h-8 rounded-lg px-3 text-xs"><User className="mr-1 h-4 w-4" /> Profile</TabsTrigger>
              <TabsTrigger value="settings" className="h-8 rounded-lg px-3 text-xs"><Settings className="mr-1 h-4 w-4" /> Settings</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      }
      headerActions={
        <>
          <button type="button" className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Filter workspace"><Filter className="h-4 w-4" /></button>
          <button type="button" className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-5 lg:p-6">
        {/* ── Profile / settings tabs ────────────────────────────────────────── */}
        {tab === "profile" || tab === "settings" ? (
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>Badge {params.badgeNumber}</CardTitle>
                <CardDescription>
                  {tab === "profile"
                    ? "Profile is now merged as a root tab for all badges."
                    : "Workspace preferences and account settings for this badge."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Badge>Role {userRole}</Badge>
                <Badge>{roleToDashboardKind(userRole) === "team_lead" ? "Team Lead Layout" : "Assembler Layout"}</Badge>
                {tab === "profile" ? (
                  <Button variant="outline" onClick={() => router.push(`/${params.badgeNumber}/profile/${params.badgeNumber}`)}>Open Full Profile Detail</Button>
                ) : null}
              </CardContent>
            </Card>
            {tab === "settings" ? (
              <Card className="rounded-2xl border-border/60">
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Manage badge-level preferences, notifications, and defaults.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={() => router.push(`/${params.badgeNumber}/profile/${params.badgeNumber}`)}>
                    Open Profile Settings
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ── Dashboard tab ─────────────────────────────────────────────────── */}
        {tab === "dashboard" ? (
          <>
            {/* Widget loading skeleton */}
            {widgetsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="col-span-2 h-64 rounded-2xl" />
                  <Skeleton className="col-span-2 h-64 rounded-2xl" />
                  <Skeleton className="col-span-2 h-48 rounded-2xl" />
                  <Skeleton className="col-span-1 h-48 rounded-2xl" />
                  <Skeleton className="col-span-1 h-48 rounded-2xl" />
                </div>
              </div>
            ) : (
              <>
                {/* Timer — full-width, non-draggable, always at top */}
                {timerWidget ? (
                  <OverviewTimerWidget
                    {...dataBundle}
                    widget={timerWidget}
                  />
                ) : null}

                {/* Widget grid — Swapy-powered when draggable widgets are present */}
                {gridWidgets.length > 0 ? (
                  <SwapyLayout
                    id="workspace-dashboard-grid"
                    onSwap={swapEnabled ? handleSwap : undefined}
                    className="grid grid-cols-4 gap-4"
                  >
                    {gridWidgets.map((widget) => {
                      const Component = WORKSPACE_WIDGET_COMPONENT_REGISTRY[widget.widgetType];
                      if (!Component) return null;
                      const colClass = COL_SPAN_CLASS[widget.slot.colSpan] ?? "col-span-2";

                      if (!widget.draggable || !swapEnabled) {
                        return (
                          <div key={widget.id} className={colClass}>
                            <Component {...dataBundle} widget={widget} />
                          </div>
                        );
                      }

                      return (
                        <SwapySlot key={widget.slot.slotId} id={widget.slot.slotId} className={colClass}>
                          <SwapyItem id={widget.id} className="h-full" dragItemOpacity={70}>
                            <div className="relative h-full">
                              <DragHandle />
                              <Component {...dataBundle} widget={widget} />
                            </div>
                          </SwapyItem>
                        </SwapySlot>
                      );
                    })}
                  </SwapyLayout>
                ) : null}

                {/* Fallback: no widgets resolved (API failure / empty registry) */}
                {!timerWidget && gridWidgets.length === 0 ? (
                  <Card className="rounded-2xl border-border/60">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No widgets are configured for your workspace role yet.
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </PageContent>
  );
}
