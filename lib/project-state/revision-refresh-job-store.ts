import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";

const JOB_FILE_NAME = "revision-refresh-job.json";

export type RevisionRefreshJobStatus = "running" | "completed" | "failed";

export interface RevisionRefreshJobProgress {
  uploadStored: boolean;
  legalRevisionBuilt: boolean;
  projectStateRefreshed: boolean;
  wireBrandSchemasGenerated: boolean;
  crossWireSchemaGenerated: boolean;
}

export interface RevisionRefreshJobDocument {
  jobId: string;
  projectId: string;
  pdNumber: string | null;
  status: RevisionRefreshJobStatus;
  startedAt: string;
  completedAt: string | null;
  message: string;
  error: string | null;
  actorBadge: string | null;
  actorShift: string | null;
  progress: RevisionRefreshJobProgress;
}

async function resolveJobFilePath(projectId: string): Promise<string | null> {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return null;
  }
  return path.join(stateDirectory, JOB_FILE_NAME);
}

async function writeJob(projectId: string, job: RevisionRefreshJobDocument) {
  const filePath = await resolveJobFilePath(projectId);
  if (!filePath) {
    throw new Error("Project state directory not found");
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(job, null, 2), "utf-8");
}

export async function readRevisionRefreshJob(
  projectId: string,
): Promise<RevisionRefreshJobDocument | null> {
  const filePath = await resolveJobFilePath(projectId);
  if (!filePath) {
    return null;
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as RevisionRefreshJobDocument;
  } catch {
    return null;
  }
}

export async function startRevisionRefreshJob(input: {
  projectId: string;
  pdNumber?: string | null;
  actorBadge?: string | null;
  actorShift?: string | null;
  message?: string;
}): Promise<RevisionRefreshJobDocument> {
  const job: RevisionRefreshJobDocument = {
    jobId: `rev_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    projectId: input.projectId,
    pdNumber: input.pdNumber ?? null,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    message: input.message ?? "Revision refresh started.",
    error: null,
    actorBadge: input.actorBadge ?? null,
    actorShift: input.actorShift ?? null,
    progress: {
      uploadStored: true,
      legalRevisionBuilt: false,
      projectStateRefreshed: false,
      wireBrandSchemasGenerated: false,
      crossWireSchemaGenerated: false,
    },
  };

  await writeJob(input.projectId, job);
  return job;
}

export async function updateRevisionRefreshJob(
  projectId: string,
  patch: Partial<RevisionRefreshJobDocument> & {
    progress?: Partial<RevisionRefreshJobProgress>;
  },
): Promise<RevisionRefreshJobDocument | null> {
  const current = await readRevisionRefreshJob(projectId);
  if (!current) {
    return null;
  }

  const next: RevisionRefreshJobDocument = {
    ...current,
    ...patch,
    progress: {
      ...current.progress,
      ...(patch.progress ?? {}),
    },
  };

  await writeJob(projectId, next);
  return next;
}

export async function completeRevisionRefreshJob(
  projectId: string,
  message: string,
): Promise<RevisionRefreshJobDocument | null> {
  return updateRevisionRefreshJob(projectId, {
    status: "completed",
    completedAt: new Date().toISOString(),
    message,
    error: null,
    progress: {
      legalRevisionBuilt: true,
      projectStateRefreshed: true,
      wireBrandSchemasGenerated: true,
      crossWireSchemaGenerated: true,
    },
  });
}

export async function failRevisionRefreshJob(
  projectId: string,
  error: string,
): Promise<RevisionRefreshJobDocument | null> {
  return updateRevisionRefreshJob(projectId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    message: "Revision refresh failed.",
    error,
  });
}
