import type { LayoutGroundPoint, LayoutRail, PanductNode } from '@/lib/wire-length'
import type { ShiftOptionId } from '@/types/d380-startup'
import type { SwsTemplateId } from '@/types/d380-sws'

export type BuildUpWorkflowSectionId =
  | 'PROJECT_VERIFICATION'
  | 'MECHANICAL_SUMMARY'
  | 'RAIL_CUT_LIST'
  | 'PANDUCT_CUT_LIST'
  | 'PANEL_COMPONENTS'
  | 'RAIL_COMPONENTS'
  | 'GROUNDING'
  | 'BLUE_LABELS'
  | 'FINAL_INSPECTION'
  | 'EXPORT_READINESS'

export type BuildUpWorkflowSectionRuntimeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE'
export type BuildUpWorkflowSectionDisplayState = 'current' | 'available' | 'blocked' | 'future' | 'complete'

export type BuildUpRailType = 'STANDARD' | 'LOW_PROFILE' | 'PROFILE'
export type BuildUpRailMountSide = 'LEFT' | 'RIGHT' | 'CENTER' | 'UNKNOWN'
export type BuildUpComponentMountType = 'PANEL' | 'RAIL'
export type BuildUpGroundingKind = 'FRAME_GROUND' | 'RAIL_GROUND' | 'BONDING'
export type BuildUpLabelPlacementFace = 'front' | 'top' | 'side'
export type BuildUpLabelPlacementMode = 'center' | 'before' | 'between'
export type BuildUpLabelTemplateSize = 'small' | 'medium' | 'large'

export interface BuildUpChecklistItemRecord {
  id: string
  label: string
  required: boolean
  completed: boolean
}

export interface BuildUpSectionChecklistState {
  id: string
  label: string
  checked: boolean
}

export interface BuildUpSectionState {
  id: BuildUpWorkflowSectionId
  title: string
  status: BuildUpWorkflowSectionRuntimeStatus
  completedAt?: string | null
  blockedReason?: string | null
  comments: string[]
  checklist: BuildUpSectionChecklistState[]
}

export interface BuildUpExportReadiness {
  ready: boolean
  missingRequirements: string[]
  requiredSectionIds: BuildUpWorkflowSectionId[]
}

export interface BuildUpStageSnapshot {
  projectId: string
  revision?: string | null
  panelName?: string | null
  sections: BuildUpSectionState[]
  mechanicalSummaryReady: boolean
  exportReady: boolean
}

export interface BuildUpWorkflowMemberRecord {
  id: string
  name: string
  initials: string
  role: string
  shift: ShiftOptionId
}

export interface BuildUpProjectVerificationRecord {
  drawingTitle: string
  workingCopyVerified: boolean
  revisionVerified: boolean
  layoutVerified: boolean
  panelIdApplied: boolean
  missingParts: string[]
  leadNotified: boolean
}

export interface BuildUpRailPlanRecord {
  id: string
  label: string
  rail: LayoutRail
  railType: BuildUpRailType
  mountSide: BuildUpRailMountSide
  locationLabel: string
  associatedDeviceIds: string[]
  frameGroundRequired: boolean
  notes: string[]
}

export interface BuildUpPanductPlanRecord {
  id: string
  label: string
  node: PanductNode
  sizeLabel: string
  cutLength: number
  locationLabel: string
  associatedRailIds: string[]
  notes: string[]
}

export interface BuildUpBlueLabelRecord {
  text: string
  placementFace: BuildUpLabelPlacementFace
  placementMode: BuildUpLabelPlacementMode
  templateSize: BuildUpLabelTemplateSize
  visibilityRequired: boolean
  referenceImageLabel?: string
}

export interface BuildUpInstalledComponentRecord {
  id: string
  title: string
  description: string
  partNumber: string
  mountType: BuildUpComponentMountType
  deviceId?: string
  locationLabel: string
  railId?: string
  hardware: string[]
  tools: string[]
  groundCheckRequired: boolean
  installNotes: string[]
  blueLabel?: BuildUpBlueLabelRecord
}

