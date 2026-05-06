/**
 * Team Roster Service Contract
 * 
 * Manages team member data from roster files.
 * Reads from Share/380/Teams/ (xlsx, csv, json)
 */

import type { ServiceResult, ShiftId, LwcSectionId } from './index'

export type MemberRole = 'BUILDUP' | 'WIRING' | 'TEST' | 'FLOAT_LEAD' | 'NTB_SPECIALIST' | 'OFFICE_COORDINATOR'
export type MemberStatus = 'active' | 'break' | 'meeting' | 'offline'

export interface TeamMember {
  /** Badge number (unique identifier) */
  badge: string
  /** Full name */
  fullName: string
  /** First name */
  firstName: string
  /** Last name */
  lastName: string
  /** Display initials */
  initials: string
  /** Assigned shift */
  shift: ShiftId
  /** Primary role */
  primaryRole: MemberRole
  /** Secondary roles the member can perform */
  secondaryRoles: MemberRole[]
  /** Current status */
  status: MemberStatus
  /** Preferred LWC sections */
  lwcAffinities: LwcSectionId[]
  /** Stages the member has experience with */
  experiencedStages: string[]
  /** Stages eligible for trainee pairing */
  traineeEligibleStages: string[]
  /** Work area kinds the member can work at */
  workstationKinds: string[]
  /** Current work area ID if assigned */
  currentWorkAreaId: string | null
  /** Avatar path (relative to Share/380/Users/) */
  avatarPath: string | null
  /** Last activity timestamp */
  lastActivityAt: string | null
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface TeamMemberWithAssignments extends TeamMember {
  /** Currently assigned project IDs */
  currentProjectIds: string[]
  /** Currently assigned sheet names */
  currentSheetNames: string[]
  /** Projects previously completed (for continuity matching) */
  priorCompletionProjectIds: string[]
}

export interface TeamRosterFilter {
  /** Filter by shift */
  shift?: ShiftId
  /** Filter by role */
  role?: MemberRole | MemberRole[]
  /** Filter by status */
  status?: MemberStatus | MemberStatus[]
  /** Filter by LWC affinity */
  lwc?: LwcSectionId
  /** Search by name or badge */
  search?: string
  /** Only members currently assigned */
  assigned?: boolean
  /** Only members available (not assigned) */
  available?: boolean
}

export interface ITeamRosterService {
  /**
   * Get all team members.
   * Reads from Share/380/Teams/roster-*.xlsx or roster-*.csv
   */
  getMembers(): Promise<ServiceResult<TeamMember[]>>

  /**
   * Get members with their current assignments.
   */
  getMembersWithAssignments(): Promise<ServiceResult<TeamMemberWithAssignments[]>>

  /**
   * Get filtered members.
   */
  getFilteredMembers(filter: TeamRosterFilter): Promise<ServiceResult<TeamMember[]>>

  /**
   * Get members by shift.
   */
  getMembersByShift(shift: ShiftId): Promise<ServiceResult<TeamMember[]>>

  /**
   * Get a single member by badge.
   */
  getMemberByBadge(badge: string): Promise<ServiceResult<TeamMember | null>>

  /**
   * Get members eligible for a specific assignment.
   * Considers role, stage experience, LWC, and availability.
   */
  getEligibleMembersForAssignment(
    assignmentId: string,
    workAreaId: string
  ): Promise<ServiceResult<TeamMemberWithAssignments[]>>

  /**
   * Update member status (active, break, meeting, offline).
   */
  updateMemberStatus(badge: string, status: MemberStatus): Promise<ServiceResult<TeamMember>>

  /**
   * Assign member to work area.
   */
  assignMemberToWorkArea(badge: string, workAreaId: string): Promise<ServiceResult<TeamMember>>

  /**
   * Clear member work area assignment.
   */
  clearMemberWorkArea(badge: string): Promise<ServiceResult<TeamMember>>

  /**
   * Refresh roster from files.
   */
  refreshRoster(): Promise<ServiceResult<void>>
}
