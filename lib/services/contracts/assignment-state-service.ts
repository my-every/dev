/**
 * Board compatibility contract
 *
 * This service still exposes the legacy board-stage vocabulary because the
 * active `/board` routes and persisted board assignment records depend on it.
 * New workspace and manifest flows should translate to canonical
 * `AssignmentStageId` values at the boundary instead of extending this list.
 */

import type { ServiceResult, PaginatedResult, ShiftId, LwcSectionId } from './index'

export const BOARD_ASSIGNMENT_STAGES = [
  'KITTED',
  'BUILD_UP',
  'IPV1',
  'WIRING',
  'IPV2',
  'BOX_BUILD',
  'IPV3',
  'CROSS_WIRING',
  'IPV4',
  'TEST_READY',
  'TEST',
  'POWER_CHECK',
  'BIQ',
  'COMPLETE',
] as const

export type AssignmentStage = (typeof BOARD_ASSIGNMENT_STAGES)[number]

export const BOARD_ASSIGNMENT_STATUSES = [
  'UNASSIGNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETE',
] as const

export type AssignmentStatus = (typeof BOARD_ASSIGNMENT_STATUSES)[number]

export interface Assignment {
  /** Unique assignment ID */
  id: string
  /** Parent project ID */
  projectId: string
  /** PD number */
  pdNumber: string
  /** Project name */
  projectName: string
  /** Sheet name */
  sheetName: string
  /** Sheet slug (URL-safe) */
  sheetSlug: string
  /** LWC section */
  lwc: LwcSectionId
  /** Target shift */
  shift: ShiftId
  /** Current stage */
  stage: AssignmentStage
  /** Current status */
  status: AssignmentStatus
  /** Required role for this stage */
  requiredRole: string
  /** Progress percentage (0-100) */
  progressPercent: number
  /** Priority (1-5, lower is higher) */
  priority: number
  /** Status note */
  statusNote: string
  /** Blocked reason (if blocked) */
  blockedReason: string | null
  /** Current work area ID */
  currentWorkAreaId: string | null
  /** Currently assigned member badges */
  currentMemberBadges: string[]
  /** Continuity member badges (from prior shift) */
  continuityMemberBadges: string[]
  /** Is this a carryover from prior shift */
  carriedFromPriorShift: boolean
  /** Trainee pairing allowed */
  traineeAllowed: boolean
  /** Wire count for this sheet */
  wireCount: number
  /** Completed wire count */
  completedWires: number
  /** Last updated timestamp */
  updatedAt: string
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
  /** ISO timestamp when this assignment was first assigned to a member */
  assignedAt?: string
  /** ISO timestamp when work was first started (stage left KITTED) */
  startedAt?: string
  /** ISO timestamp when assignment reached BIQ */
  completedAt?: string
  /** ISO due date (target completion) */
  dueAt?: string
  /** ISO timestamp when assignment entered BLOCKED status */
  blockedAt?: string
  /** Estimated work minutes (size-based) */
  estimatedMinutes: number
  /** Size tier for SLA calculation */
  sizeTier: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE'
}

export interface AssignmentFilter {
  /** Filter by project ID */
  projectId?: string
  /** Filter by stage */
  stage?: AssignmentStage | AssignmentStage[]
  /** Filter by status */
  status?: AssignmentStatus | AssignmentStatus[]
  /** Filter by LWC section */
  lwc?: LwcSectionId
  /** Filter by shift */
  shift?: ShiftId
  /** Filter by work area */
  workAreaId?: string
  /** Filter by member badge */
  memberBadge?: string
  /** Search by sheet name or PD number */
  search?: string
  /** Only carryover assignments */
  carryoverOnly?: boolean
  /** Only blocked assignments */
  blockedOnly?: boolean
}

export interface AssignmentPlacement {
  assignmentId: string
  workAreaId: string
  memberBadges: string[]
  traineePairing: boolean
  mode: 'place' | 'takeover'
}

export interface IAssignmentStateService {
  /**
   * Get all active assignments.
   * Reads from Share/380/State/active-assignments.json
   */
  getActiveAssignments(): Promise<ServiceResult<Assignment[]>>

  /**
   * Get paginated assignments with filters.
   */
  getAssignments(
    filter?: AssignmentFilter,
    page?: number,
    pageSize?: number
  ): Promise<ServiceResult<PaginatedResult<Assignment>>>

  /**
   * Get a single assignment by ID.
   */
  getAssignmentById(id: string): Promise<ServiceResult<Assignment | null>>

  /**
   * Get assignments for a project.
   */
  getAssignmentsByProject(projectId: string): Promise<ServiceResult<Assignment[]>>

  /**
   * Get assignments for a work area.
   */
  getAssignmentsByWorkArea(workAreaId: string): Promise<ServiceResult<Assignment[]>>

  /**
   * Get assignments for a member.
   */
  getAssignmentsByMember(badge: string): Promise<ServiceResult<Assignment[]>>

  /**
   * Get backlog (unassigned + blocked).
   */
  getBacklog(): Promise<ServiceResult<{
    unassigned: Assignment[]
    blocked: Assignment[]
    carryover: Assignment[]
  }>>

  /**
   * Get recommended assignments for a work area.
   */
  getRecommendedAssignments(workAreaId: string, limit?: number): Promise<ServiceResult<Assignment[]>>

  /**
   * Place an assignment at a work area with members.
   */
  placeAssignment(placement: AssignmentPlacement): Promise<ServiceResult<Assignment>>

  /**
   * Update assignment status.
   */
  updateStatus(id: string, status: AssignmentStatus, note?: string): Promise<ServiceResult<Assignment>>

  /**
   * Advance assignment to next stage.
   */
  advanceStage(id: string): Promise<ServiceResult<Assignment>>

  /**
   * Block an assignment.
   */
  blockAssignment(id: string, reason: string): Promise<ServiceResult<Assignment>>

  /**
   * Unblock an assignment.
   */
  unblockAssignment(id: string): Promise<ServiceResult<Assignment>>

  /**
   * Update assignment progress.
   */
  updateProgress(id: string, progressPercent: number, completedWires?: number): Promise<ServiceResult<Assignment>>
}
