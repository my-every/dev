import type {
  D380WiringDataSet,
  D380WiringRecord,
  RoutingPlan,
  TerminationPlan,
  ValidationPlan,
  WiringConnectionPlan,
  WiringExportReadiness,
  WiringHeaderViewModel,
  WiringProgressSummaryViewModel,
  WiringSectionDisplayState,
  WiringSectionId,
  WiringSectionState,
  WiringViewModel,
  WiringWorkflowState,
} from '@/types/d380-wiring'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const wiringSectionOrder: WiringSectionId[] = [
  'WIRING_PREP',
  'GROUNDING_INITIAL',
  'RELAY_TIMER',
  'SMALL_GAUGE',
  'DIODES_AC',
  'CABLES_COMM',
  'FINAL_COMPLETION',
  'IPV_FINAL',
]

export const wiringSectionLabels: Record<WiringSectionId, string> = {
  WIRING_PREP: 'Wiring Prep',
  GROUNDING_INITIAL: 'Grounding + Initial Wiring',
  RELAY_TIMER: 'Relay / Timer Wiring',
  SMALL_GAUGE: 'Small Gauge Wiring',
  DIODES_AC: 'Diodes + AC Wiring',
  CABLES_COMM: 'Cables + Communication',
  FINAL_COMPLETION: 'Final Wiring Completion',
  IPV_FINAL: 'IPV + Final Validation',
}

const statusLabels = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETE: 'Complete',
} as const

function getShiftLabel(shift: D380WiringRecord['shift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function getDevicePrefix(deviceId: string) {
  const match = deviceId.match(/^[A-Z]+/)
  return match?.[0] ?? 'UNKNOWN'
}

function formatConnectionLabel(connection: D380WiringRecord['connections'][number]) {
  return `${connection.wireNumber} · ${connection.fromDeviceId} → ${connection.toDeviceId}`
}

function getDependenciesComplete(wiring: D380WiringRecord, workflowState: WiringWorkflowState, sectionId: WiringSectionId) {
  const section = wiring.sections.find(candidate => candidate.id === sectionId)
  return section?.dependencies.every(dependencyId => workflowState.sections[dependencyId]?.status === 'COMPLETE') ?? false
}

export function buildWiringSectionStates({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState?: WiringWorkflowState
}): WiringSectionState[] {
  return wiring.sections.map(section => {
    const snapshot = workflowState?.sections[section.id]

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      status: snapshot?.status ?? section.initialStatus,
      dependencies: section.dependencies,
      completedAt: snapshot?.completedAt ?? section.completedAt ?? null,
      blockedReason: snapshot?.blockedReason ?? section.blockedReason ?? null,
      comments: snapshot?.comments ?? section.seedComments ?? [],
      checklist: section.checklist.map(item => ({
        id: item.id,
        label: item.label,
        checked: snapshot?.checklist[item.id] ?? item.checked,
      })),
    }
  })
}

export function buildConnectionPlan({ wiring }: { wiring: D380WiringRecord }): WiringConnectionPlan {
  const byDevice: Record<string, string[]> = {}
  const byBundle: Record<string, string[]> = {}
  const byHarness: Record<string, string[]> = {}

  wiring.connections.forEach(connection => {
    ;[connection.fromDeviceId, connection.toDeviceId].forEach(deviceId => {
      byDevice[deviceId] = [...(byDevice[deviceId] ?? []), connection.id]
    })

    const bundleId = connection.bundleId ?? 'UNASSIGNED'
    byBundle[bundleId] = [...(byBundle[bundleId] ?? []), connection.id]

    const harnessId = connection.harnessId ?? 'UNASSIGNED'
    byHarness[harnessId] = [...(byHarness[harnessId] ?? []), connection.id]
  })

  return {
    byDevice,
    byBundle,
    byHarness,
    totalConnections: wiring.connections.length,
  }
}

