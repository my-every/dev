/**
 * Services Index
 *
 * Central export for all service modules
 */

// Assignment Manager
export {
  // Types
  type AssignmentErrorCode,
  type AssignmentError,
  type AssignmentResult,
  type StationAssignment,
  type UserAssignment,
  type QueuedAssignment,
  type AssignmentState,
  type AssignmentValidation,
  // State Factory
  createAssignmentState,
  // Station Validation
  canAssignToStation,
  getStationAssignments,
  isStationAvailable,
  // User Assignment Validation
  canAssignToUser,
  getUserAssignment,
  isUserAssigned,
  getAssignedUserIds,
  // Queue Management
  canQueueAssignment,
  addToQueue,
  removeFromQueue,
  getUserQueue,
  getNextQueuedAssignment,
  isInQueue,
  // Assignment Operations
  assignProject,
  addUserToAssignment,
  releaseUser,
  releaseStation,
  reassignUser,
  // Clock Operations
  clockInUser,
  clockOutUser,
  isUserClockedIn,
  // Batch Operations
  syncFromAssignments,
  getAssignmentStats,
  // Helpers
  minutesToTime,
} from './assignment-manager'

// Priority Service
export {
  parseTimeToMinutes,
  formatMinutesToTime,
  minutesUntilDeadline,
  getStageDefinition,
  getStageCategory,
  mapSwsType,
  getStageWeight,
  calculateRemainingMinutes,
  calculateDeadlineMultiplier,
  getPriorityLevel,
  getPriorityReason,
  calculatePriorityScore,
  calculateProjectPriorities,
  flattenAndSortAssignments,
  getTopPriorityAssignments,
  filterByPriorityLevel,
  groupByPriorityLevel,
  groupByStage,
} from './priority-service'

// Manifest Service
export {
  loadManifest,
  loadManifests,
  calculateAggregates,
  filterAssignments,
  filterProjectsByLwcType,
  filterFlattenedAssignments,
  sortFlattenedAssignments,
  groupByProject,
  groupByLwcType,
  groupByUnitType,
  updateAssignment,
  updateAssignmentStatus,
  updateAssignmentStage,
  addActualTime,
  getAssignmentsReadyForStage,
  getNextAssignment,
  getStartableAssignments,
} from './manifest-service'

// Timeline Bridge
export {
  addMinutesToTime,
  getCurrentTime,
  getShiftForTime,
  mapManifestStatusToTimeline,
  mapTimelineStatusToManifest,
  mapPriorityLevelToTimeline,
  mapTimelinePriorityToLevel,
  generateTimelineId,
  flattenedToTimelineAssignment,
  manifestToTimelineAssignment,
  parseTimelineId,
  timelineToManifestUpdate,
  batchFlattenedToTimeline,
  manifestToProject,
  manifestsToProjects,
} from './timeline-bridge'
