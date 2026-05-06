import { NextRequest, NextResponse } from 'next/server'

import {
  ingestDevicePartNumbersMap,
  ingestPartCandidates,
  ingestStoredProjectPartNumbers,
  type PartIngestCandidate,
} from '@/lib/project-state/parts-ingest-service'
import {
  readProjectManifest,
  resolveProjectRootDirectory,
} from '@/lib/project-state/share-project-state-handlers'
import { readDevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'
import type { StoredProject } from '@/types/d380-shared'

export const dynamic = 'force-dynamic'

type IngestRequestBody = {
  projectId?: string
  candidates?: PartIngestCandidate[]
  project?: StoredProject
  uploadedBy?: string
  reviewRole?: string
  dryRun?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as IngestRequestBody

    if (Array.isArray(body.candidates) && body.candidates.length > 0) {
      const result = await ingestPartCandidates(body.candidates, {
        projectId: body.projectId,
        uploadedBy: body.uploadedBy,
        reviewRole: body.reviewRole,
        dryRun: Boolean(body.dryRun),
      })

      return NextResponse.json({ success: true, mode: 'candidates', result })
    }

    if (body.project && body.project.projectModel) {
      const result = await ingestStoredProjectPartNumbers(body.project, {
        projectId: body.project.id,
        uploadedBy: body.uploadedBy,
        reviewRole: body.reviewRole,
        dryRun: Boolean(body.dryRun),
      })

      return NextResponse.json({ success: true, mode: 'project', result })
    }

    if (body.projectId) {
      const manifest = await readProjectManifest(body.projectId)
      if (!manifest) {
        return NextResponse.json(
          { success: false, error: `Project ${body.projectId} not found` },
          { status: 404 },
        )
      }

      const projectRoot = await resolveProjectRootDirectory(body.projectId, {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
      })

      if (!projectRoot) {
        return NextResponse.json(
          { success: false, error: `Unable to resolve root directory for project ${body.projectId}` },
          { status: 404 },
        )
      }

      const map = await readDevicePartNumbersMap(projectRoot)
      if (!map) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device part numbers map is missing. Generate it first or submit candidates directly.',
          },
          { status: 400 },
        )
      }

      const result = await ingestDevicePartNumbersMap(map, {
        projectId: body.projectId,
        uploadedBy: body.uploadedBy,
        reviewRole: body.reviewRole,
        dryRun: Boolean(body.dryRun),
      })

      return NextResponse.json({ success: true, mode: 'projectId', result })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Provide one of: candidates[], project, or projectId',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('[parts/ingest] POST failed', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ingest parts',
      },
      { status: 500 },
    )
  }
}
