import { NextResponse } from 'next/server'

import { assignBoardAssignments } from '@/lib/board/assignment-operations'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      actorBadge?: string
      actorPin?: string
      assignmentId?: string
      memberBadge?: string
    }

    const result = await assignBoardAssignments({
      actorBadge: body.actorBadge ?? '',
      actorPin: body.actorPin ?? '',
      memberBadge: body.memberBadge ?? '',
      items: body.assignmentId ? [{ assignmentId: body.assignmentId }] : [],
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, assignment: result.records[0] ?? null })
  } catch (error) {
    console.error('[board/assign] POST failed', error)
    return NextResponse.json({ error: 'Failed to assign project from board.' }, { status: 500 })
  }
}
