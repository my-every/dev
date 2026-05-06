/**
 * SWS (Standard Work Sheet) Components
 * 
 * Reusable components for rendering SWS worksheets in both print and tablet modes.
 */

// Main renderer
export { SwsWorksheetRenderer } from './sws-worksheet-renderer'

// Worksheet sections
export { SwsWorksheetHeader } from './sws-worksheet-header'
export { SwsWorksheetMetadataGrid } from './sws-worksheet-metadata-grid'
export { SwsWorksheetWorkExecutions } from './sws-worksheet-work-executions'
export { SwsWorksheetFooter } from './sws-worksheet-footer'

// Print mode
export { SwsPrintSidebar } from './sws-print-sidebar'

// Tablet mode
export { SwsTabletSectionPanel } from './sws-tablet-section-panel'

// Selection
export { SwsTemplatePicker } from './sws-template-picker'

// Work Execution Table (interactive execution)
export { SwsWorkExecutionTable } from './sws-work-execution-table'
export type { 
  SwsSection, 
  WorkExecution, 
  SubStep, 
  SymbolType,
  StepCompletion,
  ContributingUser 
} from './sws-work-execution-table'

// Blocked reason modal and components
export { 
  SwsBlockedReasonModal,
  SwsBlockedStatusBadge,
  SwsBlockedItemsList,
  BLOCKED_REASONS,
} from './sws-blocked-reason-modal'
export type { 
  BlockedReasonCode, 
  BlockedReason, 
  BlockedItem,
} from './sws-blocked-reason-modal'

// Save progress modal and components
export { 
  SwsSaveProgressModal,
  SwsResumeSessionBanner,
} from './sws-save-progress-modal'
export type { 
  SaveProgressType, 
  SaveProgressSummary, 
  SaveProgressResult,
} from './sws-save-progress-modal'
