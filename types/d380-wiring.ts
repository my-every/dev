import type { ShiftOptionId } from '@/types/d380-startup'

export type WiringSectionId =
  | 'WIRING_PREP'
  | 'GROUNDING_INITIAL'
  | 'RELAY_TIMER'
  | 'SMALL_GAUGE'
  | 'DIODES_AC'
  | 'CABLES_COMM'
  | 'FINAL_COMPLETION'
  | 'IPV_FINAL'

export type WiringSectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE'
export type WiringSectionDisplayState = 'current' | 'available' | 'blocked' | 'future' | 'complete'

export type WireConnectionKind = 'SC' | 'W' | 'JC'

export type WireColorId =
  | 'WHT'
  | 'RED'
  | 'BLU'
  | 'GRN'
  | 'GRN_YEL'
  | 'BLK'
  | 'VIO'
  | 'SH'
  | 'CLIP'
  | 'OTHER'

export type WiringGauge = 20 | 16 | 14 | 12 | 10 | 'CABLE' | null
export type WiringRouteHint = 'UNDER_RAIL' | 'OVER_RAIL' | 'PANDUCT' | 'DOOR' | 'BOX' | 'CONSOLE' | 'UNKNOWN'
export type WiringConnectionExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE'

export type WireConnection = {
  id: string
  fromDeviceId: string
  toDeviceId: string
  fromLocation?: string | null
  toLocation?: string | null
  wireNumber: string
  wireId: WireColorId
  gauge: WiringGauge
  connectionKind: WireConnectionKind
  bundleId?: string | null
  harnessId?: string | null
  routeHint?: WiringRouteHint
  isGround?: boolean
  isJumper?: boolean
  isCable?: boolean
  requiresPullTest?: boolean
  requiresPolarityValidation?: boolean
  requiresLabel?: boolean
}

export interface WiringConnectionRecord extends WireConnection {
  status: WiringConnectionExecutionStatus
  blockedReason?: string | null
  terminationNote?: string | null
  validationNote?: string | null
}

export type WiringDeviceRef = {
  deviceId: string
  partNumber?: string | null
  location: string
  mountType: 'PANEL' | 'RAIL' | 'DOOR' | 'BOX' | 'UNKNOWN'
  hasBlueLabel?: boolean
  images?: string[]
}

export type WiringSectionChecklistState = {
  id: string
  label: string
  checked: boolean
}

export type WiringChecklistItemState = WiringSectionChecklistState

export type WiringSectionState = {
  id: WiringSectionId
  title: string
  description: string
  status: WiringSectionStatus
  dependencies: WiringSectionId[]
  completedAt?: string | null
  blockedReason?: string | null
  comments: string[]
  checklist: WiringSectionChecklistState[]
}

export type WiringConnectionPlan = {
  byDevice: Record<string, string[]>
  byBundle: Record<string, string[]>
  byHarness: Record<string, string[]>
  totalConnections: number
}

export type RoutingPlan = {
  panductPaths: string[]
  consoleRoutes: string[]
  underRailConnections: string[]
  overRailConnections: string[]
}

export type TerminationPlan = {
  relayConnections: string[]
  moduleConnections: string[]
  terminalConnections: string[]
  busBarConnections: string[]
  ferruleWarnings: string[]
}

export type ValidationPlan = {
  pullTestConnectionIds: string[]
  polarityValidationIds: string[]
  birdCageInspectionIds: string[]
  stripLengthInspectionIds: string[]
  discrepancyChecks: string[]
}

export type WiringExportReadiness = {
  ready: boolean
  ipvReady: boolean
  missingRequirements: string[]
}

export type WiringStageSnapshot = {
  projectId: string
  sheetName: string
  revision?: string | null
  totalConnections: number
  completedConnections: number
  blockedConnections: number
  sectionStates: WiringSectionState[]
  exportReadiness: WiringExportReadiness
}

export type WiringViewModel = {
  projectId: string
  sheetName: string
  title: string
  sections: WiringSectionState[]
  connectionPlan: WiringConnectionPlan
  routingPlan: RoutingPlan
  terminationPlan: TerminationPlan
  validationPlan: ValidationPlan
  exportReadiness: WiringExportReadiness
  currentActionableSectionId: WiringSectionId | null
}

export interface WiringWorkflowMemberRecord {
  id: string
  name: string
  initials: string
  role: string
  shift: ShiftOptionId
}

export interface WiringSectionRecord {
  id: WiringSectionId
  title: string
  description: string
  note: string
  dependencies: WiringSectionId[]
  initialStatus: WiringSectionStatus
  blockedReason?: string | null
  startedAt?: string
  completedAt?: string
  seedComments?: string[]
  checklist: WiringChecklistItemState[]
}

export interface D380WiringRecord {
  id: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetName: string
  revision: string
  shift: ShiftOptionId
  statusNote: string
  leadSummary: string
  assignedMemberIds: string[]
  members: WiringWorkflowMemberRecord[]
  devices: WiringDeviceRef[]
  connections: WiringConnectionRecord[]
  sections: WiringSectionRecord[]
}

export interface D380WiringDataSet {
  operatingDate: string
  projects: D380WiringRecord[]
}

export interface WiringWorkflowSectionSnapshot {
  status: WiringSectionStatus
  comments: string[]
  checklist: Record<string, boolean>
  startedAt?: string
  completedAt?: string
  blockedReason?: string | null
  previousStatus?: Exclude<WiringSectionStatus, 'BLOCKED'>
}

export interface WiringWorkflowState {
  sections: Record<WiringSectionId, WiringWorkflowSectionSnapshot>
  activeSectionId?: WiringSectionId
  currentActionableSectionId?: WiringSectionId | null
}

export interface WiringHeaderViewModel {
  projectId: string
  pdNumber: string
  projectName: string
  sheetName: string
  revisionLabel: string
  shiftLabel: string
  currentSectionLabel: string
  currentStatusLabel: string
  statusNote: string
  leadSummary: string
}

export interface WiringProgressSummaryViewModel {
  totalSections: number
  completedSections: number
  blockedSections: number
  completionPercent: number
  currentActionableSectionLabel: string
  totalConnections: number
  completedConnections: number
  blockedConnections: number
  exportReady: boolean
  ipvReady: boolean
  exportReadinessLabel: string
  ipvReadinessLabel: string
  exportReadiness: WiringExportReadiness
}

export interface WiringWorkflowController {
  wiring?: D380WiringRecord
  workflowState: WiringWorkflowState
  startSection: (sectionId: WiringSectionId) => void
  resumeSection: (sectionId: WiringSectionId) => void
  completeSection: (sectionId: WiringSectionId) => void
  blockSection: (sectionId: WiringSectionId, reason: string) => void
  setSectionComment: (sectionId: WiringSectionId, value: string) => void
  toggleChecklistItem: (sectionId: WiringSectionId, itemId: string) => void
  getCompletionProgress: () => WiringProgressSummaryViewModel | null
}