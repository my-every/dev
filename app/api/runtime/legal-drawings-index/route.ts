import { NextRequest, NextResponse } from 'next/server'

import {
  getLegalDrawingsSourceIndex,
  refreshLegalDrawingsSourceIndex,
  resolveLegalDrawingsSourceRoot,
} from '@/lib/legal-drawings/source-scan-index'

export const dynamic = 'force-dynamic'

function buildEmptyIndexResponse(input?: {
  sourceRoot?: string
  fromYear?: number
  fromDays?: number
  configured?: boolean
  message?: string
}) {
  const nowIso = new Date().toISOString()
  const fallbackFromDays = Number.isInteger(input?.fromDays) && (input?.fromDays ?? 0) > 0
    ? Number(input?.fromDays)
    : 90
  const fallbackFromYear = Number.isInteger(input?.fromYear)
    ? Number(input?.fromYear)
    : new Date().getFullYear()

  return {
    version: 1 as const,
    sourceRoot: input?.sourceRoot ?? '',
    scannedAt: nowIso,
    fromYear: fallbackFromYear,
    ...(fallbackFromDays ? { fromDays: fallbackFromDays } : {}),
    projectCount: 0,
    updatedProjectCount: 0,
    projects: [],
    configured: input?.configured ?? false,
    message: input?.message ?? 'Legal Drawings source root is not configured.',
  }
}

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
  const startedAt = Date.now()
  try {
    const sourceRootParam = request.nextUrl.searchParams.get('sourceRoot')
    const sourceRoot = sourceRootParam?.trim() || await resolveLegalDrawingsSourceRoot()
    const fromYear = parseOptionalYear(request.nextUrl.searchParams.get('fromYear'))
    const fromDays = parseOptionalPositiveInt(request.nextUrl.searchParams.get('fromDays'))
    const refreshFlag = request.nextUrl.searchParams.get('refresh')
    const refresh = refreshFlag === '1' || refreshFlag === 'true'

    console.info('[legal-drawings-index:get] start', {
      sourceRoot,
      fromYear,
      fromDays,
      refresh,
    })

    if (!sourceRoot) {
      console.info('[legal-drawings-index:get] not-configured', {
        elapsedMs: Date.now() - startedAt,
      })
      return NextResponse.json(buildEmptyIndexResponse({
        sourceRoot: '',
        fromYear,
        fromDays,
        configured: false,
        message: 'Legal Drawings source root is not configured. Set it in Startup or Path Settings.',
      }))
    }

    const index = await getLegalDrawingsSourceIndex({
      sourceRoot,
      fromYear,
      fromDays,
      refresh,
    })

    console.info('[legal-drawings-index:get] success', {
      sourceRoot: index.sourceRoot,
      fromYear: index.fromYear,
      fromDays: index.fromDays ?? null,
      projectCount: index.projectCount,
      updatedProjectCount: index.updatedProjectCount,
      elapsedMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ...index,
      configured: true,
      message: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load legal drawings index'
    console.error('[legal-drawings-index:get] failed', {
      message,
      elapsedMs: Date.now() - startedAt,
    })
    if (message.toLowerCase().includes('not configured')) {
      return NextResponse.json(buildEmptyIndexResponse({ message }))
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const body = await request.json() as {
      sourceRoot?: string
      fromYear?: number
      fromDays?: number
    }

    const sourceRoot = body.sourceRoot?.trim() || await resolveLegalDrawingsSourceRoot()
    const fromYear = Number.isInteger(body.fromYear) ? body.fromYear : undefined
    const fromDays = Number.isInteger(body.fromDays) && body.fromDays > 0 ? body.fromDays : undefined

    console.info('[legal-drawings-index:post] start', {
      sourceRoot,
      fromYear,
      fromDays,
    })

    if (!sourceRoot) {
      console.info('[legal-drawings-index:post] not-configured', {
        elapsedMs: Date.now() - startedAt,
      })
      return NextResponse.json(buildEmptyIndexResponse({
        sourceRoot: '',
        fromYear,
        fromDays,
        configured: false,
        message: 'Legal Drawings source root is not configured. Set it in Startup or Path Settings.',
      }))
    }

    const index = await refreshLegalDrawingsSourceIndex({
      sourceRoot,
      fromYear,
      fromDays,
    })

    console.info('[legal-drawings-index:post] success', {
      sourceRoot: index.sourceRoot,
      fromYear: index.fromYear,
      fromDays: index.fromDays ?? null,
      projectCount: index.projectCount,
      updatedProjectCount: index.updatedProjectCount,
      elapsedMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ...index,
      configured: true,
      message: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh legal drawings index'
    console.error('[legal-drawings-index:post] failed', {
      message,
      elapsedMs: Date.now() - startedAt,
    })
    if (message.toLowerCase().includes('not configured')) {
      return NextResponse.json(buildEmptyIndexResponse({ message }))
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
