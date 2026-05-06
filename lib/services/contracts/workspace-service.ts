/**
 * Workspace Service Contract
 * 
 * Manages the active workspace session including:
 * - Operating date and active shift
 * - User session context
 * - Global runtime state
 */

import type { ServiceResult, ShiftId } from './index'

export interface WorkspaceSession {
  /** Currently selected operating date (YYYY-MM-DD) */
  operatingDate: string
  /** Active shift for the session */
  activeShift: ShiftId
  /** Logged-in user badge number */
  userBadge: string | null
  /** User display name */
  userName: string | null
  /** Session start timestamp */
  sessionStartedAt: string
  /** Last activity timestamp */
  lastActivityAt: string
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface WorkspaceSummaryMetrics {
  /** Total active projects */
  activeProjectCount: number
  /** Total sheets in progress */
  inProgressSheetCount: number
  /** Total blocked assignments */
  blockedAssignmentCount: number
  /** Total wires completed today */
  wiresCompletedToday: number
  /** Staffed work areas count */
  staffedWorkAreaCount: number
  /** Total team members on shift */
  teamMembersOnShift: number
}

export interface ShiftSnapshot {
  shift: ShiftId
  shiftLabel: string
  operatingDate: string
  memberCount: number
  completedSheets: number
  wiresCompleted: number
  averageEfficiency: number
  blockedCount: number
}

export interface IWorkspaceService {
  /**
   * Initialize or restore the workspace session.
   * Reads from Share/380/State/current-session.json
   */
  getSession(): Promise<ServiceResult<WorkspaceSession>>

  /**
   * Update the operating date for the session.
   * Writes to Share/380/State/current-session.json
   */
  setOperatingDate(date: string): Promise<ServiceResult<WorkspaceSession>>

  /**
   * Update the active shift for the session.
   * Writes to Share/380/State/current-session.json
   */
  setActiveShift(shift: ShiftId): Promise<ServiceResult<WorkspaceSession>>

  /**
   * Set the logged-in user for the session.
   * Writes to Share/380/State/current-session.json
   */
  setSessionUser(badge: string): Promise<ServiceResult<WorkspaceSession>>

  /**
   * Get summary metrics for the dashboard.
   * Aggregates data from projects, assignments, and team state.
   */
  getSummaryMetrics(): Promise<ServiceResult<WorkspaceSummaryMetrics>>

  /**
   * Get shift performance snapshots for comparison.
   * Reads from Share/380/State/shift-snapshots/
   */
  getShiftSnapshots(date: string): Promise<ServiceResult<ShiftSnapshot[]>>

  /**
   * Clear the session (logout / reset).
   */
  clearSession(): Promise<ServiceResult<void>>
}
