import type {
  D380ProjectBoardDataSet,
  D380ProjectBoardViewModel,
  ProjectBoardAssignmentRecord,
  ProjectBoardAssignmentStatus,
  ProjectBoardAssignmentViewModel,
  ProjectBoardLwcSectionId,
  ProjectBoardLwcSectionViewModel,
  ProjectBoardMemberRecommendationViewModel,
  ProjectBoardMemberRecord,
  ProjectBoardPlacementSelection,
  ProjectBoardWorkAreaCardViewModel,
  ProjectBoardWorkAreaLoadState,
  ProjectBoardWorkAreaLoadViewModel,
  ProjectBoardWorkAreaRecord,
} from '@/types/d380-project-board'
import type { ProjectAssignmentStage } from '@/types/d380-shared'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const lwcDescriptions: Record<ProjectBoardLwcSectionId, string> = {
  ONSKID: 'Primary skid floor with dedicated build-up, wiring, and test flow.',
  OFFSKID: 'Secondary skid floor balancing conlay recovery and test handoffs.',
  'NEW/FLEX': 'Flexible lanes for overflow, NTB handling, and continuity saves.',
  OFFICE: 'Coordination and BIQ handoff surface for release-ready paperwork.',
}

const workAreaKindLabels = {
  BUILDUP_TABLE: 'Build-Up Table',
  WIRING_TABLE: 'Wiring Table',
  TEST_STATION: 'Test Station',
  FLOAT: 'Float Cell',
  NTB: 'NTB Bench',
  OFFICE_AREA: 'Office Area',
} as const

const memberRoleLabels = {
  BUILDUP: 'Build-Up',
  WIRING: 'Wiring',
  TEST: 'Test',
  FLOAT_LEAD: 'Float Lead',
  NTB_SPECIALIST: 'NTB Specialist',
  OFFICE_COORDINATOR: 'Office Coordinator',
} as const

const buildUpStages = ['READY_TO_LAY', 'BUILD_UP', 'READY_FOR_VISUAL', 'BOX_BUILD'] as const satisfies readonly ProjectAssignmentStage[]
const wiringStages = ['READY_TO_WIRE', 'WIRING', 'WIRING_IPV', 'READY_TO_HANG', 'CROSS_WIRE', 'CROSS_WIRE_IPV'] as const satisfies readonly ProjectAssignmentStage[]
const testStages = ['READY_TO_TEST', 'TEST_1ST_PASS', 'POWER_CHECK', 'READY_FOR_BIQ', 'BIQ', 'FINISHED_BIQ'] as const satisfies readonly ProjectAssignmentStage[]

function isBuildUpStage(stage: ProjectAssignmentStage) {
  return (buildUpStages as readonly ProjectAssignmentStage[]).includes(stage)
}

function isWiringStage(stage: ProjectAssignmentStage) {
  return (wiringStages as readonly ProjectAssignmentStage[]).includes(stage)
}

function isTestStage(stage: ProjectAssignmentStage) {
  return (testStages as readonly ProjectAssignmentStage[]).includes(stage)
}

const stageLabels: Record<ProjectAssignmentStage, string> = {
  READY_TO_LAY: 'Ready To Lay',
  BUILD_UP: 'Build Up',
  READY_TO_WIRE: 'Ready To Wire',
  READY_FOR_VISUAL: 'Ready for Review',
  BOX_BUILD: 'Box Build',
  WIRING: 'Wiring',
  WIRING_IPV: 'Wire Review',
  READY_TO_HANG: 'Ready for Box Build',
  CROSS_WIRE: 'Cross Wire',
  CROSS_WIRE_IPV: 'Cross Wire Review',
  READY_TO_TEST: 'Ready To Test',
  TEST_1ST_PASS: 'Test Review',
  POWER_CHECK: 'Power Check',
  READY_FOR_BIQ: 'Ready For BIQ',
  BIQ: 'BIQ',
  FINISHED_BIQ: 'BIQ Complete',
}

const statusLabels: Record<ProjectBoardAssignmentStatus, string> = {
  UNASSIGNED: 'Unassigned',
  BLOCKED: 'Blocked',
  IN_PROGRESS: 'In Progress',
  ASSIGNED: 'Assigned',
  COMPLETE: 'Complete',
}

