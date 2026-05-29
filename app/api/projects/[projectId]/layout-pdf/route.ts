import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

import { resolveProjectRootDirectory, readProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import { getProjectRevisionHistory } from '@/lib/revision/revision-discovery'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
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

/**
 * Resolve an absolute file path for a layout PDF when the filesystem scan
 * (which uses the default Windows UNC path) cannot locate the file. Falls
 * back to constructing the path directly from the share directory so the
 * route works on macOS / non-Windows environments where the default scan
 * root is unavailable.
 */
async function resolveLayoutPdfFilePath(pdNumber: string, filename: string): Promise<string | null> {
  try {
    const shareRoot = await resolveShareDirectory()
    const legalRoot = path.join(shareRoot, 'Legal Drawings')
    const pdFolder = pdNumber.trim().toUpperCase()

    // Try the project folder root first, then common subdirectory patterns.
    const candidates: string[] = [
      path.join(legalRoot, pdFolder, filename),
    ]

    // Also search one level of subdirectories (e.g. ANG01/A.6_M.2/file.pdf)
    try {
      const entries = await fs.readdir(path.join(legalRoot, pdFolder), { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          candidates.push(path.join(legalRoot, pdFolder, entry.name, filename))
        }
      }
    } catch {
      // Folder may not exist; continue with root-level candidate only.
    }

    for (const candidate of candidates) {
      const stat = await fs.stat(candidate).catch(() => null)
      if (stat?.isFile()) {
        return candidate
      }
    }

    return null
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

  // Resolve the file path — prefer the scan result, fall back to direct share-directory lookup
  // for environments where the default Windows scan root is unavailable (e.g. macOS).
  let resolvedFilePath = selectedRevision?.filePath ?? null
  const resolvedFilename = selectedRevision?.filename ?? selectedFilename ?? null
  if (!resolvedFilePath && resolvedFilename) {
    resolvedFilePath = await resolveLayoutPdfFilePath(manifest.pdNumber, resolvedFilename)
  }

  if (!resolvedFilePath || !resolvedFilename) {
    return NextResponse.json({
      pdf: null,
      layoutIndex,
      pages: slimPages?.pages ?? [],
      totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
    }, { status: 200 })
  }

  if (request.nextUrl.searchParams.get('raw') === '1') {
    const requestedPage = Number(request.nextUrl.searchParams.get('page') || '')
    const shouldDownload = request.nextUrl.searchParams.get('download') === '1'
    const fileBuffer = await fs.readFile(resolvedFilePath)
    let responseBuffer = fileBuffer
    let downloadName = resolvedFilename

    if (Number.isFinite(requestedPage) && requestedPage >= 1) {
      const sourceDocument = await PDFDocument.load(fileBuffer)
      const pageIndex = requestedPage - 1
      if (pageIndex >= 0 && pageIndex < sourceDocument.getPageCount()) {
        const extractedDocument = await PDFDocument.create()
        const [copiedPage] = await extractedDocument.copyPages(sourceDocument, [pageIndex])
        extractedDocument.addPage(copiedPage)
        responseBuffer = Buffer.from(await extractedDocument.save())
        const baseName = resolvedFilename.replace(/\.pdf$/i, '')
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

  const revisionInfo = selectedRevision?.revisionInfo ?? { displayVersion: '' }
  return NextResponse.json({
    pdf: {
      fileName: resolvedFilename,
      revision: revisionInfo.displayVersion,
      totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
      url: `/api/projects/${encodeURIComponent(projectId)}/layout-pdf?raw=1`,
    },
    layoutIndex,
    pages: slimPages?.pages ?? [],
    totalSheets: layoutIndex?.pageCount ?? slimPages?.pages?.length ?? 0,
  })
}
