import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type {
  AssignmentProgressSummaryViewModel,
  AssignmentWorkspaceOverviewViewModel,
  AssignmentStageWorkflowState,
  AssignmentWorkspaceStageDisplayState,
  AssignmentWorkspaceTabViewModel,
  D380AssignmentWorkspaceDataSet,
  D380AssignmentWorkspaceRecord,
  D380AssignmentWorkspaceViewModel,
} from '@/types/d380-assignment-workspace'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const stageOrder: AssignmentStageId[] = [
  'READY_TO_LAY',
  'BUILD_UP',
  'READY_TO_WIRE',
  'WIRING',
  'READY_FOR_VISUAL',
  'WIRING_IPV',
  'READY_TO_HANG',
  'BOX_BUILD',
  'CROSS_WIRE',
  'CROSS_WIRE_IPV',
  'READY_TO_TEST',
  'TEST_1ST_PASS',
  'POWER_CHECK',
  'READY_FOR_BIQ',
  'BIQ',
  'FINISHED_BIQ',
]

const stageLabels: Record<AssignmentStageId, string> = {
  READY_TO_LAY: 'Ready to Lay',
  BUILD_UP: 'Build-Up',
  READY_TO_WIRE: 'Ready to Wire',
  WIRING: 'Wiring',
  READY_FOR_VISUAL: 'Ready for Review',
  WIRING_IPV: 'Wire Review',
  READY_TO_HANG: 'Ready for Box Build',
  BOX_BUILD: 'Box Build',
  READY_TO_CROSS_WIRE: 'Ready for Cross Wire',
  CROSS_WIRE: 'Cross Wire',
  CROSS_WIRE_IPV: 'Cross Wire Review',
  READY_TO_TEST: 'Ready to Test',
  TEST_1ST_PASS: 'Test Review',
  POWER_CHECK: 'Power Check',
  READY_FOR_BIQ: 'Ready for BIQ',
  BIQ: 'BIQ',
  FINISHED_BIQ: 'BIQ Complete',
}

const statusLabels = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETE: 'Complete',
} as const

const workstationTypeLabels = {
  BUILDUP_TABLE: 'Build-Up Table',
  WIRING_TABLE: 'Wiring Table',
  TEST_STATION: 'Test Station',
  FLOAT: 'Float Cell',
  NTB: 'NTB Bench',
  OFFICE_AREA: 'Office Area',
} as const

