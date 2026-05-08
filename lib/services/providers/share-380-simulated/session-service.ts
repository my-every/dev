import type {
  ISessionService,
  SessionValidation,
  SignInRequest,
  SignInResult,
} from '@/lib/services/contracts/session-service'
import type { ServiceResult } from '@/lib/services/contracts'
import {
  SECURE_ACTION_PERMISSIONS,
  type CredentialVerificationResult,
  type PinChangeResult,
  type SecureActionRequest,
  type SecureActionResult,
  type SecureActionType,
  type TimestampEvent,
  type UserActivitySummary,
  type UserIdentity,
  type UserRole,
  type UserSession,
} from '@/types/d380-user-session'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function fail<T>(error: string, data: T | null = null): ServiceResult<T> {
  return {
    data,
    error,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function defaultIdentity(): UserIdentity {
  const now = new Date().toISOString()
  return {
    badge: '1001',
    pinHash: '1234',
    legalName: 'Demo User',
    preferredName: 'Demo',
    initials: 'DU',
    role: 'DEVELOPER',
    title: 'Developer',
    avatarPath: null,
    primaryLwc: 'ONSKID',
    currentShift: '1st',
    email: null,
    phone: null,
    isActive: true,
    requiresPinChange: false,
    createdAt: now,
    updatedAt: now,
  }
}

export class SimulatedSessionService implements ISessionService {
  private identities = new Map<string, UserIdentity>([['1001', defaultIdentity()]])
  private sessions = new Map<string, UserSession>()
  private timestamps: TimestampEvent[] = []
  private currentSessionId: string | null = null

  private getIdentity(badge: string): UserIdentity | null {
    return this.identities.get(badge) ?? null
  }

  private createSession(user: UserIdentity, request: SignInRequest): UserSession {
    const now = new Date()
    const session: UserSession = {
      id: `sess-${Date.now()}`,
      badge: user.badge,
      user,
      status: 'active',
      executionMode: request.executionMode ?? 'TABLET_INTERACTIVE',
      currentLwc: user.primaryLwc,
      currentWorkAreaId: request.workAreaId ?? null,
      startedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      deviceInfo: {
        type: 'desktop',
        userAgent: 'simulated',
        screenSize: { width: 1920, height: 1080 },
        touchCapable: false,
      },
    }

    this.sessions.set(session.id, session)
    this.currentSessionId = session.id
    return session
  }

  private async buildValidation(sessionId: string): Promise<ServiceResult<SessionValidation>> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return ok({ valid: false, session: null, reason: 'not_found' })
    }

    const nowMs = Date.now()
    const expiryMs = new Date(session.expiresAt).getTime()
    if (Number.isFinite(expiryMs) && expiryMs <= nowMs) {
      const expired = { ...session, status: 'expired' as const }
      this.sessions.set(session.id, expired)
      if (this.currentSessionId === session.id) this.currentSessionId = null
      return ok({ valid: false, session: expired, reason: 'expired' })
    }

    return ok({ valid: true, session })
  }

  async getUserIdentity(badge: string): Promise<ServiceResult<UserIdentity | null>> {
    // Check local cache first
    const local = this.getIdentity(badge)
    if (local) return ok(local)

    // Fall through to server API for real users from users.csv
    try {
      const res = await fetch(`/api/session/users?badge=${encodeURIComponent(badge)}`, { cache: 'no-store' })
      if (!res.ok) return ok(null)
      const data = await res.json() as { user?: UserIdentity | null }
      if (data.user) {
        this.identities.set(badge, data.user)
        return ok(data.user)
      }
      return ok(null)
    } catch {
      return ok(null)
    }
  }

  async getUserActivitySummary(_badge: string): Promise<ServiceResult<UserActivitySummary>> {
    return ok({
      totalAssignmentsCompleted: 0,
      totalWiresCompleted: 0,
      averageQualityScore: 0,
      hoursThisWeek: 0,
      currentStreak: 0,
      activeAssignments: 0,
      lastActiveAt: null,
    })
  }

  async validateBadge(badge: string): Promise<ServiceResult<boolean>> {
    if (this.identities.has(badge)) return ok(true)
    const identity = await this.getUserIdentity(badge)
    return ok(identity.data !== null)
  }

  async validateCredentials(badge: string, pin: string): Promise<ServiceResult<boolean>> {
    const result = await this.verifyCredentials(badge, pin)
    return ok(result.data?.success === true)
  }

  async verifyCredentials(badge: string, pin: string): Promise<ServiceResult<CredentialVerificationResult>> {
    // Delegate to server API which reads from users.csv with proper HMAC PIN verification
    try {
      const res = await fetch('/api/session/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge, pin }),
      })

      const data = await res.json() as {
        valid?: boolean
        user?: UserIdentity | null
        error?: string
      }

      if (data.valid && data.user) {
        // Cache the identity locally for session creation
        this.identities.set(badge, { ...data.user, pinHash: '' })
        return ok({
          success: true,
          user: { ...data.user, pinHash: '' },
          requiresPinChange: data.user.requiresPinChange,
        })
      }

      // Determine specific error code
      const userLookup = await this.getUserIdentity(badge)
      if (!userLookup.data) {
        return ok({ success: false, error: 'Badge not found', errorCode: 'INVALID_BADGE' })
      }
      if (!userLookup.data.isActive) {
        return ok({ success: false, error: 'Account inactive', errorCode: 'ACCOUNT_INACTIVE' })
      }
      return ok({ success: false, error: 'Invalid PIN', errorCode: 'INVALID_PIN' })
    } catch {
      return ok({ success: false, error: 'Verification failed', errorCode: 'VERIFICATION_FAILED' as const })
    }
  }

  async changePin(badge: string, currentPin: string, nextPin: string): Promise<ServiceResult<PinChangeResult>> {
    if (!/^\d{4}$/.test(nextPin)) {
      return ok({ success: false, error: 'PIN must be 4 digits', errorCode: 'PIN_CHANGE_FAILED' })
    }

    // Delegate to server API which handles HMAC hashing and CSV persistence
    try {
      const res = await fetch('/api/session/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge, currentPin, nextPin }),
      })

      const data = await res.json() as {
        success?: boolean
        user?: UserIdentity
        error?: string
        errorCode?: string
      }

      if (data.success && data.user) {
        this.identities.set(badge, { ...data.user, pinHash: '' })
        return ok({ success: true, user: { ...data.user, pinHash: '' } })
      }

      return ok({
        success: false,
        error: data.error || 'PIN change failed',
        errorCode: (data.errorCode as PinChangeResult['errorCode']) || 'PIN_CHANGE_FAILED',
      })
    } catch {
      return ok({ success: false, error: 'PIN change failed', errorCode: 'PIN_CHANGE_FAILED' })
    }
  }

  async updateUserIdentity(badge: string, updates: Partial<UserIdentity>): Promise<ServiceResult<UserIdentity>> {
    const identity = this.getIdentity(badge)
    if (!identity) return fail('User not found')

    const updated: UserIdentity = {
      ...identity,
      ...updates,
      badge: identity.badge,
      updatedAt: new Date().toISOString(),
    }
    this.identities.set(badge, updated)
    return ok(updated)
  }

  async updateUserAvatar(badge: string, _imageData: Blob): Promise<ServiceResult<string>> {
    const identity = this.getIdentity(badge)
    if (!identity) return fail('User not found')

    const avatarPath = `380/Users/${badge}/avatar.png`
    const updated: UserIdentity = {
      ...identity,
      avatarPath,
      updatedAt: new Date().toISOString(),
    }
    this.identities.set(badge, updated)
    return ok(avatarPath)
  }

  async signIn(request: SignInRequest): Promise<ServiceResult<SignInResult>> {
    const normalizedBadge = request.badge.trim().replace(/\D/g, '')
    const normalizedPin = request.pin.trim().replace(/\D/g, '')

    // First-time bootstrap: allow badge-only sign in when the user is marked
    // requiresPinChange. This lets onboarding/profile setup run before PIN setup.
    if (normalizedPin.length === 0) {
      const identityResult = await this.getUserIdentity(normalizedBadge)
      const identity = identityResult.data

      if (!identity) {
        return ok({
          success: false,
          error: 'Badge not found',
          errorCode: 'INVALID_BADGE',
        })
      }

      if (!identity.isActive) {
        return ok({
          success: false,
          error: 'Account inactive',
          errorCode: 'ACCOUNT_INACTIVE',
        })
      }

      if (!identity.requiresPinChange) {
        return ok({
          success: false,
          error: 'PIN is required for this account',
          errorCode: 'INVALID_PIN',
        })
      }

      const active = [...this.sessions.values()].find(
        s => s.badge === normalizedBadge && s.status === 'active'
      )
      if (active) {
        this.currentSessionId = active.id
        return ok({ success: true, session: active, requiresPinChange: true })
      }

      const session = this.createSession(identity, {
        ...request,
        badge: normalizedBadge,
        pin: normalizedPin,
      })
      return ok({ success: true, session, requiresPinChange: true })
    }

    const verified = await this.verifyCredentials(request.badge, request.pin)
    if (!verified.data?.success || !verified.data.user) {
      return ok({
        success: false,
        error: verified.data?.error ?? 'Sign in failed',
        errorCode: (verified.data?.errorCode as SignInResult['errorCode']) ?? 'SIGN_IN_FAILED',
      })
    }

    const active = [...this.sessions.values()].find(
      s => s.badge === request.badge && s.status === 'active'
    )
    if (active) {
      this.currentSessionId = active.id
      return ok({
        success: true,
        session: active,
      })
    }

    const session = this.createSession(verified.data.user, request)
    const event = await this.recordTimestampEvent({
      type: 'SESSION_START',
      actorBadge: session.badge,
      actorName: session.user.preferredName,
      actorRole: session.user.role,
      sessionId: session.id,
      assignmentId: null,
      workAreaId: session.currentWorkAreaId,
      details: null,
    })

    return ok({ success: true, session, timestampEvent: event.data ?? undefined })
  }

  async signOut(sessionId: string): Promise<ServiceResult<void>> {
    const session = this.sessions.get(sessionId)
    if (!session) return fail('Session not found')

    const updated = { ...session, status: 'expired' as const, lastActivityAt: new Date().toISOString() }
    this.sessions.set(sessionId, updated)
    if (this.currentSessionId === sessionId) this.currentSessionId = null
    return ok(undefined)
  }

  async getCurrentSession(): Promise<ServiceResult<UserSession | null>> {
    if (!this.currentSessionId) return ok(null)
    const session = this.sessions.get(this.currentSessionId) ?? null
    return ok(session)
  }

  async validateSession(sessionId: string): Promise<ServiceResult<SessionValidation>> {
    return this.buildValidation(sessionId)
  }

  async refreshSession(sessionId: string): Promise<ServiceResult<UserSession>> {
    const session = this.sessions.get(sessionId)
    if (!session) return fail('Session not found')

    const now = new Date()
    const refreshed: UserSession = {
      ...session,
      status: 'active',
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    }
    this.sessions.set(sessionId, refreshed)
    return ok(refreshed)
  }

  async getActiveSessions(): Promise<ServiceResult<UserSession[]>> {
    const nowMs = Date.now()
    const active = [...this.sessions.values()].filter(session => {
      const expiresMs = new Date(session.expiresAt).getTime()
      return session.status === 'active' && Number.isFinite(expiresMs) && expiresMs > nowMs
    })
    return ok(active)
  }

  async terminateSession(sessionId: string, _reason?: string): Promise<ServiceResult<void>> {
    const session = this.sessions.get(sessionId)
    if (!session) return fail('Session not found')

    this.sessions.set(sessionId, { ...session, status: 'locked' })
    if (this.currentSessionId === sessionId) this.currentSessionId = null
    return ok(undefined)
  }

  async executeSecureAction(request: SecureActionRequest): Promise<ServiceResult<SecureActionResult>> {
    const verified = await this.verifyCredentials(request.badge, request.pin)
    if (!verified.data?.success || !verified.data.user) {
      return ok({
        success: false,
        error: verified.data?.error ?? 'Verification failed',
        errorCode: (verified.data?.errorCode as SecureActionResult['errorCode']) ?? 'ACTION_FAILED',
      })
    }

    const role = verified.data.user.role
    const action = request.context.action
    const allowed = SECURE_ACTION_PERMISSIONS[action]?.includes(role) ?? false
    if (!allowed) {
      return ok({ success: false, error: 'Permission denied', errorCode: 'PERMISSION_DENIED' })
    }

    const current = await this.getCurrentSession()
    return ok({ success: true, session: current.data ?? undefined })
  }

  async canPerformAction(action: SecureActionType): Promise<ServiceResult<boolean>> {
    const current = await this.getCurrentSession()
    const role = current.data?.user.role
    if (!role) return ok(false)
    return ok(SECURE_ACTION_PERMISSIONS[action]?.includes(role) ?? false)
  }

  async getAvailableActions(): Promise<ServiceResult<SecureActionType[]>> {
    const current = await this.getCurrentSession()
    const role = current.data?.user.role
    if (!role) return ok([])

    const actions = (Object.keys(SECURE_ACTION_PERMISSIONS) as SecureActionType[]).filter(action =>
      SECURE_ACTION_PERMISSIONS[action].includes(role)
    )
    return ok(actions)
  }

  async recordTimestampEvent(event: Omit<TimestampEvent, 'id' | 'timestamp'>): Promise<ServiceResult<TimestampEvent>> {
    const next: TimestampEvent = {
      ...event,
      id: `evt-${Date.now()}-${this.timestamps.length + 1}`,
      timestamp: new Date().toISOString(),
    }
    this.timestamps.unshift(next)
    return ok(next)
  }

  async getAssignmentTimestamps(assignmentId: string): Promise<ServiceResult<TimestampEvent[]>> {
    return ok(this.timestamps.filter(event => event.assignmentId === assignmentId))
  }

  async getUserTimestamps(badge: string, limit?: number): Promise<ServiceResult<TimestampEvent[]>> {
    const data = this.timestamps.filter(event => event.actorBadge === badge)
    return ok(typeof limit === 'number' ? data.slice(0, limit) : data)
  }

  async getRecentTimestamps(limit = 25): Promise<ServiceResult<TimestampEvent[]>> {
    return ok(this.timestamps.slice(0, limit))
  }

  async hasRole(badge: string, role: UserRole): Promise<ServiceResult<boolean>> {
    const identity = this.getIdentity(badge)
    return ok(identity?.role === role)
  }

  async hasAnyRole(badge: string, roles: UserRole[]): Promise<ServiceResult<boolean>> {
    const identity = this.getIdentity(badge)
    if (!identity) return ok(false)
    return ok(roles.includes(identity.role))
  }

  async isLeader(badge: string): Promise<ServiceResult<boolean>> {
    const identity = this.getIdentity(badge)
    if (!identity) return ok(false)
    return ok(identity.role === 'MANAGER' || identity.role === 'SUPERVISOR' || identity.role === 'TEAM_LEAD')
  }

  async getUsersByRole(role: UserRole): Promise<ServiceResult<UserIdentity[]>> {
    const users = [...this.identities.values()].filter(identity => identity.role === role)
    return ok(users)
  }
}