export interface BuildUpGroundingRecord {
  id: string
  label: string
  point: LayoutGroundPoint
  locationLabel: string
  kind: BuildUpGroundingKind
  railId?: string
  hardwareStack: string[]
  paintRemovalRequired: boolean
  note?: string
}

export interface BuildUpMechanicalExtractionRecord {
  sheetLabel: string
  summary: string
  predrilledPanel: boolean
  noDrillZones: string[]
  mountingHoleChecks: string[]
  railPlans: BuildUpRailPlanRecord[]
  panductPlans: BuildUpPanductPlanRecord[]
  grounds: LayoutGroundPoint[]
  oversizedPanelComponents: string[]
  oversizedRailComponents: string[]
}

export interface BuildUpFinalInspectionItemRecord {
  id: string
  label: string
  description: string
}

export interface BuildUpExportRecord {
  id: string
  label: string
  description: string
  destinationLabel: string
  requiredSectionIds: BuildUpWorkflowSectionId[]
  note: string
  lastGeneratedLabel?: string
}

export interface BuildUpWorkflowSectionRecord {
  id: BuildUpWorkflowSectionId
  title: string
  description: string
  note: string
  dependencySectionIds: BuildUpWorkflowSectionId[]
  checklist: BuildUpChecklistItemRecord[]
  initialStatus: BuildUpWorkflowSectionRuntimeStatus
  blockedReason?: string
  startedAt?: string
  completedAt?: string
  seedComment?: string
  progressUpdates?: string[]
}

export interface D380ProjectBuildUpRecord {
  id: string
  projectId: string
  pdNumber: string
  projectName: string
  unit: string
  panelName: string
  revision: string
  drawingTitle: string
  shift: ShiftOptionId
  statusNote: string
  leadSummary: string
  assignedMemberIds: string[]
  members: BuildUpWorkflowMemberRecord[]
  projectVerification: BuildUpProjectVerificationRecord
  mechanicalExtraction: BuildUpMechanicalExtractionRecord
  panelInstalledComponents: BuildUpInstalledComponentRecord[]
  railInstalledComponents: BuildUpInstalledComponentRecord[]
  groundingPlan: BuildUpGroundingRecord[]
  finalInspection: BuildUpFinalInspectionItemRecord[]
  exportRecord: BuildUpExportRecord
  sections: BuildUpWorkflowSectionRecord[]
}

export interface D380BuildUpDataSet {
  operatingDate: string
  projects: D380ProjectBuildUpRecord[]
}

export interface BuildUpWorkflowSectionSnapshot {
  status: BuildUpWorkflowSectionRuntimeStatus
  comment: string
  startedAt?: string
  completedAt?: string
  blockedReason?: string
  previousStatus?: Exclude<BuildUpWorkflowSectionRuntimeStatus, 'BLOCKED'>
  progressUpdates: string[]
  checklist: Record<string, boolean>
}

export interface BuildUpWorkflowState {
  sections: Record<BuildUpWorkflowSectionId, BuildUpWorkflowSectionSnapshot>
  activeSectionId?: BuildUpWorkflowSectionId
  currentActionableSectionId?: BuildUpWorkflowSectionId
}

export interface BuildUpMetricCardViewModel {
  id: string
  label: string
  value: string
  detail: string
  tone: 'neutral' | 'positive' | 'attention'
}

export interface BuildUpHeaderViewModel {
  projectId: string
  pdNumber: string
  projectName: string
  unit: string
  panelName: string
  revisionLabel: string
  drawingTitle: string
  shiftLabel: string
  leadSummary: string
  statusNote: string
  currentSectionLabel: string
  currentStatusLabel: string
}

export interface BuildUpProgressSummaryViewModel {
  completionPercent: number
  completedSectionsCount: number
  totalSections: number
  currentSectionLabel: string
  nextSectionLabel?: string
  blockedCount: number
  exportReadinessLabel: string
  exportReadiness: BuildUpExportReadiness
}

export interface BuildUpSectionStatViewModel {
  id: string
  label: string
  value: string
  detail: string
}

export interface BuildUpSectionItemViewModel {
  id: string
  eyebrow: string
  title: string
  description: string
  chips: string[]
  tone: 'neutral' | 'positive' | 'attention'
}

