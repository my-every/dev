import type { ProjectBoardLwcSectionId } from '@/types/d380-project-board'
import type { ProjectsBoardLifecycleColumnId, ProjectsBoardRiskLevel } from '@/types/d380-projects-board'
import type { ShiftOptionId } from '@/types/d380-startup'
import type { ProjectAssignmentStage, ProjectAssignmentStatus } from '@/types/d380-shared'

export type ProjectWorkspaceTabId =
  | 'OVERVIEW'
  | 'ASSIGNMENTS'
  | 'FILES'
  | 'PROGRESS'
  | 'TEAM_ASSIGNMENTS'
  | 'EXPORTS'

export type ProjectWorkspaceFileCategory = 'LAYOUT' | 'WIRE_LIST' | 'REFERENCE' | 'STATE' | 'EXPORT'
export type ProjectWorkspaceFileStatus = 'ready' | 'watch' | 'missing' | 'staged'
export type ProjectWorkspaceExportStatus = 'ready' | 'watch' | 'not-ready'

export interface ProjectWorkspaceAssignmentRecord {
  id: string
  sheetName: string
  stage: ProjectAssignmentStage
  status: ProjectAssignmentStatus
  assignedMemberIds: string[]
  traineeMemberIds: string[]
  workstationLabel?: string
  lwc: ProjectBoardLwcSectionId
  estimatedHours: number
  averageHours: number
  progressPercent: number
  statusNote: string
  blockedReason?: string
}

export interface ProjectWorkspaceFileRecord {
  id: string
  category: ProjectWorkspaceFileCategory
  label: string
  fileName: string
  revision: string
  status: ProjectWorkspaceFileStatus
  sourceLabel: string
  lastUpdatedLabel: string
  note: string
}

export interface ProjectWorkspaceMemberRecord {
  id: string
  name: string
  initials: string
  role: string
  shift: ShiftOptionId
  workstationLabel: string
  lwc: ProjectBoardLwcSectionId
  assignmentIds: string[]
  continuityMember: boolean
}

export interface ProjectWorkspaceTraineePairingRecord {
  id: string
  leadMemberId: string
  traineeMemberId: string
  assignmentId: string
  note: string
}

export interface ProjectWorkspaceExportRecord {
  id: string
  label: string
  description: string
  status: ProjectWorkspaceExportStatus
  lastGeneratedLabel?: string
  note: string
}

export interface D380ProjectWorkspaceProjectRecord {
  id: string
  pdNumber: string
  name: string
  revision: string
  member: string
  shift: ShiftOptionId
  targetDate: string
  lifecycle: ProjectsBoardLifecycleColumnId
  risk: ProjectsBoardRiskLevel
  lwc: ProjectBoardLwcSectionId
  units: number
  leadSummary: string
  statusNote: string
  assignmentCounts: {
    total: number
    complete: number
    active: number
    blocked: number
  }
  stageSummary: Array<{
    stage: ProjectAssignmentStage
    count: number
  }>
  blockers: string[]
  assignments: ProjectWorkspaceAssignmentRecord[]
  files: ProjectWorkspaceFileRecord[]
  members: ProjectWorkspaceMemberRecord[]
  traineePairings: ProjectWorkspaceTraineePairingRecord[]
  exports: ProjectWorkspaceExportRecord[]
}

export interface D380ProjectWorkspaceDataSet {
  operatingDate: string
  projects: D380ProjectWorkspaceProjectRecord[]
}

export interface ProjectWorkspaceTabViewModel {
  id: ProjectWorkspaceTabId
  label: string
  badge?: string
}

export interface ProjectWorkspaceMetricCardViewModel {
  id: string
  label: string
  value: string
  detail: string
  tone: 'neutral' | 'positive' | 'attention'
}

