import fs from "node:fs/promises";
import path from "node:path";

import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";

const PRIORITY_QUEUE_FILE = "project-priority-queue.json";

export type ProjectPriorityQueueStore = {
  version: number;
  updatedAt: string;
  manualOrder: string[];
};

function queuePath(): string {
  const shareRoot = resolveShareDirectorySync();
  return path.join(shareRoot, "Projects", PRIORITY_QUEUE_FILE);
}

function emptyStore(): ProjectPriorityQueueStore {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    manualOrder: [],
  };
}

export async function readProjectPriorityQueueStore(): Promise<ProjectPriorityQueueStore> {
  const filePath = queuePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ProjectPriorityQueueStore>;
    return {
      version: Number(parsed.version || 1),
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
          ? parsed.updatedAt
          : new Date().toISOString(),
      manualOrder: Array.isArray(parsed.manualOrder)
        ? parsed.manualOrder.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [],
    };
  } catch {
    return emptyStore();
  }
}

export async function writeProjectPriorityQueueStore(manualOrder: string[]): Promise<ProjectPriorityQueueStore> {
  const filePath = queuePath();
  const normalizedOrder = Array.from(
    new Set(manualOrder.map((id) => String(id).trim()).filter(Boolean)),
  );
  const next: ProjectPriorityQueueStore = {
    version: 1,
    updatedAt: new Date().toISOString(),
    manualOrder: normalizedOrder,
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
}
