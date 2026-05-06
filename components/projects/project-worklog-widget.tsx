"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, FileText, Loader2, Plus, RefreshCw, Repeat, TimerReset, Trash2 } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ProjectTask, ProjectTaskRecurrenceCadence, ProjectTaskScope } from "@/types/project-task";
import { type AssignableMember } from "@/components/projects/member-assignment-selector";
import { MemberQuickSelector } from "@/components/projects/member-quick-selector";
import { ProjectPickerWithContext } from "@/components/projects/project-picker-with-context";
import { DateField } from "@/components/projects/fields";
import type { BoardDataResponse } from "@/lib/board/types";
import type { ProjectManifest } from "@/types/project-manifest";
import type { LegalProjectRecord } from "@/types/legal-drawings";
import type { ProjectTaskTeam } from "@/types/project-task-team";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

type CreateTaskState = {
  title: string;
  scope: ProjectTaskScope;
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
  scope: "project",
  projectId: "",
  pdNumber: "",
  legalRevision: "",
  dueDate: "",
  assignedToBadge: "",
  teamId: "",
  recurrenceEnabled: true,
  recurrenceCadence: "daily",
};

function toAssignableMembers(data: BoardDataResponse | null): AssignableMember[] {
  if (!data?.members?.length) return [];
  return data.members.map((member) => {
    const [firstName = member.fullName, ...rest] = member.fullName.split(" ").filter(Boolean);
    const lastName = rest.join(" ");
    const competencyStages = Object.keys(member.assignmentCompetency?.stageCounts ?? {}).filter(
      (stage) => Number((member.assignmentCompetency?.stageCounts as Record<string, number> | undefined)?.[stage] ?? 0) > 0,
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
      currentProjectIds: member.activeAssignments.map((assignment) => assignment.projectId),
      currentSheetNames: member.activeAssignments.map((assignment) => assignment.sheetName),
    } satisfies AssignableMember;
  });
}

function recurrencePresetForScope(scope: ProjectTaskScope): ProjectTaskRecurrenceCadence {
  return scope === "legal" ? "weekly" : "daily";
}

