import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { resolveShareDirectory } from "@/lib/runtime/share-directory"

export const dynamic = "force-dynamic"

/**
 * GET /api/schedule/timeline?date=YYYY-MM-DD
 *
 * Returns all saved timeline slots across all projects for a given date.
 * Useful for a cross-project floor/schedule view.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json(
            { error: "Missing or invalid date param (YYYY-MM-DD)" },
            { status: 400 },
        )
    }

    const results: {
        projectId: string
        folder: string
        slots: unknown[]
        savedAt: string | null
    }[] = []

    try {
        const shareRoot = await resolveShareDirectory()
        const shareProjectsRoot = path.join(shareRoot, "Projects")
        const projectFolders = await fs.readdir(shareProjectsRoot, { withFileTypes: true })

        for (const entry of projectFolders) {
            if (!entry.isDirectory()) continue

            const timelineFile = path.join(
                shareProjectsRoot,
                entry.name,
                "state",
                "timeline",
                `${dateStr}.json`,
            )

            try {
                const raw = await fs.readFile(timelineFile, "utf-8")
                const data = JSON.parse(raw)
                if (Array.isArray(data.slots) && data.slots.length > 0) {
                    results.push({
                        projectId: data.projectId ?? entry.name,
                        folder: entry.name,
                        slots: data.slots,
                        savedAt: data.savedAt ?? null,
                    })
                }
            } catch {
                // No timeline file for this project+date — skip
            }
        }

        return NextResponse.json({ date: dateStr, projects: results })
    } catch {
        return NextResponse.json({ date: dateStr, projects: [] })
    }
}
