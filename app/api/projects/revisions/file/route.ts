import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

import { resolveRevisionSourceRoots } from '@/lib/revision/filesystem-scan'

export const dynamic = 'force-dynamic'

function resolveContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase()
  if (extension === '.pdf') return 'application/pdf'
  if (['.xlsx', '.xls', '.xlsm', '.xlsb'].includes(extension)) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (extension === '.json') return 'application/json'
  return 'application/octet-stream'
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const normalizedTarget = path.normalize(targetPath)
  const normalizedRoot = path.normalize(rootPath)
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
}

export async function GET(request: NextRequest) {
  try {
    const targetPath = request.nextUrl.searchParams.get('path')
    if (!targetPath) {
      return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 })
    }

    const normalizedTarget = path.normalize(targetPath)
    const roots = await resolveRevisionSourceRoots({})
    const candidateRoots = [roots.legalSourceRoot, roots.brandSourceRoot].filter(
      (value): value is string => Boolean(value),
    )

    if (!candidateRoots.some((rootPath) => isPathWithinRoot(normalizedTarget, rootPath))) {
      return NextResponse.json({ error: 'Requested path is outside allowed revision sources' }, { status: 403 })
    }

    const fileBuffer = await fs.readFile(normalizedTarget)
    const fileName = path.basename(normalizedTarget)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': resolveContentType(fileName),
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('[revisions/file] Failed to stream source file:', error)
    return NextResponse.json({ error: 'Failed to stream source file' }, { status: 500 })
  }
}
