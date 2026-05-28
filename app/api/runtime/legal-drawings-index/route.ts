import { NextRequest, NextResponse } from 'next/server'

import {
  getLegalDrawingsSourceIndex,
  refreshLegalDrawingsSourceIndex,
  resolveLegalDrawingsSourceRoot,
} from '@/lib/legal-drawings/source-scan-index'

export const dynamic = 'force-dynamic'

function parseOptionalYear(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1900) {
    return undefined
  }

  return parsed
}

function parseOptionalPositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const sourceRoot = request.nextUrl.searchParams.get('sourceRoot') ?? await resolveLegalDrawingsSourceRoot()
    const fromYear = parseOptionalYear(request.nextUrl.searchParams.get('fromYear'))
    const fromDays = parseOptionalPositiveInt(request.nextUrl.searchParams.get('fromDays'))
    const refreshFlag = request.nextUrl.searchParams.get('refresh')
    const refresh = refreshFlag === '1' || refreshFlag === 'true'

    const index = await getLegalDrawingsSourceIndex({
      sourceRoot,
      fromYear,
      fromDays,
      refresh,
    })

    return NextResponse.json(index)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load legal drawings index' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      sourceRoot?: string
      fromYear?: number
      fromDays?: number
    }

    const sourceRoot = body.sourceRoot?.trim() || await resolveLegalDrawingsSourceRoot()
    const fromYear = Number.isInteger(body.fromYear) ? body.fromYear : undefined
    const fromDays = Number.isInteger(body.fromDays) && body.fromDays > 0 ? body.fromDays : undefined

    const index = await refreshLegalDrawingsSourceIndex({
      sourceRoot,
      fromYear,
      fromDays,
    })

    return NextResponse.json(index)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh legal drawings index' },
      { status: 500 },
    )
  }
}
