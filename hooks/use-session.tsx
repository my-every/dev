'use client'

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { getSessionService } from '@/lib/services/session-service-registry'
import type {
  CredentialVerificationResult,
  PinChangeResult,
  UserSession,
  UserIdentity,
  UserActivitySummary,
  SecureActionType,
  UserRole,
  RoleDashboardConfig,
  ROLE_DASHBOARD_CONFIGS,
} from '@/types/d380-user-session'
import { canSwitchRoles as checkCanSwitchRoles } from '@/types/d380-user-session'

// ============================================================================
// Types
// ============================================================================

interface SessionState {
  /** Current session */
  session: UserSession | null
  /** Loading state */
  isLoading: boolean
  /** Is authenticated */
  isAuthenticated: boolean
  /** Current user identity */
  user: UserIdentity | null
  /** Activity summary */
  activitySummary: UserActivitySummary | null
  /** Available actions for current user */
  availableActions: SecureActionType[]
  /** Dashboard config for current role */
  dashboardConfig: RoleDashboardConfig | null
}

interface SessionActions {
  /** Sign in */
  signIn: (badge: string, pin: string, workAreaId?: string) => Promise<{ success: boolean; error?: string; requiresPinChange?: boolean }>
  /** Sign out */
  signOut: () => Promise<void>
  /** Refresh session */
  refreshSession: () => Promise<void>
  /** Verify credentials without creating a session (for secure actions) */
  verifyCredentials: (badge: string, pin: string) => Promise<CredentialVerificationResult>
  /** Change a user's PIN */
  changePin: (badge: string, currentPin: string, nextPin: string) => Promise<PinChangeResult>
  /** Check if user can perform action */
  canPerform: (action: SecureActionType) => boolean
  /** Check if user has role */
  hasRole: (role: UserRole) => boolean
  /** Check if user has any of roles */
  hasAnyRole: (roles: UserRole[]) => boolean
  /** Check if user is leadership */
  isLeader: () => boolean
  /** Switch the effective role (DEVELOPER, MANAGER, SUPERVISOR only) */
  switchRole: (targetRole: UserRole) => Promise<void>
  /** Whether the current user can switch roles */
  canSwitchRoles: boolean
  /** The user's original role before any switch (null if no switch) */
  originalRole: UserRole | null
}

interface SessionContextValue extends SessionState, SessionActions {}

function normalizeBadgeInput(value: string): string {
  return value.trim().replace(/\D/g, '')
}

function normalizePinInput(value: string): string {
  return value.trim().replace(/\D/g, '').slice(0, 4)
}

// ============================================================================
// Context
// ============================================================================

