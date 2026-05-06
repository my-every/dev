"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOutsideInteractionTarget,
  isPortaledOverlayInteraction,
} from "@/lib/radix-outside-interactions";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  TimerReset,
  Trash2,
} from "lucide-react";

import { ActivityTimelineContextPanel } from "@/components/activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  ProjectTask,
  ProjectTaskRecurrenceCadence,
  ProjectTaskScope,
} from "@/types/project-task";
import { type AssignableMember } from "@/components/projects/member-assignment-selector";
import { ProjectPickerWithContext } from "@/components/projects/project-picker-with-context";
import { TaskPreviewCard } from "@/components/projects/task-preview-card";
import { TaskAssignSelector } from "@/components/projects/task-assign-selector";
import type { BoardDataResponse } from "@/lib/board/types";
import type { ProjectManifest } from "@/types/project-manifest";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectTaskTeam } from "@/types/project-task-team";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components";

type TaskScopeContext = {
  scope: ProjectTaskScope;
  projectId?: string | null;
  pdNumber?: string | null;
  legalRevision?: string | null;
};

type ProjectWorklogWidgetProps = {
  badge: string;
  shift: string;
  className?: string;
  showActivityTab?: boolean;
  initialTab?: "tasks" | "activity";
  scopeContext?: TaskScopeContext | null;
};

type LegalTaskTemplate = "review-brand-list" | "notify-brander" | "custom";

type ProjectScheduleMode = "immediate" | "when-ready" | "before-due" | "overtime";

const PROJECT_SCHEDULE_OPTIONS: { value: ProjectScheduleMode; label: string }[] = [
  { value: "immediate", label: "Immediate" },
  { value: "when-ready", label: "When Ready" },
  { value: "before-due", label: "Before Due Date/Time" },
  { value: "overtime", label: "Overtime" },
];

type CreateTaskState = {
  title: string;
  titleManuallyEdited: boolean;
  scope: ProjectTaskScope;
  taskTemplate: LegalTaskTemplate;
  assignmentId: string;
  scheduleMode: ProjectScheduleMode;
  scheduleDateTime: string;
  operation: string;
  taskAction: string;
  projectId: string;
  pdNumber: string;
  legalRevision: string;
  dueDate: string;
  assignedToBadge: string;
  teamId: string;
  recurrenceEnabled: boolean;
  recurrenceCadence: ProjectTaskRecurrenceCadence;
};

type ProjectTaskApiResponse = {
  manifests?: ProjectManifest[];
};

type LegalTaskApiResponse = {
  projects?: LegalProjectRecord[];
};

type TeamApiResponse = {
  teams?: ProjectTaskTeam[];
};

const DEFAULT_CREATE_STATE: CreateTaskState = {
  title: "",
  titleManuallyEdited: false,
  scope: "project",
  taskTemplate: "custom",
  assignmentId: "",
  scheduleMode: "immediate",
  scheduleDateTime: "",
  operation: "",
  taskAction: "",
  projectId: "",
  pdNumber: "",
  legalRevision: "",
  dueDate: "",
  assignedToBadge: "",
  teamId: "",
  recurrenceEnabled: true,
  recurrenceCadence: "daily",
};

function toAssignableMembers(
  data: BoardDataResponse | null,
): AssignableMember[] {
  if (!data?.members?.length) return [];
  return data.members.map((member) => {
    const [firstName = member.fullName, ...rest] = member.fullName
      .split(" ")
      .filter(Boolean);
    const lastName = rest.join(" ");
    const competencyStages = Object.keys(
      member.assignmentCompetency?.stageCounts ?? {},
    ).filter(
      (stage) =>
        Number(
          (
            member.assignmentCompetency?.stageCounts as
              | Record<string, number>
              | undefined
          )?.[stage] ?? 0,
        ) > 0,
    );

    return {
      badge: member.badge,
      fullName: member.fullName,
      firstName,
      lastName,
      initials:
        member.initials ??
        member.fullName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      shift: member.shift,
      primaryRole: member.role,
      secondaryRoles: [],
      status:
        member.availabilityStatus === "AVAILABLE"
          ? "active"
          : member.availabilityStatus === "ON_ASSIGNMENT"
            ? "meeting"
            : "offline",
      experiencedStages: competencyStages,
      traineeEligibleStages: [],
      avatarPath: null,
      currentProjectIds: member.activeAssignments.map(
        (assignment) => assignment.projectId,
      ),
      currentSheetNames: member.activeAssignments.map(
        (assignment) => assignment.sheetName,
      ),
    } satisfies AssignableMember;
  });
}

function recurrencePresetForScope(
  scope: ProjectTaskScope,
): ProjectTaskRecurrenceCadence {
  return scope === "legal" ? "weekly" : "daily";
}

function getPreferredLegalRevision(project: LegalProjectRecord | null): string {
  if (!project) return "";
  return (
    project.latestRevision ??
    project.revisions[project.revisions.length - 1]?.revision ??
    ""
  );
}

