/**
 * Assignment Manager Service
 *
 * Manages project and team member assignments with the following constraints:
 * 1. Only one project can be assigned to a work station at a time (except BUILD_UP tables)
 * 2. Each team member can only be assigned to one project until they clock out
 * 3. Users can be assigned to an additional project while placed in a queue
 *
 * Provides methods for assigning, reassigning, queuing, and releasing projects,
 * plus checks for current assignment status and queue membership.
 */

import type { Assignment, AssignmentStatus } from "@/types/scheduling"
import type { StationCategory } from "@/lib/constants/floor-layout"

// ============================================================================
// Types
// ============================================================================

export type AssignmentErrorCode =
  | "STATION_OCCUPIED"
  | "USER_ALREADY_ASSIGNED"
  | "USER_NOT_CLOCKED_IN"
  | "INVALID_STATION"
  | "INVALID_USER"
  | "ASSIGNMENT_NOT_FOUND"
  | "QUEUE_FULL"
  | "ALREADY_IN_QUEUE"
  | "NOT_IN_QUEUE"

export interface AssignmentError {
  code: AssignmentErrorCode
  message: string
  details?: Record<string, unknown>
}

export interface AssignmentResult<T = void> {
  success: boolean
  data?: T
  error?: AssignmentError
}

export interface StationAssignment {
  stationId: string
  projectId: string
  assignmentId: string
  assignedAt: string // ISO timestamp
  startTime: string // HH:mm
  endTime: string // HH:mm
  assigneeIds: string[]
  category: StationCategory
}

export interface UserAssignment {
  userId: string
  assignmentId: string
  stationId: string
  projectId: string
  projectName: string
  assignedAt: string // ISO timestamp
  startTime: string // HH:mm
  estimatedEndTime: string // HH:mm
  status: "active" | "paused" | "queued"
}

export interface QueuedAssignment {
  userId: string
  assignmentId: string
  stationId: string
  projectId: string
  projectName: string
  queuedAt: string // ISO timestamp
  priority: number // Lower is higher priority
  estimatedStartTime?: string // HH:mm
}

export interface AssignmentState {
  stationAssignments: Map<string, StationAssignment[]> // stationId -> assignments (multiple for BUILD_UP)
  userAssignments: Map<string, UserAssignment> // userId -> primary assignment
  userQueues: Map<string, QueuedAssignment[]> // userId -> queued assignments
  clockedInUsers: Set<string> // Set of clocked-in user IDs
}

export interface AssignmentValidation {
  canAssign: boolean
  reason?: string
  conflictingAssignment?: StationAssignment | UserAssignment
}

// ============================================================================
// Constants
// ============================================================================

const MAX_QUEUE_SIZE = 3 // Maximum queued assignments per user
const BUILD_UP_MAX_CONCURRENT = 2 // Max concurrent projects on BUILD_UP tables

// ============================================================================
// State Factory
// ============================================================================

export function createAssignmentState(): AssignmentState {
  return {
    stationAssignments: new Map(),
    userAssignments: new Map(),
    userQueues: new Map(),
    clockedInUsers: new Set(),
  }
}

// ============================================================================
// Station Validation
// ============================================================================

/**
 * Check if a station can accept a new assignment
 * BUILD_UP tables allow multiple concurrent assignments (up to BUILD_UP_MAX_CONCURRENT)
 * Other stations allow only one assignment at a time
 */
export function canAssignToStation(
  state: AssignmentState,
  stationId: string,
  stationCategory: StationCategory,
  timeRange?: { startTime: string; endTime: string }
): AssignmentValidation {
  const stationAssignments = state.stationAssignments.get(stationId) || []

  // BUILD_UP tables can have multiple concurrent assignments
  if (stationCategory === "BUILD_UP") {
    const activeAssignments = stationAssignments.filter(
      (a) => !timeRange || hasTimeOverlap(a, timeRange)
    )

    if (activeAssignments.length >= BUILD_UP_MAX_CONCURRENT) {
      return {
        canAssign: false,
        reason: `Build-up table already has ${BUILD_UP_MAX_CONCURRENT} concurrent assignments`,
        conflictingAssignment: activeAssignments[0],
      }
    }
    return { canAssign: true }
  }

  // Other stations: check for any overlapping assignments
  if (timeRange) {
    const overlapping = stationAssignments.find((a) => hasTimeOverlap(a, timeRange))
    if (overlapping) {
      return {
        canAssign: false,
        reason: "Station already has an assignment during this time",
        conflictingAssignment: overlapping,
      }
    }
    return { canAssign: true }
  }

  // Without time range, check if station has any active assignments
  if (stationAssignments.length > 0) {
    return {
      canAssign: false,
      reason: "Station is currently occupied",
      conflictingAssignment: stationAssignments[0],
    }
  }

  return { canAssign: true }
}

