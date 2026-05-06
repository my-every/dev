/**
 * Shift-specific calculation utilities
 */

import type { ShiftId, ShiftSchedule, ShiftWindow } from "@/types/shifts"
import type { Assignment, CapacitySummary, Resource } from "@/types/scheduling"
import {
  SHIFT_SCHEDULES,
  getShiftStandardMinutes,
  getShiftOvertimeMinutes,
} from "@/types/shifts"
import { timeToMinutes, getDurationMinutes, isTimeInRange } from "./time-utils"

/**
 * Get the shift schedule for a given shift ID
 */
export function getShiftSchedule(shiftId: ShiftId): ShiftSchedule {
  return SHIFT_SCHEDULES[shiftId]
}

/**
 * Get all shift windows for a shift
 */
export function getShiftWindows(shiftId: ShiftId): ShiftWindow[] {
  return SHIFT_SCHEDULES[shiftId].windows
}

/**
 * Get the earliest start time across all windows for a shift
 */
export function getShiftEarliestStart(shiftId: ShiftId): number {
  const schedule = SHIFT_SCHEDULES[shiftId]
  return timeToMinutes(schedule.earliestStart)
}

/**
 * Get the latest end time across all windows for a shift
 */
export function getShiftLatestEnd(shiftId: ShiftId): number {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const end = timeToMinutes(schedule.latestEnd)
  // Handle overnight (e.g., 2nd shift ending at 01:00)
  if (end < getShiftEarliestStart(shiftId)) {
    return end + 1440 // Add 24 hours
  }
  return end
}

/**
 * Determine if a time falls within overtime or standard hours
 */
export function isOvertimeTime(shiftId: ShiftId, time: string): boolean {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const overtimeWindows = schedule.windows.filter((w) => w.type === "overtime")

  return overtimeWindows.some((window) =>
    isTimeInRange(time, window.startTime, window.endTime)
  )
}

/**
 * Calculate how much of an assignment falls into standard vs overtime
 */
export function splitAssignmentTime(assignment: Assignment): {
  standardMinutes: number
  overtimeMinutes: number
} {
  const schedule = SHIFT_SCHEDULES[assignment.shiftId]
  const assignmentStart = timeToMinutes(assignment.startTime)
  const assignmentEnd = timeToMinutes(assignment.endTime)

  let standardMinutes = 0
  let overtimeMinutes = 0

  for (const window of schedule.windows) {
    const windowStart = timeToMinutes(window.startTime)
    let windowEnd = timeToMinutes(window.endTime)

    // Handle overnight windows
    if (windowEnd <= windowStart) {
      windowEnd += 1440
    }

    // Calculate overlap
    const overlapStart = Math.max(assignmentStart, windowStart)
    const overlapEnd = Math.min(assignmentEnd, windowEnd)

    if (overlapStart < overlapEnd) {
      const overlap = overlapEnd - overlapStart
      if (window.type === "standard") {
        standardMinutes += overlap
      } else {
        overtimeMinutes += overlap
      }
    }
  }

  return { standardMinutes, overtimeMinutes }
}

/**
 * Calculate capacity summary for a shift's resources on a given date
 */
export function calculateShiftCapacity(
  shiftId: ShiftId,
  resources: Resource[],
  assignments: Assignment[]
): CapacitySummary {
  const shiftResources = resources.filter((r) => r.shiftId === shiftId)
  const shiftAssignments = assignments.filter((a) => a.shiftId === shiftId)

  const standardPerResource = getShiftStandardMinutes(shiftId)
  const overtimePerResource = getShiftOvertimeMinutes(shiftId)

  const totalStandardMinutes = shiftResources.length * standardPerResource
  const totalOvertimeMinutes = shiftResources.reduce(
    (sum, r) => sum + Math.min(r.maxOvertimeMinutes, overtimePerResource),
    0
  )

  let assignedStandardMinutes = 0
  let assignedOvertimeMinutes = 0

  for (const assignment of shiftAssignments) {
    if (assignment.status === "cancelled") continue
    const { standardMinutes, overtimeMinutes } =
      splitAssignmentTime(assignment)
    assignedStandardMinutes += standardMinutes
    assignedOvertimeMinutes += overtimeMinutes
  }

  const remainingStandardMinutes = totalStandardMinutes - assignedStandardMinutes
  const remainingOvertimeMinutes = totalOvertimeMinutes - assignedOvertimeMinutes
  const totalMinutes = totalStandardMinutes + totalOvertimeMinutes
  const assignedMinutes = assignedStandardMinutes + assignedOvertimeMinutes
  const utilizationPercent =
    totalMinutes > 0 ? Math.round((assignedMinutes / totalMinutes) * 100) : 0

  return {
    totalStandardMinutes,
    totalOvertimeMinutes,
    assignedStandardMinutes,
    assignedOvertimeMinutes,
    remainingStandardMinutes,
    remainingOvertimeMinutes,
    utilizationPercent,
  }
}

