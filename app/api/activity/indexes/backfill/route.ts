import { NextRequest, NextResponse } from 'next/server'

import { backfillProjectIndexesFromShare } from '@/lib/activity/share-activity-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({})) as {
            badge?: string
            shift?: string
        }

        const badge = typeof body.badge === 'string' ? body.badge.trim() : undefined
        const shift = typeof body.shift === 'string' ? body.shift.trim() : undefined

        const result = await backfillProjectIndexesFromShare({
            badge: badge || undefined,
            shift: shift || undefined,
        })

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to backfill activity project indexes',
            },
            { status: 500 },
        )
    }
}