export function buildRoutingPlan({ wiring }: { wiring: D380WiringRecord }): RoutingPlan {
  return {
    panductPaths: wiring.connections.filter(connection => connection.routeHint === 'PANDUCT').map(formatConnectionLabel),
    consoleRoutes: wiring.connections.filter(connection => connection.routeHint === 'CONSOLE').map(formatConnectionLabel),
    underRailConnections: wiring.connections.filter(connection => connection.routeHint === 'UNDER_RAIL').map(formatConnectionLabel),
    overRailConnections: wiring.connections.filter(connection => connection.routeHint === 'OVER_RAIL').map(formatConnectionLabel),
  }
}

export function buildTerminationPlan({ wiring }: { wiring: D380WiringRecord }): TerminationPlan {
  const relayConnections = wiring.connections.filter(connection => ['KA', 'KT'].includes(getDevicePrefix(connection.fromDeviceId)) || ['KA', 'KT'].includes(getDevicePrefix(connection.toDeviceId))).map(formatConnectionLabel)
  const moduleConnections = wiring.connections.filter(connection => ['AF', 'AU', 'PLC'].includes(getDevicePrefix(connection.fromDeviceId)) || ['AF', 'AU', 'PLC'].includes(getDevicePrefix(connection.toDeviceId))).map(formatConnectionLabel)
  const terminalConnections = wiring.connections.filter(connection => ['XT', 'TB'].includes(getDevicePrefix(connection.fromDeviceId)) || ['XT', 'TB'].includes(getDevicePrefix(connection.toDeviceId))).map(formatConnectionLabel)
  const busBarConnections = wiring.connections.filter(connection => ['BB', 'AT'].includes(getDevicePrefix(connection.fromDeviceId)) || ['BB', 'AT'].includes(getDevicePrefix(connection.toDeviceId))).map(formatConnectionLabel)
  const ferruleWarnings = wiring.connections
    .filter(connection => Boolean(connection.terminationNote) || (connection.connectionKind === 'SC' && !connection.isCable && connection.gauge !== 'CABLE' && connection.status !== 'COMPLETE'))
    .map(connection => connection.terminationNote ?? `${formatConnectionLabel(connection)} still needs ferrule and termination confirmation.`)

  return {
    relayConnections,
    moduleConnections,
    terminalConnections,
    busBarConnections,
    ferruleWarnings,
  }
}

export function buildValidationPlan({ wiring }: { wiring: D380WiringRecord }): ValidationPlan {
  return {
    pullTestConnectionIds: wiring.connections.filter(connection => connection.requiresPullTest).map(connection => connection.id),
    polarityValidationIds: wiring.connections.filter(connection => connection.requiresPolarityValidation).map(connection => connection.id),
    birdCageInspectionIds: wiring.connections.filter(connection => connection.connectionKind !== 'W' && connection.gauge !== 'CABLE').map(connection => connection.id),
    stripLengthInspectionIds: wiring.connections
      .filter(connection => ['KA', 'KT', 'AF', 'AU', 'XT', 'TB'].includes(getDevicePrefix(connection.fromDeviceId)) || ['KA', 'KT', 'AF', 'AU', 'XT', 'TB'].includes(getDevicePrefix(connection.toDeviceId)))
      .map(connection => connection.id),
    discrepancyChecks: wiring.connections
      .filter(connection => connection.status === 'BLOCKED' || Boolean(connection.validationNote) || Boolean(connection.terminationNote))
      .map(connection => connection.validationNote ?? connection.terminationNote ?? `${formatConnectionLabel(connection)} is currently blocked.`),
  }
}

