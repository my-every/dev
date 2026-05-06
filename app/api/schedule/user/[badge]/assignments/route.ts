import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { resolveProfilePath } from "@/lib/profile/share-profile-store"

export const dynamic = "force-dynamic"

/**
 * GET /api/schedule/user/[badge]/assignments?date=YYYY-MM-DD
 *
 * Returns all scheduled assignments for a user.
 * Optionally filter by date.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: "Invalid badge number" }, { status: 400 })
    }

    const profilePath = resolveProfilePath(badge)
    if (!profilePath) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userDir = path.dirname(profilePath)
    const assignmentsFile = path.join(userDir, "assignments.json")

    try {
        const raw = await fs.readFile(assignmentsFile, "utf-8")
        const data = JSON.parse(raw)
        let assignments: { projectId: string; date: string; slots: unknown[] }[] =
            Array.isArray(data.assignments) ? data.assignments : []

        // Optional date filter
        const { searchParams } = new URL(request.url)
        const dateFilter = searchParams.get("date")
        if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
            assignments = assignments.filter((a) => a.date === dateFilter)
        }

        return NextResponse.json({
            badge,
            assignments,
            updatedAt: data.updatedAt ?? null,
        })
    } catch {
        // No assignments file yet
        return NextResponse.json({ badge, assignments: [], updatedAt: null })
    }
}

/**
 * DELETE /api/schedule/user/[badge]/assignments
 * Body: { projectId, date } — remove a specific project+date entry
 * Body: { all: true } — clear all assignments
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: "Invalid badge number" }, { status: 400 })
    }

    const profilePath = resolveProfilePath(badge)
    if (!profilePath) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userDir = path.dirname(profilePath)
    const assignmentsFile = path.join(userDir, "assignments.json")

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    try {
        const raw = await fs.readFile(assignmentsFile, "utf-8")
        const data = JSON.parse(raw)
        let assignments: { projectId: string; date: string; slots: unknown[] }[] =
            Array.isArray(data.assignments) ? data.assignments : []

        if (body.all === true) {
            assignments = []
        } else {
            const { projectId, date } = body as { projectId?: string; date?: string }
            if (!projectId || !date) {
                return NextResponse.json(
                    { error: "Body must include 'projectId' and 'date', or 'all: true'" },
                    { status: 400 },
                )
            }
            assignments = assignments.filter(
                (a) => !(a.projectId === projectId && a.date === date),
            )
        }

        const payload = {
            badge,
            assignments,
            updatedAt: new Date().toISOString(),
        }
        await fs.writeFile(assignmentsFile, JSON.stringify(payload, null, 2), "utf-8")

        return NextResponse.json({ ok: true, remaining: assignments.length })
    } catch {
        return NextResponse.json({ badge, ok: true, remaining: 0 })
    }
}
