import { NextRequest, NextResponse } from 'next/server'
import { runProjectInitializePipeline } from '@/lib/project-state/project-initialize-pipeline'

export const dynamic = 'force-dynamic'

/**
 * POST /api/project-context/[projectId]/initialize
 *
 * Run the auto-generate pipeline:
 *   - SWS detection for all sheets
 *   - Build + persist MappedAssignment[]
 *   - Compute stage-hours breakdown
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params

    try {
        const result = await runProjectInitializePipeline(projectId)
        return NextResponse.json(result)
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Pipeline failed'
        console.error('[API] Initialize pipeline error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
