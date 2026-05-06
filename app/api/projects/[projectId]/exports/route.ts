import { NextRequest, NextResponse } from 'next/server'

import {
  generateBrandingCsvExports,
  readBrandingCsvExports,
} from '@/lib/project-exports/branding-csv-exports'
import {
  generateWireListPdfExports,
  readWireListPdfExports,
} from '@/lib/project-exports/wire-list-pdf-exports'

export const dynamic = 'force-dynamic'

type ExportKind = 'branding' | 'wire-lists'

function parseKind(value: string | null): ExportKind | null {
  if (value === 'branding' || value === 'wire-lists') {
    return value
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const kind = parseKind(request.nextUrl.searchParams.get('kind'))

  if (!kind) {
    return NextResponse.json({ error: 'Missing or invalid kind' }, { status: 400 })
  }

  if (kind === 'branding') {
    const result = await readBrandingCsvExports(projectId)
    if (!result) {
      return NextResponse.json({ error: 'Export manifest not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  }

  const result = await readWireListPdfExports(projectId)
  if (!result) {
    return NextResponse.json({ error: 'Export manifest not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const kind = parseKind(request.nextUrl.searchParams.get('kind'))

  if (!kind) {
    return NextResponse.json({ error: 'Missing or invalid kind' }, { status: 400 })
  }

  try {
    if (kind === 'branding') {
      const result = await generateBrandingCsvExports(projectId)
      return NextResponse.json(result)
    }

    const result = await generateWireListPdfExports(projectId, request.nextUrl.origin)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate exports' },
      { status: 500 },
    )
  }
}
