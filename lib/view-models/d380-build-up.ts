import type {
  BuildUpExportReadiness,
  BuildUpHeaderViewModel,
  BuildUpMetricCardViewModel,
  BuildUpProgressSummaryViewModel,
  BuildUpSwsSectionSchema,
  BuildUpSectionState,
  BuildUpSectionItemViewModel,
  BuildUpSectionStatViewModel,
  BuildUpSectionViewModel,
  BuildUpStageSnapshot,
  BuildUpWorkflowSectionDisplayState,
  BuildUpWorkflowSectionId,
  BuildUpWorkflowState,
  D380BuildUpDataSet,
  D380ProjectBuildUpRecord,
  D380BuildUpWorkspaceViewModel,
} from '@/types/d380-build-up'
import { getSwsTemplate } from '@/lib/sws/sws-template-registry'

const BUILD_UP_SCHEMA_VERSION = 1 as const

const buildUpToTemplateSectionMap: Partial<Record<BuildUpWorkflowSectionId, string>> = {
  PROJECT_VERIFICATION: 'obtain-parts',
  MECHANICAL_SUMMARY: 'prepare-build',
  RAIL_CUT_LIST: 'standoffs-rails',
  PANDUCT_CUT_LIST: 'panduct',
  PANEL_COMPONENTS: 'panel-components',
  RAIL_COMPONENTS: 'rail-components',
  GROUNDING: 'drill-bond',
  BLUE_LABELS: 'blue-labels',
  FINAL_INSPECTION: 'clean-complete-build',
  EXPORT_READINESS: 'stamp-complete',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const operatingDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

export const buildUpSectionOrder: BuildUpWorkflowSectionId[] = [
  'PROJECT_VERIFICATION',
  'MECHANICAL_SUMMARY',
  'RAIL_CUT_LIST',
  'PANDUCT_CUT_LIST',
  'PANEL_COMPONENTS',
  'RAIL_COMPONENTS',
  'GROUNDING',
  'BLUE_LABELS',
  'FINAL_INSPECTION',
  'EXPORT_READINESS',
]

export const buildUpSectionLabels: Record<BuildUpWorkflowSectionId, string> = {
  PROJECT_VERIFICATION: 'Project Verification',
  MECHANICAL_SUMMARY: 'Layout / Mechanical Summary',
  RAIL_CUT_LIST: 'Rail Cut List',
  PANDUCT_CUT_LIST: 'Panduct Cut List',
  PANEL_COMPONENTS: 'Panel Installed Components',
  RAIL_COMPONENTS: 'Rail Installed Components',
  GROUNDING: 'Grounding / Bonding',
  BLUE_LABELS: 'Blue Labels / Labeling',
  FINAL_INSPECTION: 'Final Inspection',
  EXPORT_READINESS: 'Export Readiness',
}

const statusLabels = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETE: 'Complete',
} as const

function getShiftLabel(shift: D380ProjectBuildUpRecord['shift']) {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

function formatTimestamp(value?: string) {
  return value ? dateFormatter.format(new Date(value)) : undefined
}

function formatOneDecimal(value: number) {
  return value.toFixed(1)
}

function buildSectionStates({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState?: BuildUpWorkflowState
}): BuildUpSectionState[] {
  return project.sections.map(section => {
    const snapshot = workflowState?.sections[section.id]

    return {
      id: section.id,
      title: section.title,
      status: snapshot?.status ?? section.initialStatus,
      completedAt: snapshot?.completedAt ?? section.completedAt ?? null,
      blockedReason: snapshot?.blockedReason ?? section.blockedReason ?? null,
      comments: snapshot?.comment
        ? [snapshot.comment]
        : section.seedComment
          ? [section.seedComment]
          : [],
      checklist: section.checklist.map(item => ({
        id: item.id,
        label: item.label,
        checked: snapshot?.checklist[item.id] ?? item.completed,
      })),
    }
  })
}

export function buildBuildUpExportReadiness({
  project,
  workflowState,
  sectionStates,
}: {
  project: D380ProjectBuildUpRecord
  workflowState?: BuildUpWorkflowState
  sectionStates?: BuildUpSectionState[]
}): BuildUpExportReadiness {
  const resolvedSectionStates = sectionStates ?? buildSectionStates({ project, workflowState })

  return {
    ready: project.exportRecord.requiredSectionIds.every(sectionId => resolvedSectionStates.find(section => section.id === sectionId)?.status === 'COMPLETE'),
    missingRequirements: project.exportRecord.requiredSectionIds
      .filter(sectionId => resolvedSectionStates.find(section => section.id === sectionId)?.status !== 'COMPLETE')
      .map(sectionId => buildUpSectionLabels[sectionId]),
    requiredSectionIds: project.exportRecord.requiredSectionIds,
  }
}

export function buildBuildUpStageSnapshot({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState?: BuildUpWorkflowState
}): BuildUpStageSnapshot {
  const sections = buildSectionStates({ project, workflowState })
  const exportReadiness = buildBuildUpExportReadiness({ project, sectionStates: sections })

  return {
    projectId: project.projectId,
    revision: project.revision,
    panelName: project.panelName,
    sections,
    mechanicalSummaryReady: sections.find(section => section.id === 'MECHANICAL_SUMMARY')?.status === 'COMPLETE',
    exportReady: exportReadiness.ready,
  }
}

function getUniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size
}

