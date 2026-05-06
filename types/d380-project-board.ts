import type { ShiftOptionId } from '@/types/d380-startup'
import type { ProjectAssignmentStage } from '@/types/d380-shared'

export type ProjectBoardLwcSectionId = 'ONSKID' | 'OFFSKID' | 'NEW/FLEX' | 'OFFICE'

export type ProjectBoardWorkAreaKind =
  | 'BUILDUP_TABLE'
  | 'WIRING_TABLE'
  | 'TEST_STATION'
  | 'FLOAT'
  | 'NTB'
  | 'OFFICE_AREA'

export type ProjectBoardAssignmentStatus = 'UNASSIGNED' | 'BLOCKED' | 'IN_PROGRESS' | 'ASSIGNED' | 'COMPLETE'
export type ProjectBoardWorkAreaLoadState = 'idle' | 'balanced' | 'busy' | 'over-capacity'
export type ProjectBoardPlacementMode = 'place' | 'reassign' | 'takeover'
export type ProjectBoardMemberRole = 'BUILDUP' | 'WIRING' | 'TEST' | 'FLOAT_LEAD' | 'NTB_SPECIALIST' | 'OFFICE_COORDINATOR'

export interface D380ProjectBoardProjectRecord {
  id: string
  pdNumber: string
  name: string
  lwc: ProjectBoardLwcSectionId
  shift: ShiftOptionId
  member: string
  targetDate: string
  units: number
}

export interface ProjectBoardWorkAreaRecord {
  id: string
  label: string
  stationCode: string
  lwc: ProjectBoardLwcSectionId
  kind: ProjectBoardWorkAreaKind
  capacity: number
  supportedStages: ProjectAssignmentStage[]
  primaryRoles: ProjectBoardMemberRole[]
  notes: string
}

export interface ProjectBoardMemberRecord {
  id: string
  name: string
  initials: string
  shift: ShiftOptionId
  primaryRole: ProjectBoardMemberRole
  secondaryRoles: ProjectBoardMemberRole[]
  lwcAffinities: ProjectBoardLwcSectionId[]
  workstationKinds: ProjectBoardWorkAreaKind[]
  experiencedStages: ProjectAssignmentStage[]
  traineeEligibleStages: ProjectAssignmentStage[]
  priorCompletionProjectIds: string[]
  currentWorkAreaId?: string
}

export interface ProjectBoardAssignmentRecord {
  id: string
  projectId: string
  pdNumber: string
  projectName: string
  lwc: ProjectBoardLwcSectionId
  shift: ShiftOptionId
  sheetName: string
  stage: ProjectAssignmentStage
  status: ProjectBoardAssignmentStatus
  requiredRole: ProjectBoardMemberRole
  preferredWorkAreaKinds: ProjectBoardWorkAreaKind[]
  traineeAllowed: boolean
  currentWorkAreaId?: string
  currentMemberIds: string[]
  continuityMemberIds: string[]
  dependencyIds: string[]
  blockedReason?: string
  progressPercent: number
  priority: 1 | 2 | 3 | 4 | 5
  carriedFromPriorShift: boolean
  statusNote: string
}

export interface D380ProjectBoardDataSet {
  operatingDate: string
  activeShift: ShiftOptionId
  projects: D380ProjectBoardProjectRecord[]
  workAreas: ProjectBoardWorkAreaRecord[]
  members: ProjectBoardMemberRecord[]
  assignments: ProjectBoardAssignmentRecord[]
}

export interface ProjectBoardPlacementSelection {
  workAreaId: string
  assignmentId: string
  memberIds: string[]
  traineePairing: boolean
  mode: ProjectBoardPlacementMode
}

export interface ProjectBoardMemberCapabilityBadgeViewModel {
  label: string
  tone: 'neutral' | 'positive' | 'attention'
}

export interface ProjectBoardMemberRecommendationViewModel {
  id: string
  name: string
  initials: string
  shiftLabel: string
  roleLabel: string
  experienceLabel: string
  priorCompletionCount: number
  continuity: boolean
  traineeFit: boolean
  score: number
  reasons: string[]
  capabilityBadges: ProjectBoardMemberCapabilityBadgeViewModel[]
}

export interface ProjectBoardAssignmentViewModel {
  id: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetName: string
  lwcLabel: string
  shiftLabel: string
  stage: ProjectAssignmentStage
  stageLabel: string
  status: ProjectBoardAssignmentStatus
  statusLabel: string
  requiredRoleLabel: string
  progressPercent: number
  priorityLabel: string
  statusNote: string
  blockedReason?: string
  currentWorkAreaLabel?: string
  currentMemberNames: string[]
  continuityLabel?: string
  traineeAllowed: boolean
  canPlace: boolean
  recommendationReasons: string[]
}

export interface ProjectBoardWorkAreaLoadViewModel {
  state: ProjectBoardWorkAreaLoadState
  label: string
  detail: string
  ratio: number
}

export interface ProjectBoardWorkAreaCardViewModel {
  id: string
  label: string
  stationCode: string
  lwc: ProjectBoardLwcSectionId
  kind: ProjectBoardWorkAreaKind
  kindLabel: string
  capacity: number
  notes: string
  load: ProjectBoardWorkAreaLoadViewModel
  assignedMembers: Array<{
    id: string
    name: string
    initials: string
    roleLabel: string
  }>
  activeAssignments: ProjectBoardAssignmentViewModel[]
  recommendedAssignments: ProjectBoardAssignmentViewModel[]
}

export interface ProjectBoardLwcSectionViewModel {
  id: ProjectBoardLwcSectionId
  label: string
  description: string
  workAreas: ProjectBoardWorkAreaCardViewModel[]
}

export interface ProjectBoardWorkAreaDetailsViewModel {
  workArea: ProjectBoardWorkAreaCardViewModel
  eligibleAssignments: ProjectBoardAssignmentViewModel[]
  recommendedAssignments: ProjectBoardAssignmentViewModel[]
}

export interface ProjectBoardPlacementDrawerViewModel {
  workArea: ProjectBoardWorkAreaCardViewModel
  assignment: ProjectBoardAssignmentViewModel
  eligibleMembers: ProjectBoardMemberRecommendationViewModel[]
  recommendedMembers: ProjectBoardMemberRecommendationViewModel[]
}

export interface D380ProjectBoardViewModel {
  operatingDateLabel: string
  activeShiftLabel: string
  summary: {
    backlogCount: number
    carryoverCount: number
    staffedAreasCount: number
    workAreaCount: number
  }
  backlog: {
    unassigned: ProjectBoardAssignmentViewModel[]
    blocked: ProjectBoardAssignmentViewModel[]
    priorShift: ProjectBoardAssignmentViewModel[]
    recommended: ProjectBoardAssignmentViewModel[]
  }
  sections: ProjectBoardLwcSectionViewModel[]
  selectedWorkArea?: ProjectBoardWorkAreaDetailsViewModel
  selectedPlacement?: ProjectBoardPlacementDrawerViewModel
  emptyState: {
    title: string
    description: string
  }
}
