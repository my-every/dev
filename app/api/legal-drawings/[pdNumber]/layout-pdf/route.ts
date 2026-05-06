import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

import { getLegalProjectRecord } from '@/lib/legal-drawings/library'
import type { LayoutPagesIndexDocument, SlimLayoutPage } from '@/lib/layout-matching'
import type { ProjectManifest } from '@/types/project-manifest'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'

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
  { params }: { params: Promise<{ pdNumber: string }> },
) {
  const { pdNumber } = await params
  const project = await getLegalProjectRecord(pdNumber)
  if (!project) {
    return NextResponse.json({ error: 'Legal project not found' }, { status: 404 })
  }

  const requestedRevision = request.nextUrl.searchParams.get('revision') || project.latestRevision || null
  const revision = project.revisions.find(entry => entry.revision === requestedRevision) ?? project.revisions[project.revisions.length - 1] ?? null
  const shareRoot = await resolveShareDirectory()
  const revisionRoot = path.join(shareRoot, 'Legal Drawings', project.pdNumber, revision.revision)
  const projectManifest = await readJsonFile<ProjectManifest>(path.join(revisionRoot, 'project-manifest.json'))
  const layoutIndex = revision?.layoutFileName
    ? await readJsonFile<LayoutPagesIndexDocument>(path.join(revisionRoot, 'layout-pages.index.json'))
    : null
  const slimPages = revision?.layoutFileName
    ? await readJsonFile<{ pages?: SlimLayoutPage[] }>(path.join(revisionRoot, 'layout-pages.json'))
    : null
  const pdfPath = revision?.layoutFileName ? path.join(revisionRoot, revision.layoutFileName) : null

  if (request.nextUrl.searchParams.get('raw') === '1' && pdfPath && revision?.layoutFileName) {
    const requestedPage = Number(request.nextUrl.searchParams.get('page') || '')
    const shouldDownload = request.nextUrl.searchParams.get('download') === '1'
    const fileBuffer = await fs.readFile(pdfPath)
    let responseBuffer = fileBuffer
    let downloadName = revision.layoutFileName

    if (Number.isFinite(requestedPage) && requestedPage >= 1) {
      const sourceDocument = await PDFDocument.load(fileBuffer)
      const pageIndex = requestedPage - 1
      if (pageIndex >= 0 && pageIndex < sourceDocument.getPageCount()) {
        const extractedDocument = await PDFDocument.create()
        const [copiedPage] = await extractedDocument.copyPages(sourceDocument, [pageIndex])
        extractedDocument.addPage(copiedPage)
        responseBuffer = Buffer.from(await extractedDocument.save())
        const baseName = revision.layoutFileName.replace(/\.pdf$/i, '')
        downloadName = `${baseName}-page-${requestedPage}.pdf`
      }
    }

    return new NextResponse(responseBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': responseBuffer.length.toString(),
        'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${downloadName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return NextResponse.json({
    pdf: {
      fileName: revision?.layoutFileName ?? null,
      revision: revision.revision,
      totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
      url: revision?.layoutFileName
        ? `/api/legal-drawings/${encodeURIComponent(project.pdNumber)}/layout-pdf?revision=${encodeURIComponent(revision.revision)}&raw=1`
        : null,
    },
    layoutIndex,
    pages: slimPages?.pages ?? [],
    totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
    manifest: projectManifest
      ? {
          id: projectManifest.id,
          name: projectManifest.name,
          operationalSheets: projectManifest.sheets
            .filter((sheet) => sheet.kind === 'operational')
            .map((sheet) => ({
              slug: sheet.slug,
              name: sheet.name,
              rowCount: sheet.rowCount,
            })),
        }
      : null,
  })
}
