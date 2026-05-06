import type {
  D380ProjectWorkspaceDataSet,
  D380ProjectWorkspaceProjectRecord,
  D380ProjectWorkspaceViewModel,
  ProjectWorkspaceAssignmentsViewModel,
  ProjectWorkspaceExportsViewModel,
  ProjectWorkspaceFilesViewModel,
  ProjectWorkspaceOverviewViewModel,
  ProjectWorkspaceProgressViewModel,
  ProjectWorkspaceStageReadinessCardViewModel,
  ProjectWorkspaceTabId,
  ProjectWorkspaceTabViewModel,
  ProjectWorkspaceTeamAssignmentsViewModel,
} from '@/types/d380-project-workspace'
import type { ProjectAssignmentStage } from '@/types/d380-shared'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const lifecycleLabels = {
  UPCOMING: 'Upcoming',
  KITTED: 'Kitted',
  CONLAY: 'Conlay',
  CONASY: 'Conasy',
  TEST: 'Test',
  PWR_CHECK: 'PWR Check',
  BIQ: 'BIQ',
  COMPLETED: 'Completed',
} as const

const buildUpStages = ['READY_TO_LAY', 'BUILD_UP', 'READY_FOR_VISUAL', 'BOX_BUILD'] as const satisfies readonly ProjectAssignmentStage[]
const wiringStages = ['READY_TO_WIRE', 'WIRING', 'WIRING_IPV', 'READY_TO_HANG', 'CROSS_WIRE', 'CROSS_WIRE_IPV'] as const satisfies readonly ProjectAssignmentStage[]

function isBuildUpStage(stage: ProjectAssignmentStage) {
  return (buildUpStages as readonly ProjectAssignmentStage[]).includes(stage)
}

