import { NextRequest, NextResponse } from 'next/server'

import {
  deleteStoredProject,
  readProjectManifest,
  writeFullProject,
  writeProjectManifest,
} from '@/lib/project-state/share-project-state-handlers'
import { enrichManifestFromProjectState } from '@/lib/project-state/manifest-enrichment'
import {
  buildAllSheetSchemas,
  buildDefaultMappedAssignments,
  buildProjectManifest,
} from '@/lib/project-state/schema-generators'
import { generateAllPrintSchemas } from '@/lib/project-exports/generate-print-schemas'
import type { ProjectModel } from '@/lib/workbook/types'
import type { ProjectManifest } from '@/types/project-manifest'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const manifest = await readProjectManifest(projectId)

  if (!manifest) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ manifest })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const requestStartedAt = Date.now()
  const { projectId } = await params
  const body = await request.json() as ProjectManifest | { projectModel?: ProjectModel }

  const logPhase = (phase: string) => {
    console.info('[project-context:put]', {
      projectId,
      phase,
      elapsedMs: Date.now() - requestStartedAt,
    })
  }

  if ('projectModel' in body && body.projectModel) {
    const projectModel = body.projectModel
    if (projectModel.id !== projectId) {
      return NextResponse.json({ error: 'Project id mismatch' }, { status: 400 })
    }

    logPhase('build-default-assignments:start')
    const defaultAssignments = buildDefaultMappedAssignments(projectModel)
    logPhase('build-default-assignments:complete')
    logPhase('build-manifest:start')
    const manifest = buildProjectManifest(projectModel, defaultAssignments)
    logPhase('build-manifest:complete')
    logPhase('build-sheet-schemas:start')
    const sheetSchemas = buildAllSheetSchemas(projectModel, defaultAssignments)
    logPhase('build-sheet-schemas:complete')
    logPhase('write-full-project:start')
    await writeFullProject(manifest, sheetSchemas, projectModel)
    logPhase('write-full-project:complete')
    logPhase('enrich-manifest-for-generation:start')
    const referenceEnrichedManifest = await enrichManifestFromProjectState(manifest)
    await writeProjectManifest(referenceEnrichedManifest)
    logPhase('enrich-manifest-for-generation:complete')
    logPhase('generate-print-schemas:start')
    await generateAllPrintSchemas(projectId)
    logPhase('generate-print-schemas:complete')
    logPhase('finalize-manifest:start')
    const finalizedManifest = await enrichManifestFromProjectState(referenceEnrichedManifest)
    await writeProjectManifest(finalizedManifest)
    logPhase('finalize-manifest:complete')
    return NextResponse.json({ manifest: finalizedManifest })
  }

  const manifest = body as ProjectManifest
  if (manifest.id !== projectId) {
    return NextResponse.json({ error: 'Project id mismatch' }, { status: 400 })
  }

  logPhase('enrich-manifest:start')
  const enrichedManifest = await enrichManifestFromProjectState(manifest)
  logPhase('enrich-manifest:complete')
  logPhase('write-manifest:start')
  await writeProjectManifest(enrichedManifest)
  logPhase('write-manifest:complete')
  return NextResponse.json({ manifest: enrichedManifest })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  await deleteStoredProject(projectId)
  return NextResponse.json({ success: true })
}
