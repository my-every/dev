/**
 * Canonical project manifest types used by project state, planning, board, and workspace UIs.
 */

import type { LwcType, ProjectStatus } from '@/lib/workbook/types'
import type { FloorArea } from '@/types/floor-layout'
import type {
  AssignmentStageHours,
  AssignmentStageId,
  AssignmentStageState,
  ProjectLifecycleGateState,
  SwsTypeId,
} from './d380-assignment-stages'

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low'

export interface PriorityScore {
  score: number
  level: PriorityLevel
  remainingMinutes: number
  deadlineMultiplier: number
  stageWeight: number
  reason: string
}

export interface PriorityConfig {
  criticalThreshold: number
  highThreshold: number
  mediumThreshold: number
  deadlineMultipliers: {
    overdue: number
    critical: number
    high: number
    medium: number
    low: number
  }
  stageCategoryWeights: {
    queue: number
    build: number
    verify: number
    test: number
    final: number
  }
}

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  criticalThreshold: 60,
  highThreshold: 240,
  mediumThreshold: 480,
  deadlineMultipliers: {
    overdue: 3.0,
    critical: 2.5,
    high: 2.0,
    medium: 1.5,
    low: 1.0,
  },
  stageCategoryWeights: {
    queue: 1.2,
    build: 1.0,
    verify: 0.9,
    test: 1.1,
    final: 1.3,
  },
}

export type ManifestAssignmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'BLOCKED'
  | 'COMPLETE'
  | 'COMPLETED'
  | 'GREEN_CHANGE'

export interface ManifestBoardAssignmentMeta {
  assignmentId: string
  estimatedMinutes?: number
  assignedBadge?: string | null
  assignedAt?: string | null
  workAreaId?: string | null
  workAreaLabel?: string | null
  floorArea?: FloorArea | string | null
  shiftId?: '1st' | '2nd' | null
  scheduledDate?: string | null
  startTime?: string | null
  endTime?: string | null
  queueIndex?: number | null
  assignmentGroupId?: string | null
  source?: 'station' | 'queue' | 'card' | 'timeline' | null
  operationCode?: string | null
  workflowStatus?: 'pending' | 'scheduled' | 'in-progress' | 'completed'
  actualStartTime?: string | null
  actualEndTime?: string | null
  activeOperationEntryId?: string | null
}

export interface ManifestAssignmentFiles {
  wireListSchemaPath?: string
  brandListSchemaPath?: string
  buildUpSWSSchemaPath?: string
  wireListPDFPath?: string
  brandListExcelPath?: string
}

export interface ManifestAssignmentTimeEstimates {
  buildUpEstTime: string
  wireListEstTime: string
  totalEstimatedMinutes: number
  remainingEstimatedMinutes: number
  actualMinutesWorked: number
}

export interface ProjectManifestSheet {
  slug: string
  name: string
  kind: 'operational' | 'reference' | 'unknown'
  sheetPath?: string
  rowCount: number
  columnCount?: number
  sheetIndex?: number
  hasData?: boolean
}

export type ManifestSheetEntry = ProjectManifestSheet

export interface ManifestSheetBase {
  sheetSlug: string
  sheetName: string
  kind: 'operational' | 'reference'
  sheetPath?: string
  rowCount: number
  columnCount?: number
  sheetIndex?: number
  hasData?: boolean
}

export interface ManifestReferenceSheet extends ManifestSheetBase {
  kind: 'reference'
}

export type LayoutMatchMethod = 'device-id' | 'title' | 'fallback'

export interface ManifestLayoutPageMatch {
  pageNumber: number
  title: string
  normalizedTitle?: string
  unitType?: string
  panelNumber?: string | null
  boxNumber?: string | null
  confidence: 'high' | 'medium' | 'low' | 'unmatched'
  matchMethod: LayoutMatchMethod
  score: number
}

export interface ManifestLayoutMatch {
  primaryPage?: ManifestLayoutPageMatch
  pages: ManifestLayoutPageMatch[]
  unmappedReason?: string
}

export interface ManifestDeviceEntry {
  partNumber: string
  description: string
  category?: string
  sheet: string
}

export interface ManifestAssignment extends ManifestSheetBase {
  kind: 'operational'
  swsType: SwsTypeId | 'PANEL' | 'BOX' | 'RAIL' | 'BLANK' | string
  /** Box side resolved from the UBP cross-project reference (e.g. centerBackSide, leftDoor) */
  boxSide?: string
  stage: AssignmentStageId
  status: ManifestAssignmentStatus
  unitType?: string
  /** Normalized title of the matched primary layout page, promoted from layout.primaryPage.normalizedTitle */
  normalizedTitle?: string
  /** Panel number of the matched primary layout page, promoted from layout.primaryPage.panelNumber */
  panelNumber?: string | null
  /** Box number of the matched primary layout page, promoted from layout.primaryPage.boxNumber */
  boxNumber?: string | null
  /** Priority level shortcut, promoted from priority.level — avoids null-chaining on every filter/sort */
  priorityLevel?: PriorityLevel
  /** Assigned badge shortcut, promoted from boardAssignment.assignedBadge */
  assignedBadge?: string | null
  /** Board workflow status shortcut, promoted from boardAssignment.workflowStatus */
  workflowStatus?: string | null
  buildUpEstTime?: string
  wireListEstTime?: string
  totalEstimatedMinutes?: number
  remainingMinutes?: number
  actualMinutes?: number
  linkedOperationCode?: string | null
  defaultOperationCodeByStage?: Partial<Record<AssignmentStageId, string | null>>
  priority?: PriorityScore
  stageStates?: AssignmentStageState[]
  completedStages?: AssignmentStageId[]
  progress?: number
  deadline?: string
  targetDate?: string
  files: ManifestAssignmentFiles
  partNumbers: string[]
  layout: ManifestLayoutMatch | null
  devices: Record<string, ManifestDeviceEntry>
  panducts: string[]
  rails: string[]
  /** Per-location visibility config for print output; backfilled from UBP reference. */
  externalLocations?: import('@/lib/layout-matching/ubp-reference-index').ExternalLocationConfig[]
  /** 
   * Pre-computed default visibility settings based on boxSide installation order logic.
   * Maps location key (uppercase) to { wireListVisible, brandingVisible, crossWireVisible }.
   * Used as initial state when loading the matrix - actual settings in externalLocations may override.
   */
  visibilityDefaults?: Record<string, {
    wireListVisible: boolean
    brandingVisible: boolean
    crossWireVisible: boolean
  }>
  whiteLabels: string[]
  blueLabels: string[]
  boardAssignment?: ManifestBoardAssignmentMeta
}

