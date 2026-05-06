import { readProfileFromShare, writeProfileToShare, type ShareUserProfile } from '@/lib/profile/share-profile-store'
import { updateBoardAssignmentRecord } from '@/lib/board/board-store'
import { updateManifestBoardAssignment } from '@/lib/project-state/share-project-state-handlers'
import type { ShiftId } from '@/types/shifts'

export type BoardAvailabilityStatus = 'OFF_SHIFT' | 'AVAILABLE' | 'ON_ASSIGNMENT'

export interface BoardAvailabilityState {
  status: BoardAvailabilityStatus
  shiftId: ShiftId | null
  activeAssignmentId: string | null
  updatedAt: string | null
}

function readAvailability(profile: ShareUserProfile & Record<string, unknown>): BoardAvailabilityState {
  const current = profile.boardAvailability as BoardAvailabilityState | undefined
  return {
    status: current?.status ?? 'OFF_SHIFT',
    shiftId: current?.shiftId ?? null,
    activeAssignmentId: current?.activeAssignmentId ?? null,
    updatedAt: current?.updatedAt ?? null,
  }
}

export async function readMemberAvailability(badge: string) {
  const profile = await readProfileFromShare(badge)
  if (!profile) {
    return null
  }

  return readAvailability(profile as ShareUserProfile & Record<string, unknown>)
}

export async function badgeInMember(params: {
  badge: string
  shiftId: ShiftId
}) {
  const profile = await readProfileFromShare(params.badge)
  if (!profile) {
    return null
  }

  return writeProfileToShare(params.badge, {
    boardAvailability: {
      status: 'AVAILABLE',
      shiftId: params.shiftId,
      activeAssignmentId: null,
      updatedAt: new Date().toISOString(),
    },
  } as Partial<ShareUserProfile> & Record<string, unknown>)
}

export async function startMemberAssignment(params: {
  badge: string
  shiftId: ShiftId
  assignmentId: string
  projectId: string
  sheetSlug: string
}) {
  const profile = await readProfileFromShare(params.badge)
  if (!profile) {
    return null
  }

  const timestamp = new Date().toISOString()

  updateBoardAssignmentRecord(params.assignmentId, {
    workflowStatus: 'in-progress',
    actualStartTime: timestamp,
    actualEndTime: null,
  })

  await updateManifestBoardAssignment(params.projectId, params.sheetSlug, {
    assignmentId: params.assignmentId,
    shiftId: params.shiftId,
    workflowStatus: 'in-progress',
    actualStartTime: timestamp,
    actualEndTime: null,
  })

  return writeProfileToShare(params.badge, {
    boardAvailability: {
      status: 'ON_ASSIGNMENT',
      shiftId: params.shiftId,
      activeAssignmentId: params.assignmentId,
      updatedAt: timestamp,
    },
  } as Partial<ShareUserProfile> & Record<string, unknown>)
}

export async function badgeOutMember(params: {
  badge: string
  assignmentId?: string | null
  projectId?: string | null
  sheetSlug?: string | null
}) {
  const profile = await readProfileFromShare(params.badge)
  if (!profile) {
    return null
  }

  const availability = readAvailability(profile as ShareUserProfile & Record<string, unknown>)
  const activeAssignmentId = params.assignmentId ?? availability.activeAssignmentId
  const timestamp = new Date().toISOString()

  if (activeAssignmentId && params.projectId && params.sheetSlug) {
    updateBoardAssignmentRecord(activeAssignmentId, {
      workflowStatus: 'scheduled',
      actualEndTime: timestamp,
    })

    await updateManifestBoardAssignment(params.projectId, params.sheetSlug, {
      assignmentId: activeAssignmentId,
      workflowStatus: 'scheduled',
      actualEndTime: timestamp,
    })
  }

  return writeProfileToShare(params.badge, {
    boardAvailability: {
      status: 'OFF_SHIFT',
      shiftId: null,
      activeAssignmentId: null,
      updatedAt: timestamp,
    },
  } as Partial<ShareUserProfile> & Record<string, unknown>)
}
