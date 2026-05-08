'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { FirstLaunchProfileSetup } from '@/components/providers/first-launch-profile-setup'
import { useSession } from '@/hooks/use-session'
import { useAppRuntime } from '@/components/providers/app-runtime-provider'

// ============================================================================
// First-launch profile setup page
//
// Reached immediately after first-time badge+PIN login (when requiresPinChange
// was true and the user just set their PIN). Renders the profile setup wizard
// then routes to the user's workspace.
// ============================================================================

interface SetupProfilePageProps {
  params: Promise<{ badgeNumber: string }>
}

export default function SetupProfilePage({ params }: SetupProfilePageProps) {
  const { badgeNumber } = use(params)
  const { user, isLoading, isAuthenticated } = useSession()
  const { appMode } = useAppRuntime()
  const router = useRouter()

  // Guard: if the user somehow reaches this page without being authenticated,
  // send them back to the launcher.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/380')
    }
  }, [isLoading, isAuthenticated, router])

  // Guard: if the badge in the URL doesn't match the logged-in user's badge,
  // redirect to the correct setup page to prevent cross-user data leaks.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.badge && user.badge !== badgeNumber) {
      router.replace(`/${user.badge}/setup-profile`)
    }
  }, [isLoading, isAuthenticated, user, badgeNumber, router])

  if (isLoading || !user) {
    return null
  }

  const displayName = user.preferredName || user.legalName || `Badge ${badgeNumber}`

  return (
    <FirstLaunchProfileSetup
      badge={badgeNumber}
      displayName={displayName}
      appMode={appMode}
    />
  )
}
