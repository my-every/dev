// ============================================================================
// PROFILE TYPES & INTERFACES
// ============================================================================

export type UserRole =
  | 'developer'
  | 'manager'
  | 'supervisor'
  | 'team_lead'
  | 'qa'
  | 'brander'
  | 'assembler'

export type UserStatus = 'active' | 'offline' | 'busy' | 'available'

export type ShiftType = '1st' | '2nd' | 'overtime'

export interface UserProfile {
  id: string
  preferredName?: string
  fullName: string
  badgeId: string
  email?: string
  role: UserRole
  avatarUrl?: string
  coverImageUrl?: string
  /** Cover image vertical position (0–100 %, default 50) */
  coverImagePositionY?: number
  shift?: ShiftType
  lwc?: string[]
  department?: string
  title?: string
  location?: string
  bio?: string
  joinedAt?: string
  status?: UserStatus
}

// ============================================================================
// PROFILE STATS
// ============================================================================

export interface ProfileStat {
  id: string
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: string
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export type RoleStatConfig = {
  [key in UserRole]: ProfileStat[]
}

// ============================================================================
// WIDGET SYSTEM
// ============================================================================

export type ProfileWidgetType =
  | 'stats'
  | 'list'
  | 'timeline'
  | 'status'
  | 'assignments'
  | 'performance'
  | 'qa_summary'
  | 'team_overview'
  | 'shift_summary'
  | 'project_health'
  | 'validation_queue'
  | 'label_tasks'
  | 'current_assignment'
  | 'custom'

export type ProfileWidgetSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ProfileWidgetConfig {
  id: string
  title: string
  roleVisibility: UserRole[]
  type: ProfileWidgetType
  size?: ProfileWidgetSize
  colSpan?: 1 | 2 | 3 | 4
  rowSpan?: 1 | 2
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

export interface ProfileQuickAction {
  id: string
  label: string
  icon: string
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  roleVisibility?: UserRole[]
  onClick?: () => void
}

// ============================================================================
// PROFILE HEADER PROPS
// ============================================================================

export interface ProfileHeaderProps {
  profile: UserProfile
  stats?: ProfileStat[]
  isEditable?: boolean
  onAvatarChange?: (file: File) => void
  onCoverChange?: (file: File) => void
  onProfileUpdate?: (profile: Partial<UserProfile>) => void
  className?: string
}

// ============================================================================
// ROLE DISPLAY CONFIG
// ============================================================================

export const ROLE_DISPLAY_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string; borderColor: string }> = {
  developer: {
    label: 'Developer',
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  manager: {
    label: 'Manager',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  supervisor: {
    label: 'Supervisor',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  team_lead: {
    label: 'Team Lead',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  qa: {
    label: 'QA',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  brander: {
    label: 'Brander',
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  assembler: {
    label: 'Assembler',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
}

// ============================================================================
// STATUS DISPLAY CONFIG
// ============================================================================

export const STATUS_DISPLAY_CONFIG: Record<UserStatus, { label: string; color: string; dotColor: string }> = {
  active: {
    label: 'Active',
    color: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  available: {
    label: 'Available',
    color: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  busy: {
    label: 'Busy',
    color: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  offline: {
    label: 'Offline',
    color: 'text-slate-500 dark:text-slate-400',
    dotColor: 'bg-slate-400',
  },
}