function getInitialsFromName(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function memberMatchesTeam(
  member: AssignableMember,
  team: ProjectTaskTeam | null,
): boolean {
  if (!team) return true;
  if (team.memberBadges.length > 0) {
    return team.memberBadges.includes(member.badge);
  }

  const tags = new Set(team.skillTags.map((tag) => tag.toUpperCase()));
  if (member.primaryRole && tags.has(member.primaryRole.toUpperCase())) {
    return true;
  }
  return member.experiencedStages.some((stage) =>
    tags.has(stage.toUpperCase()),
  );
}

/**
 * Maps an assignment's current stage to the next operation the worker will perform.
 * READY_ statuses represent unassigned queue positions.
 */
const STAGE_NEXT_OPERATION: Record<string, string> = {
  // Stage IDs from the manifest
  BUILD_UP:       "Build Up",
  WIRING:         "Wire",
  WIRING_IPV:     "Wire IPV",
  BOX_BUILD:      "Box Build",
  CROSS_WIRE:     "Cross Wire",
  CROSS_WIRE_IPV: "Cross Wire IPV",
  TEST_1ST_PASS:  "Test",
  POWER_CHECK:    "BIQ",
  BIQ:            "BIQ",
  FINISHED_BIQ:   "Complete",
  // Explicit queue/status strings the user called out
  READY_TO_LAY:        "Build Up",
  READY_TO_WIRE:       "Wire",
  READY_FOR_VISUAL:    "Wire IPV",
  READY_TO_HANG:       "Box Build",
  READY_TO_CROSS_WIRE: "Cross Wire",
  READY_TO_TEST:       "Test",
  GREEN_CHANGE:        "Green Change",
};

function stageToNextOperation(stage: string): string {
  return STAGE_NEXT_OPERATION[stage] ?? STAGE_NEXT_OPERATION[stage.toUpperCase()] ?? stage;
}

/** Linear stage order — used to build dependency + operation gating for "When Ready". */
const STAGE_ORDER: Array<{ id: string; label: string }> = [
  { id: "BUILD_UP",       label: "Build Up" },
  { id: "WIRING",         label: "Wiring" },
  { id: "WIRING_IPV",     label: "Wire IPV" },
  { id: "BOX_BUILD",      label: "Box Build" },
  { id: "CROSS_WIRE",     label: "Cross Wire" },
  { id: "CROSS_WIRE_IPV", label: "Cross Wire IPV" },
  { id: "TEST_1ST_PASS",  label: "Test" },
  { id: "BIQ",            label: "BIQ" },
  { id: "FINISHED_BIQ",   label: "Complete" },
];

const QUEUE_TO_STAGE_ID: Record<string, string> = {
  READY_TO_LAY: "BUILD_UP",
  READY_TO_WIRE: "WIRING",
  READY_FOR_VISUAL: "WIRING_IPV",
  READY_TO_HANG: "BOX_BUILD",
  READY_TO_CROSS_WIRE: "CROSS_WIRE",
  READY_TO_TEST: "TEST_1ST_PASS",
  TEST_1ST_PASS: "TEST_1ST_PASS",
  BIQ_COMPLETE: "FINISHED_BIQ",
  GREEN_CHANGE: "FINISHED_BIQ",
};

function normalizeToStageId(stageOrQueue: string): string {
  const upper = stageOrQueue.toUpperCase();
  return QUEUE_TO_STAGE_ID[upper] ?? upper;
}

function toWhenReadyOperationOptions(
  stage: string,
): Array<{ value: string; label: string; disabled: boolean }> {
  const normalizedStage = normalizeToStageId(stage);
  const currentIndex = STAGE_ORDER.findIndex((item) => item.id === normalizedStage);

  return STAGE_ORDER.map((item, index) => ({
    value: item.label,
    label: item.label,
    disabled: currentIndex !== -1 ? index < currentIndex : false,
  }));
}

function toProjectAssignmentOptions(project: ProjectManifest | null) {
  if (!project)
    return [] as Array<{ id: string; label: string; stage: string; nextOperation: string; isUnassigned: boolean }>;

  return Object.entries(project.assignments ?? {})
    .filter(([, assignment]) => {
      // Show only unassigned (no badge) or NOT_STARTED / ready-queue statuses
      const hasNoAssignee = !assignment.boardAssignment?.assignedBadge;
      const isQueueStatus =
        assignment.status === "NOT_STARTED" ||
        assignment.status === "INCOMPLETE" ||
        !assignment.boardAssignment?.assignedBadge;
      return hasNoAssignee || isQueueStatus;
    })
    .map(([assignmentId, assignment]) => {
      const stage = assignment.stage ?? "";
      const nextOperation = stageToNextOperation(stage);
      return {
        id: assignmentId,
        label: assignment.sheetName || assignment.sheetSlug || assignmentId,
        stage,
        nextOperation,
        isUnassigned: !assignment.boardAssignment?.assignedBadge,
      };
    });
}

function toScheduleLabel(scheduleMode: ProjectScheduleMode): string {
  return PROJECT_SCHEDULE_OPTIONS.find((option) => option.value === scheduleMode)?.label ?? scheduleMode;
}

function toPreviewDateTime(createState: CreateTaskState): string {
  if (createState.scheduleMode === "before-due" && createState.scheduleDateTime) {
    const dt = new Date(createState.scheduleDateTime);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return new Date().toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectWorklogWidget({
  badge,
  shift,
  className,
  showActivityTab = true,
  initialTab = "tasks",
  scopeContext = null,
}: ProjectWorklogWidgetProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectManifest[]>([]);
  const [legalOptions, setLegalOptions] = useState<LegalProjectRecord[]>([]);
  const [teamOptions, setTeamOptions] = useState<ProjectTaskTeam[]>([]);
  const [selectedPipelineOperation, setSelectedPipelineOperation] = useState<string>("");
  const [pipelineAssignees, setPipelineAssignees] = useState<Record<string, string>>({});
  const [createState, setCreateState] = useState<CreateTaskState>(() => ({
    ...DEFAULT_CREATE_STATE,
    scope: scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
    projectId: scopeContext?.projectId ?? "",
    pdNumber: scopeContext?.pdNumber ?? "",
    legalRevision: scopeContext?.legalRevision ?? "",
    assignedToBadge: badge,
    teamId: "",
    recurrenceCadence: recurrencePresetForScope(
      scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
    ),
  }));
  const scopeLocked = Boolean(scopeContext);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/project-tasks?assignedToBadge=${encodeURIComponent(badge)}&includeDone=true`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        tasks?: ProjectTask[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load tasks");
      }
      setTasks(payload.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [badge]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const response = await fetch("/api/board/data", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as BoardDataResponse;
        if (!cancelled) {
          setMembers(toAssignableMembers(payload));
        }
      } catch {
        // Keep widget functional even when member roster fails.
      }
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scopeContext) return;
    setCreateState((prev) => ({
      ...prev,
      scope: scopeContext.scope,
      projectId: scopeContext.projectId ?? prev.projectId,
      pdNumber: scopeContext.pdNumber ?? prev.pdNumber,
      legalRevision: scopeContext.legalRevision ?? prev.legalRevision,
      recurrenceCadence: recurrencePresetForScope(scopeContext.scope),
      recurrenceEnabled: true,
    }));
  }, [scopeContext]);

  useEffect(() => {
    if (!isCreateOpen || scopeLocked) {
      return;
    }

    let cancelled = false;
    setContextLoading(true);

    Promise.all([
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/legal-drawings", { cache: "no-store" }),
      fetch("/api/project-task-teams", { cache: "no-store" }),
    ])
      .then(async ([projectsResponse, legalResponse, teamsResponse]) => {
        const [projectPayload, legalPayload, teamsPayload] = await Promise.all([
          projectsResponse.ok
            ? (projectsResponse.json() as Promise<ProjectTaskApiResponse>)
            : Promise.resolve({ manifests: [] }),
          legalResponse.ok
            ? (legalResponse.json() as Promise<LegalTaskApiResponse>)
            : Promise.resolve({ projects: [] }),
          teamsResponse.ok
            ? (teamsResponse.json() as Promise<TeamApiResponse>)
            : Promise.resolve({ teams: [] }),
        ]);

        if (cancelled) return;

        const nextProjects = projectPayload.manifests ?? [];
        const nextLegals = legalPayload.projects ?? [];
        const nextTeams = teamsPayload.teams ?? [];
        setProjectOptions(nextProjects);
        setLegalOptions(nextLegals);
        setTeamOptions(nextTeams);

        setCreateState((prev) => {
          if (prev.scope === "project") {
            const selectedProject =
              nextProjects.find((project) => project.id === prev.projectId) ??
              null;
            if (!selectedProject) {
              return prev;
            }

            return {
              ...prev,
              projectId: selectedProject.id,
              pdNumber: selectedProject.pdNumber,
            };
          }

          const selectedLegal =
            nextLegals.find((project) => project.pdNumber === prev.pdNumber) ??
            nextLegals[0] ??
            null;
          if (!selectedLegal) {
            return prev;
          }

          return {
            ...prev,
            pdNumber: selectedLegal.pdNumber,
            legalRevision:
              prev.legalRevision || getPreferredLegalRevision(selectedLegal),
          };
        });
      })
      .finally(() => {
        if (!cancelled) {
          setContextLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCreateOpen, scopeLocked]);

  useEffect(() => {
    setCreateState((prev) => ({
      ...prev,
      recurrenceCadence: recurrencePresetForScope(prev.scope),
      recurrenceEnabled: true,
    }));
  }, [createState.scope]);

  const openCount = useMemo(
    () => tasks.filter((task) => task.status !== "done").length,
    [tasks],
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "done").length,
    [tasks],
  );

  const handleCreateTask = async () => {
    if (createState.scope === "project" && !createState.projectId) {
      setError("Project selection is required.");
      return;
    }
    if (createState.scope === "project" && !createState.assignmentId) {
      setError("Assignment selection is required.");
      return;
    }
    if (
      createState.scope === "project" &&
      createState.scheduleMode === "before-due" &&
      !createState.scheduleDateTime
    ) {
      setError("Before Due Date/Time is required for this schedule.");
      return;
    }
    if (!createState.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const resolvedAssignedToBadge =
        createState.scheduleMode === "when-ready" && createState.operation
          ? (pipelineAssignees[createState.operation] || "")
          : createState.assignedToBadge;

      const response = await fetch("/api/project-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createState.title,
          scope: createState.scope,
          operation: createState.operation || undefined,
          action: createState.taskAction || undefined,
          projectId: createState.projectId || undefined,
          pdNumber: createState.pdNumber || undefined,
          legalRevision: createState.legalRevision || undefined,
          dueDate: createState.dueDate || undefined,
          assignedToBadge: resolvedAssignedToBadge || undefined,
          teamId: createState.teamId || undefined,
          createdByBadge: badge,
          createdByShift: shift,
          recurrence: {
            enabled:
              createState.scope === "legal"
                ? createState.recurrenceEnabled
                : false,
            cadence: createState.recurrenceCadence,
            interval: 1,
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        task?: ProjectTask;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create task");
      }

      setTasks((prev) => [payload.task as ProjectTask, ...prev]);
      setIsCreateOpen(false);
      setCreateState({
        ...DEFAULT_CREATE_STATE,
        scope: scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
        projectId: scopeContext?.projectId ?? "",
        pdNumber: scopeContext?.pdNumber ?? "",
        legalRevision: scopeContext?.legalRevision ?? "",
        assignedToBadge: badge,
        teamId: "",
        recurrenceCadence: recurrencePresetForScope(
          scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const cycleStatus = (
    status: ProjectTask["status"],
  ): ProjectTask["status"] => {
    if (status === "open") return "in_progress";
    if (status === "in_progress") return "done";
    return "open";
  };

  const handleCycleTaskStatus = async (task: ProjectTask) => {
    const nextStatus = cycleStatus(task.status);
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item,
      ),
    );

    const response = await fetch(
      `/api/project-tasks/${encodeURIComponent(task.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          actorBadge: badge,
          actorShift: shift,
          projectId: task.projectId,
          previousStatus: task.status,
        }),
      },
    );

    if (!response.ok) {
      setTasks((prev) =>
        prev.map((item) => (item.id === task.id ? task : item)),
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(payload.error || "Failed to update task");
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      task?: ProjectTask;
    };
    if (payload.task) {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? (payload.task as ProjectTask) : item,
        ),
      );
      void loadTasks();
    }
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((item) => item.id !== task.id));

    const response = await fetch(
      `/api/project-tasks/${encodeURIComponent(task.id)}?actorBadge=${encodeURIComponent(badge)}&actorShift=${encodeURIComponent(shift)}&projectId=${encodeURIComponent(task.projectId || "")}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      setTasks(previous);
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(payload.error || "Failed to delete task");
    }
  };

  const selectedProject = useMemo(
    () =>
      projectOptions.find((project) => project.id === createState.projectId) ??
      null,
    [projectOptions, createState.projectId],
  );
  const projectAssignmentOptions = useMemo(
    () => toProjectAssignmentOptions(selectedProject),
    [selectedProject],
  );
  const selectedAssignmentOption = useMemo(
    () =>
      projectAssignmentOptions.find(
        (a) => a.id === createState.assignmentId,
      ) ?? null,
    [projectAssignmentOptions, createState.assignmentId],
  );
  const whenReadyOperationOptions = useMemo(
    () => toWhenReadyOperationOptions(selectedAssignmentOption?.stage ?? ""),
    [selectedAssignmentOption],
  );
  const selectedTeam = useMemo(
    () => teamOptions.find((team) => team.id === createState.teamId) ?? null,
    [teamOptions, createState.teamId],
  );
  const assignableMembers = useMemo(() => {
    const teamFiltered = members.filter((member) =>
      memberMatchesTeam(member, selectedTeam),
    );

    if (createState.scope !== "project") {
      return teamFiltered;
    }

    if (createState.scheduleMode === "when-ready") {
      // Keep when-ready assignee selection broad; assignment is optional per stage card.
      return teamFiltered;
    }

    if (createState.scheduleMode === "overtime") {
      return teamFiltered.filter((member) =>
        /overtime|ot/i.test(member.shift || ""),
      );
    }

    return teamFiltered;
  }, [
    members,
    selectedTeam,
    createState.scope,
    createState.scheduleMode,
    selectedAssignmentOption,
  ]);
  const memberByBadge = useMemo(
    () => new Map(members.map((member) => [member.badge, member])),
    [members],
  );
  const selectedLegalProject = useMemo(
    () =>
      legalOptions.find(
        (project) => project.pdNumber === createState.pdNumber,
      ) ?? null,
    [createState.pdNumber, legalOptions],
  );
  const whenReadyPreviewOperations = useMemo(() => {
    if (createState.scope !== "project") return [] as string[];
    if (createState.scheduleMode !== "when-ready") return [] as string[];

    const enabled = whenReadyOperationOptions
      .filter((option) => !option.disabled)
      .map((option) => option.value);
    if (enabled.length === 0) return [];

    if (createState.operation && enabled.includes(createState.operation)) {
      // Reversed direction: show only prerequisite operations before the selected operation.
      return enabled.slice(0, enabled.indexOf(createState.operation));
    }

    return enabled;
  }, [
    createState.scope,
    createState.scheduleMode,
    createState.operation,
    whenReadyOperationOptions,
  ]);

  useEffect(() => {
    if (createState.scheduleMode !== "when-ready") {
      setSelectedPipelineOperation("");
      setPipelineAssignees({});
      return;
    }

    if (
      selectedPipelineOperation &&
      !whenReadyPreviewOperations.includes(selectedPipelineOperation)
    ) {
      setSelectedPipelineOperation("");
    }
  }, [
    createState.scheduleMode,
    selectedPipelineOperation,
    whenReadyPreviewOperations,
  ]);

  useEffect(() => {
    if (createState.scheduleMode !== "when-ready") return;

    setPipelineAssignees((prev) => {
      const next: Record<string, string> = {};
      for (const operation of whenReadyPreviewOperations) {
        if (prev[operation]) {
          next[operation] = prev[operation];
        }
      }
      return next;
    });
  }, [createState.scheduleMode, whenReadyPreviewOperations]);

  useEffect(() => {
    if (createState.scope !== "project") return;

    const nextOperation = selectedAssignmentOption?.nextOperation ?? "";
    const scheduleLabel = toScheduleLabel(createState.scheduleMode);
    const resolvedOperation =
      createState.scheduleMode === "when-ready"
        ? createState.operation || nextOperation
        : nextOperation;
    // Keep project task title focused; project + schedule are already visible elsewhere.
    const assignmentLabel = selectedAssignmentOption?.label ?? "";
    const autoTitle = [assignmentLabel, resolvedOperation]
      .filter(Boolean)
      .join(" • ");

    setCreateState((prev) => ({
      ...prev,
      operation: resolvedOperation,
      taskAction: scheduleLabel,
      title: prev.titleManuallyEdited ? prev.title : autoTitle,
    }));
  }, [
    createState.scope,
    createState.operation,
    createState.scheduleMode,
    selectedAssignmentOption,
    selectedProject,
  ]);

  useEffect(() => {
    if (createState.scheduleMode !== "when-ready") return;
    // Do not auto-assign to the current/session user in when-ready mode.
    setCreateState((prev) => ({
      ...prev,
      assignedToBadge: "",
    }));
  }, [createState.scheduleMode]);

  return (
    <div
      className={cn(
        "min-w-sm max-w-min flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <Tabs defaultValue={initialTab} className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Worklog
              </div>
              <div className="text-[11px] text-muted-foreground">
                {openCount} open • {completedCount} done
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </Button>
          </div>
          <TabsList
            className={cn(
              "grid w-full",
              showActivityTab ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            {showActivityTab ? (
              <TabsTrigger value="activity">Activity</TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="tasks" className="m-0 flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/70 px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => void loadTasks()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No tasks yet
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {scopeContext?.pdNumber
                        ? `No tasks for ${scopeContext.pdNumber} yet.`
                        : "Create your first task to get started."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Task
                  </Button>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {task.assignedToBadge ? (
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={
                                  memberByBadge.get(task.assignedToBadge)
                                    ?.avatarPath ?? undefined
                                }
                                alt={
                                  memberByBadge.get(task.assignedToBadge)
                                    ?.fullName ?? task.assignedToBadge
                                }
                              />
                              <AvatarFallback className="text-[9px] font-medium">
                                {memberByBadge.get(task.assignedToBadge)
                                  ?.initials ??
                                  getInitialsFromName(
                                    memberByBadge.get(task.assignedToBadge)
                                      ?.fullName ?? task.assignedToBadge,
                                  )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">
                              {memberByBadge.get(task.assignedToBadge)
                                ?.fullName ?? task.assignedToBadge}
                            </span>
                          </div>
                        ) : null}
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            task.status === "done" &&
                              "line-through text-muted-foreground",
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {task.scope === "project" ? "Project" : "Legal"}
                          </Badge>
                          {task.pdNumber && (
                            <Badge variant="outline" className="text-[10px]">
                              {task.pdNumber}
                            </Badge>
                          )}
                          {task.dueDate && (
                            <Badge variant="outline" className="text-[10px]">
                              Due {task.dueDate}
                            </Badge>
                          )}
                          {task.recurrence.enabled && (
                            <Badge variant="secondary" className="text-[10px]">
                              <TimerReset className="mr-1 h-3 w-3" />
                              {task.recurrence.cadence}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setActiveTask(task)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void handleCycleTaskStatus(task)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void handleDeleteTask(task)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {showActivityTab ? (
          <TabsContent value="activity" className="m-0 flex min-h-0 flex-1">
            <div className="flex min-h-0 flex-1">
              <ActivityTimelineContextPanel badge={badge} shift={shift} />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      {/* ── Create Task Dialog ──────────────────────────────────── */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setSelectedPipelineOperation("");
            setPipelineAssignees({});
            setCreateState({
              ...DEFAULT_CREATE_STATE,
              scope: scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
              projectId: scopeContext?.projectId ?? "",
              pdNumber: scopeContext?.pdNumber ?? "",
              legalRevision: scopeContext?.legalRevision ?? "",
              assignedToBadge: badge,
              teamId: "",
              recurrenceCadence: recurrencePresetForScope(
                scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
              ),
            });
            setError(null);
          }
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl"
          onInteractOutside={(event) => {
            const target = getOutsideInteractionTarget(event as Event);
            if (
              isPortaledOverlayInteraction(target) ||
              target?.closest('[data-member-assignment-dropdown="true"]')
            ) {
              event.preventDefault();
            }
          }}
        >
          {/* Header */}
          <div className="border-b border-border px-6 py-5">
            <DialogTitle className="text-base font-semibold">
              Create Task
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              {scopeContext?.pdNumber
                ? `Adding a task to ${scopeContext.pdNumber}`
                : "Add a new task to your worklog."}
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="space-y-5">

                {/* ── Step 1: Scope selector ─────────────────────── */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Scope</Label>
                  <div className="flex gap-2">
                    {(["project", "legal"] as ProjectTaskScope[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={scopeLocked}
                        onClick={() =>
                          setCreateState((prev) => ({
                            ...prev,
                            scope: s,
                            taskTemplate: "custom",
                            assignmentId: "",
                            scheduleMode: "immediate",
                            scheduleDateTime: "",
                            operation: "",
                            taskAction: "",
                            title: "",
                            titleManuallyEdited: false,
                            projectId: "",
                            pdNumber: "",
                            legalRevision: "",
                          }))
                        }
                        className={cn(
                          "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                          createState.scope === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                          scopeLocked && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {s === "project" ? "Project" : "Legal"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Step 2: Scope-driven flow fields ───────────── */}
                {createState.scope === "project" ? (
                  <div className="grid gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Project
                      </Label>
                      <ProjectPickerWithContext
                        projects={projectOptions}
                        selectedId={createState.projectId}
                        onSelectionChange={(projectId, pdNumber) => {
                          setCreateState((prev) => ({
                            ...prev,
                            projectId,
                            pdNumber,
                            assignmentId: "",
                            scheduleMode: "immediate",
                            scheduleDateTime: "",
                            operation: "",
                            taskAction: "",
                            title: "",
                            titleManuallyEdited: false,
                          }));
                        }}
                        loading={contextLoading}
                        placeholder="Select project"
                      />
                    </div>

                    {createState.projectId && (
                      <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-2">
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Assignment
                          </Label>
                          <Select
                            value={createState.assignmentId || "_none"}
                            onValueChange={(value) => {
                              const assignmentId = value === "_none" ? "" : value;
                              setCreateState((prev) => ({
                                ...prev,
                                assignmentId,
                                scheduleMode: "immediate",
                                scheduleDateTime: "",
                                title: prev.titleManuallyEdited ? prev.title : "",
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select assignment" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" index={0}>
                                — Select assignment —
                              </SelectItem>
                              {projectAssignmentOptions.map((assignment, index) => (
                                <SelectItem key={assignment.id} value={assignment.id} index={index + 1}>
                                  {assignment.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Schedule
                          </Label>
                          <Select
                            value={createState.scheduleMode}
                            disabled={!createState.assignmentId}
                            onValueChange={(value) => {
                              const scheduleMode = value as ProjectScheduleMode;
                              setCreateState((prev) => ({
                                ...prev,
                                scheduleMode,
                                taskAction: toScheduleLabel(scheduleMode),
                                scheduleDateTime:
                                  scheduleMode === "before-due" ? prev.scheduleDateTime : "",
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Schedule" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROJECT_SCHEDULE_OPTIONS.map((option, index) => (
                                <SelectItem key={option.value} value={option.value} index={index}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {createState.scheduleMode === "before-due" && createState.assignmentId && (
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Before Due Date/Time
                        </Label>
                        <Input
                          type="datetime-local"
                          className="h-9"
                          value={createState.scheduleDateTime}
                          onChange={(event) => {
                            const nextDateTime = event.target.value;
                            setCreateState((prev) => ({
                              ...prev,
                              scheduleDateTime: nextDateTime,
                              dueDate: nextDateTime ? nextDateTime.slice(0, 10) : prev.dueDate,
                            }));
                          }}
                        />
                      </div>
                    )}

                    {createState.scheduleMode === "when-ready" && createState.assignmentId && (
                      <div className="grid gap-2">
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Operation Selection
                          </Label>
                          <Select
                            value={createState.operation || "_none"}
                            onValueChange={(value) => {
                              const operation = value === "_none" ? "" : value;
                              setCreateState((prev) => ({
                                ...prev,
                                operation,
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select operation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" index={0}>
                                — Select operation —
                              </SelectItem>
                              {whenReadyOperationOptions.map((option, index) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  index={index + 1}
                                  disabled={option.disabled}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Previous status queues are disabled until prerequisites are complete.
                          </p>
                        </div>

                        {whenReadyPreviewOperations.length > 0 ? (
                          <div className="grid gap-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground">
                                Stage Pipeline
                              </Label>
                              {createState.operation && (
                                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  {createState.operation}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Task activates once all prior stages in the queue have cleared.
                            </p>
                            <div className="grid gap-2 pt-1">
                              <Label className="text-xs font-medium text-muted-foreground">
                                Pipeline Cards
                              </Label>
                              <div className="grid gap-1.5">
                                {whenReadyPreviewOperations.map((operation) => {
                                  const isActive = selectedPipelineOperation === operation;
                                  const assignedBadge = pipelineAssignees[operation] ?? "";
                                  const assignedMember = assignedBadge
                                    ? memberByBadge.get(assignedBadge)
                                    : null;
                                  return (
                                    <button
                                      key={operation}
                                      type="button"
                                      onClick={() =>
                                        setSelectedPipelineOperation((prev) =>
                                          prev === operation ? "" : operation,
                                        )
                                      }
                                      className={cn(
                                        "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                                        isActive
                                          ? "border-primary/40 bg-primary/10 text-primary"
                                          : "border-border bg-background hover:bg-muted/40",
                                      )}
                                    >
                                      <div className="font-medium">{operation}</div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {assignedMember?.fullName || "Unassigned"}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {selectedPipelineOperation ? (
                                <div className="grid gap-1.5 rounded-md border border-border/70 bg-muted/20 p-2">
                                  <Label className="text-xs font-medium text-muted-foreground">
                                    Optional Assignee ({selectedPipelineOperation})
                                  </Label>
                                  <TaskAssignSelector
                                    members={assignableMembers}
                                    teams={teamOptions}
                                    selectedTeamId={createState.teamId}
                                    selectedBadge={pipelineAssignees[selectedPipelineOperation] ?? ""}
                                    onTeamChange={(teamId) =>
                                      setCreateState((prev) => ({
                                        ...prev,
                                        teamId,
                                      }))
                                    }
                                    onSelectBadge={(badge) =>
                                      setPipelineAssignees((prev) => ({
                                        ...prev,
                                        [selectedPipelineOperation]: badge,
                                      }))
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {createState.operation && createState.scheduleMode !== "when-ready" && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground">Next Operation:</span>
                        <span className="text-xs font-semibold text-foreground">{createState.operation}</span>
                      </div>
                    )}

                    {/* ── Assign To ──────────────────────────────── */}
                    {createState.assignmentId && createState.scheduleMode !== "when-ready" && (
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">Assign To</Label>
                        <TaskAssignSelector
                          members={assignableMembers}
                          teams={teamOptions}
                          selectedTeamId={createState.teamId}
                          selectedBadge={createState.assignedToBadge}
                          onTeamChange={(teamId) =>
                            setCreateState((prev) => ({
                              ...prev,
                              teamId,
                              assignedToBadge: "",
                            }))
                          }
                          onSelectBadge={(badge) =>
                            setCreateState((prev) => ({
                              ...prev,
                              assignedToBadge: badge,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Select Legal (optional) */}
                    <div className="flex flex-row gap-4">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Select Legal <span className="text-muted-foreground/60">(optional)</span>
                        </Label>
                        <Select
                          value={createState.pdNumber || "_none"}
                          onValueChange={(value) => {
                            if (value === "_none") {
                              setCreateState((prev) => ({ ...prev, pdNumber: "", legalRevision: "" }));
                              return;
                            }
                            const selectedLegal = legalOptions.find((p) => p.pdNumber === value) ?? null;
                            setCreateState((prev) => ({
                              ...prev,
                              pdNumber: value,
                              legalRevision: getPreferredLegalRevision(selectedLegal),
                            }));
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={contextLoading ? "Loading…" : "Select PD (optional)"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none" index={0}>
                              — None —
                            </SelectItem>
                            {legalOptions.map((project, index) => (
                              <SelectItem key={project.pdNumber} value={project.pdNumber} index={index + 1}>
                                {project.pdNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {createState.pdNumber && selectedLegalProject && (
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Revision</Label>
                          <Select
                            value={createState.legalRevision}
                            onValueChange={(value) =>
                              setCreateState((prev) => ({ ...prev, legalRevision: value }))
                            }
                          >
                            <SelectTrigger className="h-9 w-32">
                              <SelectValue placeholder="Rev" />
                            </SelectTrigger>
                            <SelectContent>
                              {(selectedLegalProject.revisions ?? []).map((revision, index) => (
                                <SelectItem key={revision.revision} value={revision.revision} index={index}>
                                  {revision.revision}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 3: Title (legal only — auto-generated for project) ── */}
                {createState.scope !== "project" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="task-title" className="text-xs font-medium">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task-title"
                    value={createState.title}
                    placeholder={
                      createState.operation && createState.taskAction
                        ? `${createState.operation}: ${createState.taskAction}`
                        : "e.g. Review wire list rev B"
                    }
                    className="h-9"
                    onChange={(event) =>
                      setCreateState((prev) => ({
                        ...prev,
                        title: event.target.value,
                        titleManuallyEdited: event.target.value.length > 0,
                        taskTemplate: "custom",
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateTask();
                    }}
                    autoFocus
                  />
                  {createState.operation && createState.taskAction && !createState.titleManuallyEdited && (
                    <p className="text-[11px] text-muted-foreground">
                      Auto-filled from operation + action. Edit to customise.
                    </p>
                  )}
                </div>
                )}


                {/* Recurrence (legal-only) */}
                {createState.scope === "legal" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        createState.recurrenceEnabled
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                      onClick={() =>
                        setCreateState((prev) => ({
                          ...prev,
                          recurrenceEnabled: !prev.recurrenceEnabled,
                        }))
                      }
                    >
                      <TimerReset className="h-3.5 w-3.5" />
                      Recurring
                    </button>
                    {createState.recurrenceEnabled && (
                      <Select
                        value={createState.recurrenceCadence}
                        onValueChange={(value) =>
                          setCreateState((prev) => ({
                            ...prev,
                            recurrenceCadence: value as ProjectTaskRecurrenceCadence,
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue placeholder="Cadence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily" index={0}>
                            Daily
                          </SelectItem>
                          <SelectItem value="weekly" index={1}>
                            Weekly
                          </SelectItem>
                          <SelectItem value="monthly" index={2}>
                            Monthly
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              <aside className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 lg:sticky lg:top-0 lg:self-start">
                {createState.scope === "project" && (createState.title || selectedAssignmentOption) ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Preview
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        How this task will appear in the Worklog
                      </p>
                    </div>
                    {createState.scheduleMode === "when-ready" && whenReadyPreviewOperations.length > 0 ? (
                      <div className="grid gap-2">
                        {whenReadyPreviewOperations.map((operation) => (
                          <TaskPreviewCard
                            key={operation}
                            title={[selectedAssignmentOption?.label ?? "", operation].filter(Boolean).join(" • ")}
                            assignedToBadge={pipelineAssignees[operation] ?? ""}
                            memberByBadge={memberByBadge}
                            selectedProject={selectedProject}
                            operation={operation}
                            previewDateTime={toPreviewDateTime(createState)}
                            scheduleHint="When Ready"
                          />
                        ))}
                      </div>
                    ) : (
                      <TaskPreviewCard
                        title={createState.title}
                        assignedToBadge={createState.assignedToBadge}
                        memberByBadge={memberByBadge}
                        selectedProject={selectedProject}
                        operation={createState.operation}
                        previewDateTime={toPreviewDateTime(createState)}
                        scheduleHint={createState.scheduleMode === "when-ready" ? "When Ready" : undefined}
                      />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      Fill in the form to see a preview
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="flex-1">
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTask}
                disabled={saving || !createState.title.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Task Details Dialog ─────────────────────────────────── */}
      <Dialog
        open={Boolean(activeTask)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setActiveTask(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
            <DialogDescription>
              Task context, ownership, and recurrence metadata.
            </DialogDescription>
          </DialogHeader>

          {activeTask ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeTask.title}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {activeTask.scope === "project" ? "Project" : "Legal"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {activeTask.status.replace("_", " ")}
                  </Badge>
                  {activeTask.dueDate ? (
                    <Badge variant="outline" className="text-[10px]">
                      Due {activeTask.dueDate}
                    </Badge>
                  ) : null}
                  {activeTask.recurrence.enabled ? (
                    <Badge variant="outline" className="text-[10px]">
                      {activeTask.recurrence.cadence}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Assigned To</span>
                  {activeTask.assignedToBadge ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={
                            memberByBadge.get(activeTask.assignedToBadge)
                              ?.avatarPath ?? undefined
                          }
                          alt={
                            memberByBadge.get(activeTask.assignedToBadge)
                              ?.fullName ?? activeTask.assignedToBadge
                          }
                        />
                        <AvatarFallback className="text-[9px]">
                          {memberByBadge.get(activeTask.assignedToBadge)
                            ?.initials ??
                            getInitialsFromName(
                              memberByBadge.get(activeTask.assignedToBadge)
                                ?.fullName ?? activeTask.assignedToBadge,
                            )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">
                        {memberByBadge.get(activeTask.assignedToBadge)
                          ?.fullName ?? activeTask.assignedToBadge}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Project ID</span>
                  <span className="font-mono text-foreground">
                    {activeTask.projectId || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">PD Number</span>
                  <span className="font-mono text-foreground">
                    {activeTask.pdNumber || "—"}
                  </span>
                </div>
                {activeTask.scope === "legal" ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Legal Revision
                    </span>
                    <span className="font-mono text-foreground">
                      {activeTask.legalRevision || "—"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {activeTask?.projectId ? (
              <Button asChild variant="outline" className="mr-auto">
                <a
                  href={`/${encodeURIComponent(badge)}/projects/${encodeURIComponent(activeTask.projectId)}`}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Project
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setActiveTask(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectWorklogWidget;