export function buildWiringExportReadiness({
  wiring,
  sectionStates,
  validationPlan,
}: {
  wiring: D380WiringRecord
  sectionStates: WiringSectionState[]
  validationPlan: ValidationPlan
}): WiringExportReadiness {
  const requiredBeforeIpv: WiringSectionId[] = [
    'WIRING_PREP',
    'GROUNDING_INITIAL',
    'RELAY_TIMER',
    'SMALL_GAUGE',
    'DIODES_AC',
    'CABLES_COMM',
    'FINAL_COMPLETION',
  ]

  const missingRequirements = requiredBeforeIpv
    .filter(sectionId => sectionStates.find(section => section.id === sectionId)?.status !== 'COMPLETE')
    .map(sectionId => wiringSectionLabels[sectionId])

  if (wiring.connections.some(connection => connection.status === 'BLOCKED')) {
    missingRequirements.push('Clear blocked connection execution')
  }

  if (validationPlan.discrepancyChecks.length > 0) {
    missingRequirements.push('Resolve validation discrepancies')
  }

  const ipvReady = requiredBeforeIpv.every(sectionId => sectionStates.find(section => section.id === sectionId)?.status === 'COMPLETE')
    && validationPlan.discrepancyChecks.length === 0

  const ipvSectionComplete = sectionStates.find(section => section.id === 'IPV_FINAL')?.status === 'COMPLETE'

  return {
    ready: ipvSectionComplete && missingRequirements.length === 0,
    ipvReady,
    missingRequirements,
  }
}

export function getNextActionableWiringSection({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
}): WiringSectionId | null {
  const activeSectionId = wiringSectionOrder.find(sectionId => workflowState.sections[sectionId]?.status === 'IN_PROGRESS')
  if (activeSectionId) {
    return activeSectionId
  }

  return wiringSectionOrder.find(sectionId => canStartWiringSection({ wiring, workflowState, sectionId })) ?? null
}

export function canStartWiringSection({
  wiring,
  workflowState,
  sectionId,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
  sectionId: WiringSectionId
}) {
  const snapshot = workflowState.sections[sectionId]
  if (!snapshot || snapshot.status === 'COMPLETE' || snapshot.status === 'BLOCKED') {
    return false
  }

  if (!getDependenciesComplete(wiring, workflowState, sectionId)) {
    return false
  }

  const activeSectionId = wiringSectionOrder.find(candidate => workflowState.sections[candidate]?.status === 'IN_PROGRESS')
  if (activeSectionId && activeSectionId !== sectionId) {
    return false
  }

  return true
}

export function canCompleteWiringSection({
  wiring,
  workflowState,
  sectionId,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
  sectionId: WiringSectionId
}) {
  const section = wiring.sections.find(candidate => candidate.id === sectionId)
  const snapshot = workflowState.sections[sectionId]

  if (!section || !snapshot || snapshot.status !== 'IN_PROGRESS') {
    return false
  }

  if (!getDependenciesComplete(wiring, workflowState, sectionId)) {
    return false
  }

  const sectionStates = buildWiringSectionStates({ wiring, workflowState })
  const validationPlan = buildValidationPlan({ wiring })

  if (sectionId === 'IPV_FINAL' && !buildWiringExportReadiness({ wiring, sectionStates, validationPlan }).ipvReady) {
    return false
  }

  return section.checklist.every(item => snapshot.checklist[item.id])
}

export function getWiringSectionDisplayState({
  wiring,
  workflowState,
  sectionId,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
  sectionId: WiringSectionId
}): WiringSectionDisplayState {
  const snapshot = workflowState.sections[sectionId]

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

  if (canStartWiringSection({ wiring, workflowState, sectionId })) {
    return 'available'
  }

  return 'future'
}

export function buildWiringStageSnapshot({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState?: WiringWorkflowState
}) {
  const sectionStates = buildWiringSectionStates({ wiring, workflowState })
  const validationPlan = buildValidationPlan({ wiring })

  return {
    projectId: wiring.projectId,
    sheetName: wiring.sheetName,
    revision: wiring.revision,
    sectionStates,
    totalConnections: wiring.connections.length,
    completedConnections: wiring.connections.filter(connection => connection.status === 'COMPLETE').length,
    blockedConnections: wiring.connections.filter(connection => connection.status === 'BLOCKED').length,
    exportReadiness: buildWiringExportReadiness({ wiring, sectionStates, validationPlan }),
  }
}

