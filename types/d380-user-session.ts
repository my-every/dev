import type { ShiftOptionId } from '@/types/d380-startup'


export type UserRole =
  | 'DEVELOPER'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'TEAM_LEAD'
  | 'QA'
  | 'BRANDER'
  | 'ASSEMBLER'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  DEVELOPER: 'Developer',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  TEAM_LEAD: 'Team Lead',
  QA: 'Quality Assurance',
  BRANDER: 'Brander',
  ASSEMBLER: 'Assembler',
}

export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  DEVELOPER: 200,
  MANAGER: 100,
  SUPERVISOR: 80,
  TEAM_LEAD: 60,
  QA: 50,
  BRANDER: 40,
  ASSEMBLER: 20,
}

// ============================================================================
// Execution Mode
// ============================================================================

export type ExecutionMode = 'PRINT_MANUAL' | 'TABLET_INTERACTIVE'

export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  PRINT_MANUAL: 'Print Manual',
  TABLET_INTERACTIVE: 'Tablet Interactive',
}

// ============================================================================
// D380 User (simplified user type for authentication)
// ============================================================================

export interface D380User {
  /** User ID */
  id: string
  /** Badge number */
  badgeNumber: string
  /** Full name */
  fullName: string
  /** Display initials */
  initials: string
  /** Avatar URL */
  avatarUrl?: string
  /** User role */
  role: UserRole
}

// ============================================================================
// User Identity
// ============================================================================

export interface UserIdentity {
  /** Badge number (unique identifier) */
  badge: string
  /** PIN hash (for validation, never stored raw) */
  pinHash: string
  /** Legal full name */
  legalName: string
  /** Preferred display name */
  preferredName: string
  /** Display initials */
  initials: string
  /** Role */
  role: UserRole
  /** Job title */
  title?: string | null
  /** Profile photo path */
  avatarPath: string | null
  /** Primary LWC section */
  primaryLwc: string
  /** Current shift */
  currentShift: ShiftOptionId
  /** Email (optional) */
  email: string | null
  /** Phone (optional) */
  phone: string | null
  /** Is active user */
  isActive: boolean
  /** Whether the user must change the default PIN before continuing */
  requiresPinChange: boolean
  /** Created timestamp */
  createdAt: string
  /** Updated timestamp */
  updatedAt: string
  /** User skills (0-4 scale) — aligned with production stages */
  skills?: {
    brandList: number
    branding: number
    buildUp: number
    wiring: number
    wiringIpv: number
    boxBuild: number
    crossWire: number
    test: number
    pwrCheck: number
    biq: number
    greenChange: number
  }
  /** Years of experience */
  yearsExperience?: number
  /** Hire date */
  hireDate?: string
}

export interface UserActivitySummary {
  /** Total assignments completed */
  totalAssignmentsCompleted: number
  /** Total wires completed */
  totalWiresCompleted: number
  /** Average quality score */
  averageQualityScore: number
  /** Hours worked this week */
  hoursThisWeek: number
  /** Current streak (consecutive days) */
  currentStreak: number
  /** Assignments in progress */
  activeAssignments: number
  /** Last active timestamp */
  lastActiveAt: string | null
}

// ============================================================================
// Session State
// ============================================================================

export type SessionStatus = 'active' | 'idle' | 'expired' | 'locked'

export interface UserSession {
  /** Session ID */
  id: string
  /** User badge */
  badge: string
  /** User identity snapshot */
  user: UserIdentity
  /** Session status */
  status: SessionStatus
  /** Execution mode */
  executionMode: ExecutionMode
  /** Current LWC section */
  currentLwc: string
  /** Current work area ID */
  currentWorkAreaId: string | null
  /** Session started at */
  startedAt: string
  /** Last activity timestamp */
  lastActivityAt: string
  /** Session expires at */
  expiresAt: string
  /** Device/client info */
  deviceInfo: DeviceInfo
}

export interface DeviceInfo {
  /** Device type */
  type: 'desktop' | 'tablet' | 'mobile'
  /** User agent */
  userAgent: string
  /** Screen size */
  screenSize: { width: number; height: number }
  /** Touch capable */
  touchCapable: boolean
}

// ============================================================================
// Secure Actions
// ============================================================================

