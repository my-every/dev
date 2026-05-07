import { NextRequest, NextResponse } from 'next/server'

import { getProjectRevisionHistory } from '@/lib/revision/revision-discovery'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/revisions/[projectId]?pdNumber=...
 *
 * Returns the full revision history (wire list + layout revisions, current,
 * previous) for a single project. Used by useProjectRevisions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const pdNumber = request.nextUrl.searchParams.get('pdNumber')

  try {
    const history = await getProjectRevisionHistory(projectId, pdNumber)

    if (!history) {
      // Return an empty history rather than a 404 — some projects may not have
      // a Legal Drawings folder yet (fresh uploads are handled elsewhere).
      return NextResponse.json({
        projectId,
        folderName: '',
        pdNumber: pdNumber ?? '',
        wireListRevisions: [],
        layoutRevisions: [],
        currentWireList: null,
        currentLayout: null,
        previousWireList: null,
        previousLayout: null,
        sourceRoots: {
          legal: null,
          brand: null,
        },
        treeRow: null,
      })
    }

    return NextResponse.json(history)
  } catch (error) {
    console.error('[revisions/[projectId]] Failed to get revision history:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve revision history' },
      { status: 500 },
    )
  }
}
