import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

import { resolveShareDirectory } from '@/lib/runtime/share-directory'

export const dynamic = 'force-dynamic'

async function getSlotsFilePath() {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Schedule', 'SLOTS.json')
}

async function readSlotsRows(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('SLOTS payload is not an array')
  }

  return parsed as Record<string, unknown>[]
}

export async function GET() {
  try {
    const filePath = await getSlotsFilePath()
    const parsed = await readSlotsRows(filePath)

    return NextResponse.json({
      rows: parsed,
      count: parsed.length,
      source: 'SLOTS.json',
      importedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to load SLOTS.json', error)
    return NextResponse.json({ error: 'Failed to load SLOTS.json' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      index?: number
      updates?: Record<string, unknown>
    }

    if (!Number.isInteger(body.index) || body.index == null || body.index < 0) {
      return NextResponse.json({ error: 'A valid row index is required' }, { status: 400 })
    }

    if (!body.updates || typeof body.updates !== 'object' || Array.isArray(body.updates)) {
      return NextResponse.json({ error: 'A valid updates object is required' }, { status: 400 })
    }

    const filePath = await getSlotsFilePath()
    const rows = await readSlotsRows(filePath)

    if (body.index >= rows.length) {
      return NextResponse.json({ error: 'Row index is out of range' }, { status: 404 })
    }

    rows[body.index] = {
      ...rows[body.index],
      ...body.updates,
    }

    await fs.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8')

    return NextResponse.json({
      row: rows[body.index],
      index: body.index,
      count: rows.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to update SLOTS.json row', error)
    return NextResponse.json({ error: 'Failed to update SLOTS.json row' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      record?: Record<string, unknown>
    }

    if (!body.record || typeof body.record !== 'object' || Array.isArray(body.record)) {
      return NextResponse.json({ error: 'A valid record object is required' }, { status: 400 })
    }

    const filePath = await getSlotsFilePath()
    const rows = await readSlotsRows(filePath)
    rows.push(body.record)

    await fs.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8')

    return NextResponse.json({
      row: body.record,
      index: rows.length - 1,
      count: rows.length,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to create SLOTS.json row', error)
    return NextResponse.json({ error: 'Failed to create SLOTS.json row' }, { status: 500 })
  }
}
