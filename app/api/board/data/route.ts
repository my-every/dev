import { NextResponse } from 'next/server'

import { buildBoardData } from '@/lib/board/board-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await buildBoardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[board/data] GET failed', error)
    return NextResponse.json({ error: 'Failed to load board data' }, { status: 500 })
  }
}