/**
 * Get all assignments for a station
 */
export function getStationAssignments(
  state: AssignmentState,
  stationId: string
): StationAssignment[] {
  return state.stationAssignments.get(stationId) || []
}

/**
 * Check if a station is available at a specific time
 */
export function isStationAvailable(
  state: AssignmentState,
  stationId: string,
  stationCategory: StationCategory,
  startTime: string,
  endTime: string
): boolean {
  const validation = canAssignToStation(state, stationId, stationCategory, {
    startTime,
    endTime,
  })
  return validation.canAssign
}

// ============================================================================
// User Assignment Validation
// ============================================================================

/**
 * Check if a user can be assigned to a new project
 * Users can only have one active assignment until they clock out
 */
export function canAssignToUser(
  state: AssignmentState,
  userId: string
): AssignmentValidation {
  // Check if user is clocked in
  if (!state.clockedInUsers.has(userId)) {
    return {
      canAssign: false,
      reason: "User is not clocked in",
    }
  }

  // Check if user already has an active assignment
  const currentAssignment = state.userAssignments.get(userId)
  if (currentAssignment && currentAssignment.status === "active") {
    return {
      canAssign: false,
      reason: "User already has an active assignment",
      conflictingAssignment: currentAssignment,
    }
  }

  return { canAssign: true }
}

/**
 * Get a user's current active assignment
 */
export function getUserAssignment(
  state: AssignmentState,
  userId: string
): UserAssignment | null {
  return state.userAssignments.get(userId) || null
}

/**
 * Check if a user is currently assigned
 */
export function isUserAssigned(state: AssignmentState, userId: string): boolean {
  const assignment = state.userAssignments.get(userId)
  return !!assignment && assignment.status === "active"
}

/**
 * Get all assigned user IDs
 */