export interface ProjectWorkspaceHeaderViewModel {
  id: string
  pdNumber: string
  name: string
  revisionLabel: string
  targetDateLabel: string
  lifecycleLabel: string
  risk: ProjectsBoardRiskLevel
  shiftLabel: string
  lwcLabel: string
  member: string
  statusNote: string
  leadSummary: string
}

export interface ProjectWorkspaceStageReadinessCardViewModel {
  id: string
  eyebrow: string
  title: string
  description: string
  completionLabel: string
  exportReadinessLabel: string
  actionLabel: string
  href: string
  theme: 'build-up' | 'wiring'
}

export interface ProjectWorkspaceOverviewViewModel {
  header: ProjectWorkspaceHeaderViewModel
  metrics: ProjectWorkspaceMetricCardViewModel[]
  stageSummary: Array<{
    label: string
    count: number
  }>
  riskIndicators: string[]
  leadShiftSummary: string[]
}

export interface ProjectWorkspaceAssignmentItemViewModel {
  id: string
  projectId: string
  sheetName: string
  stageId: ProjectAssignmentStage
  stageLabel: string
  statusLabel: string
  assignedMemberCount: number
  traineeCount: number
  workstationLabel?: string
  lwcLabel: string
  estimatedHoursLabel: string
  averageHoursLabel: string
  progressPercent: number
  statusNote: string
  blockedReason?: string
  sheetWorkspaceHref: string
  sheetWorkspaceLabel: string
  stageActionLabel?: string
  stageActionHref?: string
}

export interface ProjectWorkspaceAssignmentsViewModel {
  summary: ProjectWorkspaceMetricCardViewModel[]
  assignments: ProjectWorkspaceAssignmentItemViewModel[]
}

export interface ProjectWorkspaceFileCardViewModel {
  id: string
  label: string
  fileName: string
  revision: string
  status: ProjectWorkspaceFileStatus
  sourceLabel: string
  lastUpdatedLabel: string
  note: string
}

export interface ProjectWorkspaceFilesViewModel {
  groups: Array<{
    id: ProjectWorkspaceFileCategory
    label: string
    files: ProjectWorkspaceFileCardViewModel[]
  }>
}

export interface ProjectWorkspaceProgressViewModel {
  completionPercent: number
  completionLabel: string
  stageDistribution: Array<{
    label: string
    count: number
    percent: number
  }>
  assignmentBreakdown: Array<{
    label: string
    count: number
  }>
  blockers: string[]
  timeline: Array<{
    label: string
    status: 'complete' | 'active' | 'queued'
  }>
}

export interface ProjectWorkspaceTeamAssignmentsViewModel {
  summary: ProjectWorkspaceMetricCardViewModel[]
  members: Array<{
    id: string
    name: string
    initials: string
    role: string
    shiftLabel: string
    workstationLabel: string
    lwcLabel: string
    assignmentCount: number
    continuityMember: boolean
  }>
  traineePairings: Array<{
    id: string
    leadName: string
    traineeName: string
    assignmentLabel: string
    note: string
  }>
  continuityOverview: string[]
}

export interface ProjectWorkspaceExportsViewModel {
  archiveReady: boolean
  archiveStatusLabel: string
  records: Array<{
    id: string
    label: string
    description: string
    status: ProjectWorkspaceExportStatus
    lastGeneratedLabel?: string
    note: string
  }>
}

export interface D380ProjectWorkspaceViewModel {
  projectId: string
  found: boolean
  operatingDateLabel: string
  tabs: ProjectWorkspaceTabViewModel[]
  stageReadiness: ProjectWorkspaceStageReadinessCardViewModel[]
  overview?: ProjectWorkspaceOverviewViewModel
  assignments?: ProjectWorkspaceAssignmentsViewModel
  files?: ProjectWorkspaceFilesViewModel
  progress?: ProjectWorkspaceProgressViewModel
  teamAssignments?: ProjectWorkspaceTeamAssignmentsViewModel
  exports?: ProjectWorkspaceExportsViewModel
  emptyState: {
    title: string
    description: string
  }
}
