import { NextRequest, NextResponse } from 'next/server'

import {
  getAppModeSettings,
  setAppModeSettings,
} from '@/lib/runtime/share-directory'
import type { AppLaunchMode } from '@/lib/runtime/app-mode-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await getAppModeSettings()
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read app mode settings' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      appMode?: AppLaunchMode
    }

    if (!body.appMode) {
      return NextResponse.json({ error: 'appMode is required' }, { status: 400 })
    }

    const settings = await setAppModeSettings(body.appMode)
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update app mode settings' },
      { status: 500 },
    )
  }
}
