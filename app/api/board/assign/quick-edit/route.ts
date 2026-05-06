import { NextResponse } from 'next/server'

import { persistBoardQuickEdit } from '@/lib/board/assignment-operations'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      assignmentId?: string
      projectId?: string
      sheetSlug?: string
      swsType?: string | null
      stage?: string | null
      assignedBadge?: string | null
      workflowStatus?: 'pending' | 'scheduled' | 'in-progress' | 'completed' | null
    }

    if (!body.assignmentId || !body.projectId || !body.sheetSlug) {
      return NextResponse.json({ error: 'assignmentId, projectId, and sheetSlug are required.' }, { status: 400 })
    }

    const result = await persistBoardQuickEdit({
      assignmentId: body.assignmentId,
      projectId: body.projectId,
      sheetSlug: body.sheetSlug,
      swsType: body.swsType ?? null,
      stage: body.stage ?? null,
      assignedBadge: body.assignedBadge ?? null,
      workflowStatus: body.workflowStatus ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[board/assign/quick-edit] POST failed', error)
    return NextResponse.json({ error: 'Failed to persist assignment quick edit.' }, { status: 500 })
  }
}
