import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { ProjectModel } from '@/lib/workbook/types'
import type { ProjectManifest } from '@/types/project-manifest'

export const dynamic = 'force-dynamic'

type IndexedFileKind =
  | 'ucp_wl_compare_spreadsheet'
  | 'ucp_wire_list_spreadsheet'
  | 'ucp_spreadsheet'
  | 'lay_pdf'

interface IndexedSelectedFile {
  fullPath: string
  fileName: string
  kind: IndexedFileKind
  mtimeMs: number
}

interface InstantiateFromIndexInput {
  pdNumber: string
  projectName?: string
  revision?: string | null
  unitNumber?: string | null
  selectedFiles: IndexedSelectedFile[]
}

function pickSourceFiles(selectedFiles: IndexedSelectedFile[]): {
  workbook: IndexedSelectedFile | null
  layout: IndexedSelectedFile | null
} {
  const spreadsheetCandidates = selectedFiles.filter((file) =>
    file.kind === 'ucp_wire_list_spreadsheet'
    || file.kind === 'ucp_wl_compare_spreadsheet'
    || file.kind === 'ucp_spreadsheet',
  )

  const layoutCandidates = selectedFiles.filter((file) => file.kind === 'lay_pdf')

  const workbook = spreadsheetCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null
  const layout = layoutCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null

  return { workbook, layout }
}

function normalizeProjectName(pdNumber: string, projectName?: string): string {
  const trimmed = String(projectName ?? '').trim()
  if (trimmed) {
    return trimmed
  }
  return `${pdNumber} Source Import`
}

function buildPlaceholderProjectModel(input: {
  projectId: string
  projectName: string
  pdNumber: string
  unitNumber?: string | null
  revision?: string | null
}): ProjectModel {
  const now = new Date()

  return {
    id: input.projectId,
    filename: `${input.projectName}.xlsx`,
    name: input.projectName,
    pdNumber: input.pdNumber,
    unitNumber: input.unitNumber?.trim() || undefined,
    revision: input.revision?.trim() || undefined,
    sheets: [],
    sheetData: {},
    createdAt: now,
    warnings: [],
    status: 'legals_pending',
    lifecycleGates: [
      { gateId: 'LEGALS_READY', status: 'LOCKED' },
      { gateId: 'BRANDLIST_COMPLETE', status: 'LOCKED' },
      { gateId: 'BRANDING_READY', status: 'LOCKED' },
      { gateId: 'KITTING_READY', status: 'LOCKED' },
    ],
  }
}

async function createProjectManifestViaApi(request: NextRequest, model: ProjectModel): Promise<ProjectManifest> {
  const targetUrl = new URL(`/api/projects/${encodeURIComponent(model.id)}`, request.url)
  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectModel: model }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({})) as { manifest?: ProjectManifest; error?: string }
  if (!response.ok || !payload.manifest) {
    throw new Error(payload.error || 'Failed to create project manifest from selected source files.')
  }

  return payload.manifest
}

async function uploadSelectedFilesViaRevisionApi(input: {
  request: NextRequest
  projectId: string
  pdNumber: string
  revision: string
  workbook: IndexedSelectedFile | null
  layout: IndexedSelectedFile | null
}): Promise<{ refreshJob?: unknown; revisionName?: string }> {
  if (!input.workbook && !input.layout) {
    throw new Error('No workbook or layout file could be resolved from the selected files.')
  }

  const formData = new FormData()
  formData.append('pdNumber', input.pdNumber)
  formData.append('revisionName', input.revision)

  if (input.workbook) {
    const workbookBuffer = await fs.readFile(input.workbook.fullPath)
    formData.append('workbook', new File([workbookBuffer], path.basename(input.workbook.fileName)))
  }

  if (input.layout) {
    const layoutBuffer = await fs.readFile(input.layout.fullPath)
    formData.append('layout', new File([layoutBuffer], path.basename(input.layout.fileName)))
  }

  const uploadUrl = new URL(
    `/api/projects/revisions/${encodeURIComponent(input.projectId)}/files?async=1`,
    input.request.url,
  )

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-badge-number': input.request.headers.get('x-badge-number') ?? '',
      'x-shift': input.request.headers.get('x-shift') ?? '1st',
    },
    body: formData,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({})) as {
    error?: string
    refreshJob?: unknown
    revisionName?: string
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to upload selected files into project revision pipeline.')
  }

  return {
    refreshJob: payload.refreshJob,
    revisionName: payload.revisionName,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as InstantiateFromIndexInput

    const pdNumber = String(body.pdNumber ?? '').trim().toUpperCase()
    if (!pdNumber) {
      return NextResponse.json({ error: 'pdNumber is required' }, { status: 422 })
    }

    if (!Array.isArray(body.selectedFiles) || body.selectedFiles.length === 0) {
      return NextResponse.json({ error: 'selectedFiles is required' }, { status: 422 })
    }

    const { workbook, layout } = pickSourceFiles(body.selectedFiles)
    if (!workbook && !layout) {
      return NextResponse.json(
        { error: 'Selected files did not contain a usable UCP workbook or LAY PDF.' },
        { status: 422 },
      )
    }

    const projectName = normalizeProjectName(pdNumber, body.projectName)
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const requestedRevision = String(body.revision ?? '').trim().toUpperCase() || 'IMPORTED'

    const projectModel = buildPlaceholderProjectModel({
      projectId,
      projectName,
      pdNumber,
      unitNumber: body.unitNumber,
      revision: requestedRevision,
    })

    const manifest = await createProjectManifestViaApi(request, projectModel)
    const uploadResult = await uploadSelectedFilesViaRevisionApi({
      request,
      projectId: manifest.id,
      pdNumber,
      revision: requestedRevision,
      workbook,
      layout,
    })

    return NextResponse.json({
      manifest,
      revisionName: uploadResult.revisionName,
      refreshJob: uploadResult.refreshJob,
      ingestedFiles: {
        workbook: workbook?.fullPath ?? null,
        layout: layout?.fullPath ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create project from selected legal source files',
      },
      { status: 500 },
    )
  }
}
