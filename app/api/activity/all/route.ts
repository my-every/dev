import { NextRequest, NextResponse } from 'next/server'

import {
    getActivityAcrossAllBadges,
} from '@/lib/activity/share-activity-store'
import type { ActivityTimelineFilterOptions } from '@/types/activity'

export const runtime = 'nodejs'

function parseCsv(value: string | null): string[] | undefined {
    if (!value) return undefined
    const items = value.split(',').map((x) => x.trim()).filter(Boolean)
    return items.length ? items : undefined
}

function buildFilters(req: NextRequest): {
    shift?: string
    filters: ActivityTimelineFilterOptions
    limit?: number
} {
    const sp = req.nextUrl.searchParams

    const shift = sp.get('shift') ?? undefined

    const limitRaw = sp.get('limit')
    const limit = limitRaw ? Number(limitRaw) : undefined

    return {
        shift,
        limit: Number.isFinite(limit) ? limit : undefined,
        filters: {
            projectIds: parseCsv(sp.get('projectIds')),
            actionTypes: parseCsv(sp.get('actionTypes')),
            targetBadges: parseCsv(sp.get('targetBadges')),
            performedByBadges: parseCsv(sp.get('performedByBadges')),
            assignmentIds: parseCsv(sp.get('assignmentIds')),
            operations: parseCsv(sp.get('operations')),
            scopes: parseCsv(sp.get('scopes')),
            stages: parseCsv(sp.get('stages')),
            milestones: parseCsv(sp.get('milestones')),
            lwcSections: parseCsv(sp.get('lwcSections')),
            resultStatus: parseCsv(sp.get('resultStatus')),
            dateFrom: sp.get('dateFrom') ?? undefined,
            dateTo: sp.get('dateTo') ?? undefined,
            searchText: sp.get('searchText') ?? undefined,
            limit: Number.isFinite(limit) ? limit : undefined,
        },
    }
}

export async function GET(req: NextRequest) {
    try {
        const options = buildFilters(req)
        const activities = await getActivityAcrossAllBadges(options)

        return NextResponse.json(
            {
                success: true,
                activities,
                count: activities.length,
                shift: options.shift ?? 'all',
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('Failed to aggregate all activity:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Unable to load activity',
            },
            { status: 500 }
        )
    }
}
