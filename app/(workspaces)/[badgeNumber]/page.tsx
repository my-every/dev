"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Filter, GraduationCap, LayoutDashboard, Settings, Trophy, User } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContent } from "@/components/layout/page-content";
import { ProfileHeader } from "@/components/profile/profile-header";
import { OverviewTimerCard } from "@/components/projects/overview-timer-card";
import { DragDropGrid, DraggableDroppableSlot, DragHandle } from "@/components/swap";
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
  type PriorityBucket,
  type ProjectLoadBarPoint,
  type PrioritizedProjectCardVM,
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
  // Skills / training
  skillsSentiment: string;
  training: TrainingSummary[];
  trainingState: DashboardWidgetState<TrainingSummary[]>;
  // Role
  dashboardKind: RoleDashboardKind;
};

type WidgetComponentProps = DashboardDataBundle & { widget: ResolvedWidget };

// ─── Constants ────────────────────────────────────────────────────────────────

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
        if (widgetsPayload.role && !sessionUser?.role) {
          setUserRole(widgetsPayload.role as UserRole);
        }
      }

      // Seed selected project from the current user's active assignment
      const member = boardPayload.members.find((item) => item.badge === params.badgeNumber);
      const activeProject = member?.activeAssignments[0]?.projectId;
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

  useEffect(() => {
    if (sessionUser?.role) setUserRole(sessionUser.role);
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
    () => allAssignments.filter((a) => a.assignedBadge === params.badgeNumber),
    [allAssignments, params.badgeNumber],
  );

  const filteredAssignments = useMemo(() => {
    const source = dashboardKind === "team_lead" ? allAssignments : myAssignments;
    return source.filter((assignment) => {
      if (assignmentsFilter === "active" && assignment.workflowStatus !== "in-progress") return false;
      if (
        assignmentsFilter === "upcoming"
        && assignment.workflowStatus !== "pending"
        && assignment.workflowStatus !== "scheduled"
      ) return false;
      return true;
    });
  }, [allAssignments, assignmentsFilter, dashboardKind, myAssignments]);

  const skillsSentiment = useMemo(() => {
    const member = boardData?.members.find((item) => item.badge === params.badgeNumber);
    const values = Object.values(member?.skills ?? {});
    if (values.length === 0) return "No skills data";
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (avg >= 3) return "Strong";
    if (avg >= 2) return "Developing";
    return "Needs support";
  }, [boardData, params.badgeNumber]);

  const prioritizedProjects = useMemo<PrioritizedProjectCardVM[]>(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

    return legalProjects
      .filter((project) => {
        const dueMonth = project.dueMonth || String(project.dueDate || "").slice(0, 7);
        return dueMonth === currentMonth || dueMonth === nextMonth;
      })
      .map((project) => {
        const linked = projectManifests.find((item) => item.pdNumber === project.pdNumber);
        const boardProject = boardData?.projects.find((item) => item.pdNumber === project.pdNumber);
        const name = project.projectName || project.projectNameHint || linked?.name || project.pdNumber;
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
          status: linked?.status ?? null,
          lwc: project.lwcType ?? linked?.lwcType ?? boardProject?.lwcType ?? "unassigned",
          color: project.color ?? linked?.color ?? "#FFCC61",
          href: linked?.id ? `/${params.badgeNumber}/projects/${encodeURIComponent(linked.id)}` : null,
          assignmentCount: boardProject?.assignments.length ?? 0,
        } satisfies PrioritizedProjectCardVM;
      })
      .filter((item) => Boolean(item.projectId))
      .sort((a, b) => {
        const aLate = a.daysLate ?? Number.NEGATIVE_INFINITY;
        const bLate = b.daysLate ?? Number.NEGATIVE_INFINITY;
        if (aLate !== bLate) return bLate - aLate;
        const aDue = Date.parse(a.dueDate ?? "");
        const bDue = Date.parse(b.dueDate ?? "");
        if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) return aDue - bDue;
        return priorityRank(b.priorityLabel) - priorityRank(a.priorityLabel);
      });
  }, [boardData?.projects, legalProjects, params.badgeNumber, projectManifests]);

  const projectLoadBars = useMemo<ProjectLoadBarPoint[]>(() => {
    if (prioritizedProjects.length === 0) return [];
    return prioritizedProjects.map((project) => {
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
  }, [prioritizedProjects]);

  const priorityMix = useMemo(() => {
    const mix: Record<PriorityBucket, number> = { urgent: 0, high: 0, normal: 0, scheduled: 0 };
    for (const row of projectLoadBars) mix[row.priorityBucket] += 1;
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

  // ── Data bundle ───────────────────────────────────────────────────────────────

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
      skillsSentiment,
      training,
      trainingState,
      dashboardKind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      params.badgeNumber, loading, loadError, boardData, selectedProjectId,
      filteredAssignments, assignmentsFilter, assignmentsState,
      projectLoadBars, overviewState, priorityMix,
      skillsSentiment, training, trainingState, dashboardKind,
    ],
  );

  // ── Drag-and-drop swap handler ───────────────────────────────────────────────

  const handleSwap = useCallback(
    (activeId: string, overId: string) => {
      const snapshot = resolvedWidgets;

      // Swap the slot metadata (order + slotId) between the two widgets.
      const activeWidget = resolvedWidgets.find((w) => w.id === activeId);
      const overWidget = resolvedWidgets.find((w) => w.id === overId);
      if (!activeWidget || !overWidget) return;

      const updated: ResolvedWidget[] = resolvedWidgets.map((widget) => {
        if (widget.id === activeId) {
          return { ...widget, slot: { ...widget.slot, slotId: overWidget.slot.slotId, order: overWidget.slot.order } };
        }
        if (widget.id === overId) {
          return { ...widget, slot: { ...widget.slot, slotId: activeWidget.slot.slotId, order: activeWidget.slot.order } };
        }
        return widget;
      });

      setResolvedWidgets(updated);

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

  // ── Resolved widget lists ─────────────────────────────────────────────────────

  const timerWidget = resolvedWidgets.find((w) => w.widgetType === "OverviewTimerCard" && w.visible);

  const gridWidgets = useMemo(
    () =>
      resolvedWidgets
        .filter((w) => w.widgetType !== "OverviewTimerCard" && w.visible)
        .sort((a, b) => a.slot.order - b.slot.order),
    [resolvedWidgets],
  );

  const swapEnabled = gridWidgets.some((w) => w.draggable);

  // ── Tab handler ───────────────────────────────────────────────────────────────

  const onTabChange = (nextTab: "dashboard" | "profile" | "settings") => {
    setTab(nextTab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", nextTab);
    router.replace(`/${params.badgeNumber}?${next.toString()}`);
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
      showPanel={false}
      showAside={true}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={true}
      showHeaderTitleInline={false}
      showSubHeader={true}
      showStartUpButton={false}
      showSidePanelToggle={false}
      showAsideToggle={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder={`Search workspace ${params.badgeNumber}`}
      subHeader={
        <div className="space-y-3 px-3 py-2 sm:px-4 lg:px-5">
          {tab === "profile" || tab === "settings" ? (
            <ProfileHeader
              badgeNumber={targetBadge}
              compact
              isEditable={true}
              layout="side" 
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
        {/* ── Profile / settings ───────────────────────────────────────────── */}
        {tab === "profile" || tab === "settings" ? (
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/60">
             
              
            </Card>
            {tab === "settings" ? (
              <Card className="rounded-2xl border-border/60">
               
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ── Dashboard ────────────────────────────────────────────────────── */}
        {tab === "dashboard" ? (
          <>
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
                {/* Timer — full-width, pinned at top, outside drag grid */}
                {timerWidget ? (
                  <OverviewTimerWidget {...dataBundle} widget={timerWidget} />
                ) : null}

                {/* Draggable widget grid */}
                {gridWidgets.length > 0 ? (
                  <DragDropGrid
                    id="workspace-dashboard-grid"
                    onSwap={swapEnabled ? handleSwap : undefined}
                    className="grid grid-cols-4 gap-4"
                    renderOverlay={(activeId) => {
                      const widget = gridWidgets.find((w) => w.id === activeId);
                      const Component = widget ? WORKSPACE_WIDGET_COMPONENT_REGISTRY[widget.widgetType] : null;
                      if (!widget || !Component) return null;
                      return <Component {...dataBundle} widget={widget} />;
                    }}
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
                        <DraggableDroppableSlot key={widget.id} id={widget.id} className={colClass}>
                          <DragHandle />
                          <Component {...dataBundle} widget={widget} />
                        </DraggableDroppableSlot>
                      );
                    })}
                  </DragDropGrid>
                ) : null}

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
