import { NextRequest, NextResponse } from "next/server"

import {
  listWireListGreenChangesSchemas,
  readWireListGreenChangesSchema,
} from "@/lib/project-state/share-print-schema-handlers"
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers"
import { ASSIGNMENT_STAGES, type AssignmentStageId } from "@/types/d380-assignment-stages"
import type { ManifestAssignment, ProjectManifest } from "@/types/project-manifest"
import type { GreenChangeSheetSchema } from "@/lib/workbook/green-changes-schema"

export const dynamic = "force-dynamic"

type AssignmentStageContext = {
  sheetSlug: string
  sheetName: string
  stage: AssignmentStageId
  stageLabel: string
  status: ManifestAssignment["status"]
}

type GreenChangeRowWithAssignment = GreenChangeSheetSchema["rows"][number] & {
  assignment?: AssignmentStageContext
}

function normalizeLocation(value: string): string {
  return value.trim().toUpperCase()
}

function getEffectiveRowLocation(row: {
  toLocation?: string
  fromLocation?: string
  location?: string
}): string {
  return row.toLocation || row.fromLocation || row.location || ""
}

function getStageLabel(stageId: AssignmentStageId): string {
  return ASSIGNMENT_STAGES.find((stage) => stage.id === stageId)?.label ?? stageId
}

function resolveAssignmentForLocation(
  manifest: ProjectManifest,
  location: string,
): AssignmentStageContext | null {
  const normalized = normalizeLocation(location)
  if (!normalized) {
    return null
  }

  const assignments = Object.values(manifest.assignments ?? {}).filter(
    (assignment): assignment is ManifestAssignment => assignment.kind === "operational",
  )

  const exact = assignments.find(
    (assignment) => normalizeLocation(assignment.sheetName) === normalized,
  )
  if (exact) {
    return {
      sheetSlug: exact.sheetSlug,
      sheetName: exact.sheetName,
      stage: exact.stage,
      stageLabel: getStageLabel(exact.stage),
      status: exact.status,
    }
  }

  let bestMatch: ManifestAssignment | null = null
  let bestLength = 0

  for (const assignment of assignments) {
    const assignmentName = normalizeLocation(assignment.sheetName)
    if (!assignmentName) {
      continue
    }

    if (normalized.includes(assignmentName) || assignmentName.includes(normalized)) {
      if (assignmentName.length > bestLength) {
        bestMatch = assignment
        bestLength = assignmentName.length
      }
    }
  }

  if (!bestMatch) {
    return null
  }

  return {
    sheetSlug: bestMatch.sheetSlug,
    sheetName: bestMatch.sheetName,
    stage: bestMatch.stage,
    stageLabel: getStageLabel(bestMatch.stage),
    status: bestMatch.status,
  }
}

function enrichRowsWithAssignmentContext(
  schema: GreenChangeSheetSchema,
  manifest: ProjectManifest,
): GreenChangeRowWithAssignment[] {
  return schema.rows.map((row) => {
    const location = getEffectiveRowLocation(row)
    return {
      ...row,
      assignment: resolveAssignmentForLocation(manifest, location) ?? undefined,
    }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const sheetSlug = request.nextUrl.searchParams.get("sheet")
  const includeAssignments = request.nextUrl.searchParams.get("includeAssignments") === "true"

  try {
    if (!sheetSlug) {
      const sheets = await listWireListGreenChangesSchemas(projectId)
      return NextResponse.json({ sheets })
    }

    const schema = await readWireListGreenChangesSchema(projectId, sheetSlug)
    if (!schema) {
      return NextResponse.json({ error: `No saved Green Changes schema found for sheet: ${sheetSlug}` }, { status: 404 })
    }

    if (!includeAssignments) {
      return NextResponse.json(schema)
    }

    const manifest = await readProjectManifest(projectId)
    if (!manifest) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...schema,
      rows: enrichRowsWithAssignmentContext(schema, manifest),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read Green Changes schema" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  try {
    const body = await request.json() as {
      locations?: string[]
    }

    const locations = Array.isArray(body.locations)
      ? Array.from(new Set(body.locations.map((value) => String(value || "").trim()).filter(Boolean)))
      : []

    if (locations.length === 0) {
      return NextResponse.json({ error: "Missing or invalid 'locations' array" }, { status: 400 })
    }

    const manifest = await readProjectManifest(projectId)
    if (!manifest) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const assignmentByLocation = Object.fromEntries(
      locations.map((location) => [location, resolveAssignmentForLocation(manifest, location)]),
    )

    return NextResponse.json({
      projectId,
      locations,
      assignmentByLocation,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve assignment context" },
      { status: 500 },
    )
  }
}
