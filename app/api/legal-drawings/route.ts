import { NextRequest, NextResponse } from 'next/server'

import { getLegalDrawingsLibraryManifest } from '@/lib/legal-drawings/library'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const manifest = await getLegalDrawingsLibraryManifest()
  return NextResponse.json(manifest)
}