function isWiringStage(stage: ProjectAssignmentStage) {
  return (wiringStages as readonly ProjectAssignmentStage[]).includes(stage)
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

const statusLabels = {
  queued: 'Queued',
  active: 'Active',
  blocked: 'Blocked',
  complete: 'Complete',
} as const

const fileCategoryLabels = {
  LAYOUT: 'Layout Files',
  WIRE_LIST: 'Wire List Files',
  REFERENCE: 'Reference Files',
  STATE: 'State Files',
  EXPORT: 'Export Files',
} as const

function getShiftLabel(shift: D380ProjectWorkspaceProjectRecord['shift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function getHoursLabel(value: number) {
  return `${value.toFixed(1)}h`
}

function toSheetWorkspaceHref(projectId: string, sheetName: string, stage?: 'BUILDUP' | 'WIRING') {
  const baseHref = `/380/projects/${projectId}/${encodeURIComponent(sheetName)}`

  if (!stage) {
    return baseHref
  }

  return `${baseHref}?tab=STAGES&stage=${stage}`
}

function getAssignmentStageAction(assignment: D380ProjectWorkspaceProjectRecord['assignments'][number]) {
  if (assignment.status === 'blocked') {
    return undefined
  }

  if (isBuildUpStage(assignment.stage)) {
    return {
      label: assignment.status === 'queued' ? 'Start Build-Up' : 'Open Build-Up Stage',
      stage: 'BUILDUP' as const,
    }
  }

  if (isWiringStage(assignment.stage)) {
    return {
      label: assignment.status === 'queued' ? 'Start Wiring' : 'Open Wiring Stage',
      stage: 'WIRING' as const,
    }
  }

  return undefined
}

function getCompletionPercent(project: D380ProjectWorkspaceProjectRecord) {
  if (project.assignmentCounts.total === 0) {
    return 0
  }

  return Math.round((project.assignmentCounts.complete / project.assignmentCounts.total) * 100)
}

export function getProjectWorkspaceTabs(project?: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceTabViewModel[] {
  return [
    { id: 'OVERVIEW', label: 'Overview' },
    { id: 'ASSIGNMENTS', label: 'Assignments', badge: project ? String(project.assignmentCounts.total) : undefined },
    { id: 'FILES', label: 'Files', badge: project ? String(project.files.length) : undefined },
    { id: 'PROGRESS', label: 'Progress' },
    { id: 'TEAM_ASSIGNMENTS', label: 'Team Assignments', badge: project ? String(project.members.length) : undefined },
    { id: 'EXPORTS', label: 'Exports', badge: project ? String(project.exports.length) : undefined },
  ]
}

export function buildProjectStageReadinessModules(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceStageReadinessCardViewModel[] {
  // Stage readiness modules are derived from actual project data when available
  // For now, return placeholder modules based on assignments in BUILD_UP or WIRING stages
  const modules: ProjectWorkspaceStageReadinessCardViewModel[] = []

  const hasBuildUpAssignments = project.assignments.some(a => isBuildUpStage(a.stage))
  const hasWiringAssignments = project.assignments.some(a => isWiringStage(a.stage))

  if (hasBuildUpAssignments) {
    const buildUpCount = project.assignments.filter(a => isBuildUpStage(a.stage)).length
    const completeCount = project.assignments.filter(a => isBuildUpStage(a.stage) && a.status === 'complete').length

    modules.push({
      id: 'build-up',
      eyebrow: 'Build Up',
      title: 'Open Build Up workspace',
      description: `${project.pdNumber} has ${buildUpCount} assignment${buildUpCount === 1 ? '' : 's'} in build-up stages.`,
      completionLabel: `${completeCount}/${buildUpCount} assignments complete`,
      exportReadinessLabel: completeCount === buildUpCount ? 'Export gate is ready.' : `${buildUpCount - completeCount} assignment${buildUpCount - completeCount === 1 ? '' : 's'} pending.`,
      actionLabel: 'Go to Build Up',
      href: `/380/projects/${project.id}/build-up`,
      theme: 'build-up',
    })
  }

  if (hasWiringAssignments) {
    const wiringCount = project.assignments.filter(a => isWiringStage(a.stage)).length
    const completeCount = project.assignments.filter(a => isWiringStage(a.stage) && a.status === 'complete').length

    modules.push({
      id: 'wiring',
      eyebrow: 'Wiring workspace',
      title: 'Open Wiring workspace',
      description: `${project.pdNumber} has ${wiringCount} assignment${wiringCount === 1 ? '' : 's'} in wiring stages.`,
      completionLabel: `${completeCount}/${wiringCount} assignments complete`,
      exportReadinessLabel: completeCount === wiringCount ? 'Export gate is ready.' : `${wiringCount - completeCount} assignment${wiringCount - completeCount === 1 ? '' : 's'} pending.`,
      actionLabel: 'Go to Wiring',
      href: `/380/projects/${project.id}/wiring`,
      theme: 'wiring',
    })
  }

  return modules
}

export function buildProjectOverviewViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceOverviewViewModel {
  const completionPercent = getCompletionPercent(project)

  return {
    header: {
      id: project.id,
      pdNumber: project.pdNumber,
      name: project.name,
      revisionLabel: project.revision,
      targetDateLabel: dateFormatter.format(new Date(`${project.targetDate}T00:00:00`)),
      lifecycleLabel: lifecycleLabels[project.lifecycle],
      risk: project.risk,
      shiftLabel: getShiftLabel(project.shift),
      lwcLabel: project.lwc,
      member: project.member,
      statusNote: project.statusNote,
      leadSummary: project.leadSummary,
    },
    metrics: [
      {
        id: 'completion',
        label: 'Completion',
        value: `${completionPercent}%`,
        detail: `${project.assignmentCounts.complete} of ${project.assignmentCounts.total} assignments complete`,
        tone: completionPercent >= 50 ? 'positive' : project.risk === 'late' ? 'attention' : 'neutral',
      },
      {
        id: 'active',
        label: 'Active assignments',
        value: String(project.assignmentCounts.active),
        detail: `${project.assignmentCounts.blocked} blocked and waiting on release gates`,
        tone: project.assignmentCounts.blocked > 0 ? 'attention' : 'neutral',
      },
      {
        id: 'units',
        label: 'Units',
        value: String(project.units),
        detail: `${project.lwc} workspace with ${getShiftLabel(project.shift)}`,
        tone: 'neutral',
      },
      {
        id: 'team',
        label: 'Team staged',
        value: String(project.members.length),
        detail: `${project.traineePairings.length} trainee pairing${project.traineePairings.length === 1 ? '' : 's'} active`,
        tone: project.traineePairings.length > 0 ? 'positive' : 'neutral',
      },
    ],
    stageSummary: project.stageSummary.map(item => ({
      label: stageLabels[item.stage],
      count: item.count,
    })),
    riskIndicators: [
      `Lifecycle status: ${lifecycleLabels[project.lifecycle]}`,
      `Risk state: ${project.risk}`,
      ...project.blockers,
    ],
    leadShiftSummary: [
      `Member: ${project.member}`,
      `Lead summary: ${project.leadSummary}`,
      `Shift coverage: ${getShiftLabel(project.shift)} focused on ${project.lwc}`,
    ],
  }
}

export function buildProjectAssignmentsViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceAssignmentsViewModel {
  return {
    summary: [
      {
        id: 'assignment-total',
        label: 'Assignments',
        value: String(project.assignmentCounts.total),
        detail: 'Current assignment-level workload in the project shell.',
        tone: 'neutral',
      },
      {
        id: 'assignment-active',
        label: 'In motion',
        value: String(project.assignmentCounts.active),
        detail: 'Assignments actively owned by the floor or test team.',
        tone: 'positive',
      },
      {
        id: 'assignment-blocked',
        label: 'Blocked',
        value: String(project.assignmentCounts.blocked),
        detail: 'Assignments waiting on signoff, upstream work, or bench access.',
        tone: project.assignmentCounts.blocked > 0 ? 'attention' : 'neutral',
      },
    ],
    assignments: project.assignments.map(assignment => {
      const stageAction = getAssignmentStageAction(assignment)

      return {
        id: assignment.id,
        projectId: project.id,
        sheetName: assignment.sheetName,
        stageId: assignment.stage,
        stageLabel: stageLabels[assignment.stage],
        statusLabel: statusLabels[assignment.status],
        assignedMemberCount: assignment.assignedMemberIds.length,
        traineeCount: assignment.traineeMemberIds.length,
        workstationLabel: assignment.workstationLabel,
        lwcLabel: assignment.lwc,
        estimatedHoursLabel: getHoursLabel(assignment.estimatedHours),
        averageHoursLabel: getHoursLabel(assignment.averageHours),
        progressPercent: assignment.progressPercent,
        statusNote: assignment.statusNote,
        blockedReason: assignment.blockedReason,
        sheetWorkspaceHref: toSheetWorkspaceHref(project.id, assignment.sheetName),
        sheetWorkspaceLabel: 'Open sheet workspace',
        stageActionLabel: stageAction?.label,
        stageActionHref: stageAction ? toSheetWorkspaceHref(project.id, assignment.sheetName, stageAction.stage) : undefined,
      }
    }),
  }
}

export function buildProjectFilesViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceFilesViewModel {
  return {
    groups: (['LAYOUT', 'WIRE_LIST', 'REFERENCE', 'STATE', 'EXPORT'] as const).map(category => ({
      id: category,
      label: fileCategoryLabels[category],
      files: project.files
        .filter(file => file.category === category)
        .map(file => ({
          id: file.id,
          label: file.label,
          fileName: file.fileName,
          revision: file.revision,
          status: file.status,
          sourceLabel: file.sourceLabel,
          lastUpdatedLabel: file.lastUpdatedLabel,
          note: file.note,
        })),
    })),
  }
}

export function buildProjectProgressViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceProgressViewModel {
  const totalAssignments = Math.max(project.assignmentCounts.total, 1)
  const completeCount = project.assignments.filter(assignment => assignment.status === 'complete').length
  const activeCount = project.assignments.filter(assignment => assignment.status === 'active').length
  const queuedCount = project.assignments.filter(assignment => assignment.status === 'queued').length
  const blockedCount = project.assignments.filter(assignment => assignment.status === 'blocked').length
  const completionPercent = getCompletionPercent(project)

  return {
    completionPercent,
    completionLabel: `${completeCount} of ${project.assignmentCounts.total} assignments complete`,
    stageDistribution: project.stageSummary.map(item => ({
      label: stageLabels[item.stage],
      count: item.count,
      percent: Math.round((item.count / totalAssignments) * 100),
    })),
    assignmentBreakdown: [
      { label: 'Complete', count: completeCount },
      { label: 'Active', count: activeCount },
      { label: 'Queued', count: queuedCount },
      { label: 'Blocked', count: blockedCount },
    ],
    blockers: project.blockers,
    timeline: [
      { label: 'Build-Up', status: ['UPCOMING', 'KITTED'].includes(project.lifecycle) ? 'queued' : 'complete' },
      { label: 'Wiring', status: ['CONASY', 'TEST', 'PWR_CHECK', 'BIQ', 'COMPLETED'].includes(project.lifecycle) ? 'complete' : project.lifecycle === 'CONLAY' ? 'active' : 'queued' },
      { label: 'Test', status: ['TEST', 'PWR_CHECK'].includes(project.lifecycle) ? 'active' : ['BIQ', 'COMPLETED'].includes(project.lifecycle) ? 'complete' : 'queued' },
      { label: 'BIQ / Export', status: ['BIQ'].includes(project.lifecycle) ? 'active' : project.lifecycle === 'COMPLETED' ? 'complete' : 'queued' },
    ],
  }
}

export function buildProjectTeamAssignmentsViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceTeamAssignmentsViewModel {
  return {
    summary: [
      {
        id: 'team-members',
        label: 'Assigned members',
        value: String(project.members.length),
        detail: 'Current team members mapped into the project workspace.',
        tone: 'neutral',
      },
      {
        id: 'team-pairings',
        label: 'Trainee pairings',
        value: String(project.traineePairings.length),
        detail: 'Active pairings maintained for assignment continuity and coaching.',
        tone: project.traineePairings.length > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'team-continuity',
        label: 'Continuity members',
        value: String(project.members.filter(member => member.continuityMember).length),
        detail: 'Members tagged as likely handoff anchors across shifts.',
        tone: 'positive',
      },
    ],
    members: project.members.map(member => ({
      id: member.id,
      name: member.name,
      initials: member.initials,
      role: member.role,
      shiftLabel: getShiftLabel(member.shift),
      workstationLabel: member.workstationLabel,
      lwcLabel: member.lwc,
      assignmentCount: member.assignmentIds.length,
      continuityMember: member.continuityMember,
    })),
    traineePairings: project.traineePairings.map(pairing => ({
      id: pairing.id,
      leadName: project.members.find(member => member.id === pairing.leadMemberId)?.name ?? 'Lead',
      traineeName: project.members.find(member => member.id === pairing.traineeMemberId)?.name ?? 'Trainee',
      assignmentLabel: project.assignments.find(assignment => assignment.id === pairing.assignmentId)?.sheetName ?? 'Assignment',
      note: pairing.note,
    })),
    continuityOverview: [
      `${project.members.filter(member => member.continuityMember).length} continuity member${project.members.filter(member => member.continuityMember).length === 1 ? '' : 's'} identified for shift handoff.`,
      `${project.members.map(member => member.workstationLabel).filter((label, index, labels) => labels.indexOf(label) === index).length} workstation lanes currently represented in the project workspace.`,
      `${project.members.map(member => member.lwc).filter((label, index, labels) => labels.indexOf(label) === index).join(', ')} coverage is mapped across the active work lanes.`,
    ],
  }
}

export function buildProjectExportsViewModel(project: D380ProjectWorkspaceProjectRecord): ProjectWorkspaceExportsViewModel {
  const archiveReady = project.exports.every(record => record.status === 'ready')

  return {
    archiveReady,
    archiveStatusLabel: archiveReady ? 'Archive bundle is ready for release.' : 'Archive bundle is not ready yet.',
    records: project.exports.map(record => ({
      id: record.id,
      label: record.label,
      description: record.description,
      status: record.status,
      lastGeneratedLabel: record.lastGeneratedLabel,
      note: record.note,
    })),
  }
}

const EMPTY_DATA_SET: D380ProjectWorkspaceDataSet = {
  operatingDate: new Date().toISOString().slice(0, 10),
  projects: [],
}

export function buildProjectWorkspaceViewModel({
  projectId,
  dataSet,
}: {
  projectId: string
  dataSet?: D380ProjectWorkspaceDataSet
}): D380ProjectWorkspaceViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_DATA_SET
  const project = resolvedDataSet.projects.find(candidate => candidate.id === projectId)

  if (!project) {
    return {
      projectId,
      found: false,
      operatingDateLabel: dateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
      tabs: getProjectWorkspaceTabs(),
      stageReadiness: [],
      emptyState: {
        title: 'This project workspace is not staged yet.',
        description: 'Add a matching project record or navigate back to the projects board to open an available workspace.',
      },
    }
  }

  return {
    projectId,
    found: true,
    operatingDateLabel: dateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
    tabs: getProjectWorkspaceTabs(project),
    stageReadiness: buildProjectStageReadinessModules(project),
    overview: buildProjectOverviewViewModel(project),
    assignments: buildProjectAssignmentsViewModel(project),
    files: buildProjectFilesViewModel(project),
    progress: buildProjectProgressViewModel(project),
    teamAssignments: buildProjectTeamAssignmentsViewModel(project),
    exports: buildProjectExportsViewModel(project),
    emptyState: {
      title: 'Project workspace is ready for a seeded project.',
      description: 'This workspace is served through typed providers and can be swapped to file-backed sources in integration phase.',
    },
  }
}
