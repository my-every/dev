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
import { generateAndSaveCrossWireSchema } from '@/lib/project-exports/cross-wire-schema'
import { readProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import { refreshProjectFromLegalRevision, rebuildLegalRevisionFiles } from '@/lib/legal-drawings/library'
import {
  completeRevisionRefreshJob,
  failRevisionRefreshJob,
  startRevisionRefreshJob,
  updateRevisionRefreshJob,
} from '@/lib/project-state/revision-refresh-job-store'
import { addActivityToShare } from '@/lib/activity/share-activity-store'
import type { LegalRevisionArtifactStatus, LegalRevisionRecord } from '@/types/legal-drawings'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.xlsb', '.pdf'])

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
): Promise<{ folderName: string; projectRoot: string; filesDir: string }> {
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
  const projectRoot = path.join(legalRoot, folderName)
  const filesDir = await resolveLegalProjectFilesDirectory(legalRoot, folderName)
  await fs.mkdir(filesDir, { recursive: true })

  return { folderName, projectRoot, filesDir }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function normalizeRevisionName(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase() || 'IMPORTED'
}

function resolveRevisionName(input: {
  manualRevisionName?: string | null
  workbookRevision?: FileRevision | null
  greenChangesRevision?: FileRevision | null
  layoutRevision?: FileRevision | null
  fallbackRevision?: string | null
}) {
  const manual = normalizeRevisionName(input.manualRevisionName)
  if (manual !== 'IMPORTED' || String(input.manualRevisionName ?? '').trim()) {
    return manual
  }

  const parsedRevision = [
    input.workbookRevision,
    input.greenChangesRevision,
    input.layoutRevision,
  ].find(
    (entry) =>
      entry?.revisionInfo?.revision
      && entry.revisionInfo.revision.toLowerCase() !== 'unknown',
  )?.revisionInfo.revision

  if (parsedRevision) {
    return normalizeRevisionName(parsedRevision)
  }

  return normalizeRevisionName(input.fallbackRevision)
}

function createEmptyArtifactStatus(): LegalRevisionArtifactStatus {
  return {
    workbookPresent: false,
    greenChangesWorkbookPresent: false,
    layoutPresent: false,
    uploadPropsBuilt: false,
    manifestBuilt: false,
    layoutPagesBuilt: false,
    devicePartNumbersBuilt: false,
    sheetSchemasBuilt: false,
    greenChangesSchemaBuilt: false,
    wireListPrintSchemaPrepared: false,
    brandListSchemaPrepared: false,
  }
}

async function copyIntoRevisionRoot(fileRevision: FileRevision, revisionRoot: string) {
  const destination = path.join(revisionRoot, fileRevision.filename)
  await fs.mkdir(revisionRoot, { recursive: true })
  await fs.copyFile(fileRevision.filePath, destination)
}

async function writeRevisionMetadata(input: {
  projectRoot: string
  pdNumber: string
  revisionName: string
  workbookRevision: FileRevision | null
  greenChangesRevision: FileRevision | null
  layoutRevision: FileRevision | null
}) {
  const latestPath = path.join(input.projectRoot, 'latest.json')
  const revisionRoot = path.join(input.projectRoot, input.revisionName)
  const revisionPath = path.join(revisionRoot, 'revision.json')

  const existingLatest = await readJsonFile<Record<string, unknown>>(latestPath)
  const existingRevision = await readJsonFile<LegalRevisionRecord>(revisionPath)
  const nextFiles = existingRevision?.files ?? createEmptyArtifactStatus()

  const nextRevisionRecord: LegalRevisionRecord = {
    pdNumber: input.pdNumber,
    revision: input.revisionName,
    projectNameHint: typeof existingLatest?.projectNameHint === 'string' ? existingLatest.projectNameHint : input.pdNumber,
    workbookFileName: input.workbookRevision?.filename ?? existingRevision?.workbookFileName ?? null,
    workbookRelativePath:
      input.workbookRevision?.filename
        ? `${input.revisionName}/${input.workbookRevision.filename}`
        : existingRevision?.workbookRelativePath ?? null,
    workbookUpdatedAt:
      input.workbookRevision
        ? new Date().toISOString()
        : existingRevision?.workbookUpdatedAt ?? null,
    greenChangesWorkbookFileName:
      input.greenChangesRevision?.filename
        ?? existingRevision?.greenChangesWorkbookFileName
        ?? null,
    greenChangesWorkbookRelativePath:
      input.greenChangesRevision?.filename
        ? `${input.revisionName}/${input.greenChangesRevision.filename}`
        : existingRevision?.greenChangesWorkbookRelativePath ?? null,
    greenChangesWorkbookUpdatedAt:
      input.greenChangesRevision
        ? new Date().toISOString()
        : existingRevision?.greenChangesWorkbookUpdatedAt ?? null,
    layoutFileName: input.layoutRevision?.filename ?? existingRevision?.layoutFileName ?? null,
    layoutRelativePath:
      input.layoutRevision?.filename
        ? `${input.revisionName}/${input.layoutRevision.filename}`
        : existingRevision?.layoutRelativePath ?? null,
    layoutUpdatedAt:
      input.layoutRevision
        ? new Date().toISOString()
        : existingRevision?.layoutUpdatedAt ?? null,
    sourceFingerprint: [
      input.workbookRevision?.filename ?? existingRevision?.workbookFileName ?? 'no-workbook',
      input.greenChangesRevision?.filename ?? existingRevision?.greenChangesWorkbookFileName ?? 'no-green-changes-workbook',
      input.layoutRevision?.filename ?? existingRevision?.layoutFileName ?? 'no-layout',
    ].join('|'),
    files: {
      ...nextFiles,
      workbookPresent: Boolean(input.workbookRevision?.filename || existingRevision?.workbookFileName),
      greenChangesWorkbookPresent: Boolean(input.greenChangesRevision?.filename || existingRevision?.greenChangesWorkbookFileName),
      layoutPresent: Boolean(input.layoutRevision?.filename || existingRevision?.layoutFileName),
    },
    generatedAt: existingRevision?.generatedAt ?? null,
  }

  await writeJsonFile(revisionPath, nextRevisionRecord)
  await writeJsonFile(latestPath, {
    ...(existingLatest ?? {}),
    pdNumber: input.pdNumber,
    latestRevision: input.revisionName,
    latestWorkbookFileName: nextRevisionRecord.workbookFileName ?? null,
    latestGreenChangesWorkbookFileName: nextRevisionRecord.greenChangesWorkbookFileName ?? null,
    latestLayoutFileName: nextRevisionRecord.layoutFileName ?? null,
    latestWorkbookUpdatedAt: nextRevisionRecord.workbookUpdatedAt ?? null,
    latestGreenChangesWorkbookUpdatedAt: nextRevisionRecord.greenChangesWorkbookUpdatedAt ?? null,
    latestLayoutUpdatedAt: nextRevisionRecord.layoutUpdatedAt ?? null,
    hasWorkbook: nextRevisionRecord.files.workbookPresent,
    hasGreenChangesWorkbook: nextRevisionRecord.files.greenChangesWorkbookPresent,
    hasLayout: nextRevisionRecord.files.layoutPresent,
    generatedAt: new Date().toISOString(),
  })
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
  const asyncMode = request.nextUrl.searchParams.get('async') === '1'

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const pdNumber = (formData.get('pdNumber') as string | null)?.trim() || null
  const revisionNameEntry = (formData.get('revisionName') as string | null)?.trim() || null

  // Determine upload mode:
  //   multi  — separate workbook / layout fields (project-upload-flow)
  //   single — one `file` field (revision panel sidebar drag-drop)
  const workbookEntry = formData.get('workbook') as File | null
  const greenChangesEntry = formData.get('greenChanges') as File | null
  const layoutEntry = formData.get('layout') as File | null
  const singleFileEntry = formData.get('file') as File | null

  if (!workbookEntry && !greenChangesEntry && !layoutEntry && !singleFileEntry) {
    return NextResponse.json(
      { error: 'No file provided. Include workbook, greenChanges, layout, or file field.' },
      { status: 400 },
    )
  }

  try {
    const manifest = await readProjectManifest(projectId)
    const effectivePdNumber = pdNumber ?? manifest?.pdNumber ?? null
    const { projectRoot, filesDir } = await resolveProjectLegalFolder(projectId, effectivePdNumber)

    let wireListRevision: FileRevision | null = null
    let greenChangesRevision: FileRevision | null = null
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
      if (greenChangesEntry) {
        greenChangesRevision = await saveRevisionFile(greenChangesEntry, filesDir, 'OTHER')
      }
      if (layoutEntry) {
        layoutRevision = await saveRevisionFile(layoutEntry, filesDir, 'LAYOUT')
      }
    }

    const resolvedRevision = resolveRevisionName({
      manualRevisionName: revisionNameEntry,
      workbookRevision: wireListRevision,
      greenChangesRevision,
      layoutRevision,
      fallbackRevision: manifest?.revision,
    })

    const revisionRoot = path.join(projectRoot, resolvedRevision)
    if (wireListRevision) {
      await copyIntoRevisionRoot(wireListRevision, revisionRoot)
    }
    if (greenChangesRevision) {
      await copyIntoRevisionRoot(greenChangesRevision, revisionRoot)
    }
    if (layoutRevision) {
      await copyIntoRevisionRoot(layoutRevision, revisionRoot)
    }
    if (effectivePdNumber) {
      await writeRevisionMetadata({
        projectRoot,
        pdNumber: effectivePdNumber,
        revisionName: resolvedRevision,
        workbookRevision: wireListRevision,
        greenChangesRevision,
        layoutRevision,
      })
    }

    const actorBadge = request.headers.get('x-badge-number')?.trim() || null
    const actorShift = request.headers.get('x-shift')?.trim() || '1st'

    const refreshJob = await startRevisionRefreshJob({
      projectId,
      pdNumber: effectivePdNumber,
      actorBadge,
      actorShift,
      message: 'Uploaded legal files. Revision refresh queued.',
    })

    if (actorBadge) {
      await addActivityToShare(actorBadge, actorShift, {
        action: 'SETTINGS_CHANGED',
        performedBy: actorBadge,
        projectId,
        result: 'pending',
        comment: 'Legal revision refresh started in background.',
        metadata: {
          workflow: 'legal-revision-refresh',
          pdNumber: effectivePdNumber,
          revision: resolvedRevision,
          jobId: refreshJob.jobId,
        },
      })
    }

    const runRefreshPipeline = async () => {
      try {
        if (effectivePdNumber) {
          await updateRevisionRefreshJob(projectId, {
            message: 'Rebuilding legal revision artifacts...',
          })
          await rebuildLegalRevisionFiles(effectivePdNumber, resolvedRevision)
          await updateRevisionRefreshJob(projectId, {
            progress: { legalRevisionBuilt: true },
            message: 'Syncing Share Projects state from legal revision...',
          })
          await refreshProjectFromLegalRevision({
            projectId,
            pdNumber: effectivePdNumber,
            revision: resolvedRevision,
          })
          await updateRevisionRefreshJob(projectId, {
            progress: { projectStateRefreshed: true },
            message: 'Regenerating wire and brand list schemas...',
          })
        }

        await generateAllPrintSchemas(projectId)
        await updateRevisionRefreshJob(projectId, {
          progress: { wireBrandSchemasGenerated: true },
          message: 'Regenerating cross-wire schema...',
        })

        await generateAndSaveCrossWireSchema(projectId)
        await completeRevisionRefreshJob(
          projectId,
          'Revision refresh completed. Wire, brand, and cross-wire outputs are updated.',
        )

        if (actorBadge) {
          await addActivityToShare(actorBadge, actorShift, {
            action: 'SETTINGS_CHANGED',
            performedBy: actorBadge,
            projectId,
            result: 'success',
            comment: 'Legal revision refresh completed.',
            metadata: {
              workflow: 'legal-revision-refresh',
              pdNumber: effectivePdNumber,
              revision: resolvedRevision,
              jobId: refreshJob.jobId,
            },
          })
        }
      } catch (pipelineError) {
        const message =
          pipelineError instanceof Error ? pipelineError.message : 'Revision refresh failed.'
        await failRevisionRefreshJob(projectId, message)
        if (actorBadge) {
          await addActivityToShare(actorBadge, actorShift, {
            action: 'SETTINGS_CHANGED',
            performedBy: actorBadge,
            projectId,
            result: 'failure',
            error: message,
            comment: 'Legal revision refresh failed.',
            metadata: {
              workflow: 'legal-revision-refresh',
              pdNumber: effectivePdNumber,
              revision: resolvedRevision,
              jobId: refreshJob.jobId,
            },
          })
        }
      }
    }

    if (asyncMode) {
      void runRefreshPipeline()
    } else {
      await runRefreshPipeline()
    }

    // Return appropriate shape based on upload mode.
    if (singleFileEntry) {
      const revision = layoutRevision ?? wireListRevision
      return NextResponse.json(
        { revision, refreshJob, revisionName: resolvedRevision },
        { status: asyncMode ? 202 : 200 },
      )
    }

    return NextResponse.json(
      { wireListRevision, greenChangesRevision, layoutRevision, refreshJob, revisionName: resolvedRevision },
      { status: asyncMode ? 202 : 200 },
    )
  } catch (error) {
    console.error('[revisions/files] Upload failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
