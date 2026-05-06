import type {
  CreateProjectUnitInput,
  IProjectDetailsV2Service,
  UpdateProjectUnitAssignmentMappingsInput,
  UpdateProjectUnitRevisionInput,
} from '@/lib/services/contracts/project-details-v2-service'
import type { ServiceResult } from '@/lib/services/contracts'
import type {
  ProjectDetailsRecord,
  ProjectRevisionDeltaRecord,
  ProjectRevisionSetRecord,
  ProjectUnitRecord,
  ProjectValidationFindingRecord,
} from '@/types/d380-project-details'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function defaultUnit(projectId: string, input?: CreateProjectUnitInput): ProjectUnitRecord {
  const now = new Date().toISOString()
  return {
    id: `unit-${Date.now()}`,
    projectId,
    unitNumber: input?.unitNumber ?? '01',
    displayName: input?.displayName ?? 'Unit 01',
    status: 'PLANNED',
    revisionSetId: 'rev-default',
    currentStageLabel: 'Ready',
    assignmentCount: 0,
    mappedAssignmentCount: 0,
    startedWork: false,
    greenChangeEligible: false,
    reworkEligible: false,
    assignmentMappings: [],
    pdNumber: input?.pdNumber,
    lwcType: input?.lwcType,
    revision: input?.revision,
    dueDate: input?.dueDate,
    planConlayDate: input?.planConlayDate,
    planConassyDate: input?.planConassyDate,
    createdAt: now,
    updatedAt: now,
    notes: [],
  }
}

export class ProjectDetailsV2ServiceImpl implements IProjectDetailsV2Service {
  constructor(_deps?: { session?: unknown }) {}

  async getProjectDetails(_projectId: string): Promise<ServiceResult<ProjectDetailsRecord | null>> {
    return ok(null)
  }

  async getRevisionSets(_projectId: string): Promise<ServiceResult<ProjectRevisionSetRecord[]>> {
    return ok([])
  }

  async createUnit(projectId: string, input?: CreateProjectUnitInput): Promise<ServiceResult<ProjectUnitRecord>> {
    return ok(defaultUnit(projectId, input))
  }

  async switchUnit(_projectId: string, _unitId: string): Promise<ServiceResult<ProjectDetailsRecord | null>> {
    return ok(null)
  }

  async updateUnitRevision(
    _projectId: string,
    _unitId: string,
    _input: UpdateProjectUnitRevisionInput
  ): Promise<ServiceResult<ProjectDetailsRecord | null>> {
    return ok(null)
  }

  async updateUnitAssignmentMappings(
    _projectId: string,
    _unitId: string,
    _input: UpdateProjectUnitAssignmentMappingsInput
  ): Promise<ServiceResult<ProjectDetailsRecord | null>> {
    return ok(null)
  }

  async getRevisionDeltas(_projectId: string, _unitId: string): Promise<ServiceResult<ProjectRevisionDeltaRecord[]>> {
    return ok([])
  }

  async getValidationFindings(
    _projectId: string,
    _unitId: string
  ): Promise<ServiceResult<ProjectValidationFindingRecord[]>> {
    return ok([])
  }

  async acknowledgeValidationFinding(
    _projectId: string,
    _unitId: string,
    _findingId: string
  ): Promise<ServiceResult<ProjectValidationFindingRecord | null>> {
    return ok(null)
  }
}
