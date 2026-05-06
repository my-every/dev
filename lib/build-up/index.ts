/**
 * Build Up Execution Library
 * 
 * Services and utilities for managing Build Up stage execution.
 */

// Session management
export {
  loadProjectSessions,
  saveProjectSessions,
  getSession,
  saveSession,
  deleteSession,
  startNewSession,
  resumeSession,
  startSection,
  completeStep,
  uncompleteStep,
  addSectionNote,
  switchMember,
  getActiveMember,
  getSessionProgress,
  getSectionProgress,
  getInProgressSessions,
  getCompletedSessions,
  hasActiveSession,
  getSessionDuration,
  getIdleTime,
} from './build-up-execution-service'

// Stage progression
export {
  isBuildUpComplete,
  getBuildUpCompletedAt,
  getNextStageAfterBuildUp,
  canProgressFromBuildUp,
  getAssignmentsWithCompletedBuildUp,
  getBuildUpProgressSummary,
  getBuildUpExportData,
} from './build-up-progression'
