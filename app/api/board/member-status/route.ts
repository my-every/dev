import { NextResponse } from 'next/server'

import { badgeInBoardMember, badgeOutBoardMember } from '@/lib/board/assignment-operations'
import type { ShiftId } from '@/types/shifts'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action?: 'badge_in' | 'badge_out'
      badge?: string
      pin?: string
      shiftId?: ShiftId | null
    }

    const action = body.action
    if (!action) {
      return NextResponse.json({ error: 'Missing board member action.' }, { status: 400 })
    }

    if (action === 'badge_in') {
      const result = await badgeInBoardMember({
        badge: body.badge ?? '',
        pin: body.pin ?? '',
        shiftId: body.shiftId ?? '1st',
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        assignment: result.assignment ?? null,
        assignmentContext: result.assignmentContext ?? null,
      })
    }

    if (action === 'badge_out') {
      const result = await badgeOutBoardMember({
        badge: body.badge ?? '',
        pin: body.pin ?? '',
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        assignmentContext: result.assignmentContext ?? null,
      })
    }

    return NextResponse.json({ error: 'Unsupported board member action.' }, { status: 400 })
  } catch (error) {
    console.error('[board/member-status] POST failed', error)
    return NextResponse.json({ error: 'Failed to update board member state.' }, { status: 500 })
  }
}
