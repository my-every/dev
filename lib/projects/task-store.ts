import fs from "node:fs/promises";
import path from "node:path";

import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";
import type {
  CreateProjectTaskInput,
  ProjectTask,
  ProjectTaskRecurrence,
  ProjectTaskStore,
  UpdateProjectTaskInput,
} from "@/types/project-task";
import { getProjectTaskTeamById } from "@/lib/projects/task-teams";

const TASK_STORE_FILE = "project-tasks.json";

function taskStorePath(): string {
  const shareRoot = resolveShareDirectorySync();
  return path.join(shareRoot, "Projects", TASK_STORE_FILE);
}

function emptyStore(): ProjectTaskStore {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: [],
  };
}

async function readStore(): Promise<ProjectTaskStore> {
  const filePath = taskStorePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ProjectTaskStore;
    if (!Array.isArray(parsed.tasks)) {
      return emptyStore();
    }
    return {
      version: Number(parsed.version || 1),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      tasks: parsed.tasks,
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ProjectTaskStore): Promise<void> {
  const filePath = taskStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

function normalizeRecurrence(
  recurrence?: Partial<ProjectTaskRecurrence>,
): ProjectTaskRecurrence {
  return {
    enabled: recurrence?.enabled ?? true,
    cadence: recurrence?.cadence ?? "weekly",
    interval: Math.max(1, Number(recurrence?.interval || 1)),
  };
}

function normalizeIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function buildTaskId(): string {
  return `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nextRecurringDate(
  dueDate: string | null,
  cadence: ProjectTaskRecurrence["cadence"],
  interval: number,
): string | null {
  if (!dueDate) return null;
  const base = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  if (cadence === "daily") {
    base.setDate(base.getDate() + interval);
  } else if (cadence === "weekly") {
    base.setDate(base.getDate() + interval * 7);
  } else {
    base.setMonth(base.getMonth() + interval);
  }

  return base.toISOString().slice(0, 10);
}

export async function listProjectTasks(filters?: {
  projectId?: string;
  pdNumber?: string;
  assignedToBadge?: string;
  teamId?: string;
  createdByBadge?: string;
  includeDone?: boolean;
}): Promise<ProjectTask[]> {
  const store = await readStore();
  let tasks = [...store.tasks];

  if (filters?.projectId) {
    tasks = tasks.filter((task) => task.projectId === filters.projectId);
  }
  if (filters?.pdNumber) {
    tasks = tasks.filter((task) => task.pdNumber === filters.pdNumber);
  }
  if (filters?.assignedToBadge) {
    tasks = tasks.filter((task) => task.assignedToBadge === filters.assignedToBadge);
  }
  if (filters?.teamId) {
    tasks = tasks.filter((task) => task.teamId === filters.teamId);
  }
  if (filters?.createdByBadge) {
    tasks = tasks.filter((task) => task.createdByBadge === filters.createdByBadge);
  }
  if (!filters?.includeDone) {
    tasks = tasks.filter((task) => task.status !== "done");
  }

  return tasks.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;

    const aDue = Date.parse(a.dueDate || "");
    const bDue = Date.parse(b.dueDate || "");
    if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) {
      return aDue - bDue;
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

export async function createProjectTask(input: CreateProjectTaskInput): Promise<ProjectTask> {
  const store = await readStore();
  const now = new Date().toISOString();

  const team = getProjectTaskTeamById(input.teamId?.trim() || null);
  const explicitAssignee = input.assignedToBadge?.trim() || null;
  const teamDefaultAssignee = team?.defaultAssigneeBadge?.trim() || null;
  const resolvedAssignee = explicitAssignee || teamDefaultAssignee;

  const task: ProjectTask = {
    id: buildTaskId(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    status: "open",
    scope: input.scope,
    operation: input.operation?.trim() || null,
    action: input.action?.trim() || null,
    projectId: input.projectId?.trim() || null,
    pdNumber: input.pdNumber?.trim().toUpperCase() || null,
    legalRevision: input.legalRevision?.trim() || null,
    dueDate: normalizeIsoDate(input.dueDate),
    assignedToBadge: resolvedAssignee,
    teamId: team?.id ?? null,
    assignmentSource: explicitAssignee
      ? "manual"
      : teamDefaultAssignee
        ? "team-default"
        : "manual",
    createdByBadge: input.createdByBadge.trim(),
    createdByShift: input.createdByShift.trim(),
    recurrence: normalizeRecurrence(input.recurrence),
    parentRecurringTaskId: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  store.tasks.unshift(task);
  store.updatedAt = now;
  await writeStore(store);
  return task;
}

export async function updateProjectTask(
  taskId: string,
  updates: UpdateProjectTaskInput,
): Promise<ProjectTask | null> {
  const store = await readStore();
  const index = store.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return null;

  const existing = store.tasks[index];
  const nextStatus = updates.status ?? existing.status;
  const now = new Date().toISOString();

  const updated: ProjectTask = {
    ...existing,
    title: updates.title?.trim() ?? existing.title,
    notes: updates.notes === undefined ? existing.notes : updates.notes?.trim() || null,
    status: nextStatus,
    dueDate: updates.dueDate === undefined ? existing.dueDate : normalizeIsoDate(updates.dueDate),
    assignedToBadge:
      updates.assignedToBadge === undefined
        ? existing.assignedToBadge
        : updates.assignedToBadge?.trim() || null,
    teamId: updates.teamId === undefined ? existing.teamId ?? null : updates.teamId?.trim() || null,
    updatedAt: now,
    completedAt: nextStatus === "done" ? now : null,
  };

  store.tasks[index] = updated;

  const becameDone = existing.status !== "done" && nextStatus === "done";
  if (becameDone && updated.recurrence.enabled) {
    const nextDue = nextRecurringDate(
      updated.dueDate,
      updated.recurrence.cadence,
      updated.recurrence.interval,
    );

    const recurringClone: ProjectTask = {
      ...updated,
      id: buildTaskId(),
      status: "open",
      dueDate: nextDue,
      parentRecurringTaskId: updated.parentRecurringTaskId || updated.id,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    store.tasks.unshift(recurringClone);
  }

  store.updatedAt = now;
  await writeStore(store);
  return updated;
}

export async function deleteProjectTask(taskId: string): Promise<boolean> {
  const store = await readStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((task) => task.id !== taskId);
  if (store.tasks.length === before) return false;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}
