'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { getPostLaunchRouteForMode } from '@/lib/runtime/app-mode-routing'

function resolveModeRedirect(pathname: string, mode: 'DEPARTMENT' | 'WORKSPACE' | 'STANDALONE_TOOL'): string | null {
  if (pathname.startsWith('/api')) {
    return null
  }

  return null
}

export function AppModeRouteGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { appMode, hasCompletedFirstLaunch, isAppModeLoading } = useAppRuntime()

  useEffect(() => {
    if (isAppModeLoading || !hasCompletedFirstLaunch) {
      return
    }

    const revisitRequested =
      pathname.startsWith('/startup')
      && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('revisit') === '1'

    if (revisitRequested) {
      return
    }

    const target = resolveModeRedirect(pathname, appMode)
    if (target && pathname !== target) {
      router.replace(target)
    }
  }, [appMode, hasCompletedFirstLaunch, isAppModeLoading, pathname, router])

  return null
}
