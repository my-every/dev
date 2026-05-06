import { NextRequest, NextResponse } from 'next/server'

import { syncLegalDrawingsLibrary } from '@/lib/legal-drawings/library'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { sourceRoot?: string | null }
    const result = await syncLegalDrawingsLibrary(body.sourceRoot)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync legal drawings library' },
      { status: 500 },
    )
  }
}