export function buildWiringViewModel({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
}): WiringViewModel {
  const sections = buildWiringSectionStates({ wiring, workflowState })
  const connectionPlan = buildConnectionPlan({ wiring })
  const routingPlan = buildRoutingPlan({ wiring })
  const terminationPlan = buildTerminationPlan({ wiring })
  const validationPlan = buildValidationPlan({ wiring })

  return {
    projectId: wiring.projectId,
    sheetName: wiring.sheetName,
    title: `${wiring.projectName} · ${wiring.sheetName}`,
    sections,
    connectionPlan,
    routingPlan,
    terminationPlan,
    validationPlan,
    exportReadiness: buildWiringExportReadiness({ wiring, sectionStates: sections, validationPlan }),
    currentActionableSectionId: getNextActionableWiringSection({ wiring, workflowState }),
  }
}

export function buildWiringHeaderViewModel({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
}): WiringHeaderViewModel {
  const currentSectionId = getNextActionableWiringSection({ wiring, workflowState })
  const currentSnapshot = currentSectionId ? workflowState.sections[currentSectionId] : undefined

  return {
    projectId: wiring.projectId,
    pdNumber: wiring.pdNumber,
    projectName: wiring.projectName,
    sheetName: wiring.sheetName,
    revisionLabel: wiring.revision,
    shiftLabel: getShiftLabel(wiring.shift),
    currentSectionLabel: currentSectionId ? wiringSectionLabels[currentSectionId] : 'Awaiting release',
    currentStatusLabel: currentSnapshot ? statusLabels[currentSnapshot.status] : 'Awaiting release',
    statusNote: wiring.statusNote,
    leadSummary: wiring.leadSummary,
  }
}

export function buildWiringProgressSummary({
  wiring,
  workflowState,
}: {
  wiring: D380WiringRecord
  workflowState: WiringWorkflowState
}): WiringProgressSummaryViewModel {
  const sectionStates = buildWiringSectionStates({ wiring, workflowState })
  const completedSections = sectionStates.filter(section => section.status === 'COMPLETE').length
  const blockedSections = sectionStates.filter(section => section.status === 'BLOCKED').length
  const stageSnapshot = buildWiringStageSnapshot({ wiring, workflowState })
  const currentActionableSectionId = getNextActionableWiringSection({ wiring, workflowState })
  const exportReadiness = stageSnapshot.exportReadiness

  return {
    totalSections: wiringSectionOrder.length,
    completedSections,
    blockedSections,
    completionPercent: Math.round((completedSections / wiringSectionOrder.length) * 100),
    currentActionableSectionLabel: currentActionableSectionId ? wiringSectionLabels[currentActionableSectionId] : 'Awaiting release',
    totalConnections: stageSnapshot.totalConnections,
    completedConnections: stageSnapshot.completedConnections,
    blockedConnections: stageSnapshot.blockedConnections,
    exportReady: exportReadiness.ready,
    ipvReady: exportReadiness.ipvReady,
    exportReadinessLabel: exportReadiness.ready
      ? 'Export and IPV gate are ready.'
      : exportReadiness.ipvReady
        ? 'IPV can start, but export is still waiting on final section closure.'
        : `Missing: ${exportReadiness.missingRequirements.join(', ')}`,
    ipvReadinessLabel: exportReadiness.ipvReady
      ? 'IPV gate can be executed.'
      : exportReadiness.missingRequirements.length > 0
        ? `IPV blocked by ${exportReadiness.missingRequirements.length} requirement${exportReadiness.missingRequirements.length === 1 ? '' : 's'}.`
        : 'IPV gate is still waiting on section closure.',
    exportReadiness,
  }
}

export function getWiringRecord(projectId: string, dataSet?: D380WiringDataSet) {
  if (!dataSet) return undefined
  return dataSet.projects.find(candidate => candidate.projectId === projectId)
}

export function formatWiringTimestamp(value?: string | null) {
  return value ? dateFormatter.format(new Date(value)) : undefined
}