export function getAssignedUserIds(state: AssignmentState): Set<string> {
  const assigned = new Set<string>()
  for (const [userId, assignment] of state.userAssignments) {
    if (assignment.status === "active") {
      assigned.add(userId)
    }
  }
  return assigned
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Check if a user can be added to the queue
 */
export function canQueueAssignment(
  state: AssignmentState,
  userId: string,
  assignmentId: string
): AssignmentValidation {
  // Check if user is clocked in
  if (!state.clockedInUsers.has(userId)) {
    return {
      canAssign: false,
      reason: "User is not clocked in",
    }
  }

  const userQueue = state.userQueues.get(userId) || []

  // Check queue size limit
  if (userQueue.length >= MAX_QUEUE_SIZE) {
    return {
      canAssign: false,
      reason: `Queue is full (max ${MAX_QUEUE_SIZE} assignments)`,
    }
  }

  // Check if already in queue
  if (userQueue.some((q) => q.assignmentId === assignmentId)) {
    return {
      canAssign: false,
      reason: "Assignment is already in queue",
    }
  }

  return { canAssign: true }
}

/**
 * Add an assignment to a user's queue
 */
export function addToQueue(
  state: AssignmentState,
  userId: string,
  queuedAssignment: Omit<QueuedAssignment, "userId" | "queuedAt">
): AssignmentResult<QueuedAssignment> {
  const validation = canQueueAssignment(state, userId, queuedAssignment.assignmentId)
  if (!validation.canAssign) {
    return {
      success: false,
      error: {
        code: validation.reason?.includes("full") ? "QUEUE_FULL" : "ALREADY_IN_QUEUE",
        message: validation.reason || "Cannot add to queue",
      },
    }
  }

  const newQueuedAssignment: QueuedAssignment = {
    ...queuedAssignment,
    userId,
    queuedAt: new Date().toISOString(),
  }

  const userQueue = state.userQueues.get(userId) || []
  userQueue.push(newQueuedAssignment)

  // Sort by priority
  userQueue.sort((a, b) => a.priority - b.priority)

  state.userQueues.set(userId, userQueue)

  return { success: true, data: newQueuedAssignment }
}

/**
 * Remove an assignment from a user's queue
 */
export function removeFromQueue(
  state: AssignmentState,
  userId: string,
  assignmentId: string
): AssignmentResult {
  const userQueue = state.userQueues.get(userId)
  if (!userQueue) {
    return {
      success: false,
      error: {
        code: "NOT_IN_QUEUE",
        message: "User has no queued assignments",
      },
    }
  }

  const index = userQueue.findIndex((q) => q.assignmentId === assignmentId)
  if (index === -1) {
    return {
      success: false,
      error: {
        code: "NOT_IN_QUEUE",
        message: "Assignment not found in queue",
      },
    }
  }

  userQueue.splice(index, 1)
  state.userQueues.set(userId, userQueue)

  return { success: true }
}

/**
 * Get a user's queued assignments
 */
export function getUserQueue(
  state: AssignmentState,
  userId: string
): QueuedAssignment[] {
  return state.userQueues.get(userId) || []
}

/**
 * Get the next queued assignment for a user
 */
export function getNextQueuedAssignment(
  state: AssignmentState,
  userId: string
): QueuedAssignment | null {
  const queue = state.userQueues.get(userId)
  return queue && queue.length > 0 ? queue[0] : null
}

/**
 * Check if a user has a specific assignment in queue
 */
export function isInQueue(
  state: AssignmentState,
  userId: string,
  assignmentId: string
): boolean {
  const queue = state.userQueues.get(userId) || []
  return queue.some((q) => q.assignmentId === assignmentId)
}

// ============================================================================
// Assignment Operations
// ============================================================================

/**
 * Assign a project to a station and user
 */
export function assignProject(
  state: AssignmentState,
  params: {
    stationId: string
    stationCategory: StationCategory
    userId: string
    projectId: string
    projectName: string
    assignmentId: string
    startTime: string
    endTime: string
  }
): AssignmentResult<{ station: StationAssignment; user: UserAssignment }> {
  const {
    stationId,
    stationCategory,
    userId,
    projectId,
    projectName,
    assignmentId,
    startTime,
    endTime,
  } = params

  // Validate station availability
  const stationValidation = canAssignToStation(state, stationId, stationCategory, {
    startTime,
    endTime,
  })
  if (!stationValidation.canAssign) {
    return {
      success: false,
      error: {
        code: "STATION_OCCUPIED",
        message: stationValidation.reason || "Station is not available",
        details: {
          conflictingAssignment: stationValidation.conflictingAssignment,
        },
      },
    }
  }

  // Validate user availability
  const userValidation = canAssignToUser(state, userId)
  if (!userValidation.canAssign) {
    return {
      success: false,
      error: {
        code: userValidation.reason?.includes("clocked")
          ? "USER_NOT_CLOCKED_IN"
          : "USER_ALREADY_ASSIGNED",
        message: userValidation.reason || "User is not available",
        details: {
          conflictingAssignment: userValidation.conflictingAssignment,
        },
      },
    }
  }

  const now = new Date().toISOString()

  // Create station assignment
  const stationAssignment: StationAssignment = {
    stationId,
    projectId,
    assignmentId,
    assignedAt: now,
    startTime,
    endTime,
    assigneeIds: [userId],
    category: stationCategory,
  }

  // Create user assignment
  const userAssignment: UserAssignment = {
    userId,
    assignmentId,
    stationId,
    projectId,
    projectName,
    assignedAt: now,
    startTime,
    estimatedEndTime: endTime,
    status: "active",
  }

  // Add to station assignments
  const stationAssignments = state.stationAssignments.get(stationId) || []
  stationAssignments.push(stationAssignment)
  state.stationAssignments.set(stationId, stationAssignments)

  // Set user assignment
  state.userAssignments.set(userId, userAssignment)

  // Remove from queue if was queued
  removeFromQueue(state, userId, assignmentId)

  return {
    success: true,
    data: { station: stationAssignment, user: userAssignment },
  }
}

/**
 * Add an additional user to an existing station assignment (for BUILD_UP tables)
 */
export function addUserToAssignment(
  state: AssignmentState,
  stationId: string,
  assignmentId: string,
  userId: string
): AssignmentResult {
  const stationAssignments = state.stationAssignments.get(stationId)
  if (!stationAssignments) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_NOT_FOUND",
        message: "Station has no assignments",
      },
    }
  }

  const assignment = stationAssignments.find((a) => a.assignmentId === assignmentId)
  if (!assignment) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_NOT_FOUND",
        message: "Assignment not found on station",
      },
    }
  }

  // Validate user availability
  const userValidation = canAssignToUser(state, userId)
  if (!userValidation.canAssign) {
    return {
      success: false,
      error: {
        code: userValidation.reason?.includes("clocked")
          ? "USER_NOT_CLOCKED_IN"
          : "USER_ALREADY_ASSIGNED",
        message: userValidation.reason || "User is not available",
      },
    }
  }

  // Add user to station assignment
  assignment.assigneeIds.push(userId)

  // Create user assignment
  const userAssignment: UserAssignment = {
    userId,
    assignmentId,
    stationId,
    projectId: assignment.projectId,
    projectName: `Project ${assignment.projectId}`,
    assignedAt: new Date().toISOString(),
    startTime: assignment.startTime,
    estimatedEndTime: assignment.endTime,
    status: "active",
  }

  state.userAssignments.set(userId, userAssignment)

  return { success: true }
}

