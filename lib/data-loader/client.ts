/**
 * Data Loader - Client-Safe Exports
 * 
 * This module exports only the utilities that are safe for client components.
 * For server-only functions (loadProjectAssignmentProgress, etc.), import from
 * '@/lib/data-loader' instead (only in Server Components or API routes).
 */

export {
  deriveProjectStageCompletions,
  formatShortDate,
} from './share-utils'

export type {
  StageHistoryEntry,
  AssignmentProgressRecord,
  ProjectAssignmentProgress,
  ProjectState,
  ActiveProjectsState,
  CurrentShiftState,
  DiscoveredProject,
} from './share-utils'
