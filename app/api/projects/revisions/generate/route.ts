import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

import { scanProjectRevisionsFromFilesystem } from '@/lib/revision/filesystem-scan'
import type { ProjectRevisionTreeRow, RevisionScanRequest } from '@/lib/revision/types'
import { listStoredProjectsByPdNumber } from '@/lib/project-state/share-project-state-handlers'
import { generateAllPrintSchemas } from '@/lib/project-exports/generate-print-schemas'

export const dynamic = 'force-dynamic'

interface GenerateRequestBody {
  selectedProjectKeys: string[]
  scanRequest?: RevisionScanRequest
}

interface GeneratedProjectResult {
  projectKey: string
  pdNumber: string
  resolvedProjectId: string | null
  outputs: Array<'wire-list-schemas' | 'branding-schemas' | 'revision-manifest' | 'layout-metadata-mapping'>
  message: string
}

async function writeGeneratedRevisionManifest(results: GeneratedProjectResult[], scanGeneratedAt: string) {
  const directory = path.join(process.cwd(), 'cache', 'revision-scans')
  await fs.mkdir(directory, { recursive: true })
  const manifestPath = path.join(directory, 'latest-generated-manifests.json')
  const payload = {
    generatedAt: new Date().toISOString(),
    scanGeneratedAt,
    results,
  }

  await fs.writeFile(manifestPath, JSON.stringify(payload, null, 2), 'utf-8')
  return manifestPath
}

function getSelectedRows(projects: ProjectRevisionTreeRow[], selectedProjectKeys: string[]) {
  const wanted = new Set(selectedProjectKeys)
  return projects.filter((row) => wanted.has(row.rootLabel))
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequestBody
    const selectedProjectKeys = Array.isArray(body.selectedProjectKeys)
      ? body.selectedProjectKeys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []

    if (selectedProjectKeys.length === 0) {
      return NextResponse.json({ error: 'No selected projects provided.' }, { status: 400 })
    }

    const scan = await scanProjectRevisionsFromFilesystem(body.scanRequest ?? { scope: 'both' })
    const selectedRows = getSelectedRows(scan.projects, selectedProjectKeys)

    if (selectedRows.length === 0) {
      return NextResponse.json({ error: 'No selected projects were found in the latest scan results.' }, { status: 404 })
    }

    const generated: GeneratedProjectResult[] = []

    for (const row of selectedRows) {
      const projects = await listStoredProjectsByPdNumber(row.pdNumber)
      const resolvedProject = projects[0] ?? null

      if (!resolvedProject) {
        generated.push({
          projectKey: row.rootLabel,
          pdNumber: row.pdNumber,
          resolvedProjectId: null,
          outputs: ['revision-manifest'],
          message: 'No stored project manifest found for PD number. Generated revision manifest only.',
        })
        continue
      }

      await generateAllPrintSchemas(resolvedProject.id)

      generated.push({
        projectKey: row.rootLabel,
        pdNumber: row.pdNumber,
        resolvedProjectId: resolvedProject.id,
        outputs: ['wire-list-schemas', 'branding-schemas', 'revision-manifest', 'layout-metadata-mapping'],
        message: 'Generated wire list + branding schemas and refreshed revision manifest metadata.',
      })
    }

    const manifestPath = await writeGeneratedRevisionManifest(generated, scan.generatedAt)

    return NextResponse.json({
      generated,
      manifestPath,
      scanGeneratedAt: scan.generatedAt,
    })
  } catch (error) {
    console.error('[revisions/generate] Failed to generate revision outputs:', error)
    return NextResponse.json({ error: 'Failed to generate revision outputs.' }, { status: 500 })
  }
}
