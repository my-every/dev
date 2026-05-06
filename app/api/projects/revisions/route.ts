import { NextResponse } from 'next/server'

import { discoverAllProjectRevisions } from '@/lib/revision/revision-discovery'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/revisions
 * Returns revision history for every project found in Legal Drawings.
 */
export async function GET() {
  try {
    const histories = await discoverAllProjectRevisions()
    return NextResponse.json({ revisions: histories })
  } catch (error) {
    console.error('[revisions/route] Failed to discover revisions:', error)
    return NextResponse.json(
      { error: 'Failed to discover project revisions' },
      { status: 500 },
    )
  }
}