export interface BuildUpChecklistItemViewModel {
  id: string
  label: string
  required: boolean
  completed: boolean
}

export interface BuildUpSectionViewModel {
  id: BuildUpWorkflowSectionId
  title: string
  description: string
  note: string
  status: BuildUpWorkflowSectionRuntimeStatus
  statusLabel: string
  displayState: BuildUpWorkflowSectionDisplayState
  isActionable: boolean
  dependencySummary: string
  readinessSummary: string
  blockedReason?: string
  checklist: BuildUpChecklistItemViewModel[]
  stats: BuildUpSectionStatViewModel[]
  items: BuildUpSectionItemViewModel[]
  comment: string
  progressUpdates: string[]
  startedAtLabel?: string
  completedAtLabel?: string
  canStart: boolean
  canComplete: boolean
}

/**
 * Schema field type used by the Build Up SWS editor surfaces.
 */
export type BuildUpSwsSchemaFieldType = 'TEXT' | 'TEXTAREA' | 'BOOLEAN' | 'NUMBER' | 'LIST'

/**
 * Generic editable field descriptor for section-level schema metadata.
 */
export interface BuildUpSwsEditableFieldSchema {
  key: string
  label: string
  type: BuildUpSwsSchemaFieldType
  value: string | number | boolean | string[]
  required: boolean
  editable: boolean
  description?: string
}

/**
 * Editable checklist row schema derived from a Build Up section.
 */
export interface BuildUpSwsChecklistItemSchema {
  id: string
  label: string
  required: boolean
  completed: boolean
  editable: boolean
}

/**
 * Editable stat row schema derived from a Build Up section.
 */
export interface BuildUpSwsStatSchema {
  id: string
  label: string
  value: string
  detail: string
  editable: boolean
}

/**
 * Editable item row schema derived from a Build Up section.
 */
export interface BuildUpSwsItemSchema {
  id: string
  eyebrow: string
  title: string
  description: string
  chips: string[]
  tone: 'neutral' | 'positive' | 'attention'
  editable: boolean
}

/**
 * Build Up SWS schema payload for a single section.
 *
 * This schema is generated per project/sheet and can be persisted, edited,
 * and reapplied by interface tooling.
 */
export interface BuildUpSwsSectionSchema {
  schemaVersion: 1
  schemaId: string
  projectId: string
  panelName: string
  templateId: SwsTemplateId
  templateSectionId?: string
  workElementNumber?: number
  sectionId: string
  title: string
  description: string
  status: BuildUpWorkflowSectionRuntimeStatus
  statusLabel: string
  fields: BuildUpSwsEditableFieldSchema[]
  checklist: BuildUpSwsChecklistItemSchema[]
  stats: BuildUpSwsStatSchema[]
  items: BuildUpSwsItemSchema[]
  progressUpdates: string[]
  startedAtLabel?: string
  completedAtLabel?: string
}

export interface D380BuildUpWorkspaceViewModel {
  found: boolean
  operatingDateLabel: string
  header?: BuildUpHeaderViewModel
  progressSummary?: BuildUpProgressSummaryViewModel
  stageSnapshot?: BuildUpStageSnapshot
  metrics: BuildUpMetricCardViewModel[]
  sections: BuildUpSectionViewModel[]
  sectionSchemas: BuildUpSwsSectionSchema[]
  emptyState: {
    title: string
    description: string
  }
}

export interface BuildUpWorkflowController {
  project?: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
  startSection: (sectionId: BuildUpWorkflowSectionId) => void
  resumeSection: (sectionId: BuildUpWorkflowSectionId) => void
  completeSection: (sectionId: BuildUpWorkflowSectionId) => void
  setSectionComment: (sectionId: BuildUpWorkflowSectionId, comment: string) => void
  setSectionBlockedReason: (sectionId: BuildUpWorkflowSectionId, reason: string) => void
  toggleChecklistItem: (sectionId: BuildUpWorkflowSectionId, checklistItemId: string) => void
  toggleSectionBlocked: (sectionId: BuildUpWorkflowSectionId) => void
  addProgressUpdate: (sectionId: BuildUpWorkflowSectionId, update: string) => void
}