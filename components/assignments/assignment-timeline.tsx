"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

import { MultiStepProjectAssignmentModal } from "@/components/board/multi-step-project-assignment-modal";
import type { WorkLogEntry } from "@/components/d380/assignment/assignment-work-log";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeLegacyBoardStageForTimeline } from "@/lib/board/stage-workspaces";
import { cn } from "@/lib/utils";
import type { BoardAssignmentView, BoardDataResponse, BoardMemberView } from "@/lib/board/types";
import type { UserRole } from "@/types/d380-user-session";
import { getOperationCode, type OperationTimeEntry } from "@/types/d380-operation-codes";
import { ASSIGNMENT_STAGES, getStageDefinition, type AssignmentStageId } from "@/types/d380-assignment-stages";

export interface AssignmentTimelineProps {
  className?: string;
  title?: string;
  description?: string;
  projectId?: string;
  assignmentId?: string;
  sheetName?: string;
  swsType?: string | null;
  currentStage?: AssignmentStageId | string | null;
  boardData?: BoardDataResponse | null;
  operationEntries?: OperationTimeEntry[];
  onRefresh?: () => Promise<unknown> | unknown;
  disableInlineAssignModal?: boolean;
}

type TimelineLoadState = "loading" | "ready" | "error";

type TimelineRow = {
  operationCode: string | null;
  assignmentId: string;
  assignmentLabel: string;
  stageLabel: string;
  assigneeLabel: string;
  stationLabel: string;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  completionPct: number;
  swsLabel: string;
  workflowStatus: string;
  estimatedMinutes: number;
  actualMinutes: number;
};

const DEFAULT_TITLE = "Assignment Timeline";
const DEFAULT_DESCRIPTION = "Track assignment placement, stage progress, and active work across the board.";