export type ManifestAssignmentNode = ManifestAssignment

export interface ProjectManifestAggregates {
  totalAssignments: number
  completedAssignments: number
  inProgressAssignments: number
  blockedAssignments: number
  totalEstimatedMinutes: number
  totalRemainingMinutes: number
  totalActualMinutes: number
  overallProgress: number
  highestPriority: PriorityLevel
  priorityCounts: Record<PriorityLevel, number>
  stageCounts: Partial<Record<AssignmentStageId, number>>
}

export interface ProjectScheduleManifestMetadata {
  source: 'SLOTS.json'
  slotKey: string
  pdNumber: string
  projectName: string
  displayName: string
  unitNumber: string
  lwcType: FloorArea | string
  color?: string
  dueDate: string
  dueMonth: string | null
  planConlayDate: string
  planConassyDate: string
  shipDate: string
  deptTargetDate: string
  daysLate: number | null
  estimatedTotalHours: number | null
  estimatedPanelCount: number | null
  estimatedSampleCount: number | null
  unitType: string
  projectType: string
  controlsSlot: string
  pmName: string
  cmpName: string
  coordinatorName: string
  needDate: string
  milestones: {
    legals: string
    brandList: string
    brandWire: string
    projKitted: string
    conlay: string
    conassy: string
    pwrchk: string
    d380FinalBiq: string
    dept380Target: string
  }
}

export interface ManifestLayoutSummary {
  totalPages: number
  panelNames: string[]
  sourceFile?: string
}

export interface ProjectManifest {
  id: string
  name: string
  filename: string
  pdNumber: string
  unitNumber: string
  revision: string
  lwcType: FloorArea | LwcType | string
  color: string
  unitType: string
  unitTypes: string[]
  createdAt: string
  dueDate: string
  planConlayDate: string
  planConassyDate: string
  shipDate?: string
  deptTargetDate?: string
  sheets: ProjectManifestSheet[]
  assignments: Record<string, ManifestAssignment>
  /** Project-level flattened white labels for full-sheet exports/imports. */
  whiteLabels?: string[]
  /** Project-level flattened blue labels for full-sheet exports/imports. */
  blueLabels?: string[]
  /** Cross-reference payload for both assignment-level and project-level label access. */
  brandingLabelReference?: {
    byAssignment: Record<
      string,
      {
        assignmentName: string
        whiteLabels: string[]
        blueLabels: string[]
      }
    >
    whiteLabels: string[]
    blueLabels: string[]
    joinHints?: {
      sourceSheets: string[]
      matchingStrategy: string
      generatedAt: string
    }
  }
  assignmentsByUnitType?: Record<string, string[]>
  referenceSheets: Record<string, ManifestReferenceSheet>
  layoutSummary?: ManifestLayoutSummary
  lifecycleGates?: ProjectLifecycleGateState[]
  status?: ProjectStatus
  aggregates?: ProjectManifestAggregates
  panducts: number
  rails: number
  activeWorkbookRevisionId?: string | null
  activeLayoutRevisionId?: string | null
  estimatedTotalHours?: number | null
  estimatedPanelCount?: number | null
  estimatedSampleCount?: number | null
  daysLate?: number | null
  scheduleMetadata?: ProjectScheduleManifestMetadata
}

export interface ManifestCollectionFilters {
  lwcTypes?: FloorArea[]
  priorityLevels?: PriorityLevel[]
  stages?: AssignmentStageId[]
  statuses?: ManifestAssignmentStatus[]
  unitTypes?: string[]
  searchQuery?: string
}

export interface ManifestCollectionSort {
  field: 'priority' | 'remainingTime' | 'deadline' | 'progress' | 'name' | 'dueDate'
  direction: 'asc' | 'desc'
}

export interface ManifestCollection {
  manifests: ProjectManifest[]
  filters: ManifestCollectionFilters
  sort: ManifestCollectionSort
  lastUpdated: string
}

export interface FlattenedAssignment {
  assignment: ManifestAssignment
  project: {
    id: string
    name: string
    pdNumber: string
    color: string
    dueDate: string
    lwcType: FloorArea | LwcType | string
  }
  priority: PriorityScore
  effectiveDeadline: string
}

export interface TimelineAssignmentBridge {
  toTimeline: (
    manifestAssignment: ManifestAssignment,
    project: ProjectManifest,
    stationId: string,
    startTime: string,
  ) => {
    id: string
    projectId: string
    projectName: string
    resourceId: string
    startTime: string
    endTime: string
    estimatedMinutes: number
    actualMinutes: number
    status: 'scheduled' | 'in-progress' | 'completed'
    priority: 'low' | 'medium' | 'high'
    color: string
  }
  fromTimeline: (
    timelineAssignment: {
      id: string
      startTime: string
      endTime: string
      status: string
    },
    currentManifest: ManifestAssignment,
  ) => Partial<ManifestAssignment>
}
