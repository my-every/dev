import { getDefaultScheduleDateForShift, getDefaultStartTimeForShift, addMinutesToTime } from '@/lib/board/assignment-flow'
import { buildBoardData } from '@/lib/board/board-data'
import {
  type BoardAssignmentRecord,
  findBoardAssignmentsForBadge,
  upsertBoardAssignment,
  readBoardAssignments,
  removeBoardAssignmentRecord,
  updateBoardAssignmentRecord,
} from '@/lib/board/board-store'
import { recordAssignmentCompetency, removeActiveAssignmentFromProfile } from '@/lib/board/skill-ledger'
import { addOperationTimeEntry, updateOperationTimeEntry } from '@/lib/project-state/share-operation-time-handlers'
import { readProfileFromShare, writeProfileToShare } from '@/lib/profile/share-profile-store'
import { verifyPinForRuntime } from '@/lib/session/runtime-user-store'
import { readProjectManifest, updateManifestBoardAssignment, writeProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import { readAssignmentSwsConfig } from '@/lib/project-state/share-assignment-sws-handlers'
import { mapBoardStageToCanonicalStage } from '@/lib/board/stage-workspaces'
import { getAllStations } from '@/types/floor-layout'
import type { BoardAssignmentSelectionInput, BoardAssignmentSource, BoardDataResponse } from '@/lib/board/types'
import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import { getOperationCodesForStage } from '@/types/d380-operation-codes'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { ShiftId } from '@/types/shifts'
import { deriveSwsProgressSummary } from '@/lib/sws/progress'

interface BadgeAssignmentWorkspaceActions {
  openWorkspaceHref: string
  openPrintHref: string | null
}

interface BadgeAssignmentContext {
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetSlug: string
  sheetName: string
  stage: AssignmentStage
  swsType: string | null
  operationCode: string | null
  workflowStatus: 'pending' | 'scheduled' | 'in-progress' | 'completed'
  actualMinutes: number
  estimatedMinutes: number
  progressPercent: number
  completedSections: number
  totalSections: number
  remainingSections: number
  hasStarted: boolean
  actions: BadgeAssignmentWorkspaceActions
}

const ALLOWED_ASSIGNER_ROLES = new Set(['TEAM_LEAD', 'DEVELOPER'])

function mapBoardStageToOperationStage(stage: AssignmentStage): AssignmentStageId {
  const canonicalStage = mapBoardStageToCanonicalStage(stage)
  switch (canonicalStage) {
    case 'READY_TO_LAY':
      return 'BUILD_UP'
    case 'READY_FOR_BIQ':
    case 'FINISHED_BIQ':
      return 'BIQ'
    default:
      return canonicalStage
  }
}

function resolveDefaultOperationCode(stage: AssignmentStage) {
  return getOperationCodesForStage(mapBoardStageToOperationStage(stage))[0]?.code ?? null
}

function computeActualMinutes(startedAt: string, endedAt: string) {
  const startedTime = new Date(startedAt).getTime()
  const endedTime = new Date(endedAt).getTime()
  if (!Number.isFinite(startedTime) || !Number.isFinite(endedTime) || endedTime <= startedTime) {
    return 0
  }

  return Math.max(1, Math.round((endedTime - startedTime) / 60000))
}

function buildBoardAvailabilityUpdate(params: {
  status: 'OFF_SHIFT' | 'AVAILABLE' | 'ON_ASSIGNMENT'
  shiftId: ShiftId | null
  activeAssignmentId?: string | null
  clockedInAt?: string | null
  clockedOutAt?: string | null
}) {
  return {
    boardAvailability: {
      status: params.status,
      shiftId: params.shiftId,
      updatedAt: new Date().toISOString(),
      clockedInAt: params.clockedInAt ?? null,
      clockedOutAt: params.clockedOutAt ?? null,
      activeAssignmentId: params.activeAssignmentId ?? null,
    },
  }
}

function buildProjectWorkspaceHref(projectId: string, sheetSlug: string, mode: 'PRINT_MANUAL' | 'TABLET_INTERACTIVE') {
  const query = new URLSearchParams({
    action: 'sws',
    swsSheetSlug: sheetSlug,
    swsMode: mode,
  });
  return `/projects/${encodeURIComponent(projectId)}?${query.toString()}`;
}

async function buildBadgeAssignmentContext(params: {
  assignmentId: string
  projectId: string
  pdNumber: string
  projectName: string
  sheetSlug: string
  sheetName: string
  stage: AssignmentStage
  workflowStatus: 'pending' | 'scheduled' | 'in-progress' | 'completed'
  operationCode: string | null
  estimatedMinutes: number
  actualMinutes: number
}) : Promise<BadgeAssignmentContext | null> {
  const manifest = await readProjectManifest(params.projectId)
  const assignment = manifest?.assignments?.[params.sheetSlug]
  const swsConfig = await readAssignmentSwsConfig(params.projectId, params.sheetSlug)
  const swsProgress = deriveSwsProgressSummary(swsConfig)

  return {
    assignmentId: params.assignmentId,
    projectId: params.projectId,
    projectName: params.projectName,
    pdNumber: params.pdNumber,
    sheetSlug: params.sheetSlug,
    sheetName: params.sheetName,
    stage: params.stage,
    swsType: assignment?.swsType ? String(assignment.swsType) : null,
    operationCode: params.operationCode ?? assignment?.linkedOperationCode ?? assignment?.boardAssignment?.operationCode ?? null,
    workflowStatus: params.workflowStatus,
    actualMinutes: params.actualMinutes,
    estimatedMinutes: params.estimatedMinutes,
    progressPercent: swsProgress.totalSections > 0 ? swsProgress.progressPercent : Math.max(0, Math.min(100, assignment?.progress ?? 0)),
    completedSections: swsProgress.completedSections,
    totalSections: swsProgress.totalSections,
    remainingSections: swsProgress.remainingSections,
    hasStarted: Boolean((assignment?.actualMinutes ?? params.actualMinutes) > 0 || assignment?.progress || swsProgress.completedSections > 0),
    actions: {
      openWorkspaceHref: buildProjectWorkspaceHref(params.projectId, params.sheetSlug, 'TABLET_INTERACTIVE'),
      openPrintHref: buildProjectWorkspaceHref(params.projectId, params.sheetSlug, 'PRINT_MANUAL'),
    },
  }
}

export async function verifyBoardAssigner(actorBadge: string, actorPin: string) {
  const auth = await verifyPinForRuntime(actorBadge, actorPin)
  if (!auth.valid || !auth.user) {
    return { ok: false as const, status: 401, error: 'Invalid scheduling badge credentials.' }
  }

  if (!ALLOWED_ASSIGNER_ROLES.has(auth.user.role)) {
    return { ok: false as const, status: 403, error: 'Only team leads and developers can assign projects from the board.' }
  }

  return { ok: true as const, user: auth.user }
}

function resolveAssignments(data: BoardDataResponse, items: BoardAssignmentSelectionInput[]) {
  const assignments = data.projects.flatMap(project => project.assignments)
  return items.map(item => ({
    item,
    assignment: assignments.find(candidate => candidate.assignmentId === item.assignmentId) ?? null,
  }))
}

function findEstimatedMinutes(data: BoardDataResponse, assignmentId: string) {
  return data.projects
    .flatMap(project => project.assignments)
    .find(assignment => assignment.assignmentId === assignmentId)
    ?.estimatedMinutes
}

export async function assignBoardAssignments(params: {
  actorBadge: string
  actorPin: string
  memberBadge: string
  items: BoardAssignmentSelectionInput[]
  shiftId?: ShiftId | null
  scheduledDate?: string | null
  startTime?: string | null
  source?: BoardAssignmentSource | null
  assignmentGroupId?: string | null
}) {
  const actorBadge = params.actorBadge.trim().replace(/\D/g, '')
  const actorPin = params.actorPin.trim().replace(/\D/g, '')
  const effectiveActorBadge = actorBadge || '000000'
  const memberBadge = params.memberBadge.trim().replace(/\D/g, '')

  if (!memberBadge || params.items.length === 0) {
    return { ok: false as const, status: 400, error: 'Missing member badge or assignment items.' }
  }

  if (actorBadge && actorPin) {
    const auth = await verifyBoardAssigner(actorBadge, actorPin)
    if (!auth.ok) {
      return auth
    }
  }

  const data = await buildBoardData()
  const resolved = resolveAssignments(data, params.items)
  if (resolved.some(entry => !entry.assignment)) {
    return { ok: false as const, status: 404, error: 'One or more assignments were not found on the current board.' }
  }

  const assignmentGroupId = params.assignmentGroupId ?? `grp-${Date.now()}`
  const previousAssignments = readBoardAssignments()
  const stations = getAllStations()
  const scheduledDate = params.scheduledDate ?? (params.shiftId ? getDefaultScheduleDateForShift(params.shiftId) : null)
  const startTime = params.startTime ?? (params.shiftId ? getDefaultStartTimeForShift(params.shiftId) : null)

  const records = []

  for (const [index, entry] of resolved.entries()) {
    if (!entry.assignment) {
      continue
    }

    const selectedStationId = entry.item.workAreaId ?? entry.assignment.workAreaId ?? null
    const station = selectedStationId ? stations.find(candidate => candidate.id === selectedStationId) : null
    const nextStartTime = entry.item.startTime ?? startTime
    const estimatedMinutes = entry.assignment.estimatedMinutes
    const nextEndTime = entry.item.endTime ?? (nextStartTime ? addMinutesToTime(nextStartTime, estimatedMinutes) : null)
    const queueIndex = entry.item.queueIndex ?? index
    const previousRecord = previousAssignments[entry.assignment.assignmentId]
    const operationCode = entry.item.operationCode ?? previousRecord?.operationCode ?? entry.assignment.operationCode ?? resolveDefaultOperationCode(entry.assignment.stage)

    const record = upsertBoardAssignment({
      assignmentId: entry.assignment.assignmentId,
      projectId: entry.assignment.projectId,
      projectName: entry.assignment.projectName,
      pdNumber: entry.assignment.pdNumber,
      sheetSlug: entry.assignment.sheetSlug,
      sheetName: entry.assignment.sheetName,
      stage: entry.assignment.stage,
      assignedBadge: memberBadge,
      assignedByBadge: effectiveActorBadge,
      partNumbers: entry.assignment.partNumbers,
      workAreaId: station?.id ?? selectedStationId,
      workAreaLabel: station?.shortLabel ?? station?.label ?? null,
      floorArea: station?.floorArea ?? null,
      shiftId: params.shiftId ?? entry.assignment.shiftId ?? null,
      scheduledDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      queueIndex,
      assignmentGroupId: params.items.length > 1 ? assignmentGroupId : null,
      source: params.source ?? null,
      operationCode,
      workflowStatus: station?.id ? 'scheduled' : 'pending',
      activeOperationEntryId: previousRecord?.activeOperationEntryId ?? null,
    })

    if (previousRecord?.assignedBadge && previousRecord.assignedBadge !== memberBadge) {
      await removeActiveAssignmentFromProfile(previousRecord.assignedBadge, previousRecord.assignmentId)
    }

    await recordAssignmentCompetency({
      badge: memberBadge,
      assignmentId: record.assignmentId,
      projectId: record.projectId,
      projectName: record.projectName,
      pdNumber: record.pdNumber,
      sheetName: record.sheetName,
      sheetSlug: record.sheetSlug,
      stage: record.stage,
      partNumbers: record.partNumbers,
      assignedAt: record.assignedAt,
      assignedByBadge: effectiveActorBadge,
      workspaceHref: record.workspaceHref,
    })

    await updateManifestBoardAssignment(record.projectId, record.sheetSlug, {
      assignmentId: record.assignmentId,
      estimatedMinutes,
      assignedBadge: record.assignedBadge,
      assignedAt: record.assignedAt,
      workAreaId: record.workAreaId,
      workAreaLabel: record.workAreaLabel,
      floorArea: record.floorArea,
      shiftId: record.shiftId,
      scheduledDate: record.scheduledDate,
      startTime: record.startTime,
      endTime: record.endTime,
      queueIndex: record.queueIndex,
      assignmentGroupId: record.assignmentGroupId,
      source: record.source,
      operationCode: record.operationCode,
      workflowStatus: record.workflowStatus,
      activeOperationEntryId: record.activeOperationEntryId,
    })

    records.push(record)
  }

  return { ok: true as const, records }
}

export async function persistBoardQuickEdit(params: {
  assignmentId: string
  projectId: string
  sheetSlug: string
  swsType?: string | null
  stage?: string | null
  assignedBadge?: string | null
  workflowStatus?: 'pending' | 'scheduled' | 'in-progress' | 'completed' | null
}) {
  const data = await buildBoardData()
  const assignment = data.projects
    .flatMap(project => project.assignments)
    .find(item => item.assignmentId === params.assignmentId)

  if (!assignment) {
    return { ok: false as const, status: 404, error: 'Assignment not found.' }
  }

  const existingRecord = readBoardAssignments()[params.assignmentId] ?? null
  const normalizedBadge = params.assignedBadge && params.assignedBadge !== 'Unassigned'
    ? params.assignedBadge.trim()
    : null

  let record: BoardAssignmentRecord | null = existingRecord

  if (normalizedBadge) {
    if (record) {
      record = updateBoardAssignmentRecord(params.assignmentId, {
        assignedBadge: normalizedBadge,
        workflowStatus: params.workflowStatus ?? record.workflowStatus,
      })
    } else {
      record = upsertBoardAssignment({
        assignmentId: assignment.assignmentId,
        projectId: assignment.projectId,
        projectName: assignment.projectName,
        pdNumber: assignment.pdNumber,
        sheetSlug: assignment.sheetSlug,
        sheetName: assignment.sheetName,
        stage: assignment.stage,
        assignedBadge: normalizedBadge,
        assignedByBadge: normalizedBadge,
        partNumbers: assignment.partNumbers,
        workAreaId: assignment.workAreaId,
        workAreaLabel: assignment.workAreaLabel,
        floorArea: assignment.floorArea,
        shiftId: assignment.shiftId,
        scheduledDate: assignment.scheduledDate,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        queueIndex: assignment.queueIndex,
        assignmentGroupId: assignment.assignmentGroupId,
        source: assignment.source,
        operationCode: assignment.operationCode,
        workflowStatus: params.workflowStatus ?? assignment.workflowStatus,
        activeOperationEntryId: assignment.activeOperationEntryId,
      })
    }
  } else if (params.assignedBadge === 'Unassigned' || params.assignedBadge === null) {
    removeBoardAssignmentRecord(params.assignmentId)
    record = null
  } else if (record && params.workflowStatus) {
    record = updateBoardAssignmentRecord(params.assignmentId, {
      workflowStatus: params.workflowStatus,
    })
  }

  const workflowStatus =
    params.workflowStatus ??
    record?.workflowStatus ??
    assignment.workflowStatus ??
    (record?.workAreaId ? 'scheduled' : 'pending')

  await updateManifestBoardAssignment(params.projectId, params.sheetSlug, {
    assignmentId: params.assignmentId,
    estimatedMinutes: assignment.estimatedMinutes,
    assignedBadge: record?.assignedBadge ?? null,
    assignedAt: record?.assignedAt ?? assignment.assignedAt ?? null,
    workAreaId: record?.workAreaId ?? assignment.workAreaId ?? null,
    workAreaLabel: record?.workAreaLabel ?? assignment.workAreaLabel ?? null,
    floorArea: record?.floorArea ?? assignment.floorArea ?? null,
    shiftId: record?.shiftId ?? assignment.shiftId ?? null,
    scheduledDate: record?.scheduledDate ?? assignment.scheduledDate ?? null,
    startTime: record?.startTime ?? assignment.startTime ?? null,
    endTime: record?.endTime ?? assignment.endTime ?? null,
    queueIndex: record?.queueIndex ?? assignment.queueIndex ?? null,
    assignmentGroupId: record?.assignmentGroupId ?? assignment.assignmentGroupId ?? null,
    source: record?.source ?? assignment.source ?? null,
    operationCode: record?.operationCode ?? assignment.operationCode ?? null,
    workflowStatus,
    actualStartTime: record?.actualStartTime ?? assignment.actualStartTime ?? null,
    actualEndTime: record?.actualEndTime ?? assignment.actualEndTime ?? null,
    activeOperationEntryId: record?.activeOperationEntryId ?? assignment.activeOperationEntryId ?? null,
  })

  if (params.swsType || params.stage) {
    const manifest = await readProjectManifest(params.projectId)
    const node = manifest?.assignments?.[params.sheetSlug]
    if (manifest && node) {
      const nextStage = params.stage
        ? (params.stage.toUpperCase().replace(/\s+/g, '_') as typeof node.stage)
        : node.stage

      manifest.assignments[params.sheetSlug] = {
        ...node,
        swsType: (params.swsType ?? node.swsType) as typeof node.swsType,
        stage: nextStage,
      }

      await writeProjectManifest(manifest)
    }
  }

  return { ok: true as const }
}

export async function persistBoardTimelineUpdate(params: {
  assignmentId: string
  resourceId: string
  startTime: string
  endTime?: string | null
  shiftId: ShiftId
  scheduledDate?: string | null
}) {
  const data = await buildBoardData()
  const assignment = data.projects.flatMap(project => project.assignments).find(item => item.assignmentId === params.assignmentId)
  if (!assignment) {
    return { ok: false as const, status: 404, error: 'Assignment not found.' }
  }

  const station = getAllStations().find(candidate => candidate.id === params.resourceId)
  if (!station) {
    return { ok: false as const, status: 404, error: 'Work area not found.' }
  }

  const existingRecord = readBoardAssignments()[params.assignmentId]
  const nextEndTime = params.endTime ?? existingRecord?.endTime ?? assignment.endTime ?? null

  const record = existingRecord
    ? updateBoardAssignmentRecord(params.assignmentId, {
      workAreaId: station.id,
      workAreaLabel: station.shortLabel,
      floorArea: station.floorArea,
      shiftId: params.shiftId,
      scheduledDate: params.scheduledDate ?? existingRecord.scheduledDate ?? assignment.scheduledDate,
      startTime: params.startTime,
      endTime: nextEndTime,
      source: existingRecord.source ?? 'timeline',
      workflowStatus: 'scheduled',
    })
    : assignment.assignedBadge
      ? upsertBoardAssignment({
        assignmentId: assignment.assignmentId,
        projectId: assignment.projectId,
        projectName: assignment.projectName,
        pdNumber: assignment.pdNumber,
        sheetSlug: assignment.sheetSlug,
        sheetName: assignment.sheetName,
        stage: assignment.stage,
        assignedBadge: assignment.assignedBadge,
        assignedByBadge: assignment.assignedBadge,
        partNumbers: assignment.partNumbers,
        workAreaId: station.id,
        workAreaLabel: station.shortLabel,
        floorArea: station.floorArea,
        shiftId: params.shiftId,
        scheduledDate: params.scheduledDate ?? assignment.scheduledDate,
        startTime: params.startTime,
        endTime: nextEndTime,
        source: 'timeline',
        operationCode: assignment.operationCode ?? resolveDefaultOperationCode(assignment.stage),
        workflowStatus: 'scheduled',
        activeOperationEntryId: assignment.activeOperationEntryId ?? null,
      })
      : null

  if (!record) {
    return { ok: false as const, status: 400, error: 'Cannot persist a timeline update for an unassigned board item.' }
  }

  await updateManifestBoardAssignment(record.projectId, record.sheetSlug, {
    assignmentId: record.assignmentId,
    estimatedMinutes: assignment.estimatedMinutes,
    assignedBadge: record.assignedBadge,
    assignedAt: record.assignedAt,
    workAreaId: record.workAreaId,
    workAreaLabel: record.workAreaLabel,
    floorArea: record.floorArea,
    shiftId: record.shiftId,
    scheduledDate: record.scheduledDate,
    startTime: record.startTime,
    endTime: record.endTime,
    queueIndex: record.queueIndex,
    assignmentGroupId: record.assignmentGroupId,
    source: record.source,
    operationCode: record.operationCode,
    workflowStatus: record.workflowStatus,
    activeOperationEntryId: record.activeOperationEntryId,
  })

  return { ok: true as const, record }
}

export async function badgeInBoardMember(params: {
  badge: string
  pin: string
  shiftId: ShiftId
}) {
  const badge = params.badge.trim().replace(/\D/g, '')
  const pin = params.pin.trim().replace(/\D/g, '')
  const auth = await verifyPinForRuntime(badge, pin)
  if (!auth.valid || !auth.user) {
    return { ok: false as const, status: 401, error: 'Invalid badge credentials.' }
  }

  const profile = await readProfileFromShare(badge)
  if (!profile) {
    return { ok: false as const, status: 404, error: 'Member profile not found.' }
  }

  const scheduledAssignment = findBoardAssignmentsForBadge(badge)
    .find(record => record.shiftId === params.shiftId && record.workflowStatus === 'scheduled')

  if (scheduledAssignment) {
    const started = await startBoardAssignment({
      badge,
      pin,
      assignmentId: scheduledAssignment.assignmentId,
    })

    if (!started.ok) {
      return started
    }

    return {
      ok: true as const,
      message: `Clocked into ${scheduledAssignment.pdNumber} · ${scheduledAssignment.sheetName}. Actual assignment time is now running.`,
      assignment: started.assignment,
      assignmentContext: started.assignmentContext ?? null,
    }
  }

  const updated = await writeProfileToShare(badge, buildBoardAvailabilityUpdate({
    status: 'AVAILABLE',
    shiftId: params.shiftId,
    clockedInAt: new Date().toISOString(),
    clockedOutAt: null,
    activeAssignmentId: null,
  }))

  if (!updated) {
    return { ok: false as const, status: 500, error: 'Failed to badge in member.' }
  }

  return {
    ok: true as const,
    message: `Badge in complete. No scheduled assignment was started, so this member is now available for ${params.shiftId} shift scheduling.`,
    assignment: null,
    assignmentContext: null,
  }
}

export async function startBoardAssignment(params: {
  badge: string
  pin: string
  assignmentId: string
}) {
  const badge = params.badge.trim().replace(/\D/g, '')
  const pin = params.pin.trim().replace(/\D/g, '')
  const assignmentId = params.assignmentId.trim()
  const auth = await verifyPinForRuntime(badge, pin)
  if (!auth.valid || !auth.user) {
    return { ok: false as const, status: 401, error: 'Invalid badge credentials.' }
  }

  const record = readBoardAssignments()[assignmentId]
  if (!record || record.assignedBadge !== badge) {
    return { ok: false as const, status: 404, error: 'Assigned board work was not found for this badge.' }
  }
  const data = await buildBoardData()
  const estimatedMinutes = findEstimatedMinutes(data, assignmentId) ?? record.partNumbers.length

  const actualStartTime = record.actualStartTime ?? new Date().toISOString()
  const operationCode = record.operationCode ?? resolveDefaultOperationCode(record.stage)
  let activeOperationEntryId = record.activeOperationEntryId ?? null

  if (operationCode && !activeOperationEntryId) {
    const operationEntry = await addOperationTimeEntry(record.projectId, {
      opCode: operationCode,
      assignmentId: record.assignmentId,
      projectId: record.projectId,
      badge,
      startedAt: actualStartTime,
      endedAt: null,
      actualMinutes: 0,
      source: 'timer',
      note: `Board assignment started for ${record.pdNumber} · ${record.sheetName}`,
    })
    activeOperationEntryId = operationEntry.id
  }

  const updatedRecord = updateBoardAssignmentRecord(assignmentId, {
    workflowStatus: 'in-progress',
    actualStartTime,
    actualEndTime: null,
    operationCode,
    activeOperationEntryId,
  })

  if (!updatedRecord) {
    return { ok: false as const, status: 500, error: 'Failed to start assignment.' }
  }

  await updateManifestBoardAssignment(updatedRecord.projectId, updatedRecord.sheetSlug, {
    assignmentId: updatedRecord.assignmentId,
    estimatedMinutes,
    assignedBadge: updatedRecord.assignedBadge,
    assignedAt: updatedRecord.assignedAt,
    workAreaId: updatedRecord.workAreaId,
    workAreaLabel: updatedRecord.workAreaLabel,
    floorArea: updatedRecord.floorArea,
    shiftId: updatedRecord.shiftId,
    scheduledDate: updatedRecord.scheduledDate,
    startTime: updatedRecord.startTime,
    endTime: updatedRecord.endTime,
    queueIndex: updatedRecord.queueIndex,
    assignmentGroupId: updatedRecord.assignmentGroupId,
    source: updatedRecord.source,
    operationCode: updatedRecord.operationCode,
    workflowStatus: updatedRecord.workflowStatus,
    actualStartTime: updatedRecord.actualStartTime,
    actualEndTime: updatedRecord.actualEndTime,
    activeOperationEntryId: updatedRecord.activeOperationEntryId,
  })

  const updated = await writeProfileToShare(badge, buildBoardAvailabilityUpdate({
    status: 'ON_ASSIGNMENT',
    shiftId: updatedRecord.shiftId ?? null,
    activeAssignmentId: updatedRecord.assignmentId,
    clockedInAt: new Date().toISOString(),
    clockedOutAt: null,
  }))

  if (!updated) {
    return { ok: false as const, status: 500, error: 'Failed to update member availability.' }
  }

  const actualMinutes = updatedRecord.actualStartTime
    ? computeActualMinutes(updatedRecord.actualStartTime, new Date().toISOString())
    : 0
  const assignmentContext = await buildBadgeAssignmentContext({
    assignmentId: updatedRecord.assignmentId,
    projectId: updatedRecord.projectId,
    pdNumber: updatedRecord.pdNumber,
    projectName: updatedRecord.projectName,
    sheetSlug: updatedRecord.sheetSlug,
    sheetName: updatedRecord.sheetName,
    stage: updatedRecord.stage,
    workflowStatus: updatedRecord.workflowStatus,
    operationCode: updatedRecord.operationCode,
    estimatedMinutes,
    actualMinutes,
  })

  return { ok: true as const, assignment: updatedRecord, assignmentContext }
}

export async function badgeOutBoardMember(params: {
  badge: string
  pin: string
}) {
  const badge = params.badge.trim().replace(/\D/g, '')
  const pin = params.pin.trim().replace(/\D/g, '')
  const auth = await verifyPinForRuntime(badge, pin)
  if (!auth.valid || !auth.user) {
    return { ok: false as const, status: 401, error: 'Invalid badge credentials.' }
  }

  const profile = await readProfileFromShare(badge)
  if (!profile) {
    return { ok: false as const, status: 404, error: 'Member profile not found.' }
  }

  const currentAvailability = profile.boardAvailability ?? null
  const activeAssignmentId = currentAvailability?.activeAssignmentId ?? null
  let message = 'Badge out complete. Member is now off shift.'
  let assignmentContext: BadgeAssignmentContext | null = null
  if (activeAssignmentId) {
    const data = await buildBoardData()
    const activeRecord = findBoardAssignmentsForBadge(badge).find(record => record.assignmentId === activeAssignmentId)
    if (activeRecord) {
      const estimatedMinutes = findEstimatedMinutes(data, activeAssignmentId) ?? activeRecord.partNumbers.length
      const endedAt = new Date().toISOString()
      const actualMinutes = activeRecord.actualStartTime ? computeActualMinutes(activeRecord.actualStartTime, endedAt) : 0

      if (activeRecord.activeOperationEntryId) {
        await updateOperationTimeEntry(activeRecord.projectId, activeRecord.activeOperationEntryId, {
          endedAt,
          actualMinutes,
          note: `Board assignment badge-out for ${activeRecord.pdNumber} · ${activeRecord.sheetName}`,
        })
      }

      const endedRecord = updateBoardAssignmentRecord(activeAssignmentId, {
        workflowStatus: 'scheduled',
        actualEndTime: endedAt,
        activeOperationEntryId: null,
      })

      if (endedRecord) {
        await updateManifestBoardAssignment(endedRecord.projectId, endedRecord.sheetSlug, {
          assignmentId: endedRecord.assignmentId,
          estimatedMinutes,
          assignedBadge: endedRecord.assignedBadge,
          assignedAt: endedRecord.assignedAt,
          workAreaId: endedRecord.workAreaId,
          workAreaLabel: endedRecord.workAreaLabel,
          floorArea: endedRecord.floorArea,
          shiftId: endedRecord.shiftId,
          scheduledDate: endedRecord.scheduledDate,
          startTime: endedRecord.startTime,
          endTime: endedRecord.endTime,
          queueIndex: endedRecord.queueIndex,
          assignmentGroupId: endedRecord.assignmentGroupId,
          source: endedRecord.source,
          operationCode: endedRecord.operationCode,
          workflowStatus: endedRecord.workflowStatus,
          actualStartTime: endedRecord.actualStartTime,
          actualEndTime: endedRecord.actualEndTime,
          activeOperationEntryId: endedRecord.activeOperationEntryId,
        })
        assignmentContext = await buildBadgeAssignmentContext({
          assignmentId: endedRecord.assignmentId,
          projectId: endedRecord.projectId,
          pdNumber: endedRecord.pdNumber,
          projectName: endedRecord.projectName,
          sheetSlug: endedRecord.sheetSlug,
          sheetName: endedRecord.sheetName,
          stage: endedRecord.stage,
          workflowStatus: endedRecord.workflowStatus,
          operationCode: endedRecord.operationCode,
          estimatedMinutes,
          actualMinutes,
        })
        message = `Clocked out of ${endedRecord.pdNumber} · ${endedRecord.sheetName}. Actual assignment time was captured and the work remains scheduled for continuation.`
      }
    }
  }

  const updated = await writeProfileToShare(badge, buildBoardAvailabilityUpdate({
    status: 'OFF_SHIFT',
    shiftId: currentAvailability?.shiftId ?? null,
    activeAssignmentId: null,
    clockedInAt: currentAvailability?.clockedInAt ?? null,
    clockedOutAt: new Date().toISOString(),
  }))

  if (!updated) {
    return { ok: false as const, status: 500, error: 'Failed to badge out member.' }
  }

  return { ok: true as const, message, assignmentContext }
}

export async function releaseBoardAssignment(params: {
  actorBadge: string
  actorPin: string
  assignmentId: string
}) {
  const actorBadge = params.actorBadge.trim().replace(/\D/g, '')
  const actorPin = params.actorPin.trim().replace(/\D/g, '')
  const assignmentId = params.assignmentId.trim()

  if (!assignmentId) {
    return { ok: false as const, status: 400, error: 'Missing assignment id.' }
  }

  if (actorBadge && actorPin) {
    const auth = await verifyBoardAssigner(actorBadge, actorPin)
    if (!auth.ok) {
      return auth
    }
  }

  const record = readBoardAssignments()[assignmentId]
  if (!record) {
    return { ok: false as const, status: 404, error: 'Board assignment record not found.' }
  }

  if (record.workflowStatus === 'in-progress' || record.activeOperationEntryId) {
    return {
      ok: false as const,
      status: 409,
      error: 'This assignment is actively running. Badge the member out before releasing it.',
    }
  }

  const removed = removeBoardAssignmentRecord(assignmentId)
  if (!removed) {
    return { ok: false as const, status: 500, error: 'Failed to release board assignment.' }
  }

  await removeActiveAssignmentFromProfile(removed.assignedBadge, removed.assignmentId)
  await updateManifestBoardAssignment(removed.projectId, removed.sheetSlug, {
    assignmentId: removed.assignmentId,
    estimatedMinutes: undefined,
    assignedBadge: null,
    assignedAt: null,
    workAreaId: null,
    workAreaLabel: null,
    floorArea: null,
    shiftId: null,
    scheduledDate: null,
    startTime: null,
    endTime: null,
    queueIndex: null,
    assignmentGroupId: null,
    source: null,
    operationCode: null,
    workflowStatus: 'pending',
    actualStartTime: null,
    actualEndTime: null,
    activeOperationEntryId: null,
  })

  return { ok: true as const, record: removed }
}
