import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import { extractProjectNumberFromLegalFolder } from '@/lib/legal-drawings/discovery'
import { getProjectRevisionHistory } from '@/lib/revision/revision-discovery'

export const dynamic = 'force-dynamic'

async function getLegalDrawingsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

/**
 * DELETE /api/projects/revisions/[projectId]/files/[filename]?pdNumber=...
 *
 * Permanently deletes a single revision file from the Legal Drawings folder.
 * The caller is responsible for confirming the action in the UI before
 * invoking this endpoint.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; filename: string }> },
) {
  const { projectId, filename } = await params
  const pdNumber = request.nextUrl.searchParams.get('pdNumber')

  // Reject any path traversal attempts in the filename.
  const safeName = path.basename(decodeURIComponent(filename))
  if (!safeName || safeName !== decodeURIComponent(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  try {
    const history = await getProjectRevisionHistory(projectId, pdNumber)

    if (!history?.folderName) {
      return NextResponse.json(
        { error: 'Project revision folder not found' },
        { status: 404 },
      )
    }

    const legalRoot = await getLegalDrawingsRoot()

    // Resolve the files directory (may be /Electrical sub-folder).
    const { resolveLegalProjectFilesDirectory } = await import('@/lib/legal-drawings/discovery')
    const filesDir = await resolveLegalProjectFilesDirectory(legalRoot, history.folderName)
    const targetPath = path.join(filesDir, safeName)

    // Security: ensure the resolved path stays within Legal Drawings.
    const resolvedTarget = path.normalize(targetPath)
    if (!resolvedTarget.startsWith(legalRoot)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    try {
      await fs.access(resolvedTarget)
    } catch {
      return NextResponse.json(
        { error: `File not found: ${safeName}` },
        { status: 404 },
      )
    }

    await fs.unlink(resolvedTarget)

    console.info('[revisions/files/[filename]] Deleted revision file', {
      projectId,
      filename: safeName,
      path: resolvedTarget,
    })

    return NextResponse.json({ deleted: true, filename: safeName })
  } catch (error) {
    console.error('[revisions/files/[filename]] Delete failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
