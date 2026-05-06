import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers"
import { resolveProfilePath } from "@/lib/profile/share-profile-store"

export const dynamic = "force-dynamic"

/**
 * Resolve the timeline directory for a project by looking up
 * the actual folder via the project manifest instead of using
 * the projectId as a literal folder name.
 */
async function resolveTimelineDir(projectId: string): Promise<string | null> {
    const stateDir = await resolveProjectStateDirectory(projectId)
    if (!stateDir) return null
    return path.join(stateDir, "timeline")
}

async function getTimelinePath(projectId: string, dateStr: string): Promise<string | null> {
    const timelineDir = await resolveTimelineDir(projectId)
    if (!timelineDir) return null
    return path.join(timelineDir, `${dateStr}.json`)
}

/**
 * Write per-user assignment entries into Share/users/<shift>/<badge>/assignments.json
 */
async function writeUserAssignments(
    projectId: string,
    date: string,
    slots: { assignmentSlug: string; scheduledStart: string; scheduledDuration: number; scheduledDate: string; assignedBadges: string[]; workstation: string; stationId: string }[],
) {
    // Collect all slots per badge
    const badgeSlots = new Map<string, typeof slots>()
    for (const slot of slots) {
        for (const badge of slot.assignedBadges ?? []) {
            if (!badgeSlots.has(badge)) badgeSlots.set(badge, [])
            badgeSlots.get(badge)!.push(slot)
        }
    }

    for (const [badge, userSlots] of badgeSlots) {
        const profilePath = resolveProfilePath(badge)
        if (!profilePath) continue
        const userDir = path.dirname(profilePath)
        const assignmentsFile = path.join(userDir, "assignments.json")

        // Read existing file to merge
        let existing: { projectId: string; date: string; slots: typeof slots }[] = []
        try {
            const raw = await fs.readFile(assignmentsFile, "utf-8")
            const data = JSON.parse(raw)
            existing = Array.isArray(data.assignments) ? data.assignments : []
        } catch {
            // no existing file
        }

        // Remove stale entry for this project+date, keep others
        const filtered = existing.filter((a) => !(a.projectId === projectId && a.date === date))
        filtered.push({ projectId, date, slots: userSlots })

        const payload = {
            badge,
            assignments: filtered,
            updatedAt: new Date().toISOString(),
        }
        await fs.writeFile(assignmentsFile, JSON.stringify(payload, null, 2), "utf-8")
    }
}

/** GET — load saved timeline slots for a project + date */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: "Missing or invalid date param (YYYY-MM-DD)" }, { status: 400 })
    }

    const filePath = await getTimelinePath(projectId, dateStr)
    if (!filePath) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    try {
        const raw = await fs.readFile(filePath, "utf-8")
        const data = JSON.parse(raw)
        return NextResponse.json({ slots: data.slots ?? [], savedAt: data.savedAt ?? null })
    } catch {
        return NextResponse.json({ slots: [], savedAt: null })
    }
}

/** POST — persist timeline slots for a project + date */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body || typeof body !== "object" || !("date" in body) || !("slots" in body)) {
        return NextResponse.json({ error: "Body must include 'date' and 'slots'" }, { status: 400 })
    }

    const { date, slots } = body as { date: string; slots: unknown[] }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 })
    }

    if (!Array.isArray(slots)) {
        return NextResponse.json({ error: "'slots' must be an array" }, { status: 400 })
    }

    const filePath = await getTimelinePath(projectId, date)
    if (!filePath) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const payload = {
        projectId,
        date,
        slots,
        savedAt: new Date().toISOString(),
    }

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8")

    // Write per-user assignments.json for each assigned badge
    await writeUserAssignments(projectId, date, slots as { assignmentSlug: string; scheduledStart: string; scheduledDuration: number; scheduledDate: string; assignedBadges: string[]; workstation: string; stationId: string }[])

    return NextResponse.json({ ok: true, savedAt: payload.savedAt })
}

/** DELETE — remove a saved timeline file for a project + date */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: "Missing or invalid date param (YYYY-MM-DD)" }, { status: 400 })
    }

    const filePath = await getTimelinePath(projectId, dateStr)
    if (!filePath) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    try {
        // Read existing slots to clean up user assignment files
        const raw = await fs.readFile(filePath, "utf-8")
        const data = JSON.parse(raw)
        const slots = data.slots ?? []

        // Remove this project+date from each assigned user's assignments.json
        await removeUserAssignments(projectId, dateStr, slots)

        await fs.unlink(filePath)
        return NextResponse.json({ ok: true, deleted: `${projectId}/${dateStr}` })
    } catch {
        return NextResponse.json({ ok: true, deleted: null })
    }
}

/**
 * Remove a project+date entry from each assigned user's assignments.json
 */
async function removeUserAssignments(
    projectId: string,
    date: string,
    slots: { assignedBadges?: string[] }[],
) {
    const badges = new Set<string>()
    for (const slot of slots) {
        for (const badge of slot.assignedBadges ?? []) {
            badges.add(badge)
        }
    }

    for (const badge of badges) {
        const profilePath = resolveProfilePath(badge)
        if (!profilePath) continue
        const userDir = path.dirname(profilePath)
        const assignmentsFile = path.join(userDir, "assignments.json")

        try {
            const raw = await fs.readFile(assignmentsFile, "utf-8")
            const data = JSON.parse(raw)
            const existing: { projectId: string; date: string }[] =
                Array.isArray(data.assignments) ? data.assignments : []

            const filtered = existing.filter(
                (a) => !(a.projectId === projectId && a.date === date),
            )

            const payload = {
                badge,
                assignments: filtered,
                updatedAt: new Date().toISOString(),
            }
            await fs.writeFile(assignmentsFile, JSON.stringify(payload, null, 2), "utf-8")
        } catch {
            // no assignments file — nothing to clean up
        }
    }
}
