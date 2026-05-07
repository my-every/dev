import { NextResponse } from 'next/server'

import { discoverAllProjectRevisions } from '@/lib/revision/revision-discovery'
import { scanProjectRevisionsFromFilesystem } from '@/lib/revision/filesystem-scan'
import type { RevisionScanRequest } from '@/lib/revision/types'

export const dynamic = 'force-dynamic'

function nowMs() {
  return Date.now()
}

function elapsedMs(startMs: number) {
  return nowMs() - startMs
}

/**
 * GET /api/projects/revisions
 * Returns revision history for every project found in Legal Drawings.
 */
export async function GET() {
  const startedAt = nowMs()
  try {
    console.info('[revisions/route][GET] Starting full revisions discovery')
    const [histories, scan] = await Promise.all([
      discoverAllProjectRevisions(),
      scanProjectRevisionsFromFilesystem({ scope: 'both' }),
    ])
    console.info(
      '[revisions/route][GET] Completed',
      JSON.stringify({
        durationMs: elapsedMs(startedAt),
        historyCount: histories.length,
        projectCount: scan.projects.length,
        scope: scan.scope,
      }),
    )
    return NextResponse.json({ revisions: histories, scan })
  } catch (error) {
    console.error(
      '[revisions/route][GET] Failed to discover revisions',
      JSON.stringify({ durationMs: elapsedMs(startedAt) }),
      error,
    )
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
  const startedAt = nowMs()
  try {
    const payload = (await request.json().catch(() => ({}))) as RevisionScanRequest
    console.info(
      '[revisions/route][POST] Starting revision scan',
      JSON.stringify({
        scope: payload.scope ?? 'both',
        fromTimeMs: payload.fromTimeMs ?? null,
        toTimeMs: payload.toTimeMs ?? null,
        hasProjectFilter: Boolean(payload.projectFilter?.trim()),
        legalSourceRoot: payload.legalSourceRoot ?? null,
        brandSourceRoot: payload.brandSourceRoot ?? null,
      }),
    )

    const scan = await scanProjectRevisionsFromFilesystem(payload)

    console.info(
      '[revisions/route][POST] Completed revision scan',
      JSON.stringify({
        durationMs: elapsedMs(startedAt),
        projectCount: scan.projects.length,
        scope: scan.scope,
        resolvedLegalSourceRoot: scan.legalSourceRoot,
        resolvedBrandSourceRoot: scan.brandSourceRoot,
      }),
    )

    return NextResponse.json({ scan })
  } catch (error) {
    console.error(
      '[revisions/route][POST] Failed to run revision scan',
      JSON.stringify({ durationMs: elapsedMs(startedAt) }),
      error,
    )
    return NextResponse.json(
      { error: 'Failed to run revision scan' },
      { status: 500 },
    )
  }
}
