import type { BoardAssignmentView, BoardMemberView } from '@/lib/board/types'
import type { AssignmentStageRole } from '@/lib/board/stage-workspaces'
import type { ShiftId } from '@/types/shifts'
import { SHIFT_SCHEDULES } from '@/types/shifts'

function normalizePartNumber(value: string) {
  return value.trim().toUpperCase()
}

function toSkillKey(stageRole: AssignmentStageRole) {
  switch (stageRole) {
    case 'KITTING':
      return 'kitting'
    case 'BRANDING':
      return 'branding'
    case 'BUILD_UP':
      return 'buildUp'
    case 'WIRING':
      return 'wiring'
    case 'BOX_BUILD':
      return 'boxBuild'
    case 'CROSS_WIRING':
      return 'crossWire'
    case 'TEST':
      return 'test'
    case 'BIQ':
      return 'biq'
    default:
      return 'buildUp'
  }
}

export function estimateMinutesForAssignment(assignment: Pick<BoardAssignmentView, 'stageRole' | 'partNumbers'>) {
  const partCount = Math.max(assignment.partNumbers.length, 1)

  switch (assignment.stageRole) {
    case 'KITTING':
      return 30 + partCount * 4
    case 'BRANDING':
      return 45 + partCount * 5
    case 'BUILD_UP':
      return 90 + partCount * 8
    case 'WIRING':
      return 150 + partCount * 10
    case 'BOX_BUILD':
      return 120 + partCount * 8
    case 'CROSS_WIRING':
      return 150 + partCount * 9
    case 'TEST':
      return 75 + partCount * 6
    case 'BIQ':
      return 60 + partCount * 5
    default:
      return 60 + partCount * 5
  }
}

export function getFollowingShiftId(now = new Date()): ShiftId {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const firstShiftEnd = 14 * 60 + 30
  return minutes < firstShiftEnd ? '2nd' : '1st'
}

export function getDefaultScheduleDateForShift(shiftId: ShiftId, now = new Date()) {
  const scheduled = new Date(now)
  const followingShift = getFollowingShiftId(now)

  if (followingShift === '1st' && shiftId === '1st') {
    scheduled.setDate(scheduled.getDate() + 1)
  }

  return scheduled.toISOString().slice(0, 10)
}

export function getDefaultStartTimeForShift(shiftId: ShiftId) {
  return SHIFT_SCHEDULES[shiftId].standardStart
}

export function addMinutesToTime(startTime: string, minutesToAdd: number) {
  const [hours, minutes] = startTime.split(':').map(Number)
  const total = hours * 60 + minutes + minutesToAdd
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60)
  const nextHours = Math.floor(normalized / 60)
  const nextMinutes = normalized % 60
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`
}

export function getMemberStageSkill(member: BoardMemberView, stageRole: AssignmentStageRole) {
  return member.skills[toSkillKey(stageRole)] ?? 0
}

export function getMemberRolePartCount(
  member: BoardMemberView,
  stageRole: AssignmentStageRole,
  partNumber: string,
) {
  const ledger = member.assignmentCompetency
  const roleCounts = ledger?.stagePartNumberCounts?.[stageRole]
  return roleCounts?.[normalizePartNumber(partNumber)] ?? 0
}