function getShiftLabel(shift: D380ProjectBoardDataSet['activeShift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function getPriorityLabel(priority: ProjectBoardAssignmentRecord['priority']) {
  return `P${priority}`
}

function getStageRole(stage: ProjectAssignmentStage) {
  if (isBuildUpStage(stage)) {
    return 'BUILDUP' as const
  }

  if (isWiringStage(stage)) {
    return 'WIRING' as const
  }

  return 'TEST' as const
}

function getAssignmentsById(assignments: ProjectBoardAssignmentRecord[]) {
  return new Map(assignments.map(assignment => [assignment.id, assignment]))
}

function memberMatchesRole(member: ProjectBoardMemberRecord, requiredRole: ProjectBoardAssignmentRecord['requiredRole']) {
  return member.primaryRole === requiredRole || member.secondaryRoles.includes(requiredRole)
}

function memberCanWorkArea(member: ProjectBoardMemberRecord, workArea: ProjectBoardWorkAreaRecord) {
  return member.workstationKinds.includes(workArea.kind)
}

function toAssignmentViewModel(
  assignment: ProjectBoardAssignmentRecord,
  dataSet: D380ProjectBoardDataSet,
  canPlace = true,
  recommendationReasons: string[] = [],
): ProjectBoardAssignmentViewModel {
  const currentWorkArea = assignment.currentWorkAreaId
    ? dataSet.workAreas.find(workArea => workArea.id === assignment.currentWorkAreaId)
    : undefined

  const currentMemberNames = assignment.currentMemberIds
    .map(memberId => dataSet.members.find(member => member.id === memberId)?.name)
    .filter((value): value is string => Boolean(value))

  return {
    id: assignment.id,
    projectId: assignment.projectId,
    pdNumber: assignment.pdNumber,
    projectName: assignment.projectName,
    sheetName: assignment.sheetName,
    lwcLabel: assignment.lwc,
    shiftLabel: getShiftLabel(assignment.shift),
    stage: assignment.stage,
    stageLabel: stageLabels[assignment.stage],
    status: assignment.status,
    statusLabel: statusLabels[assignment.status],
    requiredRoleLabel: memberRoleLabels[assignment.requiredRole],
    progressPercent: assignment.progressPercent,
    priorityLabel: getPriorityLabel(assignment.priority),
    statusNote: assignment.statusNote,
    blockedReason: assignment.blockedReason,
    currentWorkAreaLabel: currentWorkArea?.label,
    currentMemberNames,
    continuityLabel: assignment.continuityMemberIds.length > 0 ? `${assignment.continuityMemberIds.length} continuity match${assignment.continuityMemberIds.length > 1 ? 'es' : ''}` : undefined,
    traineeAllowed: assignment.traineeAllowed,
    canPlace,
    recommendationReasons,
  }
}

export function canPlaceAssignmentInWorkArea({
  assignment,
  workArea,
  allAssignments,
}: {
  assignment: ProjectBoardAssignmentRecord
  workArea: ProjectBoardWorkAreaRecord
  allAssignments: ProjectBoardAssignmentRecord[]
}) {
  if (assignment.status === 'COMPLETE' || assignment.status === 'BLOCKED') {
    return false
  }

  const lwcCompatible = assignment.lwc === workArea.lwc || (assignment.stage === 'BIQ' && workArea.kind === 'OFFICE_AREA')
  if (!lwcCompatible) {
    return false
  }

  if (!workArea.supportedStages.includes(assignment.stage)) {
    return false
  }

  if (['READY_TO_LAY', 'BUILD_UP', 'READY_FOR_VISUAL'].includes(assignment.stage) && workArea.kind !== 'BUILDUP_TABLE' && workArea.kind !== 'FLOAT') {
    return false
  }

  if (assignment.stage === 'BOX_BUILD' && !['BUILDUP_TABLE', 'FLOAT', 'NTB'].includes(workArea.kind)) {
    return false
  }

  if (['READY_TO_WIRE', 'WIRING', 'WIRING_IPV', 'READY_TO_HANG'].includes(assignment.stage) && !['WIRING_TABLE', 'FLOAT', 'NTB'].includes(workArea.kind)) {
    return false
  }

  if (assignment.stage === 'CROSS_WIRE' || assignment.stage === 'CROSS_WIRE_IPV') {
    if (!['WIRING_TABLE', 'FLOAT', 'NTB'].includes(workArea.kind)) {
      return false
    }

    const boxBuildComplete = allAssignments.some(candidate =>
      candidate.projectId === assignment.projectId
      && candidate.stage === 'BOX_BUILD'
      && (candidate.status === 'COMPLETE' || candidate.progressPercent >= 50),
    )

    if (!boxBuildComplete) {
      return false
    }
  }

  if (isTestStage(assignment.stage) && !['TEST_STATION', 'OFFICE_AREA'].includes(workArea.kind)) {
    return false
  }

  return true
}

export function deriveWorkAreaLoadState({
  workArea,
  assignments,
  members,
}: {
  workArea: ProjectBoardWorkAreaRecord
  assignments: ProjectBoardAssignmentRecord[]
  members: ProjectBoardMemberRecord[]
}): ProjectBoardWorkAreaLoadViewModel {
  const activeAssignments = assignments.filter(assignment =>
    assignment.currentWorkAreaId === workArea.id && assignment.status !== 'COMPLETE',
  )
  const assignedMembers = members.filter(member => member.currentWorkAreaId === workArea.id)
  const ratio = Math.max(activeAssignments.length, assignedMembers.length) / Math.max(workArea.capacity, 1)

  let state: ProjectBoardWorkAreaLoadState = 'idle'
  let label = 'Idle'
  let detail = 'Open capacity available.'

  if (ratio > 1) {
    state = 'over-capacity'
    label = 'Over Capacity'
    detail = 'More active work than the station should hold.'
  } else if (ratio >= 0.85) {
    state = 'busy'
    label = 'Busy'
    detail = 'Station is close to full utilization.'
  } else if (ratio > 0) {
    state = 'balanced'
    label = 'Balanced'
    detail = 'Station has work in motion with room to absorb one more task.'
  }

  return {
    state,
    label,
    detail,
    ratio: Math.min(ratio, 1.2),
  }
}

export function getEligibleAssignmentsForWorkArea({
  workArea,
  assignments,
}: {
  workArea: ProjectBoardWorkAreaRecord
  assignments: ProjectBoardAssignmentRecord[]
}) {
  return assignments.filter(assignment => canPlaceAssignmentInWorkArea({ assignment, workArea, allAssignments: assignments }))
}

function getAssignmentRecommendationReasons(
  assignment: ProjectBoardAssignmentRecord,
  workArea: ProjectBoardWorkAreaRecord,
) {
  const reasons: string[] = []

  if (assignment.preferredWorkAreaKinds.includes(workArea.kind)) {
    reasons.push('Matches preferred station type')
  }

  if (assignment.continuityMemberIds.length > 0) {
    reasons.push('Continuity members already identified')
  }

  if (assignment.carriedFromPriorShift) {
    reasons.push('Carryover from prior shift')
  }

  if (assignment.priority <= 2) {
    reasons.push('High schedule priority')
  }

  return reasons
}

export function getRecommendedAssignments({
  assignments,
  workArea,
  dataSet,
  limit = 3,
}: {
  assignments: ProjectBoardAssignmentRecord[]
  workArea: ProjectBoardWorkAreaRecord
  dataSet: D380ProjectBoardDataSet
  limit?: number
}) {
  return getEligibleAssignmentsForWorkArea({ workArea, assignments })
    .sort((left, right) => {
      const leftScore = Number(left.carriedFromPriorShift) * 5 + Number(left.preferredWorkAreaKinds.includes(workArea.kind)) * 3 + (6 - left.priority)
      const rightScore = Number(right.carriedFromPriorShift) * 5 + Number(right.preferredWorkAreaKinds.includes(workArea.kind)) * 3 + (6 - right.priority)
      return rightScore - leftScore
    })
    .slice(0, limit)
    .map(assignment => toAssignmentViewModel(assignment, dataSet, true, getAssignmentRecommendationReasons(assignment, workArea)))
}

export function getEligibleMembersForAssignment({
  assignment,
  members,
  workArea,
}: {
  assignment: ProjectBoardAssignmentRecord
  members: ProjectBoardMemberRecord[]
  workArea: ProjectBoardWorkAreaRecord
}): ProjectBoardMemberRecommendationViewModel[] {
  return members
    .filter(member => {
      const roleMatch = memberMatchesRole(member, assignment.requiredRole) || memberMatchesRole(member, getStageRole(assignment.stage))
      const shiftMatch = member.shift === assignment.shift
      const lwcMatch = member.lwcAffinities.includes(assignment.lwc) || workArea.kind === 'OFFICE_AREA'
      const workstationMatch = memberCanWorkArea(member, workArea)
      const experienceMatch = member.experiencedStages.includes(assignment.stage)
      const traineeMatch = assignment.traineeAllowed && member.traineeEligibleStages.includes(assignment.stage)

      return roleMatch && shiftMatch && lwcMatch && workstationMatch && (experienceMatch || traineeMatch)
    })
    .map(member => {
      const continuity = assignment.continuityMemberIds.includes(member.id)
      const priorCompletionCount = Number(member.priorCompletionProjectIds.includes(assignment.projectId))
      const traineeFit = !member.experiencedStages.includes(assignment.stage) && assignment.traineeAllowed
      const score = [
        continuity ? 6 : 0,
        member.primaryRole === assignment.requiredRole ? 4 : 2,
        member.experiencedStages.includes(assignment.stage) ? 3 : 0,
        priorCompletionCount ? 2 : 0,
        member.currentWorkAreaId === workArea.id ? 1 : 0,
        traineeFit ? 1 : 0,
      ].reduce((total, value) => total + value, 0)

      const reasons: string[] = []
      if (continuity) {
        reasons.push('Direct continuity from the prior shift')
      }
      if (member.experiencedStages.includes(assignment.stage)) {
        reasons.push(`Experienced at ${stageLabels[assignment.stage]}`)
      }
      if (priorCompletionCount) {
        reasons.push('Previously completed this project family')
      }
      if (traineeFit) {
        reasons.push('Trainee-eligible with pairing support')
      }
      if (member.currentWorkAreaId === workArea.id) {
        reasons.push('Already staged at this work area')
      }

      return {
        id: member.id,
        name: member.name,
        initials: member.initials,
        shiftLabel: getShiftLabel(member.shift),
        roleLabel: memberRoleLabels[member.primaryRole],
        experienceLabel: member.experiencedStages.includes(assignment.stage) ? 'Experienced' : 'Trainee Pairing',
        priorCompletionCount,
        continuity,
        traineeFit,
        score,
        reasons,
        capabilityBadges: [
          {
            label: continuity ? 'Continuity' : memberRoleLabels[member.primaryRole],
            tone: continuity ? 'positive' as const : 'neutral' as const,
          },
          {
            label: member.experiencedStages.includes(assignment.stage) ? stageLabels[assignment.stage] : 'Trainee',
            tone: member.experiencedStages.includes(assignment.stage) ? 'positive' as const : 'attention' as const,
          },
        ],
      }
    })
    .sort((left, right) => right.score - left.score)
}

export function getRecommendedMembers({
  assignment,
  members,
  workArea,
  limit = 4,
}: {
  assignment: ProjectBoardAssignmentRecord
  members: ProjectBoardMemberRecord[]
  workArea: ProjectBoardWorkAreaRecord
  limit?: number
}) {
  return getEligibleMembersForAssignment({ assignment, members, workArea }).slice(0, limit)
}

function buildWorkAreaCardViewModel(
  workArea: ProjectBoardWorkAreaRecord,
  dataSet: D380ProjectBoardDataSet,
): ProjectBoardWorkAreaCardViewModel {
  const assignedMembers = dataSet.members.filter(member => member.currentWorkAreaId === workArea.id)
  const activeAssignments = dataSet.assignments.filter(assignment =>
    assignment.currentWorkAreaId === workArea.id && assignment.status !== 'COMPLETE',
  )

  return {
    id: workArea.id,
    label: workArea.label,
    stationCode: workArea.stationCode,
    lwc: workArea.lwc,
    kind: workArea.kind,
    kindLabel: workAreaKindLabels[workArea.kind],
    capacity: workArea.capacity,
    notes: workArea.notes,
    load: deriveWorkAreaLoadState({
      workArea,
      assignments: dataSet.assignments,
      members: dataSet.members,
    }),
    assignedMembers: assignedMembers.map(member => ({
      id: member.id,
      name: member.name,
      initials: member.initials,
      roleLabel: memberRoleLabels[member.primaryRole],
    })),
    activeAssignments: activeAssignments.map(assignment => toAssignmentViewModel(assignment, dataSet)),
    recommendedAssignments: getRecommendedAssignments({
      assignments: dataSet.assignments,
      workArea,
      dataSet,
      limit: 2,
    }),
  }
}

export function groupWorkAreasByLwc(
  workAreas: ProjectBoardWorkAreaRecord[],
  assignments: ProjectBoardAssignmentRecord[],
  members: ProjectBoardMemberRecord[],
): Array<{ id: ProjectBoardLwcSectionId; workAreaIds: string[] }> {
  void assignments
  void members

  return (['ONSKID', 'OFFSKID', 'NEW/FLEX', 'OFFICE'] as const).map(sectionId => ({
    id: sectionId,
    workAreaIds: workAreas.filter(workArea => workArea.lwc === sectionId).map(workArea => workArea.id),
  }))
}

function buildSections(dataSet: D380ProjectBoardDataSet): ProjectBoardLwcSectionViewModel[] {
  const grouped = groupWorkAreasByLwc(dataSet.workAreas, dataSet.assignments, dataSet.members)

  return grouped.map(group => ({
    id: group.id,
    label: group.id,
    description: lwcDescriptions[group.id],
    workAreas: group.workAreaIds
      .map(workAreaId => dataSet.workAreas.find(workArea => workArea.id === workAreaId))
      .filter((workArea): workArea is ProjectBoardWorkAreaRecord => Boolean(workArea))
      .map(workArea => buildWorkAreaCardViewModel(workArea, dataSet)),
  }))
}

export function simulateProjectBoardPlacement(
  dataSet: D380ProjectBoardDataSet,
  placement?: ProjectBoardPlacementSelection,
): D380ProjectBoardDataSet {
  if (!placement) {
    return dataSet
  }

  return {
    ...dataSet,
    members: dataSet.members.map(member => (
      placement.memberIds.includes(member.id)
        ? { ...member, currentWorkAreaId: placement.workAreaId }
        : member
    )),
    assignments: dataSet.assignments.map(assignment => {
      if (assignment.id !== placement.assignmentId) {
        return assignment
      }

      return {
        ...assignment,
        currentWorkAreaId: placement.workAreaId,
        currentMemberIds: placement.memberIds,
        status: placement.mode === 'takeover' ? 'IN_PROGRESS' : 'ASSIGNED',
        statusNote: placement.traineePairing
          ? 'Trainee pairing staged in mock route state.'
          : placement.mode === 'takeover'
            ? 'Shift takeover staged in mock route state.'
            : 'Assignment placement staged in mock route state.',
      }
    }),
  }
}

const EMPTY_PROJECT_BOARD_DATA_SET: D380ProjectBoardDataSet = {
  operatingDate: new Date().toISOString().slice(0, 10),
  activeShift: '1st',
  projects: [],
  workAreas: [],
  members: [],
  assignments: [],
}

export function buildProjectBoardViewModel({
  dataSet,
  selectedWorkAreaId,
  selectedAssignmentId,
  placement,
}: {
  dataSet?: D380ProjectBoardDataSet
  selectedWorkAreaId?: string
  selectedAssignmentId?: string
  placement?: ProjectBoardPlacementSelection
}): D380ProjectBoardViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_PROJECT_BOARD_DATA_SET
  const nextDataSet = simulateProjectBoardPlacement(resolvedDataSet, placement)
  const sections = buildSections(nextDataSet)
  const staffedAreasCount = sections.reduce((total, section) => total + section.workAreas.filter(area => area.assignedMembers.length > 0).length, 0)
  const backlog = nextDataSet.assignments.filter(assignment => assignment.status === 'UNASSIGNED')
  const blocked = nextDataSet.assignments.filter(assignment => assignment.status === 'BLOCKED')
  const priorShift = nextDataSet.assignments.filter(assignment => assignment.carriedFromPriorShift && assignment.status === 'IN_PROGRESS')

  const recommended = nextDataSet.workAreas
    .flatMap(workArea => getRecommendedAssignments({ assignments: nextDataSet.assignments, workArea, dataSet: nextDataSet, limit: 1 }))
    .filter((assignment, index, assignments) => assignments.findIndex(candidate => candidate.id === assignment.id) === index)
    .slice(0, 5)

  const selectedWorkAreaRecord = selectedWorkAreaId
    ? nextDataSet.workAreas.find(workArea => workArea.id === selectedWorkAreaId)
    : undefined

  const selectedWorkArea = selectedWorkAreaRecord
    ? {
        workArea: buildWorkAreaCardViewModel(selectedWorkAreaRecord, nextDataSet),
        eligibleAssignments: getEligibleAssignmentsForWorkArea({ workArea: selectedWorkAreaRecord, assignments: nextDataSet.assignments })
          .map(assignment => toAssignmentViewModel(assignment, nextDataSet, true, getAssignmentRecommendationReasons(assignment, selectedWorkAreaRecord))),
        recommendedAssignments: getRecommendedAssignments({
          assignments: nextDataSet.assignments,
          workArea: selectedWorkAreaRecord,
          dataSet: nextDataSet,
          limit: 4,
        }),
      }
    : undefined

  const selectedAssignmentRecord = selectedAssignmentId
    ? nextDataSet.assignments.find(assignment => assignment.id === selectedAssignmentId)
    : undefined

  const selectedPlacement = selectedWorkAreaRecord && selectedAssignmentRecord
    ? {
        workArea: buildWorkAreaCardViewModel(selectedWorkAreaRecord, nextDataSet),
        assignment: toAssignmentViewModel(selectedAssignmentRecord, nextDataSet, true, getAssignmentRecommendationReasons(selectedAssignmentRecord, selectedWorkAreaRecord)),
        eligibleMembers: getEligibleMembersForAssignment({
          assignment: selectedAssignmentRecord,
          members: nextDataSet.members,
          workArea: selectedWorkAreaRecord,
        }),
        recommendedMembers: getRecommendedMembers({
          assignment: selectedAssignmentRecord,
          members: nextDataSet.members,
          workArea: selectedWorkAreaRecord,
          limit: 4,
        }),
      }
    : undefined

  return {
    operatingDateLabel: dateFormatter.format(new Date(`${nextDataSet.operatingDate}T00:00:00`)),
    activeShiftLabel: getShiftLabel(nextDataSet.activeShift),
    summary: {
      backlogCount: backlog.length + blocked.length,
      carryoverCount: priorShift.length,
      staffedAreasCount,
      workAreaCount: nextDataSet.workAreas.length,
    },
    backlog: {
      unassigned: backlog.map(assignment => toAssignmentViewModel(assignment, nextDataSet)),
      blocked: blocked.map(assignment => toAssignmentViewModel(assignment, nextDataSet, false, assignment.blockedReason ? [assignment.blockedReason] : [])),
      priorShift: priorShift.map(assignment => toAssignmentViewModel(assignment, nextDataSet)),
      recommended,
    },
    sections,
    selectedWorkArea,
    selectedPlacement,
    emptyState: {
      title: 'No work areas are available in the current mock floor plan.',
      description: 'Add mock work areas or change the provider later when the real floor-layout service comes online.',
    },
  }
}

/**
 * Get an empty project board data set.
 * Real data should be loaded from the Share import service.
 */
export function getProjectBoardDataSet(): D380ProjectBoardDataSet {
  return EMPTY_PROJECT_BOARD_DATA_SET
}
