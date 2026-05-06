/**
 * Data Loader Module
 * 
 * Centralizes all data loading from Share/ directory.
 * 
 * Data Flow:
 * 1. Legal Drawings are scanned by project-sync-service
 * 2. Extracted data is written to Share/Projects/<folder>/state/*.json
 * 3. This loader reads from Share/Projects/, Share/State/, Share/Config/
 * 4. Components consume data via view models
 */

export * from './share-loader'

// Re-export common utilities
export {
  formatShortDate,
  clearDataCache,
  discoverProjectFolders,
  getAllProjects,
} from './share-loader'

// Re-export types for consumers
export type {
  ProjectAssignmentProgress,
  ProjectState,
  ActiveProjectsState,
  CurrentShiftState,
  DiscoveredProject,
  AssignmentProgressRecord,
  StageHistoryEntry,
  // CSV data types
  ShareDataState,
  UserCSVRow,
  SessionCSVRow,
  AssignmentCSVRow,
  EventCSVRow,
  WorkAreaCSVRow,
  SwsProgressCSVRow,
  DiscrepancyCSVRow,
} from './share-loader'

// Re-export CSV loaders and exporters
export {
  // CSV utilities
  parseCSV,
  toCSV,
  // Loaders
  loadUsersFromCSV,
  loadSessionsFromCSV,
  loadAssignmentsFromCSV,
  loadEventsFromCSV,
  loadWorkAreasFromCSV,
  loadSwsProgressFromCSV,
  loadDiscrepanciesFromCSV,
  // Exporters
  exportUsersToCSV,
  exportSessionsToCSV,
  exportAssignmentsToCSV,
  exportWorkAreasToCSV,
  exportSwsProgressToCSV,
  exportDiscrepanciesToCSV,
  appendEventToCSV,
  // Initialization
  initializeDataFromShare,
} from './share-loader'

// Legal Drawings loader
export {
  discoverLegalDrawingsProjects,
  loadLegalDrawingsProjects,
  getLegalDrawingsPaths,
} from './legal-drawings-loader'

export type {
  LegalDrawingsProject,
} from './legal-drawings-loader'
