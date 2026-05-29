import { NextResponse } from 'next/server'

import { generateAllPrintSchemas } from '@/lib/project-exports/generate-print-schemas'
import { enrichManifestFromProjectState } from '@/lib/project-state/manifest-enrichment'
import { readProjectManifest, writeProjectManifest } from '@/lib/project-state/share-project-state-handlers'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const manifest = await readProjectManifest(projectId)

  if (!manifest) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Regenerate schema artifacts first so manifest file paths and metadata are fresh.
  await generateAllPrintSchemas(projectId)

  const enriched = await enrichManifestFromProjectState(manifest)
  await writeProjectManifest(enriched)

  return NextResponse.json({ manifest: enriched })
}
