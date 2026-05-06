import { NextRequest, NextResponse } from 'next/server'

import {
  applyProjectUnitBindingsToSheetSchemas,
  detectProjectUnits,
  readProjectUnits,
  writeProjectUnits,
} from '@/lib/project-state/share-project-units-handlers'
import type { ProjectUnit } from '@/lib/project-units/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  try {
    const persisted = await readProjectUnits(projectId)
    if (persisted) {
      return NextResponse.json({
        document: persisted,
        source: 'persisted',
        summary: {
          unmatchedSheetSlugs: [],
          unmatchedPageNumbers: [],
        },
      })
    }

    const detected = await detectProjectUnits(projectId)
    return NextResponse.json(detected)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load project units'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  try {
    const body = (await request.json()) as { units?: ProjectUnit[] }
    if (!Array.isArray(body.units)) {
      return NextResponse.json({ error: 'Units array is required' }, { status: 400 })
    }

    const document = await writeProjectUnits(projectId, body.units)
    await applyProjectUnitBindingsToSheetSchemas(projectId, document.units)
    return NextResponse.json({
      document,
      source: 'persisted',
      summary: {
        unmatchedSheetSlugs: [],
        unmatchedPageNumbers: [],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save project units'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
