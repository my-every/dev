import type { GreenChangeSheetSchema } from "@/lib/workbook/green-changes-schema"

type AssignmentContext = {
  sheetSlug: string
  sheetName: string
  stage: string
  stageLabel: string
  status: string
} | null

export async function listProjectGreenChangesSheets(projectId: string): Promise<string[]> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/wire-list-green-changes`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Failed to list Green Changes sheets")
  }

  const payload = await response.json() as { sheets?: string[] }
  return Array.isArray(payload.sheets) ? payload.sheets : []
}

export async function readProjectGreenChangesSchema(
  projectId: string,
  sheetSlug: string,
  options?: { includeAssignments?: boolean },
): Promise<GreenChangeSheetSchema | null> {
  const includeAssignments = options?.includeAssignments ? "&includeAssignments=true" : ""
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/wire-list-green-changes?sheet=${encodeURIComponent(sheetSlug)}${includeAssignments}`,
    { cache: "no-store" },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error("Failed to read Green Changes schema")
  }

  return await response.json() as GreenChangeSheetSchema
}

export async function resolveProjectAssignmentsByLocations(
  projectId: string,
  locations: string[],
): Promise<Record<string, AssignmentContext>> {
  if (locations.length === 0) {
    return {}
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/wire-list-green-changes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ locations }),
  })

  if (!response.ok) {
    throw new Error("Failed to resolve assignment context")
  }

  const payload = await response.json() as {
    assignmentByLocation?: Record<string, AssignmentContext>
  }

  return payload.assignmentByLocation ?? {}
}
