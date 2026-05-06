import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

async function resolveSchedulePaths() {
    const shareRoot = path.join(process.cwd(), "Share");
    const scheduleDir = path.join(shareRoot, "Schedule");
    const priorityListFile = path.join(scheduleDir, "priority-list.json");

    return { scheduleDir, priorityListFile };
}

async function ensureDir(scheduleDir: string) {
    await fs.mkdir(scheduleDir, { recursive: true });
}

/**
 * GET /api/schedule/priority-list
 * Read the persisted priority list data.
 */
export async function GET() {
    try {
        const { scheduleDir, priorityListFile } = await resolveSchedulePaths();
        await ensureDir(scheduleDir);
        const raw = await fs.readFile(priorityListFile, "utf-8");
        return NextResponse.json(JSON.parse(raw));
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return NextResponse.json(null);
        }
        console.error("Failed to read priority list:", err);
        return NextResponse.json(
            { error: "Failed to read priority list" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/schedule/priority-list
 * Write the full priority list data.
 */
export async function PUT(request: Request) {
    try {
        const { scheduleDir, priorityListFile } = await resolveSchedulePaths();
        await ensureDir(scheduleDir);
        const body = await request.json();
        if (!body || !Array.isArray(body.entries)) {
            return NextResponse.json(
                { error: "Invalid priority list data" },
                { status: 400 }
            );
        }
        await fs.writeFile(priorityListFile, JSON.stringify(body, null, 2), "utf-8");
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Failed to write priority list:", err);
        return NextResponse.json(
            { error: "Failed to write priority list" },
            { status: 500 }
        );
    }
}
