import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";
import type { ManifestAuditEntry } from "./engineer-schemas";

async function resolveAuditLogPath(projectId: string): Promise<string> {
  const shareRoot = await resolveShareDirectory();
  const dir = path.join(shareRoot, "Projects", projectId, "audit");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "manifest-audit.jsonl");
}

export async function appendAuditEntry(
  entry: Omit<ManifestAuditEntry, "id" | "timestamp">,
): Promise<void> {
  const logPath = await resolveAuditLogPath(entry.projectId);
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
