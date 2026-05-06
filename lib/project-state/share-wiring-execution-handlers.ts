import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";
import type { WiringExecutionSession } from "@/types/d380-wiring-execution";

const WIRING_EXECUTION_DIR = "wiring-execution";

async function resolveWiringExecutionDir(projectId: string): Promise<string | null> {
    const stateDir = await resolveProjectStateDirectory(projectId);
    if (!stateDir) return null;
    const dir = path.join(stateDir, WIRING_EXECUTION_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

function sessionFileName(sheetSlug: string): string {
    return `${sheetSlug}.json`;
}

export async function saveWiringExecutionSession(
    projectId: string,
    session: WiringExecutionSession,
): Promise<string> {
    const dir = await resolveWiringExecutionDir(projectId);
    if (!dir) throw new Error("Project state directory not found");
    const filePath = path.join(dir, sessionFileName(session.sheetSlug));
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
    return filePath;
}

export async function readWiringExecutionSession(
    projectId: string,
    sheetSlug: string,
): Promise<WiringExecutionSession | null> {
    const dir = await resolveWiringExecutionDir(projectId);
    if (!dir) return null;
    const filePath = path.join(dir, sessionFileName(sheetSlug));
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as WiringExecutionSession;
    } catch {
        return null;
    }
}

export async function deleteWiringExecutionSession(
    projectId: string,
    sheetSlug: string,
): Promise<boolean> {
    const dir = await resolveWiringExecutionDir(projectId);
    if (!dir) return false;
    const filePath = path.join(dir, sessionFileName(sheetSlug));
    try {
        await fs.unlink(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function listWiringExecutionSessions(
    projectId: string,
): Promise<string[]> {
    const dir = await resolveWiringExecutionDir(projectId);
    if (!dir) return [];
    try {
        const files = await fs.readdir(dir);
        return files.filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
    } catch {
        return [];
    }
}