function getDependenciesComplete(project: D380ProjectBuildUpRecord, workflowState: BuildUpWorkflowState, sectionId: BuildUpWorkflowSectionId) {
  const section = project.sections.find(candidate => candidate.id === sectionId)
  return section?.dependencySectionIds.every(dependencyId => workflowState.sections[dependencyId]?.status === 'COMPLETE') ?? false
}

export function isBuildUpExportReady({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}) {
  return buildBuildUpExportReadiness({ project, workflowState }).ready
}

export function canStartBuildUpSection({
  project,
  workflowState,
  sectionId,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
  sectionId: BuildUpWorkflowSectionId
}) {
  const snapshot = workflowState.sections[sectionId]

  if (!snapshot || snapshot.status === 'COMPLETE' || snapshot.status === 'BLOCKED') {
    return false
  }

  if (!getDependenciesComplete(project, workflowState, sectionId)) {
    return false
  }

  const activeSectionId = buildUpSectionOrder.find(candidate => workflowState.sections[candidate]?.status === 'IN_PROGRESS')
  if (activeSectionId && activeSectionId !== sectionId) {
    return false
  }

  if (sectionId === 'EXPORT_READINESS' && !isBuildUpExportReady({ project, workflowState })) {
    return false
  }

  return true
}

export function canCompleteBuildUpSection({
  project,
  workflowState,
  sectionId,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
  sectionId: BuildUpWorkflowSectionId
}) {
  const section = project.sections.find(candidate => candidate.id === sectionId)
  const snapshot = workflowState.sections[sectionId]

  if (!section || !snapshot || snapshot.status !== 'IN_PROGRESS') {
    return false
  }

  if (!getDependenciesComplete(project, workflowState, sectionId)) {
    return false
  }

  if (sectionId === 'EXPORT_READINESS' && !isBuildUpExportReady({ project, workflowState })) {
    return false
  }

  return section.checklist.every(item => !item.required || snapshot.checklist[item.id])
}

export function getNextBuildUpSection({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}) {
  const activeSectionId = buildUpSectionOrder.find(sectionId => workflowState.sections[sectionId]?.status === 'IN_PROGRESS')
  if (activeSectionId) {
    return activeSectionId
  }

  return buildUpSectionOrder.find(sectionId => canStartBuildUpSection({ project, workflowState, sectionId }))
}

export function getBuildUpSectionDisplayState({
  project,
  workflowState,
  sectionId,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
  sectionId: BuildUpWorkflowSectionId
}): BuildUpWorkflowSectionDisplayState {
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

  if (canStartBuildUpSection({ project, workflowState, sectionId })) {
    return 'available'
  }

  return 'future'
}

export function buildBuildUpProgressSummary({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}): BuildUpProgressSummaryViewModel {
  const stageSnapshot = buildBuildUpStageSnapshot({ project, workflowState })
  const exportReadiness = buildBuildUpExportReadiness({ project, sectionStates: stageSnapshot.sections })
  const completedSectionsCount = buildUpSectionOrder.filter(sectionId => workflowState.sections[sectionId]?.status === 'COMPLETE').length
  const blockedCount = buildUpSectionOrder.filter(sectionId => workflowState.sections[sectionId]?.status === 'BLOCKED').length
  const completionPercent = Math.round((completedSectionsCount / buildUpSectionOrder.length) * 100)
  const currentActionableSectionId = getNextBuildUpSection({ project, workflowState })
  const currentSectionLabel = currentActionableSectionId ? buildUpSectionLabels[currentActionableSectionId] : 'Awaiting release'
  const nextIndex = currentActionableSectionId ? buildUpSectionOrder.indexOf(currentActionableSectionId) + 1 : -1
  const nextSectionLabel = nextIndex > 0 && nextIndex < buildUpSectionOrder.length ? buildUpSectionLabels[buildUpSectionOrder[nextIndex]] : undefined

  return {
    completionPercent,
    completedSectionsCount,
    totalSections: buildUpSectionOrder.length,
    currentSectionLabel,
    nextSectionLabel,
    blockedCount,
    exportReadinessLabel: exportReadiness.ready ? 'Export can release.' : `Missing: ${exportReadiness.missingRequirements.join(', ')}`,
    exportReadiness,
  }
}

function buildVerificationItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  const shortages = project.projectVerification.missingParts.length > 0 ? project.projectVerification.missingParts.join('; ') : 'No shortages recorded at verification.'

  return [
    {
      id: 'verification-identity',
      eyebrow: 'Identity',
      title: `${project.pdNumber} · ${project.panelName}`,
      description: `${project.projectName} ${project.unit} matched to ${project.projectVerification.drawingTitle}.`,
      chips: [project.revision, project.projectVerification.layoutVerified ? 'Layout verified' : 'Layout pending'],
      tone: 'positive',
    },
    {
      id: 'verification-working-copy',
      eyebrow: 'Worksheet',
      title: 'Working copy and panel labeling',
      description: project.projectVerification.panelIdApplied ? 'Working copy is complete and the panel ID label has been applied.' : 'Panel ID labeling still needs to be applied.',
      chips: [project.projectVerification.workingCopyVerified ? 'Working copy verified' : 'Working copy pending'],
      tone: project.projectVerification.workingCopyVerified && project.projectVerification.panelIdApplied ? 'positive' : 'attention',
    },
    {
      id: 'verification-shortages',
      eyebrow: 'Shortages',
      title: 'Kit and shortage review',
      description: shortages,
      chips: [project.projectVerification.leadNotified ? 'Lead notified' : 'No escalation needed'],
      tone: project.projectVerification.missingParts.length > 0 ? 'attention' : 'neutral',
    },
  ]
}

function buildMechanicalItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return [
    {
      id: 'mechanical-summary',
      eyebrow: 'Extraction',
      title: project.mechanicalExtraction.sheetLabel,
      description: project.mechanicalExtraction.summary,
      chips: [project.mechanicalExtraction.predrilledPanel ? 'Predrilled' : 'Non-predrilled'],
      tone: 'neutral',
    },
    {
      id: 'mechanical-no-drill',
      eyebrow: 'No-Drill Zones',
      title: 'Keep-clear constraints',
      description: project.mechanicalExtraction.noDrillZones.join(' '),
      chips: ['No-drill review'],
      tone: 'attention',
    },
    {
      id: 'mechanical-holes',
      eyebrow: 'Hole Checks',
      title: 'Hanging and mounting conditions',
      description: project.mechanicalExtraction.mountingHoleChecks.join(' '),
      chips: ['Nutcert review'],
      tone: 'neutral',
    },
    {
      id: 'mechanical-oversized',
      eyebrow: 'Oversized Components',
      title: 'Panel and rail install constraints',
      description: `Panel: ${project.mechanicalExtraction.oversizedPanelComponents.join(', ')}. Rail: ${project.mechanicalExtraction.oversizedRailComponents.join(', ')}.`,
      chips: ['Fit-up gate'],
      tone: 'neutral',
    },
  ]
}

function buildRailCutItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return project.mechanicalExtraction.railPlans.map(railPlan => ({
    id: railPlan.id,
    eyebrow: railPlan.railType === 'LOW_PROFILE' ? 'Low rail' : 'Rail',
    title: `${railPlan.label} · ${formatOneDecimal(railPlan.rail.length)}"`,
    description: `${railPlan.locationLabel}. Associated devices: ${railPlan.associatedDeviceIds.join(', ')}. ${railPlan.notes.join(' ')}`,
    chips: [railPlan.mountSide, railPlan.frameGroundRequired ? 'Frame ground required' : 'No frame ground'],
    tone: railPlan.frameGroundRequired ? 'attention' : 'neutral',
  }))
}

function buildPanductItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return project.mechanicalExtraction.panductPlans.map(panductPlan => ({
    id: panductPlan.id,
    eyebrow: panductPlan.sizeLabel,
    title: `${panductPlan.label} · ${formatOneDecimal(panductPlan.cutLength)}"`,
    description: `${panductPlan.locationLabel}. ${panductPlan.notes.join(' ')}`,
    chips: [panductPlan.node.orientation, `${panductPlan.associatedRailIds.length} rail references`],
    tone: panductPlan.notes.some(note => note.toLowerCase().includes('held')) ? 'attention' : 'neutral',
  }))
}

function buildComponentItems(project: D380ProjectBuildUpRecord, mountType: 'PANEL' | 'RAIL'): BuildUpSectionItemViewModel[] {
  const components = mountType === 'PANEL' ? project.panelInstalledComponents : project.railInstalledComponents

  return components.map(component => ({
    id: component.id,
    eyebrow: component.partNumber,
    title: component.title,
    description: `${component.locationLabel}. ${component.description} ${component.installNotes.join(' ')}`,
    chips: [component.groundCheckRequired ? 'Ground check' : 'No bond check', `${component.tools.length} tools`],
    tone: component.blueLabel ? 'positive' : 'neutral',
  }))
}

function buildGroundingItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return project.groundingPlan.map(item => ({
    id: item.id,
    eyebrow: item.kind === 'FRAME_GROUND' ? 'Frame ground' : item.kind === 'RAIL_GROUND' ? 'Rail ground' : 'Bonding',
    title: item.label,
    description: `${item.locationLabel}. Hardware stack: ${item.hardwareStack.join(', ')}. ${item.note ?? ''}`.trim(),
    chips: [item.paintRemovalRequired ? 'Paint removal required' : 'No paint removal', project.mechanicalExtraction.predrilledPanel ? 'Predrilled rules' : 'Template rules'],
    tone: item.paintRemovalRequired ? 'attention' : 'neutral',
  }))
}

function buildBlueLabelItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return [...project.panelInstalledComponents, ...project.railInstalledComponents]
    .filter(component => component.blueLabel)
    .map(component => ({
      id: `${component.id}-label`,
      eyebrow: component.blueLabel?.templateSize ?? 'label',
      title: `${component.blueLabel?.text} placement`,
      description: `${component.title} label on ${component.blueLabel?.placementFace} face using ${component.blueLabel?.placementMode} placement. Reference: ${component.blueLabel?.referenceImageLabel ?? 'No reference image staged yet'}.`,
      chips: [component.blueLabel?.visibilityRequired ? 'Visibility required' : 'Visibility optional', component.blueLabel?.templateSize ?? 'template'],
      tone: 'positive',
    }))
}

function buildFinalInspectionItems(project: D380ProjectBuildUpRecord): BuildUpSectionItemViewModel[] {
  return project.finalInspection.map(item => ({
    id: item.id,
    eyebrow: 'Inspection',
    title: item.label,
    description: item.description,
    chips: ['Final gate'],
    tone: 'neutral',
  }))
}

function buildExportItems(project: D380ProjectBuildUpRecord, workflowState: BuildUpWorkflowState): BuildUpSectionItemViewModel[] {
  const requiredItems: BuildUpSectionItemViewModel[] = project.exportRecord.requiredSectionIds.map(sectionId => ({
    id: `${sectionId}-export`,
    eyebrow: 'Required section',
    title: buildUpSectionLabels[sectionId],
    description: workflowState.sections[sectionId]?.status === 'COMPLETE'
      ? 'Closed and ready for export evidence.'
      : 'Still incomplete, so export remains blocked.',
    chips: [statusLabels[workflowState.sections[sectionId]?.status ?? 'NOT_STARTED']],
    tone: workflowState.sections[sectionId]?.status === 'COMPLETE' ? 'positive' : 'attention',
  }))

  return [
    ...requiredItems,
    {
      id: 'export-destination',
      eyebrow: 'Destination',
      title: project.exportRecord.label,
      description: `${project.exportRecord.description} Output target: ${project.exportRecord.destinationLabel}. ${project.exportRecord.note}`,
      chips: [project.exportRecord.lastGeneratedLabel ?? 'Not generated yet'],
      tone: isBuildUpExportReady({ project, workflowState }) ? 'positive' : 'attention',
    },
  ]
}

