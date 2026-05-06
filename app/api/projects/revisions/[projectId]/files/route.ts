import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import {
  extractProjectNumberFromLegalFolder,
  resolveLegalProjectFilesDirectory,
} from '@/lib/legal-drawings/discovery'
import {
  parseRevisionFromFilename,
  isWireListFile,
  isLayoutFile,
  type FileRevision,
} from '@/lib/revision/types'
import { generateAllPrintSchemas } from '@/lib/project-exports/generate-print-schemas'
import { readProjectManifest } from '@/lib/project-state/share-project-state-handlers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.pdf'])

async function getLegalDrawingsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

/**
 * Resolve the Legal Drawings project folder for a given project, falling back
 * to creating a new folder when none exists yet.
 */
async function resolveProjectLegalFolder(
  projectId: string,
  pdNumber: string | null,
): Promise<{ folderName: string; filesDir: string }> {
  const legalRoot = await getLegalDrawingsRoot()

  // Try to find an existing folder that matches pdNumber or projectId.
  const searchTerm = (pdNumber ?? projectId).replace(/^pd-/i, '').toLowerCase()
  let folderName: string | null = null

  try {
    const entries = await fs.readdir(legalRoot, { withFileTypes: true })
    const match = entries
      .filter((e) => e.isDirectory())
      .find((e) => {
        const folderPd = extractProjectNumberFromLegalFolder(e.name).toLowerCase()
        return folderPd === searchTerm || e.name.toLowerCase().includes(searchTerm)
      })

    if (match) {
      folderName = match.name
    }
  } catch {
    // Legal Drawings root doesn't exist yet — we'll create it below.
  }

  // Create a new folder when no match was found.
  if (!folderName) {
    folderName = (pdNumber?.toUpperCase() ?? projectId).trim()
  }

  await fs.mkdir(legalRoot, { recursive: true })
  const filesDir = await resolveLegalProjectFilesDirectory(legalRoot, folderName)
  await fs.mkdir(filesDir, { recursive: true })

  return { folderName, filesDir }
}

/**
 * Persist a single uploaded file to the Legal Drawings folder and return a
 * FileRevision descriptor. The file is stored with its original filename.
 */
async function saveRevisionFile(
  file: File,
  filesDir: string,
  category: FileRevision['category'],
): Promise<FileRevision> {
  const filename = file.name
  const ext = path.extname(filename).toLowerCase()

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not permitted: ${ext}`)
  }

  // Sanitise filename — strip path traversal characters.
  const safeName = path.basename(filename).replace(/[/\\]/g, '')
  const destPath = path.join(filesDir, safeName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(destPath, buffer)

  const stats = await fs.stat(destPath)

  const revision: FileRevision = {
    filename: safeName,
    filePath: destPath,
    revisionInfo: parseRevisionFromFilename(safeName),
    category,
    lastModified: stats.mtime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    fileSize: stats.size,
  }

  return revision
}

// ---------------------------------------------------------------------------
// POST /api/projects/revisions/[projectId]/files
//
// Accepts multipart/form-data with:
//   workbook  — xlsx file (optional when layout-only upload)
//   layout    — pdf file  (optional when workbook-only upload)
//   file      — single pdf file (legacy single-file upload from revision panel)
//   baseRevision — revision string, e.g. "B.2"
//   pdNumber     — drawing number, e.g. "4K001"
//
// After saving the files the handler regenerates all wire-list and brand-list
// print schemas so the wire list and branding list reflect the new revision.
//
// Returns:
//   { wireListRevision, layoutRevision }  when workbook/layout fields are used
//   { revision }                          when single `file` field is used
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const pdNumber = (formData.get('pdNumber') as string | null)?.trim() || null

  // Determine upload mode:
  //   multi  — separate workbook / layout fields (project-upload-flow)
  //   single — one `file` field (revision panel sidebar drag-drop)
  const workbookEntry = formData.get('workbook') as File | null
  const layoutEntry = formData.get('layout') as File | null
  const singleFileEntry = formData.get('file') as File | null

  if (!workbookEntry && !layoutEntry && !singleFileEntry) {
    return NextResponse.json(
      { error: 'No file provided. Include workbook, layout, or file field.' },
      { status: 400 },
    )
  }

  try {
    const { filesDir } = await resolveProjectLegalFolder(projectId, pdNumber)

    let wireListRevision: FileRevision | null = null
    let layoutRevision: FileRevision | null = null

    if (singleFileEntry) {
      // Single-file mode — treat as layout (PDFs only).
      const category = isLayoutFile(singleFileEntry.name)
        ? 'LAYOUT'
        : isWireListFile(singleFileEntry.name)
          ? 'WIRE_LIST'
          : 'OTHER'
      const saved = await saveRevisionFile(singleFileEntry, filesDir, category)
      if (category === 'WIRE_LIST') {
        wireListRevision = saved
      } else {
        layoutRevision = saved
      }
    } else {
      if (workbookEntry) {
        wireListRevision = await saveRevisionFile(workbookEntry, filesDir, 'WIRE_LIST')
      }
      if (layoutEntry) {
        layoutRevision = await saveRevisionFile(layoutEntry, filesDir, 'LAYOUT')
      }
    }

    // Regenerate wire-list print schemas and brand-list schemas for all sheets
    // so the UI reflects the new revision data without a manual refresh.
    const manifest = await readProjectManifest(projectId)
    if (manifest) {
      try {
        await generateAllPrintSchemas(projectId)
        console.info('[revisions/files] Regenerated all print schemas', {
          projectId,
          wireListRevision: wireListRevision?.filename ?? null,
          layoutRevision: layoutRevision?.filename ?? null,
        })
      } catch (schemaError) {
        // Non-blocking — log but don't fail the upload.
        console.warn('[revisions/files] Schema regeneration failed (non-blocking):', schemaError)
      }
    }

    // Return appropriate shape based on upload mode.
    if (singleFileEntry) {
      const revision = layoutRevision ?? wireListRevision
      return NextResponse.json({ revision })
    }

    return NextResponse.json({ wireListRevision, layoutRevision })
  } catch (error) {
    console.error('[revisions/files] Upload failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