/**
 * Release/unassign a user from their current assignment
 */
export function releaseUser(
  state: AssignmentState,
  userId: string
): AssignmentResult<UserAssignment> {
  const userAssignment = state.userAssignments.get(userId)
  if (!userAssignment) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_NOT_FOUND",
        message: "User has no active assignment",
      },
    }
  }

  // Remove user from station assignment
  const stationAssignments = state.stationAssignments.get(userAssignment.stationId)
  if (stationAssignments) {
    const stationAssignment = stationAssignments.find(
      (a) => a.assignmentId === userAssignment.assignmentId
    )
    if (stationAssignment) {
      const userIndex = stationAssignment.assigneeIds.indexOf(userId)
      if (userIndex > -1) {
        stationAssignment.assigneeIds.splice(userIndex, 1)
      }

      // If no more assignees, remove the station assignment
      if (stationAssignment.assigneeIds.length === 0) {
        const assignmentIndex = stationAssignments.indexOf(stationAssignment)
        stationAssignments.splice(assignmentIndex, 1)
        state.stationAssignments.set(userAssignment.stationId, stationAssignments)
      }
    }
  }

  // Remove user assignment
  state.userAssignments.delete(userId)

  return { success: true, data: userAssignment }
}

/**
 * Release a project from a station (removes all users)
 */
export function releaseStation(
  state: AssignmentState,
  stationId: string,
  assignmentId: string
): AssignmentResult<StationAssignment> {
  const stationAssignments = state.stationAssignments.get(stationId)
  if (!stationAssignments) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_NOT_FOUND",
        message: "Station has no assignments",
      },
    }
  }

  const index = stationAssignments.findIndex((a) => a.assignmentId === assignmentId)
  if (index === -1) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_NOT_FOUND",
        message: "Assignment not found on station",
      },
    }
  }

  const [removed] = stationAssignments.splice(index, 1)

  // Release all assigned users
  for (const userId of removed.assigneeIds) {
    state.userAssignments.delete(userId)
  }

  state.stationAssignments.set(stationId, stationAssignments)

  return { success: true, data: removed }
}

/**
 * Reassign a user from one assignment to another
 */
