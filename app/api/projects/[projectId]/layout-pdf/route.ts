import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveProjectRootDirectory, readProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import { getProjectRevisionHistory } from '@/lib/revision/revision-discovery'
import type { LayoutPagesIndexDocument, SlimLayoutPage } from '@/lib/layout-matching'

export const dynamic = 'force-dynamic'

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const manifest = await readProjectManifest(projectId)
  if (!manifest?.pdNumber) {
    return NextResponse.json({ error: 'Project manifest not found' }, { status: 404 })
  }

  const projectRoot = await resolveProjectRootDirectory(projectId, {
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
  })

  if (!projectRoot) {
    return NextResponse.json({ error: 'Project root not found' }, { status: 404 })
  }

  const stateRoot = path.join(projectRoot, 'state')
  const layoutIndex = await readJsonFile<LayoutPagesIndexDocument>(path.join(stateRoot, 'layout-pages.index.json'))
  const slimPages = await readJsonFile<{ pages?: SlimLayoutPage[] }>(path.join(stateRoot, 'layout-pages.json'))
  const history = await getProjectRevisionHistory(projectId, manifest.pdNumber)
  const selectedFilename = manifest.activeLayoutRevisionId ?? history?.currentLayout?.filename ?? null
  const selectedRevision = selectedFilename
    ? history?.layoutRevisions.find(revision => revision.filename === selectedFilename) ?? history?.currentLayout ?? null
    : null

  if (!selectedRevision?.filePath) {
    return NextResponse.json({
      pdf: null,
      layoutIndex,
      pages: slimPages?.pages ?? [],
      totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
    }, { status: 200 })
  }

  if (request.nextUrl.searchParams.get('raw') === '1') {
    const fileBuffer = await fs.readFile(selectedRevision.filePath)
    const stats = await fs.stat(selectedRevision.filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `inline; filename="${selectedRevision.filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return NextResponse.json({
    pdf: {
      fileName: selectedRevision.filename,
      revision: selectedRevision.revisionInfo.displayVersion,
      totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
      url: `/api/projects/${encodeURIComponent(projectId)}/layout-pdf?raw=1`,
    },
    layoutIndex,
    pages: slimPages?.pages ?? [],
    totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
  })
}
