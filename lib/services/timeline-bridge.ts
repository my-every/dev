/**
 * Timeline Bridge
 *
 * Converts between manifest assignments and timeline assignments.
 * Enables drag-and-drop scheduling from the priority queue to the timeline.
 */

import type {
  Assignment,
  AssignmentStatus,
  AssignmentPriority,
  Resource,
  Project,
} from '@/types/scheduling'
import type { ShiftId } from '@/types/shifts'
import type {
  ManifestAssignment,
  ProjectManifest,
  FlattenedAssignment,
  PriorityLevel,
} from '@/types/project-manifest'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { parseTimeToMinutes, formatMinutesToTime } from './priority-service'

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMinutes = totalMinutes % 60
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
}

/**
 * Get current time as HH:mm string
 */
export function getCurrentTime(): string {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Determine shift ID based on time
 */
export function getShiftForTime(time: string): ShiftId {
  const [hours] = time.split(':').map(Number)
  // 1st shift: 04:00 - 14:30, 2nd shift: 15:00 - 23:00
  return hours >= 4 && hours < 15 ? '1st' : '2nd'
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map manifest status to timeline status
 */
export function mapManifestStatusToTimeline(
  manifestStatus: ManifestAssignment['status']
): AssignmentStatus {
  switch (manifestStatus) {
    case 'NOT_STARTED':
      return 'scheduled'
    case 'IN_PROGRESS':
      return 'in-progress'
    case 'COMPLETED':
      return 'completed'
    case 'BLOCKED':
      return 'blocked'
    case 'INCOMPLETE':
      return 'scheduled'
    default:
      return 'scheduled'
  }
}

/**
 * Map timeline status to manifest status
 */
export function mapTimelineStatusToManifest(
  timelineStatus: AssignmentStatus
): ManifestAssignment['status'] {
  switch (timelineStatus) {
    case 'scheduled':
      return 'NOT_STARTED'
    case 'in-progress':
      return 'IN_PROGRESS'
    case 'completed':
      return 'COMPLETED'
    case 'blocked':
      return 'BLOCKED'
    case 'cancelled':
      return 'NOT_STARTED'
    default:
      return 'NOT_STARTED'
  }
}

/**
 * Map priority level to timeline priority
 */
export function mapPriorityLevelToTimeline(
  level: PriorityLevel
): AssignmentPriority {
  switch (level) {
    case 'critical':
      return 'urgent'
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
  }
}

/**
 * Map timeline priority to priority level
 */
export function mapTimelinePriorityToLevel(
  priority: AssignmentPriority
): PriorityLevel {
  switch (priority) {
    case 'urgent':
      return 'critical'
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
  }
}

// ============================================================================
// Manifest to Timeline Conversion
// ============================================================================

/**
 * Generate unique timeline assignment ID
 */
export function generateTimelineId(
  projectId: string,
  sheetSlug: string,
  stage: AssignmentStageId
): string {
  return `${projectId}-${sheetSlug}-${stage}`
}

/**
 * Convert a flattened assignment to a timeline assignment
 */
export function flattenedToTimelineAssignment(
  flattened: FlattenedAssignment,
  stationId: string,
  startTime: string
): Assignment {
  const { assignment, project, priority } = flattened

  // Calculate duration from estimated times
  const estimatedMinutes =
    parseTimeToMinutes(assignment.buildUpEstTime ?? "") +
    parseTimeToMinutes(assignment.wireListEstTime ?? "")

  // Use remaining minutes if available, otherwise use total estimate
  const durationMinutes = assignment.remainingMinutes ?? estimatedMinutes

  const endTime = addMinutesToTime(startTime, durationMinutes)
  const shiftId = getShiftForTime(startTime)

  return {
    id: generateTimelineId(project.id, assignment.sheetSlug, assignment.stage),
    projectId: project.id,
    projectName: `${project.name} - ${assignment.sheetName}`,
    resourceId: stationId,
    shiftId,
    startTime,
    endTime,
    estimatedStartTime: startTime,
    estimatedEndTime: endTime,
    status: mapManifestStatusToTimeline(assignment.status),
    priority: mapPriorityLevelToTimeline(priority.level),
    isOvertime: false,
    color: project.color,
    notes: `Stage: ${assignment.stage} | Est: ${formatMinutesToTime(estimatedMinutes)}`,
    assignees: [],
  }
}

/**
 * Convert manifest assignment to timeline assignment
 */
export function manifestToTimelineAssignment(
  assignment: ManifestAssignment,
  project: ProjectManifest,
  stationId: string,
  startTime: string
): Assignment {
  const estimatedMinutes =
    parseTimeToMinutes(assignment.buildUpEstTime ?? "") +
    parseTimeToMinutes(assignment.wireListEstTime ?? "")

  const durationMinutes = assignment.remainingMinutes ?? estimatedMinutes
  const endTime = addMinutesToTime(startTime, durationMinutes)
  const shiftId = getShiftForTime(startTime)

  return {
    id: generateTimelineId(project.id, assignment.sheetSlug, assignment.stage),
    projectId: project.id,
    projectName: `${project.name} - ${assignment.sheetName}`,
    resourceId: stationId,
    shiftId,
    startTime,
    endTime,
    estimatedStartTime: startTime,
    estimatedEndTime: endTime,
    status: mapManifestStatusToTimeline(assignment.status),
    priority: assignment.priority
      ? mapPriorityLevelToTimeline(assignment.priority.level)
      : 'medium',
    isOvertime: false,
    color: project.color,
    notes: `Stage: ${assignment.stage}`,
    assignees: [],
  }
}

// ============================================================================
// Timeline to Manifest Conversion
// ============================================================================

/**
 * Parse timeline ID to extract components
 */
export function parseTimelineId(timelineId: string): {
  projectId: string
  sheetSlug: string
  stage: AssignmentStageId
} | null {
  const parts = timelineId.split('-')
  if (parts.length < 3) return null

  // Handle complex IDs with multiple dashes
  const stage = parts.pop() as AssignmentStageId
  const sheetSlug = parts.pop()!
  const projectId = parts.join('-')

  return { projectId, sheetSlug, stage }
}

/**
 * Create manifest update from timeline assignment changes
 */
export function timelineToManifestUpdate(
  timelineAssignment: Assignment,
  currentManifest: ManifestAssignment
): Partial<ManifestAssignment> {
  const updates: Partial<ManifestAssignment> = {}

  // Update status if changed
  const newStatus = mapTimelineStatusToManifest(timelineAssignment.status)
  if (newStatus !== currentManifest.status) {
    updates.status = newStatus
  }

  // Calculate actual time if completed
  if (
    timelineAssignment.status === 'completed' &&
    timelineAssignment.actualStartTime &&
    timelineAssignment.actualEndTime
  ) {
    const [startH, startM] = timelineAssignment.actualStartTime.split(':').map(Number)
    const [endH, endM] = timelineAssignment.actualEndTime.split(':').map(Number)
    const actualMinutes = (endH * 60 + endM) - (startH * 60 + startM)

    updates.actualMinutes = (currentManifest.actualMinutes ?? 0) + actualMinutes
  }

  return updates
}

// ============================================================================
// Batch Conversion
// ============================================================================

/**
 * Convert multiple flattened assignments to timeline assignments
 * Auto-schedules based on station availability and priority order
 */
export function batchFlattenedToTimeline(
  assignments: FlattenedAssignment[],
  stationIds: string[],
  startTime: string = '06:00'
): Assignment[] {
  const results: Assignment[] = []
  
  // Track end times for each station
  const stationEndTimes = new Map<string, string>()
  for (const stationId of stationIds) {
    stationEndTimes.set(stationId, startTime)
  }

  // Assignments should already be sorted by priority
  for (const flattened of assignments) {
    // Find station with earliest availability
    let earliestStation = stationIds[0]
    let earliestTime = stationEndTimes.get(earliestStation) ?? startTime

    for (const stationId of stationIds) {
      const endTime = stationEndTimes.get(stationId) ?? startTime
      if (endTime < earliestTime) {
        earliestStation = stationId
        earliestTime = endTime
      }
    }

    // Create timeline assignment
    const timelineAssignment = flattenedToTimelineAssignment(
      flattened,
      earliestStation,
      earliestTime
    )

    results.push(timelineAssignment)

    // Update station end time
    stationEndTimes.set(earliestStation, timelineAssignment.endTime)
  }

  return results
}

// ============================================================================
// Project/Resource Conversion
// ============================================================================

/**
 * Create a Project object from a ProjectManifest
 */
export function manifestToProject(manifest: ProjectManifest): Project {
  const totalMinutes = Object.values(manifest.assignments).reduce(
    (sum, a) =>
      sum +
      parseTimeToMinutes(a.buildUpEstTime ?? "") +
      parseTimeToMinutes(a.wireListEstTime ?? ""),
    0
  )

  return {
    id: manifest.id,
    name: manifest.name,
    description: `PD: ${manifest.pdNumber} | Rev: ${manifest.revision}`,
    color: manifest.color,
    estimatedMinutes: totalMinutes,
    priority: manifest.aggregates?.highestPriority
      ? mapPriorityLevelToTimeline(manifest.aggregates.highestPriority)
      : 'medium',
    requiredSkills: [], // Could map from LWC type
  }
}

/**
 * Create multiple Project objects from manifests
 */
export function manifestsToProjects(manifests: ProjectManifest[]): Project[] {
  return manifests.map(manifestToProject)
}
