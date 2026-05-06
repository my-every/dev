import fs from 'node:fs'
import path from 'node:path'

import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'
import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import type { FloorArea } from '@/types/floor-layout'
import type { ShiftId } from '@/types/shifts'
import { getAssignmentRoleLabel, getAssignmentWorkspaceTarget, mapStageToAssignmentRole, type AssignmentStageRole } from '@/lib/board/stage-workspaces'
import type { BoardAssignmentSource, BoardWorkflowStatus } from '@/lib/board/types'

export interface BoardAssignmentRecord {
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetSlug: string
  sheetName: string
  stage: AssignmentStage
  stageRole: AssignmentStageRole
  stageRoleLabel: string
  assignedBadge: string
  assignedByBadge: string
  assignedAt: string
  partNumbers: string[]
  workspaceHref: string
  workAreaId: string | null
  workAreaLabel: string | null
  floorArea: FloorArea | null
  shiftId: ShiftId | null
  scheduledDate: string | null
  startTime: string | null
  endTime: string | null
  queueIndex: number | null
  assignmentGroupId: string | null
  source: BoardAssignmentSource | null
  operationCode: string | null
  workflowStatus: BoardWorkflowStatus
  actualStartTime: string | null
  actualEndTime: string | null
  activeOperationEntryId: string | null
}

interface PersistedBoardStore {
  version: 2
  assignments: Record<string, BoardAssignmentRecord>
  updatedAt: string
}

function getBoardStorePath() {
  return path.join(resolveShareDirectorySync(), 'State', 'board-assignments.json')
}

function ensureBoardStateDir() {
  fs.mkdirSync(path.dirname(getBoardStorePath()), { recursive: true })
}

function normalizeRecord(raw: Partial<BoardAssignmentRecord>): BoardAssignmentRecord | null {
  if (!raw.assignmentId || !raw.projectId || !raw.sheetSlug || !raw.sheetName || !raw.stage || !raw.assignedBadge || !raw.assignedByBadge) {
    return null
  }

  const stageRole = raw.stageRole ?? mapStageToAssignmentRole(raw.stage)
  const workspace = raw.workspaceHref
    ? { href: raw.workspaceHref }
    : getAssignmentWorkspaceTarget({
      projectId: raw.projectId,
      sheetSlug: raw.sheetSlug,
      stage: raw.stage,
    })

  return {
    assignmentId: raw.assignmentId,
    projectId: raw.projectId,
    projectName: raw.projectName ?? '',
    pdNumber: raw.pdNumber ?? '',
    sheetSlug: raw.sheetSlug,
    sheetName: raw.sheetName,
    stage: raw.stage,
    stageRole,
    stageRoleLabel: raw.stageRoleLabel ?? getAssignmentRoleLabel(stageRole),
    assignedBadge: raw.assignedBadge,
    assignedByBadge: raw.assignedByBadge,
    assignedAt: raw.assignedAt ?? new Date().toISOString(),
    partNumbers: Array.from(new Set((raw.partNumbers ?? []).map(value => value.trim()).filter(Boolean))),
    workspaceHref: workspace.href,
    workAreaId: raw.workAreaId ?? null,
    workAreaLabel: raw.workAreaLabel ?? null,
    floorArea: raw.floorArea ?? null,
    shiftId: raw.shiftId ?? null,
    scheduledDate: raw.scheduledDate ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    queueIndex: raw.queueIndex ?? null,
    assignmentGroupId: raw.assignmentGroupId ?? null,
    source: raw.source ?? null,
    operationCode: raw.operationCode ?? null,
    workflowStatus: raw.workflowStatus ?? (raw.workAreaId ? 'scheduled' : 'pending'),
    actualStartTime: raw.actualStartTime ?? null,
    actualEndTime: raw.actualEndTime ?? null,
    activeOperationEntryId: raw.activeOperationEntryId ?? null,
  }
}

