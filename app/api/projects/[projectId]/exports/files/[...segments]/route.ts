import { promises as fs } from 'node:fs'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

import { resolveProjectExportFile } from '@/lib/project-exports/project-exports-paths'

export const dynamic = 'force-dynamic'

function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.pdf':
      return 'application/pdf'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.json':
      return 'application/json; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; segments: string[] }> },
) {
  const { projectId, segments } = await params
  const filePath = await resolveProjectExportFile(projectId, segments)

  if (!filePath) {
    return NextResponse.json({ error: 'Export file not found' }, { status: 404 })
  }

  try {
    const data = await fs.readFile(filePath)
    const download = request.nextUrl.searchParams.get('download') === '1'

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': getContentType(filePath),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export file not found' }, { status: 404 })
  }
}
