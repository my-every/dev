import { redirect } from 'next/navigation'

import { getPostLaunchRouteForMode } from '@/lib/runtime/app-mode-routing'
import { getAppModeSettings } from '@/lib/runtime/share-directory'

export const dynamic = 'force-dynamic'

function getDefaultRoute(settings: {
  appMode: 'DEPARTMENT' | 'WORKSPACE' | 'STANDALONE_TOOL'
  firstLaunchCompleted: boolean
}): string {
  if (!settings.firstLaunchCompleted) {
    return '/startup'
  }

  return getPostLaunchRouteForMode(settings.appMode)
}

/**
 * Root page redirects based on selected launch mode.
 */
export default async function HomePage() {
  const settings = await getAppModeSettings()
  redirect(getDefaultRoute(settings))
}
