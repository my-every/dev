import type {
  D380ProjectsBoardDataSet,
  D380ProjectsBoardProjectRecord,
  D380ProjectsBoardViewModel,
  ProjectsBoardColumnViewModel,
  ProjectsBoardFilterState,
  ProjectsBoardLifecycleColumnId,
  ProjectsBoardProjectCardViewModel,
  ProjectsBoardRiskLevel,
} from '@/types/d380-projects-board'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const CONASY_THRESHOLD_PERCENT = 65

const lifecycleColumns: Array<{
  id: ProjectsBoardLifecycleColumnId
  label: string
  description: string
}> = [
  { id: 'UPCOMING', label: 'Upcoming Projects', description: 'Projects waiting on kit release and lane commitment.' },
  { id: 'KITTED', label: 'Kitted', description: 'Material is staged and ready for build-up membership.' },
  { id: 'CONLAY', label: 'Conlay', description: 'First build-up work has officially started on at least one assignment.' },
  { id: 'CONASY', label: 'Conasy', description: 'Wiring is underway or the build-up / ready-to-wire threshold has been crossed.' },
  { id: 'TEST', label: 'Test', description: 'Cross wiring is complete and the project is genuinely test ready.' },
  { id: 'PWR_CHECK', label: 'PWR Check', description: 'Test passed and the project is staged for power check.' },
  { id: 'BIQ', label: 'BIQ', description: 'Power check passed and BIQ is the active release gate.' },
  { id: 'COMPLETED', label: 'Completed', description: 'BIQ closed and the project completed on or before target.' },
]

const stageFloorPercent: Record<ProjectsBoardLifecycleColumnId, number> = {
  UPCOMING: 6,
  KITTED: 18,
  CONLAY: 34,
  CONASY: 52,
  TEST: 72,
  PWR_CHECK: 84,
  BIQ: 93,
  COMPLETED: 100,
}

const lifecycleLabelLookup = Object.fromEntries(
  lifecycleColumns.map(column => [column.id, column.label]),
) as Record<ProjectsBoardLifecycleColumnId, string>

function toDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function isOnOrBeforeTarget(completedAt: string, targetDate: string) {
  return toDate(completedAt).getTime() <= toDate(targetDate).getTime()
}

function anyAssignmentsAtOrBeyondBuildUp(project: D380ProjectsBoardProjectRecord) {
  return project.assignments.some(assignment =>
    ['BUILD_UP', 'READY_TO_WIRE', 'WIRING', 'CROSS_WIRE', 'READY_TO_TEST', 'TEST_1ST_PASS', 'PWR_CHECK', 'BIQ'].includes(assignment.stage) && assignment.status !== 'queued',
  )
}

function anyAssignmentsAtOrBeyondWiring(project: D380ProjectsBoardProjectRecord) {
  return project.assignments.some(assignment =>
    ['WIRING', 'CROSS_WIRE', 'READY_TO_TEST', 'TEST_1ST_PASS', 'PWR_CHECK', 'BIQ'].includes(assignment.stage) && assignment.status !== 'queued',
  )
}

function getAssignmentCounts(project: D380ProjectsBoardProjectRecord) {
  const total = project.assignments.length
  const complete = project.assignments.filter(assignment => assignment.status === 'complete').length
  const active = project.assignments.filter(assignment => assignment.status === 'active').length
  const blocked = project.assignments.filter(assignment => assignment.status === 'blocked').length

  return {
    total,
    complete,
    active,
    blocked,
  }
}

function getProgressPercent(
  project: D380ProjectsBoardProjectRecord,
  lifecycleStage: ProjectsBoardLifecycleColumnId,
) {
  const counts = getAssignmentCounts(project)
  const baseProgress = counts.total === 0 ? 0 : Math.round((counts.complete / counts.total) * 100)
  const milestoneProgress = Math.max(project.milestones.buildUpCompletionPercent, project.milestones.readyToWirePercent)

  return Math.min(100, Math.max(stageFloorPercent[lifecycleStage], baseProgress, milestoneProgress))
}

