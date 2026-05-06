import { NextRequest, NextResponse } from 'next/server'

import {
    readSheetSchema,
    writeSheetSchema,
} from '@/lib/project-state/share-project-state-handlers'
import type { SheetSchema } from '@/types/sheet-schema'

export const dynamic = 'force-dynamic'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
    const { projectId, sheetSlug } = await params
    const schema = await readSheetSchema(projectId, sheetSlug)

    if (!schema) {
        return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
    }

    return NextResponse.json({ schema })
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
    const { projectId, sheetSlug } = await params
    const schema = await request.json() as SheetSchema

    if (schema.slug !== sheetSlug) {
        return NextResponse.json({ error: 'Sheet slug mismatch' }, { status: 400 })
    }

    await writeSheetSchema(projectId, schema)
    return NextResponse.json({ schema })
}