/**
 * Calculate capacity for a single resource
 */
export function calculateResourceCapacity(
  resource: Resource,
  assignments: Assignment[]
): CapacitySummary {
  const resourceAssignments = assignments.filter(
    (a) => a.resourceId === resource.id && a.status !== "cancelled"
  )

  const standardMinutes = getShiftStandardMinutes(resource.shiftId)
  const overtimeMinutes = Math.min(
    resource.maxOvertimeMinutes,
    getShiftOvertimeMinutes(resource.shiftId)
  )

  let assignedStandardMinutes = 0
  let assignedOvertimeMinutes = 0

  for (const assignment of resourceAssignments) {
    const split = splitAssignmentTime(assignment)
    assignedStandardMinutes += split.standardMinutes
    assignedOvertimeMinutes += split.overtimeMinutes
  }

  const totalMinutes = standardMinutes + overtimeMinutes
  const assignedMinutes = assignedStandardMinutes + assignedOvertimeMinutes

  return {
    totalStandardMinutes: standardMinutes,
    totalOvertimeMinutes: overtimeMinutes,
    assignedStandardMinutes,
    assignedOvertimeMinutes,
    remainingStandardMinutes: standardMinutes - assignedStandardMinutes,
    remainingOvertimeMinutes: overtimeMinutes - assignedOvertimeMinutes,
    utilizationPercent:
      totalMinutes > 0 ? Math.round((assignedMinutes / totalMinutes) * 100) : 0,
  }
}

/**
 * Check if a new assignment would cause conflicts
 */
export function checkAssignmentConflicts(
  newAssignment: Omit<Assignment, "id">,
  existingAssignments: Assignment[]
): Assignment[] {
  const newStart = timeToMinutes(newAssignment.startTime)
  const newEnd = timeToMinutes(newAssignment.endTime)

  return existingAssignments.filter((existing) => {
    if (existing.resourceId !== newAssignment.resourceId) return false
    if (existing.status === "cancelled") return false

    const existingStart = timeToMinutes(existing.startTime)
    const existingEnd = timeToMinutes(existing.endTime)

    return newStart < existingEnd && existingStart < newEnd
  })
}

/**
 * Get timeline display bounds for a shift (in hours)
 */
export function getShiftTimelineBounds(shiftId: ShiftId): {
  startHour: number
  endHour: number
} {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const startHour = Math.floor(timeToMinutes(schedule.earliestStart) / 60)
  let endHour = Math.ceil(timeToMinutes(schedule.latestEnd) / 60)

  // Handle overnight shifts
  if (endHour <= startHour) {
    endHour += 24
  }

  return { startHour, endHour }
}

/**
 * Get a color class based on assignment priority
 */
export function getPriorityColor(priority: Assignment["priority"]): string {
  switch (priority) {
    case "urgent":
      return "bg-red-500"
    case "high":
      return "bg-orange-500"
    case "medium":
      return "bg-blue-500"
    case "low":
      return "bg-slate-400"
    default:
      return "bg-slate-400"
  }
}

/**
 * Get a color class based on assignment status
 */
export function getStatusColor(status: Assignment["status"]): string {
  switch (status) {
    case "completed":
      return "bg-green-500"
    case "in-progress":
      return "bg-blue-500"
    case "blocked":
      return "bg-red-500"
    case "cancelled":
      return "bg-slate-300"
    case "scheduled":
    default:
      return "bg-slate-500"
  }
}
