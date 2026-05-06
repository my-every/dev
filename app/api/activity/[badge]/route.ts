import { NextResponse } from 'next/server'

import type { ActivityAction, ActivityTimelineFilterOptions } from '@/types/activity'
import {
    addActivityToShare,
    deleteActivityEntryFromShare,
    getActivityEntriesFromShare,
    getActivityStatsFromShare,
    readActivityDocumentFromShare,
    upsertActivityDocumentInShare,
} from '@/lib/activity/share-activity-store'
import {
    isActivityAction,
    normalizeMetadata,
    normalizeOptionalNumber,
    normalizeOptionalString,
    validateBadge,
    validateActivityPayload,
} from '@/lib/activity/activity-validation'

export const dynamic = 'force-dynamic'

function parseCsv(value: string | null): string[] | undefined {
    if (!value) return undefined
    const list = value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    return list.length ? list : undefined
}

function parseFilters(url: URL): ActivityTimelineFilterOptions {
    const actionTypes = parseCsv(url.searchParams.get('actionTypes')) as ActivityAction[] | undefined
    const targetBadges = parseCsv(url.searchParams.get('targetBadges'))
    const assignmentIds = parseCsv(url.searchParams.get('assignmentIds'))
    const projectIds = parseCsv(url.searchParams.get('projectIds'))
    const resultStatus = parseCsv(url.searchParams.get('resultStatus')) as Array<'success' | 'failure' | 'pending'> | undefined

    const dateFrom = url.searchParams.get('dateFrom') ?? undefined
    const dateTo = url.searchParams.get('dateTo') ?? undefined
    const searchText = url.searchParams.get('searchText') ?? undefined

    const limitRaw = url.searchParams.get('limit')
    const offsetRaw = url.searchParams.get('offset')
    const reversedRaw = url.searchParams.get('reversed')

    const limit = limitRaw ? Number(limitRaw) : undefined
    const offset = offsetRaw ? Number(offsetRaw) : undefined
    const reversed = reversedRaw === 'true'

    return {
        actionTypes,
        targetBadges,
        assignmentIds,
        projectIds,
        resultStatus,
        dateFrom,
        dateTo,
        searchText,
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
        reversed,
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    const url = new URL(request.url)
    const shift = url.searchParams.get('shift') ?? ''
    const includeDocument = url.searchParams.get('includeDocument') === 'true'

    if (!shift) {
        return NextResponse.json({ error: 'Missing shift query parameter' }, { status: 400 })
    }

    try {
        // Ensure a document exists so the UI has a stable response shape.
        await upsertActivityDocumentInShare(badge, shift)

        const doc = await readActivityDocumentFromShare(badge, shift)
        if (!doc) {
            return NextResponse.json({ error: 'Failed to read activity document' }, { status: 500 })
        }

        const filters = parseFilters(url)
        const activities = await getActivityEntriesFromShare(badge, shift, filters)
        const stats = await getActivityStatsFromShare(badge, shift)

        return NextResponse.json({
            badge,
            shift: doc.shift,
            activities,
            stats,
            ...(includeDocument ? { document: doc } : {}),
        })
    } catch (error) {
        console.error(`[activity/${badge}] GET failed`, error)
        return NextResponse.json({ error: 'Failed to read activity' }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const body = await request.json()

        const shift = body?.shift as string | undefined
        const action = body?.action as ActivityAction | undefined
        const performedBy = (body?.performedBy as string | undefined) ?? badge

        if (!shift) {
            return NextResponse.json({ error: 'Missing shift in request body' }, { status: 400 })
        }

        if (!action) {
            return NextResponse.json({ error: 'Missing action in request body' }, { status: 400 })
        }

        if (!validateBadge(performedBy)) {
            return NextResponse.json({ error: 'Invalid performedBy badge' }, { status: 400 })
        }

        if (!isActivityAction(action)) {
            return NextResponse.json({ error: 'Invalid action in request body' }, { status: 400 })
        }

        const validationError = validateActivityPayload({
            action,
            shift,
            result: body?.result,
            durationSeconds: body?.durationSeconds,
            comment: body?.comment,
        })

        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 })
        }

        const entry = await addActivityToShare(badge, shift, {
            action,
            performedBy,
            metadata: normalizeMetadata(body?.metadata),
            assignmentId: normalizeOptionalString(body?.assignmentId),
            projectId: normalizeOptionalString(body?.projectId),
            stage: normalizeOptionalString(body?.stage),
            comment: normalizeOptionalString(body?.comment),
            targetBadge: normalizeOptionalString(body?.targetBadge),
            durationSeconds: normalizeOptionalNumber(body?.durationSeconds),
            result: body?.result,
            error: normalizeOptionalString(body?.error),
        })

        if (!entry) {
            return NextResponse.json({ error: 'Failed to write activity entry' }, { status: 500 })
        }

        const stats = await getActivityStatsFromShare(badge, shift)

        return NextResponse.json({ entry, stats }, { status: 201 })
    } catch (error) {
        console.error(`[activity/${badge}] POST failed`, error)
        return NextResponse.json({ error: 'Failed to create activity entry' }, { status: 500 })
    }
}

/**
 * DELETE /api/activity/[badge]
 * Body: { shift, activityId }
 *
 * Removes a single activity entry by ID.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const shift = body?.shift as string | undefined
        const activityId = body?.activityId as string | undefined

        if (!shift) {
            return NextResponse.json({ error: 'Missing shift in request body' }, { status: 400 })
        }

        if (!activityId) {
            return NextResponse.json({ error: 'Missing activityId in request body' }, { status: 400 })
        }

        const deleted = await deleteActivityEntryFromShare(badge, shift, activityId)

        if (!deleted) {
            return NextResponse.json({ error: 'Activity entry not found' }, { status: 404 })
        }

        const stats = await getActivityStatsFromShare(badge, shift)

        return NextResponse.json({ ok: true, activityId, stats })
    } catch (error) {
        console.error(`[activity/${badge}] DELETE failed`, error)
        return NextResponse.json({ error: 'Failed to delete activity entry' }, { status: 500 })
    }
}