function buildSectionStats(project: D380ProjectBuildUpRecord, sectionId: BuildUpWorkflowSectionId, workflowState: BuildUpWorkflowState): BuildUpSectionStatViewModel[] {
  const totalRailInches = project.mechanicalExtraction.railPlans.reduce((sum, item) => sum + item.rail.length, 0)
  const totalPanductLength = project.mechanicalExtraction.panductPlans.reduce((sum, item) => sum + item.cutLength, 0)
  const panelTools = getUniqueCount(project.panelInstalledComponents.flatMap(item => item.tools))
  const railTools = getUniqueCount(project.railInstalledComponents.flatMap(item => item.tools))
  const blueLabelCount = [...project.panelInstalledComponents, ...project.railInstalledComponents].filter(item => item.blueLabel).length

  switch (sectionId) {
    case 'PROJECT_VERIFICATION':
      return [
        { id: 'verification-revision', label: 'Revision', value: project.revision, detail: 'Confirmed against the current working copy.' },
        { id: 'verification-shortages', label: 'Shortages', value: String(project.projectVerification.missingParts.length), detail: 'Immediate shortage capture at project release.' },
        { id: 'verification-panel-id', label: 'Panel ID', value: project.projectVerification.panelIdApplied ? 'Applied' : 'Pending', detail: 'Panel identity label status.' },
      ]
    case 'MECHANICAL_SUMMARY':
      return [
        { id: 'mechanical-rails', label: 'Rails', value: String(project.mechanicalExtraction.railPlans.length), detail: `${formatOneDecimal(totalRailInches)} total rail inches extracted.` },
        { id: 'mechanical-panduct', label: 'Panduct', value: String(project.mechanicalExtraction.panductPlans.length), detail: `${formatOneDecimal(totalPanductLength)} total panduct inches extracted.` },
        { id: 'mechanical-grounds', label: 'Ground points', value: String(project.mechanicalExtraction.grounds.length), detail: 'Frame and rail ground references detected from layout.' },
        { id: 'mechanical-mode', label: 'Panel mode', value: project.mechanicalExtraction.predrilledPanel ? 'Predrilled' : 'Template', detail: 'Determines hardware and bonding prep rules.' },
      ]
    case 'RAIL_CUT_LIST':
      return [
        { id: 'rail-cut-count', label: 'Cuts', value: String(project.mechanicalExtraction.railPlans.length), detail: 'Each rail requires cut, deburr, and dry fit.' },
        { id: 'rail-cut-length', label: 'Total length', value: `${formatOneDecimal(totalRailInches)}"`, detail: 'Combined rail footage for the current slice.' },
        { id: 'rail-tools', label: 'Tools', value: String(getUniqueCount(['rail cutter', 'tape measure', 'deburring tool', 'marker'])), detail: 'Core tool set for rail prep.' },
        { id: 'rail-grounds', label: 'Ground rails', value: String(project.mechanicalExtraction.railPlans.filter(item => item.frameGroundRequired).length), detail: 'Rails requiring frame-ground attention.' },
      ]
    case 'PANDUCT_CUT_LIST':
      return [
        { id: 'panduct-count', label: 'Cuts', value: String(project.mechanicalExtraction.panductPlans.length), detail: 'Panduct cuts staged from layout extraction.' },
        { id: 'panduct-length', label: 'Total length', value: `${formatOneDecimal(totalPanductLength)}"`, detail: 'Combined panduct length for this panel.' },
        { id: 'panduct-sizes', label: 'Sizes', value: String(getUniqueCount(project.mechanicalExtraction.panductPlans.map(item => item.sizeLabel))), detail: 'Unique duct sizes staged in the slice.' },
      ]
    case 'PANEL_COMPONENTS':
      return [
        { id: 'panel-components', label: 'Components', value: String(project.panelInstalledComponents.length), detail: 'Panel-mounted hardware driven from the layout and install rules.' },
        { id: 'panel-ground-checks', label: 'Ground checks', value: String(project.panelInstalledComponents.filter(item => item.groundCheckRequired).length), detail: 'Panel install items that require bonding validation.' },
        { id: 'panel-tools', label: 'Tools', value: String(panelTools), detail: 'Unique tools referenced by panel-mounted hardware.' },
      ]
    case 'RAIL_COMPONENTS':
      return [
        { id: 'rail-components', label: 'Components', value: String(project.railInstalledComponents.length), detail: 'Rail-mounted devices sequenced after rail prep.' },
        { id: 'rail-labels', label: 'Blue labels', value: String(project.railInstalledComponents.filter(item => item.blueLabel).length), detail: 'Rail-mounted devices with label rules already staged.' },
        { id: 'rail-tools', label: 'Tools', value: String(railTools), detail: 'Unique tools referenced by rail install work.' },
      ]
    case 'GROUNDING':
      return [
        { id: 'ground-total', label: 'Ground plans', value: String(project.groundingPlan.length), detail: 'Frame and rail ground plans derived from layout and process rules.' },
        { id: 'ground-frame', label: 'Frame grounds', value: String(project.groundingPlan.filter(item => item.kind === 'FRAME_GROUND').length), detail: 'Bonding points requiring frame prep.' },
        { id: 'ground-mode', label: 'Hardware rule', value: project.mechanicalExtraction.predrilledPanel ? 'Predrilled' : 'No star washer', detail: project.mechanicalExtraction.predrilledPanel ? 'Predrilled stacks include standard ground hardware.' : 'Non-predrilled mode avoids star washer use in this seeded slice.' },
      ]
    case 'BLUE_LABELS':
      return [
        { id: 'blue-label-count', label: 'Label plans', value: String(blueLabelCount), detail: 'Devices that already carry explicit blue-label instructions.' },
        { id: 'blue-label-templates', label: 'Template sizes', value: String(getUniqueCount(project.railInstalledComponents.filter(item => item.blueLabel).map(item => item.blueLabel?.templateSize ?? ''))), detail: 'Small, medium, and large template reuse in the panel.' },
        { id: 'blue-label-faces', label: 'Placement faces', value: String(getUniqueCount(project.railInstalledComponents.filter(item => item.blueLabel).map(item => item.blueLabel?.placementFace ?? ''))), detail: 'Front and top placement rules are both represented.' },
      ]
    case 'FINAL_INSPECTION':
      return [
        { id: 'inspection-items', label: 'Inspection items', value: String(project.finalInspection.length), detail: 'Final mechanical closeout checks.' },
        { id: 'inspection-blockers', label: 'Blocked sections', value: String(buildUpSectionOrder.filter(item => workflowState.sections[item]?.status === 'BLOCKED').length), detail: 'Blocked upstream work still prevents final signoff.' },
      ]
    case 'EXPORT_READINESS':
      return [
        { id: 'export-required', label: 'Required sections', value: String(project.exportRecord.requiredSectionIds.length), detail: 'Build Up sections that must be complete before export.' },
        { id: 'export-ready', label: 'Ready', value: isBuildUpExportReady({ project, workflowState }) ? 'Yes' : 'No', detail: 'Pure helper gate for the export release.' },
      ]
    default:
      return []
  }
}

