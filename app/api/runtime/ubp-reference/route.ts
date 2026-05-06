import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getShareDirectory } from '@/lib/runtime/share-directory'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import type { ExternalLocationConfig } from '@/lib/layout-matching/ubp-reference-index'

export const dynamic = 'force-dynamic'

async function getReferenceFilePath(): Promise<string> {
  const shareDir = await resolveShareDirectory()
  return path.join(shareDir, 'References', 'layout-unit-box-panel-reference.json')
}

async function readReference(): Promise<Record<string, unknown>> {
  const filePath = await getReferenceFilePath()
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

async function writeReference(data: Record<string, unknown>): Promise<void> {
  const filePath = await getReferenceFilePath()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

/**
 * GET /api/runtime/ubp-reference
 *
 * Returns the full unitTypeToBoxNumber mappings including per-assignment
 * externalLocations visibility configs.
 */
export async function GET() {
  try {
    const reference = await readReference()
    const mappings = (reference?.mappings as Record<string, unknown>)?.unitTypeToBoxNumber ?? []
    return NextResponse.json({ mappings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read UBP reference' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/runtime/ubp-reference
 *
 * Update the externalLocations visibility config for a single assignment.
 *
 * Body:
 * ```json
 * {
 *   "unitType": "C4.4",
 *   "assignment": "FO CONV VFD",
 *   "externalLocations": [
 *     { "location": "PLC", "wireListVisible": true, "brandingVisible": false }
 *   ]
 * }
 * ```
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      unitType?: string
      assignment?: string
      externalLocations?: ExternalLocationConfig[]
    }

    const { unitType, assignment, externalLocations } = body

    if (!unitType || !assignment) {
      return NextResponse.json(
        { error: 'unitType and assignment are required' },
        { status: 400 },
      )
    }

    if (!Array.isArray(externalLocations)) {
      return NextResponse.json(
        { error: 'externalLocations must be an array' },
        { status: 400 },
      )
    }

    // Validate each entry
    for (const entry of externalLocations) {
      if (typeof entry.location !== 'string' || !entry.location.trim()) {
        return NextResponse.json(
          { error: 'Each externalLocations entry must have a non-empty location string' },
          { status: 400 },
        )
      }
    }

    const reference = await readReference()
    const rows = Array.isArray((reference?.mappings as Record<string, unknown>)?.unitTypeToBoxNumber)
      ? ((reference.mappings as Record<string, unknown>).unitTypeToBoxNumber as Record<string, unknown>[])
      : []

    const unitTypeNorm = unitType.trim().toUpperCase()
    const assignmentNorm = assignment.trim().toUpperCase()

    let found = false
    for (const row of rows) {
      if (String(row.unitType ?? '').trim().toUpperCase() !== unitTypeNorm) continue
      const assignments = Array.isArray(row.assignments)
        ? (row.assignments as Record<string, unknown>[])
        : []
      for (const a of assignments) {
        if (String(a.value ?? '').trim().toUpperCase() !== assignmentNorm) continue
        a.externalLocations = externalLocations
        found = true
        break
      }
      if (found) break
    }

    if (!found) {
      return NextResponse.json(
        { error: `Assignment "${assignment}" not found under unitType "${unitType}"` },
        { status: 404 },
      )
    }

    await writeReference(reference)

    return NextResponse.json({ ok: true, unitType, assignment, externalLocations })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update UBP reference' },
      { status: 500 },
    )
  }
}