export function reassignUser(
  state: AssignmentState,
  userId: string,
  newParams: {
    stationId: string
    stationCategory: StationCategory
    projectId: string
    projectName: string
    assignmentId: string
    startTime: string
    endTime: string
  }
): AssignmentResult<{ station: StationAssignment; user: UserAssignment }> {
  // First release the user from current assignment
  releaseUser(state, userId)

  // Then assign to new project
  return assignProject(state, { ...newParams, userId })
}

// ============================================================================
// Clock Operations
// ============================================================================

/**
 * Mark a user as clocked in
 */
export function clockInUser(state: AssignmentState, userId: string): void {
  state.clockedInUsers.add(userId)
}

/**
 * Mark a user as clocked out (releases any assignments and clears queue)
 */
export function clockOutUser(
  state: AssignmentState,
  userId: string
): AssignmentResult<{ releasedAssignment?: UserAssignment; clearedQueue: QueuedAssignment[] }> {
  // Release active assignment if any
  const releasedAssignment = state.userAssignments.get(userId)
  if (releasedAssignment) {
    releaseUser(state, userId)
  }

  // Clear queue
  const clearedQueue = state.userQueues.get(userId) || []
  state.userQueues.delete(userId)

  // Mark as clocked out
  state.clockedInUsers.delete(userId)

  return {
    success: true,
    data: {
      releasedAssignment: releasedAssignment || undefined,
      clearedQueue,
    },
  }
}

/**
 * Check if a user is clocked in
 */
export function isUserClockedIn(state: AssignmentState, userId: string): boolean {
  return state.clockedInUsers.has(userId)
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Sync state from a list of timeline assignments
 */
export function syncFromAssignments(
  state: AssignmentState,
  assignments: Assignment[],
  getStationCategory: (stationId: string) => StationCategory
): void {
  // Clear existing state
  state.stationAssignments.clear()
  state.userAssignments.clear()

  for (const assignment of assignments) {
    const category = getStationCategory(assignment.resourceId)

    // Create station assignment
    const stationAssignment: StationAssignment = {
      stationId: assignment.resourceId,
      projectId: assignment.projectId,
      assignmentId: assignment.id,
      assignedAt: new Date().toISOString(),
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      assigneeIds: assignment.assignees?.map((a) => a.id) || [],
      category,
    }

    // Add to station assignments
    const stationAssignments = state.stationAssignments.get(assignment.resourceId) || []
    stationAssignments.push(stationAssignment)
    state.stationAssignments.set(assignment.resourceId, stationAssignments)

    // Create user assignments for each assignee
    if (assignment.assignees) {
      for (const assignee of assignment.assignees) {
        // Skip if user already has an assignment (take the first one)
        if (state.userAssignments.has(assignee.id)) continue

        const userAssignment: UserAssignment = {
          userId: assignee.id,
          assignmentId: assignment.id,
          stationId: assignment.resourceId,
          projectId: assignment.projectId,
          projectName: assignment.projectName,
          assignedAt: new Date().toISOString(),
          startTime: assignment.startTime,
          estimatedEndTime: assignment.endTime,
          status: assignment.status === "in-progress" ? "active" : "active",
        }

        state.userAssignments.set(assignee.id, userAssignment)
      }
    }
  }
}

/**
 * Get summary statistics
 */
export function getAssignmentStats(state: AssignmentState): {
  totalStationsOccupied: number
  totalUsersAssigned: number
  totalUsersQueued: number
  totalClockedIn: number
} {
  let totalQueued = 0
  for (const queue of state.userQueues.values()) {
    totalQueued += queue.length
  }

  return {
    totalStationsOccupied: state.stationAssignments.size,
    totalUsersAssigned: state.userAssignments.size,
    totalUsersQueued: totalQueued,
    totalClockedIn: state.clockedInUsers.size,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if two time ranges overlap
 */
function hasTimeOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  const aStart = timeToMinutes(a.startTime)
  const aEnd = timeToMinutes(a.endTime)
  const bStart = timeToMinutes(b.startTime)
  const bEnd = timeToMinutes(b.endTime)

  return aStart < bEnd && bStart < aEnd
}

/**
 * Convert HH:mm time string to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes to HH:mm time string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}