function getPreferredLegalRevision(project: LegalProjectRecord | null): string {
  if (!project) return "";
  return project.latestRevision ?? project.revisions[project.revisions.length - 1]?.revision ?? "";
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

function memberMatchesTeam(member: AssignableMember, team: ProjectTaskTeam | null): boolean {
  if (!team) return true;
  if (team.memberBadges.length > 0) {
    return team.memberBadges.includes(member.badge);
  }

  const tags = new Set(team.skillTags.map((tag) => tag.toUpperCase()));
  if (member.primaryRole && tags.has(member.primaryRole.toUpperCase())) {
    return true;
  }
  return member.experiencedStages.some((stage) => tags.has(stage.toUpperCase()));
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
  const [createState, setCreateState] = useState<CreateTaskState>(() => ({
    ...DEFAULT_CREATE_STATE,
    scope: scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
    projectId: scopeContext?.projectId ?? "",
    pdNumber: scopeContext?.pdNumber ?? "",
    legalRevision: scopeContext?.legalRevision ?? "",
    assignedToBadge: badge,
    teamId: "",
    recurrenceCadence: recurrencePresetForScope(scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope),
  }));
  const scopeLocked = Boolean(scopeContext);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/project-tasks?assignedToBadge=${encodeURIComponent(badge)}&includeDone=true`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as { tasks?: ProjectTask[]; error?: string };
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
            const selectedProject = nextProjects.find((project) => project.id === prev.projectId) ?? null;
            if (!selectedProject) {
              return prev;
            }

            return {
              ...prev,
              projectId: selectedProject.id,
              pdNumber: selectedProject.pdNumber,
            };
          }

          const selectedLegal = nextLegals.find((project) => project.pdNumber === prev.pdNumber)
            ?? nextLegals[0]
            ?? null;
          if (!selectedLegal) {
            return prev;
          }

          return {
            ...prev,
            pdNumber: selectedLegal.pdNumber,
            legalRevision: prev.legalRevision || getPreferredLegalRevision(selectedLegal),
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
    if (!createState.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/project-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createState.title,
          scope: createState.scope,
          projectId: createState.projectId || undefined,
          pdNumber: createState.pdNumber || undefined,
          legalRevision: createState.legalRevision || undefined,
          dueDate: createState.dueDate || undefined,
          assignedToBadge: createState.assignedToBadge || undefined,
          teamId: createState.teamId || undefined,
          createdByBadge: badge,
          createdByShift: shift,
          recurrence: {
            enabled: createState.recurrenceEnabled,
            cadence: createState.recurrenceCadence,
            interval: 1,
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { task?: ProjectTask; error?: string };
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
        recurrenceCadence: recurrencePresetForScope(scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const cycleStatus = (status: ProjectTask["status"]): ProjectTask["status"] => {
    if (status === "open") return "in_progress";
    if (status === "in_progress") return "done";
    return "open";
  };

  const handleCycleTaskStatus = async (task: ProjectTask) => {
    const nextStatus = cycleStatus(task.status);
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)));

    const response = await fetch(`/api/project-tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        actorBadge: badge,
        actorShift: shift,
        projectId: task.projectId,
        previousStatus: task.status,
      }),
    });

    if (!response.ok) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Failed to update task");
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { task?: ProjectTask };
    if (payload.task) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? payload.task as ProjectTask : item)));
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
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Failed to delete task");
    }
  };

  const selectedAssignees = createState.assignedToBadge ? [createState.assignedToBadge] : [];
  const selectedTeam = useMemo(
    () => teamOptions.find((team) => team.id === createState.teamId) ?? null,
    [teamOptions, createState.teamId],
  );
  const assignableMembers = useMemo(
    () => members.filter((member) => memberMatchesTeam(member, selectedTeam)),
    [members, selectedTeam],
  );
  const memberByBadge = useMemo(
    () => new Map(members.map((member) => [member.badge, member])),
    [members],
  );
  const selectedLegalProject = useMemo(
    () => legalOptions.find((project) => project.pdNumber === createState.pdNumber) ?? null,
    [createState.pdNumber, legalOptions],
  );

  return (
    <div className={cn("min-w-sm max-w-min flex flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <Tabs defaultValue={initialTab} className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Worklog</div>
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
          <TabsList className={cn("grid w-full", showActivityTab ? "grid-cols-2" : "grid-cols-1")}>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            {showActivityTab ? <TabsTrigger value="activity">Activity</TabsTrigger> : null}
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
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
                    <p className="text-sm font-medium text-foreground">No tasks yet</p>
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
                  <div key={task.id} className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {task.assignedToBadge ? (
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={memberByBadge.get(task.assignedToBadge)?.avatarPath ?? undefined}
                                alt={memberByBadge.get(task.assignedToBadge)?.fullName ?? task.assignedToBadge}
                              />
                              <AvatarFallback className="text-[9px] font-medium">
                                {memberByBadge.get(task.assignedToBadge)?.initials
                                  ?? getInitialsFromName(memberByBadge.get(task.assignedToBadge)?.fullName ?? task.assignedToBadge)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">
                              {memberByBadge.get(task.assignedToBadge)?.fullName ?? task.assignedToBadge}
                            </span>
                          </div>
                        ) : null}
                        <p className={cn("truncate text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {task.scope === "project" ? "Project" : "Legal"}
                          </Badge>
                          {task.pdNumber && (
                            <Badge variant="outline" className="text-[10px]">{task.pdNumber}</Badge>
                          )}
                          {task.dueDate && (
                            <Badge variant="outline" className="text-[10px]">Due {task.dueDate}</Badge>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveTask(task)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleCycleTaskStatus(task)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleDeleteTask(task)}>
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
          setIsCreateOpen(open)
          if (!open) {
            setCreateState({
              ...DEFAULT_CREATE_STATE,
              scope: scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope,
              projectId: scopeContext?.projectId ?? "",
              pdNumber: scopeContext?.pdNumber ?? "",
              legalRevision: scopeContext?.legalRevision ?? "",
              assignedToBadge: badge,
              teamId: "",
              recurrenceCadence: recurrencePresetForScope(scopeContext?.scope ?? DEFAULT_CREATE_STATE.scope),
            })
            setError(null)
          }
        }}
      >
        <DialogContent
           className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg"
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-member-assignment-dropdown="true"]')) {
              event.preventDefault();
            }
          }}
        >
          {/* Header */}
          <div className="border-b border-border px-6 py-5">
            <DialogTitle className="text-base font-semibold">Create Task</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              {scopeContext?.pdNumber
                ? `Adding a task to ${scopeContext.pdNumber}`
                : "Add a new task to your worklog."}
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-title" className="text-xs font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={createState.title}
                placeholder="e.g. Review wire list rev B"
                className="h-9"
                onChange={(event) => setCreateState((prev) => ({ ...prev, title: event.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateTask(); }}
                autoFocus
              />
            </div>

            {/* Scope + Due Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Scope</Label>
                <Select
                  value={createState.scope}
                  onValueChange={(value) =>
                    setCreateState((prev) => ({ ...prev, scope: value as ProjectTaskScope }))
                  }
                  disabled={scopeLocked}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project" index={0}>Project</SelectItem>
                    <SelectItem value="legal" index={1}>Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DateField
                mode="create"
                label="Due Date"
                value={createState.dueDate ? new Date(`${createState.dueDate}T00:00:00`) : undefined}
                onChange={(date) => {
                  if (!date) { setCreateState((prev) => ({ ...prev, dueDate: "" })); return; }
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  setCreateState((prev) => ({ ...prev, dueDate: `${y}-${m}-${d}` }));
                }}
              />
            </div>

            {/* Context fields */}
            {!scopeLocked && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Context
                </p>
                {createState.scope === "project" ? (
                  <div className="grid gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Project</Label>
                      <ProjectPickerWithContext
                        projects={projectOptions}
                        selectedId={createState.projectId}
                        onSelectionChange={(projectId, pdNumber) => {
                          setCreateState((prev) => ({ ...prev, projectId, pdNumber }));
                        }}
                        loading={contextLoading}
                        placeholder="Select project"
                      />
                    </div>
                    {createState.pdNumber && (
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">PD Number</Label>
                        <Input value={createState.pdNumber} className="h-9 font-mono uppercase" readOnly />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Legal Package</Label>
                      <Select
                        value={createState.pdNumber}
                        onValueChange={(value) => {
                          const selectedLegal = legalOptions.find((project) => project.pdNumber === value) ?? null;
                          setCreateState((prev) => ({
                            ...prev,
                            pdNumber: value,
                            legalRevision: getPreferredLegalRevision(selectedLegal),
                          }));
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={contextLoading ? "Loading…" : "Select PD"} />
                        </SelectTrigger>
                        <SelectContent>
                          {legalOptions.map((project, index) => (
                            <SelectItem key={project.pdNumber} value={project.pdNumber} index={index}>
                              {project.pdNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Revision</Label>
                      <Select
                        value={createState.legalRevision}
                        onValueChange={(value) =>
                          setCreateState((prev) => ({ ...prev, legalRevision: value }))
                        }
                        disabled={!selectedLegalProject}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select rev" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedLegalProject?.revisions ?? []).map((revision, index) => (
                            <SelectItem key={revision.revision} value={revision.revision} index={index}>
                              {revision.revision}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assign To */}
            <div className="grid gap-1.5">
              {teamOptions.length > 0 && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Team</Label>
                  <Select
                    value={createState.teamId || "__none__"}
                    onValueChange={(value) => {
                      setCreateState((prev) => ({
                        ...prev,
                        teamId: value === "__none__" ? "" : value,
                        assignedToBadge: "",
                      }));
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" index={0}>All teams</SelectItem>
                      {teamOptions.map((team, index) => (
                        <SelectItem key={team.id} value={team.id} index={index + 1}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Label className="text-xs font-medium">Assign To</Label>
              <MemberQuickSelector
                members={assignableMembers}
                selected={selectedAssignees}
                onChange={(selected) =>
                  setCreateState((prev) => ({ ...prev, assignedToBadge: selected[0] ?? "" }))
                }
                max={1}
                requireActiveStatus={false}
              />
            </div>

            {/* Recurrence */}
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
                  setCreateState((prev) => ({ ...prev, recurrenceEnabled: !prev.recurrenceEnabled }))
                }
              >
                <Repeat className="h-3.5 w-3.5" />
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
                    <SelectItem value="daily" index={0}>Daily</SelectItem>
                    <SelectItem value="weekly" index={1}>Weekly</SelectItem>
                    <SelectItem value="monthly" index={2}>Monthly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="flex-1">
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateTask} disabled={saving || !createState.title.trim()}>
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
            <DialogDescription>Task context, ownership, and recurrence metadata.</DialogDescription>
          </DialogHeader>

          {activeTask ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{activeTask.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{activeTask.scope === "project" ? "Project" : "Legal"}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{activeTask.status.replace("_", " ")}</Badge>
                  {activeTask.dueDate ? <Badge variant="outline" className="text-[10px]">Due {activeTask.dueDate}</Badge> : null}
                  {activeTask.recurrence.enabled ? <Badge variant="outline" className="text-[10px]">{activeTask.recurrence.cadence}</Badge> : null}
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Assigned To</span>
                  {activeTask.assignedToBadge ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={memberByBadge.get(activeTask.assignedToBadge)?.avatarPath ?? undefined}
                          alt={memberByBadge.get(activeTask.assignedToBadge)?.fullName ?? activeTask.assignedToBadge}
                        />
                        <AvatarFallback className="text-[9px]">
                          {memberByBadge.get(activeTask.assignedToBadge)?.initials
                            ?? getInitialsFromName(memberByBadge.get(activeTask.assignedToBadge)?.fullName ?? activeTask.assignedToBadge)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{memberByBadge.get(activeTask.assignedToBadge)?.fullName ?? activeTask.assignedToBadge}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Project ID</span>
                  <span className="font-mono text-foreground">{activeTask.projectId || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">PD Number</span>
                  <span className="font-mono text-foreground">{activeTask.pdNumber || "—"}</span>
                </div>
                {activeTask.scope === "legal" ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Legal Revision</span>
                    <span className="font-mono text-foreground">{activeTask.legalRevision || "—"}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {activeTask?.projectId ? (
              <Button asChild variant="outline" className="mr-auto">
                <a href={`/${encodeURIComponent(badge)}/projects/${encodeURIComponent(activeTask.projectId)}`}>
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
