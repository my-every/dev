import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { AssignmentSwsConfig } from "@/types/d380-assignment-sws";
import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";

const ASSIGNMENT_SWS_DIRECTORY = "assignment-sws";

function makeAssignmentSwsFileName(sheetSlug: string) {
  return `${encodeURIComponent(sheetSlug)}.json`;
}

async function resolveAssignmentSwsPaths(projectId: string, sheetSlug: string) {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return null;
  }

  const assignmentSwsDirectory = path.join(stateDirectory, ASSIGNMENT_SWS_DIRECTORY);
  await fs.mkdir(assignmentSwsDirectory, { recursive: true });

  return {
    assignmentSwsDirectory,
    filePath: path.join(assignmentSwsDirectory, makeAssignmentSwsFileName(sheetSlug)),
  };
}

export async function listAssignmentSwsSlugs(projectId: string): Promise<string[]> {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return [];
  }

  const assignmentSwsDirectory = path.join(stateDirectory, ASSIGNMENT_SWS_DIRECTORY);

  try {
    const entries = await fs.readdir(assignmentSwsDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => decodeURIComponent(entry.name.slice(0, -5)));
  } catch {
    return [];
  }
}

export async function readAssignmentSwsConfig(
  projectId: string,
  sheetSlug: string,
): Promise<AssignmentSwsConfig | null> {
  const paths = await resolveAssignmentSwsPaths(projectId, sheetSlug);
  if (!paths) {
    return null;
  }

  try {
    const raw = await fs.readFile(paths.filePath, "utf-8");
    return JSON.parse(raw) as AssignmentSwsConfig;
  } catch {
    return null;
  }
}

export async function writeAssignmentSwsConfig(
  projectId: string,
  sheetSlug: string,
  config: AssignmentSwsConfig,
): Promise<AssignmentSwsConfig> {
  const paths = await resolveAssignmentSwsPaths(projectId, sheetSlug);
  if (!paths) {
    throw new Error("Project state directory not found");
  }

  await fs.writeFile(paths.filePath, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export async function deleteAssignmentSwsConfig(projectId: string, sheetSlug: string) {
  const paths = await resolveAssignmentSwsPaths(projectId, sheetSlug);
  if (!paths) {
    return;
  }

  await fs.rm(paths.filePath, { force: true });
}

export async function deleteAssignmentSwsConfigs(projectId: string) {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return;
  }

  await fs.rm(path.join(stateDirectory, ASSIGNMENT_SWS_DIRECTORY), {
    force: true,
    recursive: true,
  });
}
