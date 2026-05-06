import { NextRequest, NextResponse } from 'next/server'

import type { ProjectUnit } from '@/lib/project-units/types'
import {
  generateAssignmentWorkflowFromProjectUnits,
  writeProjectUnits,
} from '@/lib/project-state/share-project-units-handlers'

export const dynamic = 'force-dynamic'

export async function POST(
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
    const mappings = await generateAssignmentWorkflowFromProjectUnits(projectId, document.units)

    return NextResponse.json({
      document,
      mappings,
      generatedCount: mappings.filter((mapping) => mapping.sheetKind === 'assignment').length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate workflow from units'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
