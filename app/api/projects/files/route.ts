import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveLegalProjectFilesDirectory } from '@/lib/legal-drawings/discovery'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.pdf', '.csv']

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectFolder = searchParams.get('project')
  const filename = searchParams.get('file')

  if (!projectFolder || !filename) {
    return NextResponse.json(
      { error: 'Missing project or file parameter' },
      { status: 400 }
    )
  }

  if (projectFolder.includes('..') || filename.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    )
  }

  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: 'File type not allowed' },
      { status: 400 }
    )
  }

  const shareRoot = await resolveShareDirectory()
  const legalDrawingsRoot = path.join(shareRoot, 'Legal Drawings')

  const projectFilesDirectory = await resolveLegalProjectFilesDirectory(legalDrawingsRoot, projectFolder)
  const filePath = path.join(projectFilesDirectory, filename)

  try {
    const realPath = await fs.realpath(filePath)
    if (!realPath.startsWith(legalDrawingsRoot)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      )
    }

    const fileBuffer = await fs.readFile(filePath)
    const stats = await fs.stat(filePath)

    let contentType = 'application/octet-stream'
    if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } else if (ext === '.xls') {
      contentType = 'application/vnd.ms-excel'
    } else if (ext === '.pdf') {
      contentType = 'application/pdf'
    } else if (ext === '.csv') {
      contentType = 'text/csv'
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('[API] Failed to read file:', error)
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