function buildSectionItems(project: D380ProjectBuildUpRecord, sectionId: BuildUpWorkflowSectionId, workflowState: BuildUpWorkflowState) {
  switch (sectionId) {
    case 'PROJECT_VERIFICATION':
      return buildVerificationItems(project)
    case 'MECHANICAL_SUMMARY':
      return buildMechanicalItems(project)
    case 'RAIL_CUT_LIST':
      return buildRailCutItems(project)
    case 'PANDUCT_CUT_LIST':
      return buildPanductItems(project)
    case 'PANEL_COMPONENTS':
      return buildComponentItems(project, 'PANEL')
    case 'RAIL_COMPONENTS':
      return buildComponentItems(project, 'RAIL')
    case 'GROUNDING':
      return buildGroundingItems(project)
    case 'BLUE_LABELS':
      return buildBlueLabelItems(project)
    case 'FINAL_INSPECTION':
      return buildFinalInspectionItems(project)
    case 'EXPORT_READINESS':
      return buildExportItems(project, workflowState)
    default:
      return []
  }
}

function buildReadinessSummary({
  project,
  workflowState,
  sectionId,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
  sectionId: BuildUpWorkflowSectionId
}) {
  const snapshot = workflowState.sections[sectionId]

  if (snapshot?.status === 'COMPLETE') {
    return 'Closed and ready for downstream Build Up work.'
  }

  if (snapshot?.status === 'BLOCKED') {
    return snapshot.blockedReason ?? 'Blocked locally in the Build Up slice.'
  }

  if (sectionId === 'EXPORT_READINESS') {
    return isBuildUpExportReady({ project, workflowState })
      ? 'All required Build Up sections are complete. Export can release when this section is closed.'
      : 'Export cannot release until every required Build Up section is complete.'
  }

  return getDependenciesComplete(project, workflowState, sectionId)
    ? 'Dependencies are clear for execution in this slice.'
    : 'Upstream Build Up dependencies still need to close before this section can start.'
}

