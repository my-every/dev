import { NextResponse } from 'next/server'

import { discoverAllProjectRevisions } from '@/lib/revision/revision-discovery'
import { scanProjectRevisionsFromFilesystem } from '@/lib/revision/filesystem-scan'
import type { RevisionScanRequest } from '@/lib/revision/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/revisions
 * Returns revision history for every project found in Legal Drawings.
 */
export async function GET() {
  try {
    const [histories, scan] = await Promise.all([
      discoverAllProjectRevisions(),
      scanProjectRevisionsFromFilesystem({ scope: 'both' }),
    ])
    return NextResponse.json({ revisions: histories, scan })
  } catch (error) {
    console.error('[revisions/route] Failed to discover revisions:', error)
    return NextResponse.json(
      { error: 'Failed to discover project revisions' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/projects/revisions
 * Runs a parameterized filesystem scan.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as RevisionScanRequest
    const scan = await scanProjectRevisionsFromFilesystem(payload)
    return NextResponse.json({ scan })
  } catch (error) {
    console.error('[revisions/route] Failed to run revision scan:', error)
    return NextResponse.json(
      { error: 'Failed to run revision scan' },
      { status: 500 },
    )
  }
}
