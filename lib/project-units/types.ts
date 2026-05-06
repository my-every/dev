export type ProjectUnitVisualState = 'closed' | 'open' | 'hanged'

export type ProjectUnitStatus = 'draft' | 'ready' | 'in_progress' | 'complete'

export type ProjectUnitWorkType =
  | 'build-up'
  | 'wire'
  | 'cross-wire'
  | 'branding'

export type ProjectUnitRole =
  | 'box'
  | 'panel'
  | 'rail'
  | 'component'
  | 'cross-wire'

export type ProjectUnitSource = 'detected' | 'manual'

export type ProjectUnitIconMatchLevel = 'exact' | 'family' | 'generic'

export interface ProjectUnitReadiness {
  buildUp: boolean
  wire: boolean
  boxBuild: boolean
  hang: boolean
  crossWire: boolean
  brandingMeasure: boolean
}

export interface SheetUnitBinding {
  unitId?: string
  workType?: ProjectUnitWorkType
  roleInUnit?: ProjectUnitRole
}

export interface ProjectUnitIconDescriptor {
  iconPath: string
  unitType: string
  lwc: string
  state: ProjectUnitVisualState
  doors: number
  matchLevel: ProjectUnitIconMatchLevel
}

export interface ProjectUnit {
  id: string
  unitType: string
  label: string
  lwc?: string
  doorCount?: number
  visualState?: ProjectUnitVisualState
  layoutPageNumbers: number[]
  sheetSlugs: string[]
  sheetBindings?: Record<string, SheetUnitBinding>
  primaryBoxSheetSlug?: string
  status: ProjectUnitStatus
  readiness: ProjectUnitReadiness
  buildSequence: string[]
  icon?: ProjectUnitIconDescriptor
  source?: ProjectUnitSource
}

export interface ProjectUnitsDocument {
  projectId: string
  updatedAt: string
  units: ProjectUnit[]
}

export interface ProjectUnitDetectionSummary {
  unmatchedSheetSlugs: string[]
  unmatchedPageNumbers: number[]
}

export interface ProjectUnitsPayload {
  document: ProjectUnitsDocument
  source: 'persisted' | 'detected'
  summary: ProjectUnitDetectionSummary
}