export type SecureActionType =
  | 'START_ASSIGNMENT'
  | 'PAUSE_ASSIGNMENT'
  | 'RESUME_ASSIGNMENT'
  | 'COMPLETE_ASSIGNMENT'
  | 'HANDOFF_ASSIGNMENT'
  | 'VERIFY_STAGE'
  | 'APPROVE_STAGE'
  | 'REJECT_STAGE'
  | 'ASSIGN_MEMBER'
  | 'UNASSIGN_MEMBER'
  | 'REOPEN_STAGE'
  | 'BLOCK_ASSIGNMENT'
  | 'UNBLOCK_ASSIGNMENT'
  | 'UPDATE_PROGRESS'
  | 'UPLOAD_PROJECT'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'START_STAGE'
  | 'IPV_VERIFY'

export const SECURE_ACTION_LABELS: Record<SecureActionType, string> = {
  START_ASSIGNMENT: 'Start Assignment',
  PAUSE_ASSIGNMENT: 'Pause Assignment',
  RESUME_ASSIGNMENT: 'Resume Assignment',
  COMPLETE_ASSIGNMENT: 'Complete Assignment',
  HANDOFF_ASSIGNMENT: 'Hand Off Assignment',
  VERIFY_STAGE: 'Verify Stage',
  APPROVE_STAGE: 'Approve Stage',
  REJECT_STAGE: 'Reject Stage',
  ASSIGN_MEMBER: 'Assign Member',
  UNASSIGN_MEMBER: 'Unassign Member',
  REOPEN_STAGE: 'Reopen Stage',
  BLOCK_ASSIGNMENT: 'Block Assignment',
  UNBLOCK_ASSIGNMENT: 'Unblock Assignment',
  UPDATE_PROGRESS: 'Update Progress',
  UPLOAD_PROJECT: 'Upload Project',
  SIGN_IN: 'Sign In',
  SIGN_OUT: 'Sign Out',
  START_STAGE: 'Start Stage',
  IPV_VERIFY: 'In-Process Verification',
}

/** Roles allowed to perform each action */
export const SECURE_ACTION_PERMISSIONS: Record<SecureActionType, UserRole[]> = {
  START_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  PAUSE_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  RESUME_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  COMPLETE_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  HANDOFF_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  VERIFY_STAGE: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA'],
  APPROVE_STAGE: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'QA'],
  REJECT_STAGE: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'QA'],
  ASSIGN_MEMBER: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'],
  UNASSIGN_MEMBER: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'],
  REOPEN_STAGE: ['DEVELOPER', 'MANAGER', 'SUPERVISOR'],
  BLOCK_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA'],
  UNBLOCK_ASSIGNMENT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'],
  UPDATE_PROGRESS: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  UPLOAD_PROJECT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  SIGN_IN: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  SIGN_OUT: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  START_STAGE: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
  IPV_VERIFY: ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'QA', 'BRANDER', 'ASSEMBLER'],
}