function buildHeaderViewModel({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}): BuildUpHeaderViewModel {
  const currentActionableSectionId = getNextBuildUpSection({ project, workflowState })
  const currentSnapshot = currentActionableSectionId ? workflowState.sections[currentActionableSectionId] : undefined

  return {
    projectId: project.projectId,
    pdNumber: project.pdNumber,
    projectName: project.projectName,
    unit: project.unit,
    panelName: project.panelName,
    revisionLabel: project.revision,
    drawingTitle: project.drawingTitle,
    shiftLabel: getShiftLabel(project.shift),
    leadSummary: project.leadSummary,
    statusNote: project.statusNote,
    currentSectionLabel: currentActionableSectionId ? buildUpSectionLabels[currentActionableSectionId] : 'Awaiting release',
    currentStatusLabel: currentSnapshot ? statusLabels[currentSnapshot.status] : 'Awaiting release',
  }
}

function buildMetricCards({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}): BuildUpMetricCardViewModel[] {
  const completed = buildUpSectionOrder.filter(sectionId => workflowState.sections[sectionId]?.status === 'COMPLETE').length
  const blocked = buildUpSectionOrder.filter(sectionId => workflowState.sections[sectionId]?.status === 'BLOCKED').length
  const installedComponentsCount = project.panelInstalledComponents.length + project.railInstalledComponents.length

  return [
    {
      id: 'mechanical-scope',
      label: 'Mechanical scope',
      value: `${project.mechanicalExtraction.railPlans.length} rails / ${project.mechanicalExtraction.panductPlans.length} ducts`,
      detail: `${formatOneDecimal(project.mechanicalExtraction.railPlans.reduce((sum, item) => sum + item.rail.length, 0))}" of rail and ${formatOneDecimal(project.mechanicalExtraction.panductPlans.reduce((sum, item) => sum + item.cutLength, 0))}" of panduct are staged in the slice.`,
      tone: 'neutral',
    },
    {
      id: 'install-load',
      label: 'Install load',
      value: String(installedComponentsCount),
      detail: `${project.panelInstalledComponents.length} panel-mounted and ${project.railInstalledComponents.length} rail-mounted components are in the current plan.`,
      tone: installedComponentsCount >= 6 ? 'positive' : 'neutral',
    },
    {
      id: 'workflow-state',
      label: 'Workflow state',
      value: `${completed}/${buildUpSectionOrder.length}`,
      detail: blocked > 0 ? `${blocked} section is blocked and needs release attention.` : 'No blocked section is currently staged.',
      tone: blocked > 0 ? 'attention' : 'positive',
    },
    {
      id: 'export-gate',
      label: 'Export gate',
      value: isBuildUpExportReady({ project, workflowState }) ? 'Ready' : 'Gated',
      detail: project.exportRecord.note,
      tone: isBuildUpExportReady({ project, workflowState }) ? 'positive' : 'attention',
    },
  ]
}

function buildSectionViewModels({
  project,
  workflowState,
}: {
  project: D380ProjectBuildUpRecord
  workflowState: BuildUpWorkflowState
}): BuildUpSectionViewModel[] {
  const currentActionableSectionId = getNextBuildUpSection({ project, workflowState })

  return buildUpSectionOrder.map(sectionId => {
    const section = project.sections.find(candidate => candidate.id === sectionId)
    const snapshot = workflowState.sections[sectionId]

    if (!section || !snapshot) {
      throw new Error(`Missing Build Up section state for ${sectionId}`)
    }

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      note: section.note,
      status: snapshot.status,
      statusLabel: statusLabels[snapshot.status],
      displayState: getBuildUpSectionDisplayState({ project, workflowState, sectionId }),
      isActionable: currentActionableSectionId === sectionId,
      dependencySummary: section.dependencySectionIds.length > 0
        ? `Depends on ${section.dependencySectionIds.map(dependencyId => buildUpSectionLabels[dependencyId]).join(', ')}`
        : 'No upstream dependency gate',
      readinessSummary: buildReadinessSummary({ project, workflowState, sectionId }),
      blockedReason: snapshot.blockedReason,
      checklist: section.checklist.map(item => ({
        id: item.id,
        label: item.label,
        required: item.required,
        completed: snapshot.checklist[item.id] ?? false,
      })),
      stats: buildSectionStats(project, sectionId, workflowState),
      items: buildSectionItems(project, sectionId, workflowState),
      comment: snapshot.comment,
      progressUpdates: snapshot.progressUpdates,
      startedAtLabel: formatTimestamp(snapshot.startedAt),
      completedAtLabel: formatTimestamp(snapshot.completedAt),
      canStart: canStartBuildUpSection({ project, workflowState, sectionId }),
      canComplete: canCompleteBuildUpSection({ project, workflowState, sectionId }),
    }
  })
}

