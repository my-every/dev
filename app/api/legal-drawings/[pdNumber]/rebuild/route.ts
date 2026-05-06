import { NextRequest, NextResponse } from 'next/server'

import { rebuildLegalRevisionArtifacts } from '@/lib/legal-drawings/library'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  try {
    const { pdNumber } = await params
    const body = await request.json().catch(() => ({})) as { revision?: string | null }
    const record = await rebuildLegalRevisionArtifacts(pdNumber, body.revision)
    return NextResponse.json(record)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rebuild legal revision artifacts' },
      { status: 500 },
    )
  }
}
