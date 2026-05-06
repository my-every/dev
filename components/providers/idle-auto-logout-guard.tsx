'use client'

import { useIdleAutoLogout } from '@/hooks/use-idle-auto-logout'

/**
 * Invisible component that activates idle auto-logout.
 * Place inside the SessionProvider tree in the root layout.
 */
export function IdleAutoLogoutGuard() {
  useIdleAutoLogout()
  return null
}
