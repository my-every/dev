/**
 * User Profile Service Contract
 * 
 * Manages user profile data and preferences.
 * Reads from Share/380/Users/<badge>/
 */

import type { ServiceResult } from './index'

export interface UserProfile {
  /** Badge number */
  badge: string
  /** Full name */
  fullName: string
  /** Display initials */
  initials: string
  /** Email (if available) */
  email: string | null
  /** Avatar URL (relative to Share/380/Users/<badge>/) */
  avatarPath: string | null
  /** User preferences */
  preferences: UserPreferences
  /** Last login timestamp */
  lastLoginAt: string | null
  /** Profile updated timestamp */
  updatedAt: string
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface UserPreferences {
  /** Preferred theme */
  theme: 'light' | 'dark' | 'system'
  /** Notification preferences */
  notifications: {
    stageComplete: boolean
    assignmentBlocked: boolean
    handoffRequired: boolean
    shiftReminders: boolean
  }
  /** Dashboard layout preferences */
  dashboardLayout: 'compact' | 'expanded'
  /** Default view preferences */
  defaultViews: {
    projectBoard: 'list' | 'kanban' | 'grid'
    workAreaBoard: 'floor' | 'list'
  }
}

export interface UserAssignmentHistory {
  /** Assignment ID */
  assignmentId: string
  /** Project ID */
  projectId: string
  /** Sheet name */
  sheetName: string
  /** Stage worked */
  stage: string
  /** Start timestamp */
  startedAt: string
  /** End timestamp (null if ongoing) */
  endedAt: string | null
  /** Wires completed during this assignment */
  wiresCompleted: number
  /** Quality score (0-100) */
  qualityScore: number | null
}

export interface UserStats {
  /** Total sheets completed */
  totalSheetsCompleted: number
  /** Total wires completed */
  totalWiresCompleted: number
  /** Average quality score */
  averageQualityScore: number
  /** Current streak (consecutive days) */
  currentStreak: number
  /** Best streak */
  bestStreak: number
  /** This week's wires */
  wiresThisWeek: number
  /** This month's wires */
  wiresThisMonth: number
}

export interface IUserProfileService {
  /**
   * Get user profile by badge.
   * Reads from Share/380/Users/<badge>/profile.json
   */
  getProfile(badge: string): Promise<ServiceResult<UserProfile | null>>

  /**
   * Update user preferences.
   * Writes to Share/380/Users/<badge>/profile.json
   */
  updatePreferences(badge: string, preferences: Partial<UserPreferences>): Promise<ServiceResult<UserProfile>>

  /**
   * Get user assignment history.
   * Reads from Share/380/Users/<badge>/history.json
   */
  getAssignmentHistory(badge: string, limit?: number): Promise<ServiceResult<UserAssignmentHistory[]>>

  /**
   * Get user stats.
   * Aggregates from history and state files.
   */
  getStats(badge: string): Promise<ServiceResult<UserStats>>

  /**
   * Record login.
   */
  recordLogin(badge: string): Promise<ServiceResult<void>>

  /**
   * Update avatar.
   * Saves to Share/380/Users/<badge>/avatar.png
   */
  updateAvatar(badge: string, imageData: Blob): Promise<ServiceResult<string>>
}
