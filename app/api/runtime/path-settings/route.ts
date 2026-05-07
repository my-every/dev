import { NextRequest, NextResponse } from 'next/server'

import { getPathSettings, setPathSettings } from '@/lib/runtime/share-directory'
import { getShareDirectorySettings } from '@/lib/runtime/share-directory'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [paths, shareDirSettings] = await Promise.all([
      getPathSettings(),
      getShareDirectorySettings(),
    ])
    return NextResponse.json({
      legalDrawingsPath: paths.legalDrawingsPath,
      brandListPath: paths.brandListPath,
      shareDirectory: shareDirSettings.shareDirectory,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read path settings' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      legalDrawingsPath?: string | null
      brandListPath?: string | null
    }

    const updated = await setPathSettings({
      ...(Object.prototype.hasOwnProperty.call(body, 'legalDrawingsPath') && { legalDrawingsPath: body.legalDrawingsPath }),
      ...(Object.prototype.hasOwnProperty.call(body, 'brandListPath') && { brandListPath: body.brandListPath }),
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update path settings' },
      { status: 500 },
    )
  }
}