const SessionContext = createContext<SessionContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { dataMode } = useAppRuntime()
  const [state, setState] = useState<SessionState>({
    session: null,
    isLoading: true,
    isAuthenticated: false,
    user: null,
    activitySummary: null,
    availableActions: [],
    dashboardConfig: null,
  })
  const [originalRole, setOriginalRole] = useState<UserRole | null>(null)

  const buildSessionState = useCallback(async (session: UserSession) => {
    const { ROLE_DASHBOARD_CONFIGS, SECURE_ACTION_PERMISSIONS } = await import('@/types/d380-user-session')
    const availableActions = Object.entries(SECURE_ACTION_PERMISSIONS)
      .filter(([_, roles]) => roles.includes(session.user.role))
      .map(([action]) => action as SecureActionType)

    return {
      session,
      isLoading: false,
      isAuthenticated: true,
      user: session.user,
      activitySummary: null,
      availableActions,
      dashboardConfig: ROLE_DASHBOARD_CONFIGS[session.user.role],
    } satisfies SessionState
  }, [])

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        // Check localStorage for persisted session
        const storedSessionId = localStorage.getItem('d380_session_id')
        if (storedSessionId) {
          // In real impl, would validate with service
          const storedSession = localStorage.getItem('d380_session')
          if (storedSession) {
            const stored = JSON.parse(storedSession) as UserSession
            const sessionService = await getSessionService(dataMode)
            const identityResult = await sessionService.getUserIdentity(stored.badge)
            const freshUser = identityResult.data

            if (!freshUser || !freshUser.isActive) {
              localStorage.removeItem('d380_session_id')
              localStorage.removeItem('d380_session')
              setState(prev => ({ ...prev, isLoading: false }))
              return
            }

            const session = {
              ...stored,
              user: freshUser,
              badge: freshUser.badge,
            }

            // Restore role switch if one was active
            const storedOriginalRole = localStorage.getItem('d380_original_role') as UserRole | null
            if (storedOriginalRole && checkCanSwitchRoles(storedOriginalRole)) {
              // Keep the switched role from the stored session
              session.user = { ...freshUser, role: stored.user.role }
              setOriginalRole(storedOriginalRole)
            }

            localStorage.setItem('d380_session', JSON.stringify(session))
            setState(await buildSessionState(session))
            return
          }
        }
      } catch (e) {
        console.error('Failed to load session:', e)
      }
      setState(prev => ({ ...prev, isLoading: false }))
    }

    loadSession()
  }, [buildSessionState, dataMode])

  const signIn = useCallback(async (badge: string, pin: string, workAreaId?: string) => {
    const normalizedBadge = normalizeBadgeInput(badge)
    const normalizedPin = normalizePinInput(pin)

    if (!normalizedBadge || normalizedPin.length !== 4) {
      return { success: false, error: 'Badge must be numeric and PIN must be 4 digits.' }
    }

    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const sessionService = await getSessionService(dataMode)
      const result = await sessionService.signIn({
        badge: normalizedBadge,
        pin: normalizedPin,
        workAreaId,
      })

      if ((result.data?.success && result.data.session) || (result.data?.session && result.data?.errorCode === 'ALREADY_SIGNED_IN')) {
        const session = result.data.session

        // Persist session
        localStorage.setItem('d380_session_id', session.id)
        localStorage.setItem('d380_session', JSON.stringify(session))

        setState(await buildSessionState(session))

        return { success: true, requiresPinChange: session.user.requiresPinChange ?? false }
      }

      setState(prev => ({ ...prev, isLoading: false }))
      return { success: false, error: result.data?.error || result.error || 'Sign in failed' }
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false }))
      return { success: false, error: 'Sign in failed' }
    }
  }, [buildSessionState, dataMode])

  const signOut = useCallback(async () => {
    if (state.session) {
      try {
        const sessionService = await getSessionService(dataMode)
        await sessionService.signOut(state.session.id)
      } catch (e) {
        console.error('Sign out error:', e)
      }
    }

    localStorage.removeItem('d380_session_id')
    localStorage.removeItem('d380_session')
    localStorage.removeItem('d380_original_role')

    setOriginalRole(null)
    setState({
      session: null,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      activitySummary: null,
      availableActions: [],
      dashboardConfig: null,
    })
  }, [dataMode, state.session])

  const refreshSession = useCallback(async () => {
    if (!state.session) return

    try {
      const sessionService = await getSessionService(dataMode)
      const result = await sessionService.refreshSession(state.session.id)
      if (result.data) {
        localStorage.setItem('d380_session', JSON.stringify(result.data))
        setState(await buildSessionState(result.data))
      }
    } catch (e) {
      console.error('Refresh session error:', e)
    }
  }, [buildSessionState, dataMode, state.session])

  const canPerform = useCallback((action: SecureActionType) => {
    return state.availableActions.includes(action)
  }, [state.availableActions])

  const hasRole = useCallback((role: UserRole) => {
    return state.user?.role === role
  }, [state.user])

  const hasAnyRole = useCallback((roles: UserRole[]) => {
    return state.user ? roles.includes(state.user.role) : false
  }, [state.user])

  const isLeader = useCallback(() => {
    const leaderRoles: UserRole[] = ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD']
    return state.user ? leaderRoles.includes(state.user.role) : false
  }, [state.user])

  const currentCanSwitchRoles = state.user ? checkCanSwitchRoles(originalRole ?? state.user.role) : false

  const switchRole = useCallback(async (targetRole: UserRole) => {
    if (!state.session || !state.user) return
    const baseRole = originalRole ?? state.user.role
    if (!checkCanSwitchRoles(baseRole)) return

    // Store original role on first switch
    if (!originalRole) {
      setOriginalRole(state.user.role)
      localStorage.setItem('d380_original_role', state.user.role)
    }
    // If switching back to original, clear it
    if (targetRole === baseRole) {
      setOriginalRole(null)
      localStorage.removeItem('d380_original_role')
    }

    const nextUser: UserIdentity = { ...state.user, role: targetRole }
    const nextSession: UserSession = { ...state.session, user: nextUser }
    localStorage.setItem('d380_session', JSON.stringify(nextSession))
    setState(await buildSessionState(nextSession))
  }, [state.session, state.user, originalRole, buildSessionState])

  const verifyCredentials = useCallback(async (badge: string, pin: string) => {
    try {
      const sessionService = await getSessionService(dataMode)
      const result = await sessionService.verifyCredentials(badge, pin)

      if (result.data) {
        return result.data
      }

      return { success: false, error: 'Invalid credentials', errorCode: 'VERIFICATION_FAILED' as const }
    } catch (e) {
      console.error('Verify credentials error:', e)
      return { success: false, error: 'Verification failed', errorCode: 'VERIFICATION_FAILED' as const }
    }
  }, [dataMode])

  const changePin = useCallback(async (badge: string, currentPin: string, nextPin: string) => {
    try {
      const sessionService = await getSessionService(dataMode)
      const result = await sessionService.changePin(badge, currentPin, nextPin)

      if (result.data) {
        if (state.session?.badge === badge && result.data.success && result.data.user) {
          const nextSession = {
            ...state.session,
            user: result.data.user,
          }
          localStorage.setItem('d380_session', JSON.stringify(nextSession))
          setState(await buildSessionState(nextSession))
        }

        return result.data
      }

      return { success: false, error: 'PIN change failed', errorCode: 'PIN_CHANGE_FAILED' as const }
    } catch (e) {
      console.error('Change PIN error:', e)
      return { success: false, error: 'PIN change failed', errorCode: 'PIN_CHANGE_FAILED' as const }
    }
  }, [buildSessionState, dataMode, state.session])

  const value: SessionContextValue = {
    ...state,
    signIn,
    signOut,
    refreshSession,
    verifyCredentials,
    changePin,
    canPerform,
    hasRole,
    hasAnyRole,
    isLeader,
    switchRole,
    canSwitchRoles: currentCanSwitchRoles,
    originalRole,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

// ============================================================================
// Utility Hooks
// ============================================================================

export function useCurrentUser() {
  const { user, isAuthenticated } = useSession()
  return { user, isAuthenticated }
}

export function useRoleAccess() {
  const { user, canPerform, hasRole, hasAnyRole, isLeader, dashboardConfig } = useSession()
  return { role: user?.role || null, canPerform, hasRole, hasAnyRole, isLeader, dashboardConfig }
}