export function readBoardAssignments(): Record<string, BoardAssignmentRecord> {
  const filePath = getBoardStorePath()
  if (!fs.existsSync(filePath)) {
    return {}
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as PersistedBoardStore | { version?: number, assignments?: Record<string, Partial<BoardAssignmentRecord>> }
    const normalizedEntries = Object.entries(parsed.assignments ?? {})
      .map(([key, value]) => [key, normalizeRecord(value)] as const)
      .filter((entry): entry is readonly [string, BoardAssignmentRecord] => Boolean(entry[1]))
    return Object.fromEntries(normalizedEntries)
  } catch {
    return {}
  }
}

export function writeBoardAssignments(assignments: Record<string, BoardAssignmentRecord>) {
  ensureBoardStateDir()
  const payload: PersistedBoardStore = {
    version: 2,
    assignments,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(getBoardStorePath(), JSON.stringify(payload, null, 2) + '\n', 'utf-8')
}

export function upsertBoardAssignment(params: {
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetSlug: string
  sheetName: string
  stage: AssignmentStage
  assignedBadge: string
  assignedByBadge: string
  partNumbers: string[]
  workAreaId?: string | null
  workAreaLabel?: string | null
  floorArea?: FloorArea | null
  shiftId?: ShiftId | null
  scheduledDate?: string | null
  startTime?: string | null
  endTime?: string | null
  queueIndex?: number | null
  assignmentGroupId?: string | null
  source?: BoardAssignmentSource | null
  operationCode?: string | null
  workflowStatus?: BoardWorkflowStatus
  activeOperationEntryId?: string | null
}) {
  const assignments = readBoardAssignments()
  const workspace = getAssignmentWorkspaceTarget({
    projectId: params.projectId,
    sheetSlug: params.sheetSlug,
    stage: params.stage,
  })

  const record: BoardAssignmentRecord = {
    assignmentId: params.assignmentId,
    projectId: params.projectId,
    projectName: params.projectName,
    pdNumber: params.pdNumber,
    sheetSlug: params.sheetSlug,
    sheetName: params.sheetName,
    stage: params.stage,
    stageRole: mapStageToAssignmentRole(params.stage),
    stageRoleLabel: getAssignmentRoleLabel(mapStageToAssignmentRole(params.stage)),
    assignedBadge: params.assignedBadge,
    assignedByBadge: params.assignedByBadge,
    assignedAt: new Date().toISOString(),
    partNumbers: Array.from(new Set(params.partNumbers.map(value => value.trim()).filter(Boolean))),
    workspaceHref: workspace.href,
    workAreaId: params.workAreaId ?? null,
    workAreaLabel: params.workAreaLabel ?? null,
    floorArea: params.floorArea ?? null,
    shiftId: params.shiftId ?? null,
    scheduledDate: params.scheduledDate ?? null,
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
    queueIndex: params.queueIndex ?? null,
    assignmentGroupId: params.assignmentGroupId ?? null,
    source: params.source ?? null,
    operationCode: params.operationCode ?? null,
    workflowStatus: params.workflowStatus ?? (params.workAreaId ? 'scheduled' : 'pending'),
    actualStartTime: null,
    actualEndTime: null,
    activeOperationEntryId: params.activeOperationEntryId ?? null,
  }

  assignments[params.assignmentId] = record
  writeBoardAssignments(assignments)
  return record
}

export function updateBoardAssignmentRecord(
  assignmentId: string,
  updates: Partial<BoardAssignmentRecord>,
) {
  const assignments = readBoardAssignments()
  const existing = assignments[assignmentId]
  if (!existing) {
    return null
  }

  const record: BoardAssignmentRecord = {
    ...existing,
    ...updates,
  }

  assignments[assignmentId] = record
  writeBoardAssignments(assignments)
  return record
}

export function removeBoardAssignmentRecord(assignmentId: string) {
  const assignments = readBoardAssignments()
  const existing = assignments[assignmentId]
  if (!existing) {
    return null
  }

  delete assignments[assignmentId]
  writeBoardAssignments(assignments)
  return existing
}

export function findBoardAssignmentsForBadge(badge: string) {
  return Object.values(readBoardAssignments())
    .filter(record => record.assignedBadge === badge)
    .sort((left, right) => new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime())
}
