import { NextResponse } from 'next/server'

import { persistBoardTimelineUpdate } from '@/lib/board/assignment-operations'
import type { ShiftId } from '@/types/shifts'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      assignmentId?: string
      resourceId?: string
      startTime?: string
      endTime?: string | null
      shiftId?: ShiftId
      scheduledDate?: string | null
    }

    const assignmentId = body.assignmentId?.trim() ?? ''
    const resourceId = body.resourceId?.trim() ?? ''
    const startTime = body.startTime?.trim() ?? ''
    const shiftId = body.shiftId

    if (!assignmentId || !resourceId || !startTime || !shiftId) {
      return NextResponse.json({ error: 'Missing assignment, work area, time, or shift.' }, { status: 400 })
    }

    const result = await persistBoardTimelineUpdate({
      assignmentId,
      resourceId,
      startTime,
      endTime: body.endTime ?? null,
      shiftId,
      scheduledDate: body.scheduledDate ?? null,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, assignment: result.record })
  } catch (error) {
    console.error('[board/assignment/update] POST failed', error)
    return NextResponse.json({ error: 'Failed to update board assignment.' }, { status: 500 })
  }
}
