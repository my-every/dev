import { NextResponse } from 'next/server'

import type { ActivityAction, ActivityTimelineFilterOptions } from '@/types/activity'
import {
    getProjectActivityAcrossAllBadges,
} from '@/lib/activity/share-activity-store'
import {
    isActivityAction,
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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params

    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const url = new URL(request.url)
    const shift = url.searchParams.get('shift') ?? undefined

    const rawActionTypes = parseCsv(url.searchParams.get('actionTypes'))
    const actionTypes = rawActionTypes?.filter(isActivityAction) as ActivityAction[] | undefined

    const targetBadges = parseCsv(url.searchParams.get('targetBadges'))
    const performedByBadges = parseCsv(url.searchParams.get('performedByBadges'))
    const assignmentIds = parseCsv(url.searchParams.get('assignmentIds'))
    const operations = parseCsv(url.searchParams.get('operations'))
    const scopes = parseCsv(url.searchParams.get('scopes'))
    const stages = parseCsv(url.searchParams.get('stages'))
    const milestones = parseCsv(url.searchParams.get('milestones'))
    const lwcSections = parseCsv(url.searchParams.get('lwcSections'))
    const resultStatus = parseCsv(url.searchParams.get('resultStatus')) as
        | Array<'success' | 'failure' | 'pending'>
        | undefined

    const dateFrom = url.searchParams.get('dateFrom') ?? undefined
    const dateTo = url.searchParams.get('dateTo') ?? undefined
    const searchText = url.searchParams.get('searchText') ?? undefined

    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 200
    const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 200

    const filters: Omit<ActivityTimelineFilterOptions, 'projectIds'> = {
        actionTypes,
        targetBadges,
        performedByBadges,
        assignmentIds,
        operations,
        scopes,
        stages,
        milestones,
        lwcSections,
        resultStatus,
        dateFrom,
        dateTo,
        searchText,
    }

    const activities = await getProjectActivityAcrossAllBadges(projectId, {
        shift,
        filters,
        limit: resolvedLimit,
    })

    return NextResponse.json({ projectId, activities, total: activities.length })
}
