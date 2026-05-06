import type { ProjectBoardLwcSectionId, ProjectBoardWorkAreaKind } from '@/types/d380-project-board'
import type { ShiftOptionId } from '@/types/d380-startup'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'

export type AssignmentWorkspaceTabId = 'OVERVIEW' | 'STAGES'

export type AssignmentWorkspaceStageRuntimeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE'
export type AssignmentWorkspaceStageDisplayState = 'current' | 'available' | 'blocked' | 'future' | 'complete'

export interface AssignmentWorkspaceChecklistItemRecord {
  id: string
  label: string
  required: boolean
  completed: boolean
}

export interface AssignmentWorkspaceMemberRecord {
  id: string
  name: string
  initials: string
  role: string
  shift: ShiftOptionId
}

export interface AssignmentWorkspaceStageRecord {
  id: AssignmentStageId
  title: string
  description: string
  note: string
  assignedMemberIds: string[]
  traineeMemberIds: string[]
  estimatedHours: number
  elapsedHours: number
  dependencyStageIds: AssignmentStageId[]
  checklist: AssignmentWorkspaceChecklistItemRecord[]
  initialStatus: AssignmentWorkspaceStageRuntimeStatus
  blockedReason?: string
  startedAt?: string
  completedAt?: string
  seedComment?: string
}

export interface D380AssignmentWorkspaceRecord {
  id: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetName: string
  revision: string
  shift: ShiftOptionId
  lwc: ProjectBoardLwcSectionId
  workstationType: ProjectBoardWorkAreaKind
  workstationLabel: string
  targetDate: string
  estimatedHours: number
  averageHours: number
  statusNote: string
  layoutMatchSummary: string
  blockers: string[]
  assignedMemberIds: string[]
  traineeMemberIds: string[]
  members: AssignmentWorkspaceMemberRecord[]
  stages: AssignmentWorkspaceStageRecord[]
}

export interface D380AssignmentWorkspaceDataSet {
  operatingDate: string
  assignments: D380AssignmentWorkspaceRecord[]
}

export interface AssignmentWorkspaceStageWorkflowSnapshot {
  status: AssignmentWorkspaceStageRuntimeStatus
  comment: string
  startedAt?: string
  completedAt?: string
  blockedReason?: string
  previousStatus?: Exclude<AssignmentWorkspaceStageRuntimeStatus, 'BLOCKED'>
  checklist: Record<string, boolean>
}

export interface AssignmentStageWorkflowState {
  stages: Record<AssignmentStageId, AssignmentWorkspaceStageWorkflowSnapshot>
  activeStageId?: AssignmentStageId
  currentActionableStageId?: AssignmentStageId
  handoffCount: number
  lastHandoffAt?: string
  lastHandoffShift?: ShiftOptionId
}

export interface AssignmentWorkspaceTabViewModel {
  id: AssignmentWorkspaceTabId
  label: string
  badge?: string
}

export interface AssignmentProgressSummaryViewModel {
  completionPercent: number
  completedStagesCount: number
  totalStages: number
  currentStageLabel: string
  nextStageLabel?: string
  elapsedVsEstimatedLabel: string
  blockedCount: number
  handoffSummary: string
}

export interface AssignmentWorkspaceHeaderViewModel {
  assignmentId: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetName: string
  revisionLabel: string
  currentStageLabel: string
  currentStatusLabel: string
  shiftLabel: string
  lwcLabel: string
  workstationTypeLabel: string
  workstationLabel: string
  targetDateLabel: string
  statusNote: string
  handoffSummary: string
}

export interface AssignmentWorkspaceMetricCardViewModel {
  id: string
  label: string
  value: string
  detail: string
  tone: 'neutral' | 'positive' | 'attention'
}

export interface AssignmentWorkspaceOverviewViewModel {
  header: AssignmentWorkspaceHeaderViewModel
  metrics: AssignmentWorkspaceMetricCardViewModel[]
  progressSummary: AssignmentProgressSummaryViewModel
  assignedMembers: AssignmentWorkspaceMemberRecord[]
  traineeMembers: AssignmentWorkspaceMemberRecord[]
  blockers: string[]
  layoutMatchSummary: string
}

export interface AssignmentWorkspaceStageChecklistItemViewModel {
  id: string
  label: string
  required: boolean
  completed: boolean
}

export interface AssignmentWorkspaceStageViewModel {
  id: AssignmentStageId
  title: string
  description: string
  status: AssignmentWorkspaceStageRuntimeStatus
  statusLabel: string
  displayState: AssignmentWorkspaceStageDisplayState
  isActionable: boolean
  assignedMembers: AssignmentWorkspaceMemberRecord[]
  traineeMembers: AssignmentWorkspaceMemberRecord[]
  estimatedHoursLabel: string
  elapsedHoursLabel: string
  dependencySummary: string
  blockedReason?: string
  note: string
  checklist: AssignmentWorkspaceStageChecklistItemViewModel[]
  comment: string
  startedAtLabel?: string
  completedAtLabel?: string
  canStart: boolean
  canComplete: boolean
}

export interface AssignmentWorkspaceStagesViewModel {
  currentActionableStageId?: AssignmentStageId
  progressSummary: AssignmentProgressSummaryViewModel
  stages: AssignmentWorkspaceStageViewModel[]
}

export interface AssignmentWorkspacePlaceholderPanelViewModel {
  id: string
  title: string
  eyebrow: string
  description: string
  actionLabel: string
}

export interface AssignmentWorkspaceRailWidgetMetricViewModel {
  id: string
  label: string
  value: string
}

export interface AssignmentWorkspaceRailWidgetItemViewModel {
  id: string
  label: string
  detail: string
}

export interface AssignmentWorkspaceRailWidgetViewModel {
  id: string
  title: string
  eyebrow: string
  description: string
  actionLabel: string
  actionHref: string
  metrics: AssignmentWorkspaceRailWidgetMetricViewModel[]
  items: AssignmentWorkspaceRailWidgetItemViewModel[]
}

export interface D380AssignmentWorkspaceViewModel {
  found: boolean
  operatingDateLabel: string
  tabs: AssignmentWorkspaceTabViewModel[]
  overview?: AssignmentWorkspaceOverviewViewModel
  stages?: AssignmentWorkspaceStagesViewModel
  railWidgets: AssignmentWorkspaceRailWidgetViewModel[]
  placeholders: AssignmentWorkspacePlaceholderPanelViewModel[]
  emptyState: {
    title: string
    description: string
  }
}

export interface AssignmentStageWorkflowController {
  assignment?: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
  startStage: (stageId: AssignmentStageId) => void
  resumeStage: (stageId: AssignmentStageId) => void
  completeStage: (stageId: AssignmentStageId) => void
  setStageComment: (stageId: AssignmentStageId, comment: string) => void
  toggleChecklistItem: (stageId: AssignmentStageId, checklistItemId: string) => void
  toggleStageBlocked: (stageId: AssignmentStageId) => void
  simulateShiftHandoff: () => void
}
