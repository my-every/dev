import { NextResponse } from 'next/server'

import { buildBoardData } from '@/lib/board/board-data'
import type { BoardDataResponse } from '@/lib/board/types'

export const dynamic = 'force-dynamic'

const BOARD_DATA_CACHE_TTL_MS = 15_000

let boardDataCache: {
  expiresAt: number
  data: BoardDataResponse
} | null = null

let boardDataInFlight: Promise<BoardDataResponse> | null = null

async function getBoardDataCached(): Promise<BoardDataResponse> {
  const now = Date.now()
  if (boardDataCache && boardDataCache.expiresAt > now) {
    return boardDataCache.data
  }

  if (boardDataInFlight) {
    return boardDataInFlight
  }

  boardDataInFlight = buildBoardData()
    .then((data) => {
      boardDataCache = {
        data,
        expiresAt: Date.now() + BOARD_DATA_CACHE_TTL_MS,
      }
      return data
    })
    .finally(() => {
      boardDataInFlight = null
    })

  return boardDataInFlight
}

export async function GET() {
  try {
    const data = await getBoardDataCached()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[board/data] GET failed', error)
    return NextResponse.json({ error: 'Failed to load board data' }, { status: 500 })
  }
}
