import { NextRequest, NextResponse } from 'next/server'

import { findBoardAssignmentsForBadge } from '@/lib/board/board-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const badge = request.nextUrl.searchParams.get('badge')?.trim().replace(/\D/g, '') ?? ''

  if (!badge) {
    return NextResponse.json({ error: 'Missing badge parameter.' }, { status: 400 })
  }

  try {
    const assignments = findBoardAssignmentsForBadge(badge)
    const activeAssignment = assignments[0] ?? null

    return NextResponse.json({
      assignment: activeAssignment,
      href: activeAssignment?.workspaceHref ?? null,
    })
  } catch (error) {
    console.error('[session/assignment-redirect] GET failed', error)
    return NextResponse.json({ error: 'Failed to resolve assignment redirect.' }, { status: 500 })
  }
}
