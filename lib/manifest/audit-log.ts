import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveProjectRootDirectory } from "@/lib/project-state/share-project-state-handlers";
import type { ManifestAuditEntry } from "./engineer-schemas";

async function resolveAuditLogPath(projectId: string): Promise<string | null> {
  // Use proper project resolution to find the correct folder (e.g., "4L101_Prop" not "4l101-prop")
  const projectRoot = await resolveProjectRootDirectory(projectId);
  if (!projectRoot) {
    return null;
  }
  const dir = path.join(projectRoot, "audit");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "manifest-audit.jsonl");
}

export async function appendAuditEntry(
  entry: Omit<ManifestAuditEntry, "id" | "timestamp">,
): Promise<void> {
  const logPath = await resolveAuditLogPath(entry.projectId);
  if (!logPath) {
    console.warn(`[audit-log] Could not resolve project root for ${entry.projectId}, skipping audit entry`);
    return;
  }
  const record: ManifestAuditEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf-8");
}

export async function readAuditLog(
  projectId: string,
  limit = 100,
): Promise<ManifestAuditEntry[]> {
  const logPath = await resolveAuditLogPath(projectId);
  if (!logPath) {
    return [];
  }
  try {
    const raw = await fs.readFile(logPath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as ManifestAuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is ManifestAuditEntry => e !== null);
    return entries.slice(-limit).reverse();
  } catch {
    return [];
  }
}