function getShiftLabel(shift: D380AssignmentWorkspaceRecord['shift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function getHoursLabel(hours: number) {
  return `${hours.toFixed(1)}h`
}

function formatTimestamp(value?: string) {
  return value ? dateFormatter.format(new Date(value)) : undefined
}

export function getAssignmentWorkspaceTabs(): AssignmentWorkspaceTabViewModel[] {
  return [
    { id: 'OVERVIEW', label: 'Overview' },
    { id: 'STAGES', label: 'Stages', badge: String(stageOrder.length) },
  ]
}

export function canStartStage({
  assignment,
  workflowState,
  stageId,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
  stageId: AssignmentStageId
}) {
  const stage = assignment.stages.find(candidate => candidate.id === stageId)
  const snapshot = workflowState.stages[stageId]

  if (!stage || !snapshot || snapshot.status === 'COMPLETE' || snapshot.status === 'BLOCKED') {
    return false
  }

  const dependenciesComplete = stage.dependencyStageIds.every(dependencyId => workflowState.stages[dependencyId]?.status === 'COMPLETE')
  if (!dependenciesComplete) {
    return false
  }

  if (stageId === 'CROSS_WIRE' && workflowState.stages.BOX_BUILD?.status !== 'COMPLETE') {
    return false
  }

  const activeStage = stageOrder.find(candidate => workflowState.stages[candidate]?.status === 'IN_PROGRESS')
  if (activeStage && activeStage !== stageId) {
    return false
  }

  return true
}

export function canCompleteStage({
  assignment,
  workflowState,
  stageId,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
  stageId: AssignmentStageId
}) {
  const stage = assignment.stages.find(candidate => candidate.id === stageId)
  const snapshot = workflowState.stages[stageId]

  if (!stage || !snapshot || snapshot.status !== 'IN_PROGRESS') {
    return false
  }

  return stage.checklist.every(item => !item.required || snapshot.checklist[item.id])
}

export function getNextAvailableStage({
  assignment,
  workflowState,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
}) {
  const activeStage = stageOrder.find(stageId => workflowState.stages[stageId]?.status === 'IN_PROGRESS')
  if (activeStage) {
    return activeStage
  }

  return stageOrder.find(stageId => canStartStage({ assignment, workflowState, stageId }))
}

export function getStageDisplayState({
  assignment,
  workflowState,
  stageId,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
  stageId: AssignmentStageId
}): AssignmentWorkspaceStageDisplayState {
  const snapshot = workflowState.stages[stageId]

  if (!snapshot) {
    return 'future'
  }

  if (snapshot.status === 'COMPLETE') {
    return 'complete'
  }

  if (snapshot.status === 'IN_PROGRESS') {
    return 'current'
  }

  if (snapshot.status === 'BLOCKED') {
    return 'blocked'
  }

  if (canStartStage({ assignment, workflowState, stageId })) {
    return 'available'
  }

  return 'future'
}

export function buildAssignmentProgressSummary({
  assignment,
  workflowState,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
}): AssignmentProgressSummaryViewModel {
  const completedStagesCount = stageOrder.filter(stageId => workflowState.stages[stageId]?.status === 'COMPLETE').length
  const blockedCount = stageOrder.filter(stageId => workflowState.stages[stageId]?.status === 'BLOCKED').length
  const completionPercent = Math.round((completedStagesCount / stageOrder.length) * 100)
  const currentActionableStageId = getNextAvailableStage({ assignment, workflowState })
  const currentStageLabel = currentActionableStageId ? stageLabels[currentActionableStageId] : 'Awaiting release'
  const nextIndex = currentActionableStageId ? stageOrder.indexOf(currentActionableStageId) + 1 : -1
  const nextStageLabel = nextIndex > 0 && nextIndex < stageOrder.length ? stageLabels[stageOrder[nextIndex]] : undefined
  const elapsedHours = assignment.stages.reduce((total, stage) => total + stage.elapsedHours, 0)

  return {
    completionPercent,
    completedStagesCount,
    totalStages: stageOrder.length,
    currentStageLabel,
    nextStageLabel,
    elapsedVsEstimatedLabel: `${getHoursLabel(elapsedHours)} elapsed vs ${getHoursLabel(assignment.estimatedHours)} estimated`,
    blockedCount,
    handoffSummary: workflowState.lastHandoffAt
      ? `${workflowState.handoffCount} mock handoff${workflowState.handoffCount === 1 ? '' : 's'} · last ${formatTimestamp(workflowState.lastHandoffAt)} · ${getShiftLabel(workflowState.lastHandoffShift ?? assignment.shift)}`
      : 'No mock handoff staged yet',
  }
}

export function buildAssignmentOverviewViewModel({
  assignment,
  workflowState,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
}): AssignmentWorkspaceOverviewViewModel {
  const progressSummary = buildAssignmentProgressSummary({ assignment, workflowState })
  const currentActionableStageId = getNextAvailableStage({ assignment, workflowState })
  const currentSnapshot = currentActionableStageId ? workflowState.stages[currentActionableStageId] : undefined

  return {
    header: {
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      pdNumber: assignment.pdNumber,
      projectName: assignment.projectName,
      sheetName: assignment.sheetName,
      revisionLabel: assignment.revision,
      currentStageLabel: progressSummary.currentStageLabel,
      currentStatusLabel: currentSnapshot ? statusLabels[currentSnapshot.status] : 'Awaiting release',
      shiftLabel: getShiftLabel(assignment.shift),
      lwcLabel: assignment.lwc,
      workstationTypeLabel: workstationTypeLabels[assignment.workstationType],
      workstationLabel: assignment.workstationLabel,
      targetDateLabel: dateFormatter.format(new Date(`${assignment.targetDate}T00:00:00`)),
      statusNote: assignment.statusNote,
      handoffSummary: progressSummary.handoffSummary,
    },
    metrics: [
      {
        id: 'assigned-members',
        label: 'Assigned members',
        value: String(assignment.assignedMemberIds.length),
        detail: `${assignment.traineeMemberIds.length} trainee member${assignment.traineeMemberIds.length === 1 ? '' : 's'} staged on this assignment.`,
        tone: assignment.traineeMemberIds.length > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'hours',
        label: 'Estimated vs average',
        value: `${getHoursLabel(assignment.estimatedHours)} / ${getHoursLabel(assignment.averageHours)}`,
        detail: 'Hours remain mock-only and provider-ready for future real routing analytics.',
        tone: assignment.estimatedHours >= assignment.averageHours ? 'attention' : 'neutral',
      },
      {
        id: 'stage-progress',
        label: 'Completed stages',
        value: `${progressSummary.completedStagesCount}/${progressSummary.totalStages}`,
        detail: `${progressSummary.blockedCount} blocked stage${progressSummary.blockedCount === 1 ? '' : 's'} currently staged.`,
        tone: progressSummary.blockedCount > 0 ? 'attention' : 'positive',
      },
      {
        id: 'layout-match',
        label: 'Layout match',
        value: 'Mock match',
        detail: assignment.layoutMatchSummary,
        tone: 'neutral',
      },
    ],
    progressSummary,
    assignedMembers: assignment.members.filter(member => assignment.assignedMemberIds.includes(member.id)),
    traineeMembers: assignment.members.filter(member => assignment.traineeMemberIds.includes(member.id)),
    blockers: [
      ...assignment.blockers,
      ...stageOrder
        .map(stageId => workflowState.stages[stageId]?.blockedReason)
        .filter((value): value is string => Boolean(value)),
    ],
    layoutMatchSummary: assignment.layoutMatchSummary,
  }
}

export function buildAssignmentStagesViewModel({
  assignment,
  workflowState,
}: {
  assignment: D380AssignmentWorkspaceRecord
  workflowState: AssignmentStageWorkflowState
}) {
  const progressSummary = buildAssignmentProgressSummary({ assignment, workflowState })
  const currentActionableStageId = getNextAvailableStage({ assignment, workflowState })

  return {
    currentActionableStageId,
    progressSummary,
    stages: assignment.stages.map(stage => {
      const snapshot = workflowState.stages[stage.id]
      const displayState = getStageDisplayState({ assignment, workflowState, stageId: stage.id })

      return {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        status: snapshot.status,
        statusLabel: statusLabels[snapshot.status],
        displayState,
        isActionable: currentActionableStageId === stage.id,
        assignedMembers: assignment.members.filter(member => stage.assignedMemberIds.includes(member.id)),
        traineeMembers: assignment.members.filter(member => stage.traineeMemberIds.includes(member.id)),
        estimatedHoursLabel: getHoursLabel(stage.estimatedHours),
        elapsedHoursLabel: getHoursLabel(stage.elapsedHours),
        dependencySummary: stage.dependencyStageIds.length > 0
          ? `Depends on ${stage.dependencyStageIds.map(dependencyId => stageLabels[dependencyId]).join(', ')}`
          : 'No upstream dependency gate',
        blockedReason: snapshot.blockedReason,
        note: stage.note,
        checklist: stage.checklist.map(item => ({
          id: item.id,
          label: item.label,
          required: item.required,
          completed: snapshot.checklist[item.id] ?? false,
        })),
        comment: snapshot.comment,
        startedAtLabel: formatTimestamp(snapshot.startedAt),
        completedAtLabel: formatTimestamp(snapshot.completedAt),
        canStart: canStartStage({ assignment, workflowState, stageId: stage.id }),
        canComplete: canCompleteStage({ assignment, workflowState, stageId: stage.id }),
      }
    }),
  }
}

const EMPTY_ASSIGNMENT_DATA_SET: D380AssignmentWorkspaceDataSet = {
  operatingDate: new Date().toISOString().slice(0, 10),
  assignments: [],
}

export function buildAssignmentWorkspaceViewModel({
  projectId,
  sheetName,
  workflowState,
  dataSet,
}: {
  projectId: string
  sheetName: string
  workflowState?: AssignmentStageWorkflowState
  dataSet?: D380AssignmentWorkspaceDataSet
}): D380AssignmentWorkspaceViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_ASSIGNMENT_DATA_SET
  const assignment = resolvedDataSet.assignments.find(candidate => candidate.projectId === projectId && candidate.sheetName === sheetName)

  if (!assignment || !workflowState) {
    return {
      found: false,
      operatingDateLabel: dateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
      tabs: getAssignmentWorkspaceTabs(),
      railWidgets: [],
      placeholders: [],
      emptyState: {
        title: 'This mock assignment workspace is not staged yet.',
        description: 'Open a seeded assignment from the mock dataset or add another fixture before wiring up later execution phases.',
      },
    }
  }

  const progressSummary = buildAssignmentProgressSummary({ assignment, workflowState })
  const currentActionableStageId = getNextAvailableStage({ assignment, workflowState })
  const currentActionableStage = currentActionableStageId
    ? assignment.stages.find(stage => stage.id === currentActionableStageId)
    : undefined

  const activeQueueItems = stageOrder
    .map(stageId => assignment.stages.find(stage => stage.id === stageId))
    .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage))
    .filter(stage => workflowState.stages[stage.id]?.status !== 'COMPLETE')
    .slice(0, 4)
    .map(stage => {
      const snapshot = workflowState.stages[stage.id]
      return {
        id: stage.id,
        label: stage.title,
        detail: snapshot.status === 'BLOCKED' && snapshot.blockedReason
          ? `${statusLabels[snapshot.status]} · ${snapshot.blockedReason}`
          : statusLabels[snapshot.status],
      }
    })

  const assignedMembers = assignment.members.filter(member => assignment.assignedMemberIds.includes(member.id))
  const assignedToCurrentStageIds = new Set(currentActionableStage?.assignedMemberIds ?? [])

  const teamCoverageItems = assignedMembers.slice(0, 4).map(member => ({
    id: member.id,
    label: member.name,
    detail: `${member.role} · ${getShiftLabel(member.shift)}${assignedToCurrentStageIds.has(member.id) ? ` · ${progressSummary.currentStageLabel}` : ''}`,
  }))

  return {
    found: true,
    operatingDateLabel: dateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
    tabs: getAssignmentWorkspaceTabs(),
    overview: buildAssignmentOverviewViewModel({ assignment, workflowState }),
    stages: buildAssignmentStagesViewModel({ assignment, workflowState }),
    railWidgets: [
      {
        id: 'execution-lane',
        eyebrow: 'Execution lane',
        title: `${progressSummary.currentStageLabel} controls the release gate`,
        description: progressSummary.nextStageLabel
          ? `Current throughput is tracked from ${progressSummary.currentStageLabel} into ${progressSummary.nextStageLabel}.`
          : `Current throughput is tracked from ${progressSummary.currentStageLabel} to closeout.`,
        actionLabel: 'Open stage workflow',
        actionHref: `/380/projects/${assignment.projectId}/${encodeURIComponent(assignment.sheetName)}?tab=STAGES`,
        metrics: [
          {
            id: 'completion',
            label: 'Completed',
            value: `${progressSummary.completedStagesCount}/${progressSummary.totalStages}`,
          },
          {
            id: 'blocked',
            label: 'Blocked',
            value: String(progressSummary.blockedCount),
          },
          {
            id: 'progress',
            label: 'Progress',
            value: `${progressSummary.completionPercent}%`,
          },
        ],
        items: activeQueueItems,
      },
      {
        id: 'team-coverage',
        eyebrow: 'Team coverage',
        title: `Shift membership for ${assignment.sheetName}`,
        description: `Staffing and handoff context are tracked live for ${assignment.workstationLabel}.`,
        actionLabel: 'Open assignment overview',
        actionHref: `/380/projects/${assignment.projectId}/${encodeURIComponent(assignment.sheetName)}?tab=OVERVIEW`,
        metrics: [
          {
            id: 'assigned',
            label: 'Assigned',
            value: String(assignment.assignedMemberIds.length),
          },
          {
            id: 'trainees',
            label: 'Trainees',
            value: String(assignment.traineeMemberIds.length),
          },
          {
            id: 'handoffs',
            label: 'Handoffs',
            value: String(workflowState.handoffCount),
          },
        ],
        items: teamCoverageItems,
      },
    ],
    placeholders: [
      {
        id: 'layout-preview',
        eyebrow: 'Layout seam',
        title: 'Layout Preview',
        description: 'Placeholder region for future sheet-to-layout preview and match validation.',
        actionLabel: 'Layout preview placeholder',
      },
      {
        id: 'device-details',
        eyebrow: 'Device seam',
        title: 'Device Details Aside',
        description: 'Placeholder trigger for future device detail exploration without coupling this phase to the real aside system.',
        actionLabel: 'Open device details seam',
      },
      {
        id: 'branding-list',
        eyebrow: 'Branding seam',
        title: 'Branding List',
        description: 'Placeholder trigger for branding and label list integration in a later phase.',
        actionLabel: 'Open branding seam',
      },
    ],
    emptyState: {
      title: 'Assignment workspace shell is ready.',
      description: 'The route remains mock-only until later phases bring in real wire-list, layout, branding, and device integrations.',
    },
  }
}
