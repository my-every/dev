/**
 * Session Service Contract
 * 
 * Manages user sessions, authentication, and secure actions.
 * Stores session state in Share/380/State/sessions/
 */

import type { ServiceResult } from './index'
import type {
  CredentialVerificationResult,
  PinChangeResult,
  UserIdentity,
  UserSession,
  UserActivitySummary,
  SecureActionRequest,
  SecureActionResult,
  SecureActionType,
  TimestampEvent,
  ExecutionMode,
  UserRole,
} from '@/types/d380-user-session'

export interface SessionValidation {
  /** Is valid */
  valid: boolean
  /** Session if valid */
  session: UserSession | null
  /** Reason if invalid */
  reason?: 'not_found' | 'expired' | 'locked' | 'invalid_badge'
}

export interface SignInRequest {
  /** Badge number */
  badge: string
  /** PIN (4 digits) */
  pin: string
  /** Work area ID (optional) */
  workAreaId?: string
  /** Execution mode */
  executionMode?: ExecutionMode
}

export interface SignInResult {
  /** Success flag */
  success: boolean
  /** Error message */
  error?: string
  /** Error code */
  errorCode?: 'INVALID_BADGE' | 'INVALID_PIN' | 'ACCOUNT_INACTIVE' | 'PIN_CHANGE_REQUIRED' | 'ACCOUNT_LOCKED' | 'ALREADY_SIGNED_IN' | 'SIGN_IN_FAILED'
  /** Session created */
  session?: UserSession
  /** Timestamp event */
  timestampEvent?: TimestampEvent
  /** Whether the user must change the default PIN before continuing */
  requiresPinChange?: boolean
}

export interface ISessionService {
  // ========================================================================
  // User Identity
  // ========================================================================

  /**
   * Get user identity by badge.
   * Reads from Share/380/Users/<badge>/identity.json
   */
  getUserIdentity(badge: string): Promise<ServiceResult<UserIdentity | null>>

  /**
   * Get user activity summary.
   */
  getUserActivitySummary(badge: string): Promise<ServiceResult<UserActivitySummary>>

  /**
   * Validate badge exists.
   */
  validateBadge(badge: string): Promise<ServiceResult<boolean>>

  /**
   * Validate badge + PIN combination.
   */
  validateCredentials(badge: string, pin: string): Promise<ServiceResult<boolean>>

  /**
   * Verify credentials and return the resolved user identity.
   */
  verifyCredentials(badge: string, pin: string): Promise<ServiceResult<CredentialVerificationResult>>

  /**
   * Update a user's PIN after successful verification.
   */
  changePin(badge: string, currentPin: string, nextPin: string): Promise<ServiceResult<PinChangeResult>>

  /**
   * Update user identity.
   */
  updateUserIdentity(badge: string, updates: Partial<UserIdentity>): Promise<ServiceResult<UserIdentity>>

  /**
   * Update user avatar.
   */
  updateUserAvatar(badge: string, imageData: Blob): Promise<ServiceResult<string>>

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * Sign in user.
   */
  signIn(request: SignInRequest): Promise<ServiceResult<SignInResult>>

  /**
   * Sign out current session.
   */
  signOut(sessionId: string): Promise<ServiceResult<void>>

  /**
   * Get current session.
   */
  getCurrentSession(): Promise<ServiceResult<UserSession | null>>

  /**
   * Validate session.
   */
  validateSession(sessionId: string): Promise<ServiceResult<SessionValidation>>

  /**
   * Refresh session (extend expiry).
   */
  refreshSession(sessionId: string): Promise<ServiceResult<UserSession>>

  /**
   * Get all active sessions.
   */
  getActiveSessions(): Promise<ServiceResult<UserSession[]>>

  /**
   * Terminate session (by manager/supervisor).
   */
  terminateSession(sessionId: string, reason?: string): Promise<ServiceResult<void>>

  // ========================================================================
  // Secure Actions
  // ========================================================================

  /**
   * Execute a secure action with badge/PIN validation.
   */
  executeSecureAction(request: SecureActionRequest): Promise<ServiceResult<SecureActionResult>>

  /**
   * Check if current session can perform action.
   */
  canPerformAction(action: SecureActionType): Promise<ServiceResult<boolean>>

  /**
   * Get actions available to current session.
   */
  getAvailableActions(): Promise<ServiceResult<SecureActionType[]>>

  // ========================================================================
  // Timestamp Events
  // ========================================================================

  /**
   * Record a timestamp event.
   */
  recordTimestampEvent(event: Omit<TimestampEvent, 'id' | 'timestamp'>): Promise<ServiceResult<TimestampEvent>>

  /**
   * Get timestamp events for assignment.
   */
  getAssignmentTimestamps(assignmentId: string): Promise<ServiceResult<TimestampEvent[]>>

  /**
   * Get timestamp events for user.
   */
  getUserTimestamps(badge: string, limit?: number): Promise<ServiceResult<TimestampEvent[]>>

  /**
   * Get recent timestamp events.
   */
  getRecentTimestamps(limit?: number): Promise<ServiceResult<TimestampEvent[]>>

  // ========================================================================
  // Role-Based Access
  // ========================================================================

  /**
   * Check if badge has role.
   */
  hasRole(badge: string, role: UserRole): Promise<ServiceResult<boolean>>

  /**
   * Check if badge has any of roles.
   */
  hasAnyRole(badge: string, roles: UserRole[]): Promise<ServiceResult<boolean>>

  /**
   * Check if badge has leadership role.
   */
  isLeader(badge: string): Promise<ServiceResult<boolean>>

  /**
   * Get users by role.
   */
  getUsersByRole(role: UserRole): Promise<ServiceResult<UserIdentity[]>>
}