export function AssignmentTimeline({
  className,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  projectId,
  assignmentId,
  sheetName,
  swsType,
  currentStage,
  boardData,
  operationEntries,
  onRefresh,
  disableInlineAssignModal = false,
}: AssignmentTimelineProps) {
  const [state, setState] = useState<TimelineLoadState>(() => (boardData ? "ready" : "loading"));
  const [error, setError] = useState<string | null>(null);
  const [liveBoardData, setLiveBoardData] = useState<BoardDataResponse | null>(boardData ?? null);
  const [liveOperationEntries, setLiveOperationEntries] = useState<OperationTimeEntry[]>(operationEntries ?? []);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [actorBadge, setActorBadge] = useState("");
  const [actorPin, setActorPin] = useState("");

  const loadTimelineData = useCallback(async () => {
    if (boardData && operationEntries) {
      setLiveBoardData(boardData);
      setLiveOperationEntries(operationEntries);
      setState("ready");
      setError(null);
      return;
    }

    setState("loading");
    setError(null);

    try {
      const requests: Promise<Response | null>[] = [
        fetch("/api/board/data", { cache: "no-store" }),
      ];

      if (projectId) {
        requests.push(fetch(`/api/projects/${encodeURIComponent(projectId)}/operation-time`, { cache: "no-store" }));
      } else {
        requests.push(Promise.resolve(null));
      }

      const [boardResponse, operationResponse] = await Promise.all(requests);
      if (!boardResponse || !boardResponse.ok) {
        throw new Error("Failed to load assignment board data.");
      }

      const boardPayload = (await boardResponse.json()) as BoardDataResponse;
      const operationPayload = operationResponse && operationResponse.ok
        ? ((await operationResponse.json()) as { entries?: OperationTimeEntry[] })
        : { entries: [] };

      setLiveBoardData(boardPayload);
      setLiveOperationEntries(operationPayload.entries ?? []);
      setState("ready");
    } catch (loadError) {
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load assignment timeline.");
    }
  }, [boardData, operationEntries, projectId]);

  useEffect(() => {
    void loadTimelineData();
  }, [loadTimelineData]);

  const assignments = useMemo(() => {
    if (!liveBoardData) {
      return [];
    }

    const allAssignments = liveBoardData.projects.flatMap((project) =>
      project.assignments.map((assignment) => ({
        projectId: project.id,
        lwcType: project.lwcType,
        assignment,
      })),
    );

    return allAssignments.filter((entry) => {
      if (assignmentId) {
        return entry.assignment.assignmentId === assignmentId;
      }

      if (projectId) {
        return entry.projectId === projectId;
      }

      return Boolean(entry.assignment.assignedBadge || entry.assignment.workAreaId || entry.assignment.actualStartTime);
    });
  }, [assignmentId, liveBoardData, projectId]);

  const activeAssignment = assignments[0]?.assignment ?? null;
  const activeProjectLwc = assignments[0]?.lwcType ?? null;
  const memberMap = useMemo(() => buildMemberMap(liveBoardData?.members ?? []), [liveBoardData?.members]);
  const stageId = useMemo(
    () => normalizeStageId(currentStage, activeAssignment?.stage),
    [activeAssignment?.stage, currentStage],
  );

  const rows = useMemo<TimelineRow[]>(
    () =>
      assignments.map(({ assignment, lwcType }) =>
        buildTimelineRow({
          assignment,
          projectLwc: lwcType,
          swsType,
          operationEntries: liveOperationEntries,
          memberMap,
        }),
      ),
    [assignments, liveOperationEntries, memberMap, swsType],
  );

  const timelineEntries = useMemo<WorkLogEntry[]>(
    () =>
      activeAssignment
        ? buildAssignmentWorkLogEntries({
            assignmentId: activeAssignment.assignmentId,
            entries: liveOperationEntries,
            members: liveBoardData?.members ?? [],
          })
        : [],
    [activeAssignment, liveBoardData?.members, liveOperationEntries],
  );

  const handleAssignmentsApplied = useCallback(async () => {
    await loadTimelineData();
    await onRefresh?.();
  }, [loadTimelineData, onRefresh]);

  const canAssign = Boolean(activeAssignment);

  return (
    <section className={cn("rounded-2xl border border-border bg-card/60", className)}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sheetName ? (
              <Badge variant="dot" className="rounded-full">
                {sheetName}
              </Badge>
            ) : null}
            {activeProjectLwc ? (
              <Badge variant="dot" className="rounded-full">
                {activeProjectLwc}
              </Badge>
            ) : null}
            {swsType ? (
              <Badge variant="dot" className="rounded-full">
                {swsType.replace(/[_-]+/g, " ")}
              </Badge>
            ) : null}
            {!disableInlineAssignModal ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!canAssign}
                onClick={() => setAssignModalOpen(true)}
              >
                <Users className="h-4 w-4" />
                Assign Users
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => void loadTimelineData()}
            >
              <Loader2 className={cn("h-4 w-4", state === "loading" ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>
        </div>

        {stageId ? (
          <div className="flex flex-wrap gap-2">
            {ASSIGNMENT_STAGES.map((stage, index) => {
              const active = stage.id === stageId;
              const completed = getStageOrder(stage.id) < getStageOrder(stageId);
              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                    active
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300"
                      : completed
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-border bg-background/80 text-muted-foreground",
                  )}
                >
                  <span className="font-medium">{stage.shortLabel}</span>
                  {index < ASSIGNMENT_STAGES.length - 1 ? <ArrowRight className="h-3 w-3 opacity-60" /> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {state === "loading" ? (
          <TimelineSkeleton />
        ) : state === "error" ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error ?? "Failed to load assignment timeline."}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background/70 p-6 text-sm text-muted-foreground">
            No assignment timeline rows are available yet.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[0.9fr_1.2fr_1fr_1fr_1.1fr_0.9fr_0.7fr_0.7fr_0.9fr_0.8fr] gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground xl:grid">
              <span>Operation #</span>
              <span>Assignment</span>
              <span>Stage</span>
              <span>Assignee</span>
              <span>LWC / Station</span>
              <span>Date</span>
              <span>Start</span>
              <span>End</span>
              <span>Completion</span>
              <span>SWS</span>
            </div>

            {rows.map((row) => (
              <div
                key={row.assignmentId}
                className="rounded-2xl border border-border bg-background/70 px-4 py-4 shadow-sm"
              >
                <div className="hidden grid-cols-[0.9fr_1.2fr_1fr_1fr_1.1fr_0.9fr_0.7fr_0.7fr_0.9fr_0.8fr] items-center gap-3 xl:grid">
                  <span className="font-mono text-sm font-semibold text-foreground">{row.operationCode ?? "—"}</span>
                  <span className="truncate font-medium text-foreground">{row.assignmentLabel}</span>
                  <span className="truncate text-sm text-foreground">{row.stageLabel}</span>
                  <span className="truncate text-sm text-foreground">{row.assigneeLabel}</span>
                  <span className="truncate text-sm text-muted-foreground">{row.stationLabel}</span>
                  <span className="text-sm text-muted-foreground">{row.scheduledDate ?? "—"}</span>
                  <span className="font-mono text-sm text-muted-foreground">{row.startTime ?? "—"}</span>
                  <span className="font-mono text-sm text-muted-foreground">{row.endTime ?? "—"}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.completionPct}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm text-foreground">{row.completionPct}%</span>
                  </div>
                  <span className="truncate text-sm text-muted-foreground">{row.swsLabel}</span>
                </div>

                <div className="space-y-3 xl:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{row.assignmentLabel}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="dot" className="rounded-full font-mono">
                          {row.operationCode ?? "—"}
                        </Badge>
                        <Badge variant="dot" className="rounded-full">
                          {row.stageLabel}
                        </Badge>
                        <Badge variant="dot" className="rounded-full">
                          {row.swsLabel}
                        </Badge>
                      </div>
                    </div>
                    <Badge className="rounded-full">
                      {normalizeStatusLabel(row.workflowStatus)}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MobileMetric icon={<UserRound className="h-3.5 w-3.5" />} label="Assignee" value={row.assigneeLabel} />
                    <MobileMetric icon={<MapPin className="h-3.5 w-3.5" />} label="LWC / Station" value={row.stationLabel} />
                    <MobileMetric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date" value={row.scheduledDate ?? "—"} />
                    <MobileMetric icon={<Clock3 className="h-3.5 w-3.5" />} label="Start / End" value={`${row.startTime ?? "—"} → ${row.endTime ?? "—"}`} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Completion</span>
                      <span>{row.completionPct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.completionPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {activeAssignment ? (
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Estimated Time" value={formatMinutes(activeAssignment.estimatedMinutes)} />
                <SummaryCard label="Actual Time" value={formatMinutes(sumOperationMinutes(liveOperationEntries, activeAssignment.assignmentId))} />
                <SummaryCard label="Work Log Entries" value={`${timelineEntries.length}`} icon={<ClipboardList className="h-4 w-4" />} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!disableInlineAssignModal ? (
        <MultiStepProjectAssignmentModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          data={liveBoardData}
          canAssign={true}
          actorBadge={actorBadge}
          actorPin={actorPin}
          onActorBadgeChange={setActorBadge}
          onActorPinChange={setActorPin}
          triggerContext={
            activeAssignment
              ? {
                  source: "timeline",
                  stationId: activeAssignment.workAreaId,
                  stationLabel: activeAssignment.workAreaLabel,
                  shiftId: activeAssignment.shiftId,
                  startTime: activeAssignment.startTime,
                  preselectedAssignmentIds: [activeAssignment.assignmentId],
                }
              : null
          }
          onAssignmentsApplied={handleAssignmentsApplied}
        />
      ) : null}
    </section>
  );
}

export function buildAssignmentWorkLogEntries(params: {
  assignmentId: string;
  entries: OperationTimeEntry[];
  members: BoardMemberView[];
}): WorkLogEntry[] {
  const memberMap = buildMemberMap(params.members);

  return params.entries
    .filter((entry) => entry.assignmentId === params.assignmentId)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .map((entry) => {
      const member = memberMap.get(entry.badge) ?? null;
      const fullName = member?.fullName || entry.badge;
      const shift = normalizeShift(member?.shift);
      const stageLabel = getOperationCode(entry.opCode)?.stageId
        ? getStageDefinition(getOperationCode(entry.opCode)!.stageId)?.label ?? getOperationCode(entry.opCode)!.stageId
        : entry.opCode;

      return {
        id: entry.id,
        assignmentId: entry.assignmentId,
        badge: entry.badge,
        userName: fullName,
        userInitials: getInitials(fullName),
        userRole: (member?.role || "ASSEMBLER") as UserRole,
        shift,
        stage: stageLabel,
        action: entry.endedAt ? "CLOCK_OUT" : "CLOCK_IN",
        clockInAt: entry.startedAt,
        clockOutAt: entry.endedAt,
        durationMinutes: entry.actualMinutes ?? null,
        notes: entry.note ?? null,
      };
    });
}

function buildTimelineRow(params: {
  assignment: BoardAssignmentView;
  projectLwc: string | null;
  swsType: string | null | undefined;
  operationEntries: OperationTimeEntry[];
  memberMap: Map<string, BoardMemberView>;
}): TimelineRow {
  const actualMinutes = sumOperationMinutes(params.operationEntries, params.assignment.assignmentId);
  const completionPct = Math.max(
    0,
    Math.min(100, params.assignment.estimatedMinutes > 0 ? Math.round((actualMinutes / params.assignment.estimatedMinutes) * 100) : 0),
  );

  return {
    operationCode: params.assignment.operationCode,
    assignmentId: params.assignment.assignmentId,
    assignmentLabel: params.assignment.sheetName,
    stageLabel: normalizeStageLabel(params.assignment.stage),
    assigneeLabel: params.assignment.assignedBadge
      ? params.memberMap.get(params.assignment.assignedBadge)?.fullName || params.assignment.assignedBadge
      : "Unassigned",
    stationLabel: [params.projectLwc, params.assignment.workAreaLabel || params.assignment.workAreaId].filter(Boolean).join(" / ") || "Not scheduled",
    scheduledDate: params.assignment.scheduledDate,
    startTime: params.assignment.startTime,
    endTime: params.assignment.endTime,
    completionPct,
    swsLabel: params.swsType || "—",
    workflowStatus: params.assignment.workflowStatus,
    estimatedMinutes: params.assignment.estimatedMinutes,
    actualMinutes,
  };
}

function buildMemberMap(members: BoardMemberView[]) {
  return new Map(members.map((member) => [member.badge, member]));
}

function normalizeStageLabel(stage: string) {
  return stage
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeStatusLabel(status: string) {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "—";
}

function normalizeShift(shift: string | undefined): "1st" | "2nd" {
  if (shift?.startsWith("2")) {
    return "2nd";
  }
  return "1st";
}

function sumOperationMinutes(entries: OperationTimeEntry[], assignmentId: string) {
  return entries
    .filter((entry) => entry.assignmentId === assignmentId)
    .reduce((sum, entry) => sum + (entry.actualMinutes ?? 0), 0);
}

function getStageOrder(stageId: AssignmentStageId) {
  return ASSIGNMENT_STAGES.findIndex((stage) => stage.id === stageId);
}

function normalizeStageId(
  currentStage: AssignmentTimelineProps["currentStage"],
  boardStage?: string | null,
): AssignmentStageId | null {
  const raw = String(currentStage ?? boardStage ?? "").trim();
  if (!raw) {
    return null;
  }

  const exact = ASSIGNMENT_STAGES.find((stage) => stage.id === raw);
  if (exact) {
    return exact.id;
  }

  return normalizeLegacyBoardStageForTimeline(raw);
}

function formatMinutes(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "0m";
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-background/70 px-4 py-4">
          <div className="hidden grid-cols-[0.9fr_1.2fr_1fr_1fr_1.1fr_0.9fr_0.7fr_0.7fr_0.9fr_0.8fr] gap-3 xl:grid">
            {Array.from({ length: 10 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-5 w-full" />
            ))}
          </div>
          <div className="space-y-3 xl:hidden">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-12 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MobileMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
