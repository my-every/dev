import { NextRequest, NextResponse } from 'next/server'

import { getLegalProjectRecord, patchLegalProjectMeta, deleteLegalProject } from '@/lib/legal-drawings/library'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  const { pdNumber } = await params
  const project = await getLegalProjectRecord(pdNumber)

  if (!project) {
    return NextResponse.json({ error: 'Legal project not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  const { pdNumber } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = ['projectName', 'lwcType', 'dueDate', 'planConlayDate', 'planConassyDate', 'shipDate', 'deptTargetDate'] as const
  const patch: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) {
      const v = body[key]
      patch[key] = typeof v === 'string' && v.trim() !== '' ? v.trim() : null
    }
  }

  try {
    const updated = await patchLegalProjectMeta(pdNumber, patch)
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  const { pdNumber } = await params

  try {
    const deleted = await deleteLegalProject(pdNumber)
    if (!deleted) {
      return NextResponse.json({ error: 'Legal project not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, pdNumber })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[legal-drawings/${pdNumber}] DELETE failed`, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
