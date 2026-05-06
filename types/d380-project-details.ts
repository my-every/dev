import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import type { ProjectSheetSummary } from '@/lib/workbook/types'

export type ProjectRevisionMismatchState = 'matched' | 'info' | 'warning' | 'blocking' | 'unknown'

export type ProjectUnitStatus = 'PLANNED' | 'ACTIVE' | 'GREEN_CHANGE' | 'REWORK' | 'COMPLETE'
export type ProjectFeatureAccessSource = 'role' | 'feature-grant' | 'none'
export type ProjectRevisionChangeCategory = 'GREEN_CHANGE' | 'REWORK' | 'CORRECTION' | 'ENGINEERING_UPDATE'
export type ProjectValidationSeverity = 'info' | 'warning' | 'blocker'

export interface ProjectRevisionSourceRecord {
  category: 'WIRE_LIST' | 'LAYOUT'
  fileName?: string
  displayRevision: string
  baseRevision?: string
  modificationNumber?: number
}

export interface ProjectRevisionSetRecord {
  id: string
  projectId: string
  label: string
  displayRevision: string
  baseRevision?: string
  modificationNumber?: number
  mismatchState: ProjectRevisionMismatchState
  selectedBy: 'import' | 'manual' | 'unknown'
  sources: ProjectRevisionSourceRecord[]
  acknowledged: boolean
}

export interface ProjectUnitRecord {
  id: string
  projectId: string
  unitNumber: string
  displayName: string
  status: ProjectUnitStatus
  revisionSetId: string
  currentStageLabel: string
  assignmentCount: number
  mappedAssignmentCount: number
  startedWork: boolean
  greenChangeEligible: boolean
  reworkEligible: boolean
  assignmentMappings: MappedAssignment[]
  pdNumber?: string
  lwcType?: string
  revision?: string
  dueDate?: string
  planConlayDate?: string
  planConassyDate?: string
  createdAt: string
  updatedAt: string
  notes: string[]
}

export interface ProjectFeatureAccessRecord {
  featureKey: string
  enabled: boolean
  source: ProjectFeatureAccessSource
  note: string
}

export interface ProjectFeatureDefinitionRecord {
  featureKey: string
  label: string
  description: string
  defaultRoles: string[]
  assignableBy: string[]
  requiresAuditLog: boolean
  enabled: boolean
  scope: 'global' | 'project' | 'unit' | 'assignment'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  notes?: string
}

export interface ProjectRevisionDeltaRecord {
  id: string
  projectId: string
  unitId: string
  previousRevisionSetId: string
  nextRevisionSetId: string
  category: ProjectRevisionChangeCategory
  reason: string
  createdAt: string
  addedRows: number
  removedRows: number
  changedRows: number
  summary: string
}

export interface ProjectValidationFindingRecord {
  id: string
  projectId: string
  unitId: string
  ruleId: string
  category: string
  severity: ProjectValidationSeverity
  title: string
  message: string
  stageImpact: string
  requiresAcknowledgement: boolean
  overridable: boolean
  acknowledged: boolean
  suggestedAction: string
}

export interface ProjectGreenChangeSummaryRecord {
  enabled: boolean
  hasRevisionDeltaHistory: boolean
  statusNote: string
  plannedCapabilities: string[]
}

export interface ProjectDetailsRecord {
  id: string
  pdNumber: string
  name: string
  unitCount: number
  currentUnitId: string
  createdAtLabel: string
  totalSheetCount: number
  totalRowCount: number
  assignmentSheets: ProjectSheetSummary[]
  units: ProjectUnitRecord[]
  revisionSets: ProjectRevisionSetRecord[]
  revisionDeltas: ProjectRevisionDeltaRecord[]
  featureAccess: ProjectFeatureAccessRecord[]
  featureCatalog: ProjectFeatureDefinitionRecord[]
  validationFindings: ProjectValidationFindingRecord[]
  greenChange: ProjectGreenChangeSummaryRecord
  migrationNotes: string[]
}