import { NextResponse } from 'next/server'

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

  const enriched = await enrichManifestFromProjectState(manifest)
  await writeProjectManifest(enriched)

  return NextResponse.json({ manifest: enriched })
}
