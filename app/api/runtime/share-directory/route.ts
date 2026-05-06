import { NextRequest, NextResponse } from 'next/server'

import {
  getShareDirectorySettings,
  hasUsersDirectory,
  setShareDirectorySettings,
} from '@/lib/runtime/share-directory'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await getShareDirectorySettings()
    const hasUsers = await hasUsersDirectory()
    return NextResponse.json({
      ...settings,
      hasUsersDirectory: hasUsers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read Share directory settings' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      shareDirectory?: string | null
    }

    const resolved = await setShareDirectorySettings(body.shareDirectory ?? null)
    const hasUsers = await hasUsersDirectory()

    return NextResponse.json({
      shareDirectory: resolved,
      source: 'config',
      hasUsersDirectory: hasUsers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Share directory settings' },
      { status: 500 },
    )
  }
}
