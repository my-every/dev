import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'

export type AssignmentStageRole =
  | 'KITTING'
  | 'BRANDING'
  | 'BUILD_UP'
  | 'WIRING'
  | 'BOX_BUILD'
  | 'CROSS_WIRING'
  | 'TEST'
  | 'BIQ'

export const BOARD_STAGE_TO_CANONICAL_STAGE: Record<AssignmentStage, AssignmentStageId> = {
  KITTED: 'BUILD_UP',
  BUILD_UP: 'BUILD_UP',
  IPV1: 'WIRING_IPV',
  WIRING: 'WIRING',
  IPV2: 'WIRING_IPV',
  BOX_BUILD: 'BOX_BUILD',
  IPV3: 'CROSS_WIRE',
  CROSS_WIRING: 'CROSS_WIRE',
  IPV4: 'CROSS_WIRE_IPV',
  TEST_READY: 'TEST_1ST_PASS',
  TEST: 'TEST_1ST_PASS',
  POWER_CHECK: 'POWER_CHECK',
  BIQ: 'BIQ',
  COMPLETE: 'FINISHED_BIQ',
}

export const BOARD_STAGE_TO_TIMELINE_STAGE: Record<AssignmentStage, AssignmentStageId> = {
  KITTED: 'BUILD_UP',
  BUILD_UP: 'BUILD_UP',
  IPV1: 'WIRING',
  WIRING: 'WIRING',
  IPV2: 'WIRING_IPV',
  BOX_BUILD: 'BOX_BUILD',
  IPV3: 'CROSS_WIRE',
  CROSS_WIRING: 'CROSS_WIRE',
  IPV4: 'CROSS_WIRE_IPV',
  TEST_READY: 'TEST_1ST_PASS',
  TEST: 'TEST_1ST_PASS',
  POWER_CHECK: 'POWER_CHECK',
  BIQ: 'BIQ',
  COMPLETE: 'FINISHED_BIQ',
}

export const BOARD_STAGE_TO_LIFECYCLE_STAGE: Record<AssignmentStage, AssignmentStageId> = {
  KITTED: 'BUILD_UP',
  BUILD_UP: 'BUILD_UP',
  IPV1: 'WIRING_IPV',
  WIRING: 'WIRING',
  IPV2: 'WIRING_IPV',
  BOX_BUILD: 'BOX_BUILD',
  IPV3: 'CROSS_WIRE_IPV',
  CROSS_WIRING: 'CROSS_WIRE',
  IPV4: 'CROSS_WIRE_IPV',
  TEST_READY: 'TEST_1ST_PASS',
  TEST: 'TEST_1ST_PASS',
  POWER_CHECK: 'POWER_CHECK',
  BIQ: 'BIQ',
  COMPLETE: 'FINISHED_BIQ',
}

export function mapBoardStageToCanonicalStage(stage: AssignmentStage): AssignmentStageId {
  return BOARD_STAGE_TO_CANONICAL_STAGE[stage]
}

export function normalizeLegacyBoardStage(value: string | null | undefined): AssignmentStageId | null {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  if (raw in BOARD_STAGE_TO_CANONICAL_STAGE) {
    return BOARD_STAGE_TO_CANONICAL_STAGE[raw as AssignmentStage]
  }

  return raw as AssignmentStageId
}

export function normalizeLegacyBoardStageForTimeline(value: string | null | undefined): AssignmentStageId | null {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  if (raw in BOARD_STAGE_TO_TIMELINE_STAGE) {
    return BOARD_STAGE_TO_TIMELINE_STAGE[raw as AssignmentStage]
  }

  return raw as AssignmentStageId
}

export function normalizeLegacyBoardStageForLifecycle(value: string | null | undefined): AssignmentStageId | null {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  if (raw in BOARD_STAGE_TO_LIFECYCLE_STAGE) {
    return BOARD_STAGE_TO_LIFECYCLE_STAGE[raw as AssignmentStage]
  }

  return raw as AssignmentStageId
}

export interface AssignmentWorkspaceTarget {
  stageRole: AssignmentStageRole
  label: string
  href: string
}

function encodeSheetSlug(value: string) {
  return encodeURIComponent(value)
}

export function mapStageToAssignmentRole(stage: AssignmentStage): AssignmentStageRole {
  const canonicalStage = mapBoardStageToCanonicalStage(stage)
  if (canonicalStage === 'READY_TO_LAY') {
    return 'KITTING'
  }
  if (['BUILD_UP', 'READY_FOR_VISUAL'].includes(canonicalStage)) {
    return 'BUILD_UP'
  }
  if (['WIRING', 'WIRING_IPV'].includes(canonicalStage)) {
    return 'WIRING'
  }
  if (['BOX_BUILD', 'READY_TO_CROSS_WIRE'].includes(canonicalStage)) {
    return 'BOX_BUILD'
  }
  if (['CROSS_WIRE', 'CROSS_WIRE_IPV'].includes(canonicalStage)) {
    return 'CROSS_WIRING'
  }
  if (['READY_TO_TEST', 'TEST_1ST_PASS', 'POWER_CHECK'].includes(canonicalStage)) {
    return 'TEST'
  }
  return 'BIQ'
}

export function getAssignmentRoleLabel(role: AssignmentStageRole): string {
  switch (role) {
    case 'KITTING':
      return 'Kitting'
    case 'BRANDING':
      return 'Branding'
    case 'BUILD_UP':
      return 'Build Up'
    case 'WIRING':
      return 'Wiring'
    case 'BOX_BUILD':
      return 'Box Build'
    case 'CROSS_WIRING':
      return 'Cross Wiring'
    case 'TEST':
      return 'Test'
    case 'BIQ':
      return 'BIQ'
  }
}

export function getAssignmentWorkspaceTarget(params: {
  projectId: string
  sheetSlug: string
  stage: AssignmentStage
}): AssignmentWorkspaceTarget {
  const { projectId, sheetSlug, stage } = params
  const stageRole = mapStageToAssignmentRole(stage)
  const encodedSlug = encodeSheetSlug(sheetSlug)

  if (stageRole === 'BUILD_UP' || stageRole === 'BOX_BUILD') {
    return {
      stageRole,
      label: getAssignmentRoleLabel(stageRole),
      href: `/projects/${encodeURIComponent(projectId)}/assignments/${encodedSlug}/build-up`,
    }
  }

  return {
    stageRole,
    label: getAssignmentRoleLabel(stageRole),
    href: `/projects/${encodeURIComponent(projectId)}/assignments/${encodedSlug}`,
  }
}
