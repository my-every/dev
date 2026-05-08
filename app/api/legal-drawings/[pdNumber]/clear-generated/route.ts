import { NextRequest, NextResponse } from 'next/server'

import { runLegalDrawingsMaintenance } from '@/lib/legal-drawings/admin'
import { invalidateLegalDrawingsLibraryManifestCache } from '@/lib/legal-drawings/library'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  try {
    const { pdNumber } = await params
    const body = await request.json().catch(() => ({})) as { revision?: string | null; dryRun?: boolean }
    const result = await runLegalDrawingsMaintenance({
      command: 'clear-generated',
      pdNumber,
      revision: body.revision,
      dryRun: body.dryRun,
    })

    if (result.projects.length === 0) {
      return NextResponse.json({ error: 'Legal project not found' }, { status: 404 })
    }

    if (!body.dryRun) {
      invalidateLegalDrawingsLibraryManifestCache()
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear generated legal artifacts' },
      { status: 500 },
    )
  }
}