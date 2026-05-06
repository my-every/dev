export type ProjectTaskScope = "project" | "legal";

export type ProjectTaskStatus = "open" | "in_progress" | "done";

export type ProjectTaskRecurrenceCadence = "daily" | "weekly" | "monthly";

export interface ProjectTaskRecurrence {
  enabled: boolean;
  cadence: ProjectTaskRecurrenceCadence;
  interval: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  notes?: string | null;
  status: ProjectTaskStatus;
  scope: ProjectTaskScope;
  projectId?: string | null;
  pdNumber?: string | null;
  legalRevision?: string | null;
  dueDate?: string | null;
  assignedToBadge?: string | null;
  teamId?: string | null;
  assignmentSource?: "manual" | "team-default" | "automation-rule";
  createdByBadge: string;
  createdByShift: string;
  recurrence: ProjectTaskRecurrence;
  parentRecurringTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ProjectTaskStore {
  version: number;
  updatedAt: string;
  tasks: ProjectTask[];
}

export interface CreateProjectTaskInput {
  title: string;
  notes?: string;
  scope: ProjectTaskScope;
  projectId?: string;
  pdNumber?: string;
  legalRevision?: string;
  dueDate?: string;
  assignedToBadge?: string;
  teamId?: string;
  createdByBadge: string;
  createdByShift: string;
  recurrence?: Partial<ProjectTaskRecurrence>;
}

export interface UpdateProjectTaskInput {
  title?: string;
  notes?: string | null;
  status?: ProjectTaskStatus;
  dueDate?: string | null;
  assignedToBadge?: string | null;
  teamId?: string | null;
}
