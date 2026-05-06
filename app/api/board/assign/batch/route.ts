import { NextResponse } from 'next/server'

import { assignBoardAssignments } from '@/lib/board/assignment-operations'
import type { BoardAssignmentSelectionInput, BoardAssignmentSource } from '@/lib/board/types'
import type { ShiftId } from '@/types/shifts'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      actorBadge?: string
      actorPin?: string
      memberBadge?: string
      items?: BoardAssignmentSelectionInput[]
      shiftId?: ShiftId | null
      scheduledDate?: string | null
      startTime?: string | null
      source?: BoardAssignmentSource | null
      assignmentGroupId?: string | null
    }

    const result = await assignBoardAssignments({
      actorBadge: body.actorBadge ?? '',
      actorPin: body.actorPin ?? '',
      memberBadge: body.memberBadge ?? '',
      items: body.items ?? [],
      shiftId: body.shiftId ?? null,
      scheduledDate: body.scheduledDate ?? null,
      startTime: body.startTime ?? null,
      source: body.source ?? null,
      assignmentGroupId: body.assignmentGroupId ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      assignments: result.records,
      assignmentGroupId: result.records.find(record => record.assignmentGroupId)?.assignmentGroupId ?? null,
    })
  } catch (error) {
    console.error('[board/assign/batch] POST failed', error)
    return NextResponse.json({ error: 'Failed to batch assign projects from board.' }, { status: 500 })
  }
}
