import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";
import type {
    OperationTimeEntry,
    ProjectOperationSummary,
    OpCodeTimeSummary,
    StageTimeSummary,
    BadgeTimeSummary,
} from "@/types/d380-operation-codes";
import { getOperationCode } from "@/types/d380-operation-codes";
import type { AssignmentStageId } from "@/types/d380-assignment-stages";

const OPERATION_TIME_FILE = "operation-time.json";

interface OperationTimeFile {
    projectId: string;
    entries: OperationTimeEntry[];
    updatedAt: string;
}

async function resolveOperationTimePath(projectId: string): Promise<string | null> {
    const stateDir = await resolveProjectStateDirectory(projectId);
    if (!stateDir) return null;
    return path.join(stateDir, OPERATION_TIME_FILE);
}

async function readOperationTimeFile(projectId: string): Promise<OperationTimeFile> {
    const filePath = await resolveOperationTimePath(projectId);
    if (!filePath) {
        return { projectId, entries: [], updatedAt: new Date().toISOString() };
    }
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as OperationTimeFile;
    } catch {
        return { projectId, entries: [], updatedAt: new Date().toISOString() };
    }
}

async function writeOperationTimeFile(data: OperationTimeFile): Promise<void> {
    const filePath = await resolveOperationTimePath(data.projectId);
    if (!filePath) throw new Error("Project state directory not found");
    data.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function addOperationTimeEntry(
    projectId: string,
    entry: Omit<OperationTimeEntry, "id">,
): Promise<OperationTimeEntry> {
    const data = await readOperationTimeFile(projectId);
    const newEntry: OperationTimeEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    data.entries.push(newEntry);
    await writeOperationTimeFile(data);
    return newEntry;
}

export async function updateOperationTimeEntry(
    projectId: string,
    entryId: string,
    updates: Partial<Pick<OperationTimeEntry, "endedAt" | "actualMinutes" | "note">>,
): Promise<OperationTimeEntry | null> {
    const data = await readOperationTimeFile(projectId);
    const idx = data.entries.findIndex(e => e.id === entryId);
    if (idx === -1) return null;

    data.entries[idx] = { ...data.entries[idx], ...updates };
    await writeOperationTimeFile(data);
    return data.entries[idx];
}

export async function deleteOperationTimeEntry(
    projectId: string,
    entryId: string,
): Promise<boolean> {
    const data = await readOperationTimeFile(projectId);
    const before = data.entries.length;
    data.entries = data.entries.filter(e => e.id !== entryId);
    if (data.entries.length === before) return false;
    await writeOperationTimeFile(data);
    return true;
}

export async function getProjectOperationSummary(
    projectId: string,
): Promise<ProjectOperationSummary> {
    const data = await readOperationTimeFile(projectId);

    // Aggregate by op code
    const opMap = new Map<string, { totalMinutes: number; entryCount: number }>();
    const stageMap = new Map<AssignmentStageId, { totalMinutes: number; entryCount: number }>();
    const badgeMap = new Map<string, { totalMinutes: number; entryCount: number }>();
    let totalMinutes = 0;

    for (const entry of data.entries) {
        totalMinutes += entry.actualMinutes;

        // By op code
        const existing = opMap.get(entry.opCode) ?? { totalMinutes: 0, entryCount: 0 };
        existing.totalMinutes += entry.actualMinutes;
        existing.entryCount++;
        opMap.set(entry.opCode, existing);

        // By stage
        const opDef = getOperationCode(entry.opCode);
        if (opDef) {
            const stageEntry = stageMap.get(opDef.stageId) ?? { totalMinutes: 0, entryCount: 0 };
            stageEntry.totalMinutes += entry.actualMinutes;
            stageEntry.entryCount++;
            stageMap.set(opDef.stageId, stageEntry);
        }

        // By badge
        const badgeEntry = badgeMap.get(entry.badge) ?? { totalMinutes: 0, entryCount: 0 };
        badgeEntry.totalMinutes += entry.actualMinutes;
        badgeEntry.entryCount++;
        badgeMap.set(entry.badge, badgeEntry);
    }

    const byOpCode: OpCodeTimeSummary[] = Array.from(opMap.entries()).map(([opCode, agg]) => ({
        opCode,
        label: getOperationCode(opCode)?.label ?? opCode,
        ...agg,
    }));

    const byStage: StageTimeSummary[] = Array.from(stageMap.entries()).map(([stageId, agg]) => ({
        stageId,
        ...agg,
    }));

    const byBadge: BadgeTimeSummary[] = Array.from(badgeMap.entries()).map(([badge, agg]) => ({
        badge,
        ...agg,
    }));

    return {
        projectId,
        entries: data.entries,
        byOpCode,
        byStage,
        byBadge,
        totalMinutes,
        updatedAt: data.updatedAt,
    };
}
