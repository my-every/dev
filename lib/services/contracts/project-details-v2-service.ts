import type { ServiceResult } from './index'
import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import type {
  ProjectDetailsRecord,
  ProjectFeatureDefinitionRecord,
  ProjectRevisionChangeCategory,
  ProjectRevisionDeltaRecord,
  ProjectRevisionSetRecord,
  ProjectUnitRecord,
  ProjectValidationFindingRecord,
} from '@/types/d380-project-details'
import type { UserRole } from '@/types/d380-user-session'

export interface CreateProjectUnitInput {
  unitNumber?: string
  displayName?: string
  pdNumber?: string
  lwcType?: string
  revision?: string
  dueDate?: string
  planConlayDate?: string
  planConassyDate?: string
}

export interface UpdateProjectUnitRevisionInput {
  revisionSetId: string
  changeCategory: ProjectRevisionChangeCategory
  reason: string
}

export interface UpdateProjectUnitAssignmentMappingsInput {
  mappings: MappedAssignment[]
}

export interface ProjectDetailsV2Actor {
  badge: string
  name: string
  role: UserRole
}

export interface ProjectDetailsV2DataPayload {
  id: string
  pdNumber: string
  name: string
  unitCount: number
  currentUnitId: string
  createdAtLabel: string
  totalSheetCount: number
  totalRowCount: number
  assignmentSheets: ProjectDetailsRecord['assignmentSheets']
  units: ProjectUnitRecord[]
  revisionSets: ProjectRevisionSetRecord[]
  revisionDeltas: ProjectRevisionDeltaRecord[]
  featureCatalog: ProjectFeatureDefinitionRecord[]
  validationFindings: ProjectValidationFindingRecord[]
  greenChange: ProjectDetailsRecord['greenChange']
  migrationNotes: string[]
}

export type ProjectDetailsV2MutationRequest =
  | {
      action: 'create-unit'
      actor: ProjectDetailsV2Actor
      input?: CreateProjectUnitInput
    }
  | {
      action: 'switch-unit'
      unitId: string
    }
  | {
      action: 'update-unit-revision'
      actor: ProjectDetailsV2Actor
      unitId: string
      input: UpdateProjectUnitRevisionInput
    }
  | {
      action: 'acknowledge-validation'
      actor: ProjectDetailsV2Actor
      unitId: string
      findingId: string
    }
  | {
      action: 'update-unit-assignment-mappings'
      actor: ProjectDetailsV2Actor
      unitId: string
      input: UpdateProjectUnitAssignmentMappingsInput
    }

export interface IProjectDetailsV2Service {
  getProjectDetails(projectId: string): Promise<ServiceResult<ProjectDetailsRecord | null>>
  getRevisionSets(projectId: string): Promise<ServiceResult<ProjectRevisionSetRecord[]>>
  createUnit(projectId: string, input?: CreateProjectUnitInput): Promise<ServiceResult<ProjectUnitRecord>>
  switchUnit(projectId: string, unitId: string): Promise<ServiceResult<ProjectDetailsRecord | null>>
  updateUnitRevision(projectId: string, unitId: string, input: UpdateProjectUnitRevisionInput): Promise<ServiceResult<ProjectDetailsRecord | null>>
  updateUnitAssignmentMappings(projectId: string, unitId: string, input: UpdateProjectUnitAssignmentMappingsInput): Promise<ServiceResult<ProjectDetailsRecord | null>>
  getRevisionDeltas(projectId: string, unitId: string): Promise<ServiceResult<ProjectRevisionDeltaRecord[]>>
  getValidationFindings(projectId: string, unitId: string): Promise<ServiceResult<ProjectValidationFindingRecord[]>>
  acknowledgeValidationFinding(projectId: string, unitId: string, findingId: string): Promise<ServiceResult<ProjectValidationFindingRecord | null>>
}