export interface SecureActionContext {
  /** Action type */
  action: SecureActionType
  /** Target assignment ID (if applicable) */
  assignmentId?: string
  /** Target work area ID (if applicable) */
  workAreaId?: string
  /** Target member badge (if applicable) */
  targetBadge?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export interface SecureActionRequest {
  /** Badge number */
  badge: string
  /** PIN (4 digits) */
  pin: string
  /** Action context */
  context: SecureActionContext
}

export interface SecureActionResult {
  /** Success flag */
  success: boolean
  /** Error message (if failed) */
  error?: string
  /** Error code */
  errorCode?: 'INVALID_BADGE' | 'INVALID_PIN' | 'PERMISSION_DENIED' | 'SESSION_EXPIRED' | 'ACTION_FAILED'
  /** Created/refreshed session */
  session?: UserSession
  /** Timestamp event created */
  timestampEvent?: TimestampEvent
}

export type SessionErrorCode =
  | 'INVALID_BADGE'
  | 'INVALID_PIN'
  | 'ACCOUNT_INACTIVE'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED'
  | 'ACTION_FAILED'
  | 'PIN_CHANGE_REQUIRED'
  | 'PIN_CHANGE_FAILED'
  | 'SIGN_IN_FAILED'
  | 'VERIFICATION_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ALREADY_SIGNED_IN'

export interface SessionFeedback {
  code: SessionErrorCode
  title: string
  message: string
}

export interface CredentialVerificationResult {
  success: boolean
  user?: UserIdentity
  error?: string
  errorCode?: SessionErrorCode
  feedback?: SessionFeedback
  requiresPinChange?: boolean
}

export interface PinChangeResult {
  success: boolean
  user?: UserIdentity
  error?: string
  errorCode?: SessionErrorCode
  feedback?: SessionFeedback
}

// ============================================================================
// Timestamp Events
// ============================================================================

export type TimestampEventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'ASSIGNMENT_START'
  | 'ASSIGNMENT_PAUSE'
  | 'ASSIGNMENT_RESUME'
  | 'ASSIGNMENT_COMPLETE'
  | 'ASSIGNMENT_HANDOFF'
  | 'STAGE_VERIFY'
  | 'STAGE_APPROVE'
  | 'STAGE_REJECT'
  | 'STAGE_REOPEN'
  | 'MEMBER_ASSIGN'
  | 'MEMBER_UNASSIGN'
  | 'PROGRESS_UPDATE'
  | 'PROJECT_UPLOAD'
  | 'BLOCK'
  | 'UNBLOCK'

export interface TimestampEvent {
  /** Event ID */
  id: string
  /** Event type */
  type: TimestampEventType
  /** Timestamp ISO string */
  timestamp: string
  /** Badge of user who performed action */
  actorBadge: string
  /** Actor name snapshot */
  actorName: string
  /** Actor role snapshot */
  actorRole: UserRole
  /** Session ID */
  sessionId: string
  /** Assignment ID (if applicable) */
  assignmentId: string | null
  /** Work area ID (if applicable) */
  workAreaId: string | null
  /** Target badge (if applicable) */
  targetBadge: string | null
  /** Previous value (for state changes) */
  previousValue: string | null
  /** New value (for state changes) */
  newValue: string | null
  /** Additional metadata */
  metadata: Record<string, unknown>
}

// ============================================================================
// Role-Based Dashboard Configuration
// ============================================================================

export type DashboardWidgetType =
  | 'my_assignments'
  | 'team_overview'
  | 'project_board'
  | 'work_area_map'
  | 'shift_summary'
  | 'quality_metrics'
  | 'leaderboard'
  | 'notifications'
  | 'recent_activity'
  | 'blocked_items'
  | 'carryover_items'
  | 'stage_distribution'
  | 'member_roster'

export interface DashboardWidget {
  /** Widget type */
  type: DashboardWidgetType
  /** Widget title override */
  title?: string
  /** Grid column span (1-4) */
  colSpan?: 1 | 2 | 3 | 4
  /** Grid row span (1-2) */
  rowSpan?: 1 | 2
  /** Widget-specific props */
  props?: Record<string, unknown>
}

export interface RoleDashboardConfig {
  /** Dashboard title */
  title: string
  /** Dashboard subtitle */
  subtitle?: string
  /** Widgets to display */
  widgets: DashboardWidget[]
  /** Quick actions available */
  quickActions: SecureActionType[]
  /** Show project board link */
  showProjectBoard: boolean
  /** Show team roster */
  showTeamRoster: boolean
}

export const ROLE_DASHBOARD_CONFIGS: Record<UserRole, RoleDashboardConfig> = {
  DEVELOPER: {
    title: 'Developer Dashboard',
    subtitle: 'Full system access — role switching enabled',
    widgets: [
      { type: 'shift_summary', colSpan: 2 },
      { type: 'quality_metrics', colSpan: 2 },
      { type: 'project_board', colSpan: 4 },
      { type: 'blocked_items', colSpan: 2 },
      { type: 'recent_activity', colSpan: 2 },
    ],
    quickActions: ['ASSIGN_MEMBER', 'APPROVE_STAGE', 'REOPEN_STAGE', 'VERIFY_STAGE'],
    showProjectBoard: true,
    showTeamRoster: true,
  },
  MANAGER: {
    title: 'Manager Dashboard',
    subtitle: 'Full department overview',
    widgets: [
      { type: 'shift_summary', colSpan: 2 },
      { type: 'quality_metrics', colSpan: 2 },
      { type: 'project_board', colSpan: 4 },
      { type: 'blocked_items', colSpan: 2 },
      { type: 'leaderboard', colSpan: 2 },
    ],
    quickActions: ['ASSIGN_MEMBER', 'APPROVE_STAGE', 'REOPEN_STAGE'],
    showProjectBoard: true,
    showTeamRoster: true,
  },
  SUPERVISOR: {
    title: 'Supervisor Dashboard',
    subtitle: 'Shift operations',
    widgets: [
      { type: 'shift_summary', colSpan: 2 },
      { type: 'team_overview', colSpan: 2 },
      { type: 'work_area_map', colSpan: 4 },
      { type: 'blocked_items', colSpan: 2 },
      { type: 'carryover_items', colSpan: 2 },
    ],
    quickActions: ['ASSIGN_MEMBER', 'APPROVE_STAGE', 'BLOCK_ASSIGNMENT'],
    showProjectBoard: true,
    showTeamRoster: true,
  },
  TEAM_LEAD: {
    title: 'Team Lead Dashboard',
    subtitle: 'Team assignments',
    widgets: [
      { type: 'team_overview', colSpan: 2 },
      { type: 'my_assignments', colSpan: 2 },
      { type: 'work_area_map', colSpan: 4 },
      { type: 'member_roster', colSpan: 2 },
      { type: 'recent_activity', colSpan: 2 },
    ],
    quickActions: ['ASSIGN_MEMBER', 'VERIFY_STAGE', 'HANDOFF_ASSIGNMENT'],
    showProjectBoard: true,
    showTeamRoster: true,
  },
  QA: {
    title: 'QA Dashboard',
    subtitle: 'Quality verification',
    widgets: [
      { type: 'quality_metrics', colSpan: 2 },
      { type: 'my_assignments', colSpan: 2 },
      { type: 'stage_distribution', colSpan: 4 },
      { type: 'recent_activity', colSpan: 2 },
      { type: 'notifications', colSpan: 2 },
    ],
    quickActions: ['VERIFY_STAGE', 'APPROVE_STAGE', 'REJECT_STAGE'],
    showProjectBoard: true,
    showTeamRoster: false,
  },
  BRANDER: {
    title: 'Brander Dashboard',
    subtitle: 'Labeling & marking',
    widgets: [
      { type: 'my_assignments', colSpan: 4 },
      { type: 'recent_activity', colSpan: 2 },
      { type: 'notifications', colSpan: 2 },
    ],
    quickActions: ['START_ASSIGNMENT', 'COMPLETE_ASSIGNMENT', 'HANDOFF_ASSIGNMENT'],
    showProjectBoard: false,
    showTeamRoster: false,
  },
  ASSEMBLER: {
    title: 'My Assignments',
    subtitle: 'Current work',
    widgets: [
      { type: 'my_assignments', colSpan: 4 },
      { type: 'recent_activity', colSpan: 2 },
      { type: 'notifications', colSpan: 2 },
    ],
    quickActions: ['START_ASSIGNMENT', 'PAUSE_ASSIGNMENT', 'COMPLETE_ASSIGNMENT'],
    showProjectBoard: false,
    showTeamRoster: false,
  },
}

// ============================================================================
// Utility Functions
// ============================================================================

export function canPerformAction(role: UserRole, action: SecureActionType): boolean {
  return SECURE_ACTION_PERMISSIONS[action].includes(role)
}

export function getRoleLevel(role: UserRole): number {
  return USER_ROLE_HIERARCHY[role]
}

export function hasHigherRole(role: UserRole, than: UserRole): boolean {
  return USER_ROLE_HIERARCHY[role] > USER_ROLE_HIERARCHY[than]
}

export function isLeadershipRole(role: UserRole): boolean {
  return ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'].includes(role)
}

export function isVerificationRole(role: UserRole): boolean {
  return ['DEVELOPER', 'MANAGER', 'SUPERVISOR', 'QA'].includes(role)
}

/** Roles that can switch to any other role at runtime */
export function canSwitchRoles(role: UserRole): boolean {
  return ['DEVELOPER', 'MANAGER', 'SUPERVISOR'].includes(role)
}
