import type { FloorArea } from '@/types/floor-layout'
import type { ShiftId } from '@/types/shifts'
import type { ManifestAssignment } from '@/types/project-manifest'
import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import type { AssignmentStageRole } from '@/lib/board/stage-workspaces'
import type { UserCompetencyProfile, CompetencyQualification, CompetencyReadiness, CompetencyConfidence } from '@/lib/users/competency'

export type BoardAssignmentSource = 'station' | 'queue' | 'card' | 'timeline'

export type BoardWorkflowStatus = 'pending' | 'scheduled' | 'in-progress' | 'completed'

export interface BoardAssignmentView {
  assignmentId: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetSlug: string
  sheetName: string
  stage: AssignmentStage
  stageRole: AssignmentStageRole
  stageRoleLabel: string
  status: ManifestAssignment['status']
  partNumbers: string[]
  estimatedMinutes: number
  assignedBadge: string | null
  assignedAt: string | null
  workspaceHref: string | null
  workAreaId: string | null
  workAreaLabel: string | null
  floorArea: FloorArea | null
  shiftId: ShiftId | null
  scheduledDate: string | null
  startTime: string | null
  endTime: string | null
  queueIndex: number | null
  assignmentGroupId: string | null
  source: BoardAssignmentSource | null
  operationCode: string | null
  workflowStatus: BoardWorkflowStatus
  actualStartTime: string | null
  actualEndTime: string | null
  activeOperationEntryId: string | null
}

export interface BoardProjectView {
  id: string
  pdNumber: string
  name: string
  lwcType: string
  unitNumber: string
  status: string
  assignments: BoardAssignmentView[]
}

export interface BoardActiveAssignmentSummary {
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetName: string
  sheetSlug: string
  stage: AssignmentStage
  stageRole: AssignmentStageRole
  stageRoleLabel: string
  workspaceHref: string
  partNumbers: string[]
  assignedAt: string
  assignedByBadge: string
  actualStartTime?: string | null
  actualEndTime?: string | null
}

export interface BoardMemberCompetencyLedger {
  version: 1
  stageCounts: Partial<Record<AssignmentStageRole, number>>
  stagePartNumberCounts: Partial<Record<AssignmentStageRole, Record<string, number>>>
  latestAssignments: BoardActiveAssignmentSummary[]
  updatedAt: string
}

export interface BoardMemberView {
  badge: string
  fullName: string
  preferredName: string | null
  initials: string | null
  role: string
  shift: string
  primaryLwc: string
  yearsExperience: number
  skills: Record<string, number>
  activeAssignments: BoardActiveAssignmentSummary[]
  assignmentCompetency: BoardMemberCompetencyLedger | null
  competencyProfile: UserCompetencyProfile | null
  availabilityStatus: 'OFF_SHIFT' | 'AVAILABLE' | 'ON_ASSIGNMENT'
  availabilityShiftId: ShiftId | null
  availabilityUpdatedAt: string | null
  availabilityClockedInAt: string | null
  availabilityClockedOutAt: string | null
  activeAssignmentId: string | null
}

export interface BoardDataResponse {
  projects: BoardProjectView[]
  members: BoardMemberView[]
  summary: {
    projectCount: number
    assignmentCount: number
    assignedCount: number
    memberCount: number
  }
}

export interface BoardAssignmentSelectionInput {
  assignmentId: string
  workAreaId?: string | null
  startTime?: string | null
  endTime?: string | null
  queueIndex?: number | null
  operationCode?: string | null
}

export interface BoardCandidateView {
  badge: string
  fullName: string
  preferredName: string | null
  initials: string | null
  role: string
  shift: string
  primaryLwc: string
  availabilityStatus: BoardMemberView['availabilityStatus']
  availabilityShiftId: BoardMemberView['availabilityShiftId']
  yearsExperience: number
  stageSkillScore: number
  stageSkillSummary: string[]
  partNumberMatchCount: number
  matchedPartNumbers: string[]
  readiness: CompetencyReadiness
  readinessReasons: string[]
  qualification: CompetencyQualification
  stageAssignmentCount: number
  matchedPartExperienceCount: number
  maxPartConfidence: CompetencyConfidence | null
  assignedTrainingCount: number
  completedTrainingCount: number
  requiredTrainingCount: number
  incompleteRequiredTrainingCount: number
  activeAssignmentsCount: number
  activeAssignments: BoardActiveAssignmentSummary[]
  score: number
  isRecommended: boolean
}