function buildBuildUpSectionSchemas({
  project,
  sections,
}: {
  project: D380ProjectBuildUpRecord
  sections: BuildUpSectionViewModel[]
}): BuildUpSwsSectionSchema[] {
  const template = getSwsTemplate('PANEL_BUILD_WIRE')
  const templateSectionById = new Map(template.sections.map(section => [section.id, section]))

  return sections.map(section => {
    const templateSectionId = buildUpToTemplateSectionMap[section.id]
    const templateSection = templateSectionId ? templateSectionById.get(templateSectionId) : undefined

    return {
      schemaVersion: BUILD_UP_SCHEMA_VERSION,
      schemaId: `${project.projectId}:${project.panelName}:${section.id}`,
      projectId: project.projectId,
      panelName: project.panelName,
      templateId: template.id,
      templateSectionId,
      workElementNumber: templateSection?.workElementNumber,
      sectionId: section.id,
      title: section.title,
      description: section.description,
      status: section.status,
      statusLabel: section.statusLabel,
      fields: [
        {
          key: 'note',
          label: 'Section Note',
          type: 'TEXTAREA',
          value: section.note,
          required: false,
          editable: true,
          description: 'Operator-focused guidance for this section.',
        },
        {
          key: 'comment',
          label: 'Current Comment',
          type: 'TEXTAREA',
          value: section.comment,
          required: false,
          editable: true,
          description: 'Live comment captured during section execution.',
        },
        {
          key: 'dependencySummary',
          label: 'Dependency Summary',
          type: 'TEXT',
          value: section.dependencySummary,
          required: false,
          editable: false,
        },
        {
          key: 'readinessSummary',
          label: 'Readiness Summary',
          type: 'TEXT',
          value: section.readinessSummary,
          required: false,
          editable: false,
        },
        {
          key: 'blockedReason',
          label: 'Blocked Reason',
          type: 'TEXTAREA',
          value: section.blockedReason ?? '',
          required: false,
          editable: true,
        },
      ],
      checklist: section.checklist.map(item => ({
        id: item.id,
        label: item.label,
        required: item.required,
        completed: item.completed,
        editable: true,
      })),
      stats: section.stats.map(stat => ({
        id: stat.id,
        label: stat.label,
        value: stat.value,
        detail: stat.detail,
        editable: false,
      })),
      items: section.items.map(item => ({
        id: item.id,
        eyebrow: item.eyebrow,
        title: item.title,
        description: item.description,
        chips: item.chips,
        tone: item.tone,
        editable: true,
      })),
      progressUpdates: section.progressUpdates,
      startedAtLabel: section.startedAtLabel,
      completedAtLabel: section.completedAtLabel,
    }
  })
}

const EMPTY_BUILD_UP_DATA_SET: D380BuildUpDataSet = {
  operatingDate: new Date().toISOString().slice(0, 10),
  projects: [],
}

export function buildBuildUpWorkspaceViewModel({
  projectId,
  workflowState,
  dataSet,
}: {
  projectId: string
  workflowState: BuildUpWorkflowState
  dataSet?: D380BuildUpDataSet
}): D380BuildUpWorkspaceViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_BUILD_UP_DATA_SET
  const project = resolvedDataSet.projects.find(candidate => candidate.projectId === projectId)

  if (!project) {
    return {
      found: false,
      operatingDateLabel: operatingDateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
      metrics: [],
      sections: [],
      sectionSchemas: [],
      emptyState: {
        title: 'Build Up slice not staged yet',
        description: 'No dedicated Build Up workflow data is currently seeded for this project. The route exists, but the project-level mechanical slice still needs mock or file-backed data.',
      },
    }
  }

  const stageSnapshot = buildBuildUpStageSnapshot({ project, workflowState })
  const sections = buildSectionViewModels({ project, workflowState })
  const sectionSchemas = buildBuildUpSectionSchemas({ project, sections })

  return {
    found: true,
    operatingDateLabel: operatingDateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`)),
    header: buildHeaderViewModel({ project, workflowState }),
    progressSummary: buildBuildUpProgressSummary({ project, workflowState }),
    stageSnapshot,
    metrics: buildMetricCards({ project, workflowState }),
    sections,
    sectionSchemas,
    emptyState: {
      title: 'Build Up slice not staged yet',
      description: 'No dedicated Build Up workflow data is currently seeded for this project.',
    },
  }
}