function getLateReason(lifecycleStage: ProjectsBoardLifecycleColumnId) {
  if (lifecycleStage === 'KITTED') {
    return 'Past target while still waiting on conlay release.'
  }

  if (lifecycleStage === 'TEST') {
    return 'Past target while test-ready work remains unresolved.'
  }

  if (lifecycleStage === 'PWR_CHECK') {
    return 'Past target while power-check closure is still open.'
  }

  if (lifecycleStage === 'BIQ') {
    return 'Past target while BIQ remains the active gate.'
  }

  return 'Past target while active lifecycle work is still open.'
}

function getShiftLabel(shift: D380ProjectsBoardProjectRecord['shift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function deriveRiskLevel(
  project: D380ProjectsBoardProjectRecord,
  lifecycleStage: ProjectsBoardLifecycleColumnId,
  operatingDate: string,
) {
  if (isProjectLate(project, operatingDate)) {
    return 'late'
  }

  const daysUntilTarget = Math.round((toDate(project.targetDate).getTime() - toDate(operatingDate).getTime()) / 86_400_000)
  const counts = getAssignmentCounts(project)

  if (counts.blocked > 0 || daysUntilTarget <= 1 || lifecycleStage === 'TEST' || lifecycleStage === 'PWR_CHECK') {
    return 'watch'
  }

  return 'healthy'
}

export function deriveProjectLifecycleStage(
  project: D380ProjectsBoardProjectRecord,
): ProjectsBoardLifecycleColumnId {
  const { milestones } = project

  if (milestones.biqComplete && milestones.completedAt && isOnOrBeforeTarget(milestones.completedAt, project.targetDate)) {
    return 'COMPLETED'
  }

  if (milestones.powerCheckPassed) {
    return 'BIQ'
  }

  if (milestones.testPassed) {
    return 'PWR_CHECK'
  }

  if (milestones.crossWireComplete && milestones.testReady) {
    return 'TEST'
  }

  if (
    anyAssignmentsAtOrBeyondWiring(project)
    || milestones.buildUpCompletionPercent >= CONASY_THRESHOLD_PERCENT
    || milestones.readyToWirePercent >= CONASY_THRESHOLD_PERCENT
  ) {
    return 'CONASY'
  }

  if (anyAssignmentsAtOrBeyondBuildUp(project)) {
    return 'CONLAY'
  }

  if (milestones.kitReady) {
    return 'KITTED'
  }

  return 'UPCOMING'
}

export function isProjectLate(
  project: D380ProjectsBoardProjectRecord,
  operatingDate: string = new Date().toISOString().slice(0, 10),
) {
  const lifecycleStage = deriveProjectLifecycleStage(project)

  if (lifecycleStage === 'COMPLETED') {
    return false
  }

  return toDate(project.targetDate).getTime() < toDate(operatingDate).getTime()
}

function toProjectCardViewModel(
  project: D380ProjectsBoardProjectRecord,
  operatingDate: string,
): ProjectsBoardProjectCardViewModel {
  const lifecycleStage = deriveProjectLifecycleStage(project)
  const isLate = isProjectLate(project, operatingDate)
  const risk = deriveRiskLevel(project, lifecycleStage, operatingDate)
  const assignmentCounts = getAssignmentCounts(project)

  return {
    id: project.id,
    pdNumber: project.pdNumber,
    name: project.name,
    member: project.member,
    shiftLabel: getShiftLabel(project.shift),
    units: project.units,
    lifecycleStage,
    lifecycleLabel: lifecycleLabelLookup[lifecycleStage],
    risk,
    isLate,
    lateReason: isLate ? getLateReason(lifecycleStage) : undefined,
    targetDateLabel: dateFormatter.format(toDate(project.targetDate)),
    statusNote: project.statusNote,
    progressPercent: getProgressPercent(project, lifecycleStage),
    assignmentCounts,
    layoutCoverLabel: project.layoutCoverLabel,
    coverTone: project.coverTone,
  }
}

function sortProjects(projects: ProjectsBoardProjectCardViewModel[]) {
  const riskWeight: Record<ProjectsBoardRiskLevel, number> = {
    late: 0,
    watch: 1,
    healthy: 2,
  }

  return [...projects].sort((left, right) => {
    const riskDelta = riskWeight[left.risk] - riskWeight[right.risk]
    if (riskDelta !== 0) {
      return riskDelta
    }

    return right.progressPercent - left.progressPercent
  })
}

export function applyProjectsBoardFilters(
  projects: ProjectsBoardProjectCardViewModel[],
  filters: ProjectsBoardFilterState,
) {
  const query = filters.search.trim().toLowerCase()

  return projects.filter(project => {
    if (filters.shift !== 'ALL' && project.shiftLabel !== getShiftLabel(filters.shift)) {
      return false
    }

    if (filters.risk !== 'ALL' && project.risk !== filters.risk) {
      return false
    }

    if (filters.lifecycle !== 'ALL' && project.lifecycleStage !== filters.lifecycle) {
      return false
    }

    if (filters.lateOnly && !project.isLate) {
      return false
    }

    if (!query) {
      return true
    }

    const searchFields = [
      project.pdNumber,
      project.name,
      project.member,
      project.lifecycleLabel,
      project.statusNote,
    ]

    return searchFields.some(field => field.toLowerCase().includes(query))
  })
}

export function groupProjectsByLifecycleColumn(
  projects: ProjectsBoardProjectCardViewModel[],
): ProjectsBoardColumnViewModel[] {
  return lifecycleColumns.map(column => ({
    id: column.id,
    label: column.label,
    description: column.description,
    projects: sortProjects(projects.filter(project => project.lifecycleStage === column.id)),
  }))
}

const EMPTY_PROJECTS_DATA_SET: D380ProjectsBoardDataSet = {
  operatingDate: new Date().toISOString().slice(0, 10),
  projects: [],
}

export function buildProjectsBoardViewModel({
  dataSet,
  filters,
}: {
  dataSet?: D380ProjectsBoardDataSet
  filters: ProjectsBoardFilterState
}): D380ProjectsBoardViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_PROJECTS_DATA_SET
  const allProjects = resolvedDataSet.projects.map(project => toProjectCardViewModel(project, resolvedDataSet.operatingDate))
  const filteredProjects = applyProjectsBoardFilters(allProjects, filters)
  const columns = groupProjectsByLifecycleColumn(filteredProjects)
  const lateProjectCount = allProjects.filter(project => project.isLate).length
  const completedProjectCount = allProjects.filter(project => project.lifecycleStage === 'COMPLETED').length
  const watchProjectCount = allProjects.filter(project => project.risk === 'watch').length
  const hasActiveFilters = Boolean(
    filters.search.trim()
      || filters.shift !== 'ALL'
      || filters.risk !== 'ALL'
      || filters.lifecycle !== 'ALL'
      || filters.lateOnly,
  )

  return {
    operatingDateLabel: dateFormatter.format(toDate(resolvedDataSet.operatingDate)),
    totalProjects: allProjects.length,
    filteredProjectCount: filteredProjects.length,
    lateProjectCount,
    completedProjectCount,
    watchProjectCount,
    hasActiveFilters,
    shiftOptions: [
      { value: 'ALL', label: 'All shifts' },
      { value: '1st', label: '1st Shift' },
      { value: '2nd', label: '2nd Shift' },
    ],
    riskOptions: [
      { value: 'ALL', label: 'All risk' },
      { value: 'healthy', label: 'Healthy' },
      { value: 'watch', label: 'Watch' },
      { value: 'late', label: 'Late' },
    ],
    lifecycleOptions: [
      { value: 'ALL', label: 'All columns' },
      ...lifecycleColumns.map(column => ({ value: column.id, label: column.label })),
    ],
    columns,
    emptyState: hasActiveFilters
      ? {
          title: 'No projects match the current filters.',
          description: 'Adjust the search or filters to bring work back into view across the lifecycle board.',
        }
      : {
          title: 'No projects are staged yet.',
          description: 'The lifecycle board is ready for data, but the current dataset is empty.',
        },
  }
}

/**
 * Get an empty projects board data set.
 * Real data should be loaded from the Share import service.
 */
export function getProjectsBoardDataSet(): D380ProjectsBoardDataSet {
  return EMPTY_PROJECTS_DATA_SET
}
