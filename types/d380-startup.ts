export type ShiftOptionId = '1st' | '2nd'

export interface ShiftOptionConfig {
  id: ShiftOptionId
  label: string
  hours: string
  teamName: string
  description: string
}

export type StartupSetupStepId = 'SHIFT' | 'DATE' | 'REVIEW'

export interface StartupSetupStepDefinition {
  id: StartupSetupStepId
  title: string
  description: string
}

export type StartupProcessingStepId =
  | 'SCHEDULE_IMPORT'
  | 'SCHEDULE_PARSE'
  | 'PROJECT_DISCOVERY'
  | 'LAYOUT_MATCHING'
  | 'ROSTER_LOAD'
  | 'STATE_RESTORE'
  | 'WORKSPACE_BUILD'

export interface StartupProcessingStepDefinition {
  id: StartupProcessingStepId
  title: string
  description: string
  loaderMessage: string
  durationMs: number
}

export type StartupStepStatus = 'pending' | 'current' | 'complete'

export interface StartupProjectPreview {
  id: string
  pdNumber: string
  name: string
  priority: number
  units: number
  targetDate: string
  risk: 'healthy' | 'watch' | 'late'
  preferredShift: ShiftOptionId
}

export interface StartupRosterMember {
  id: string
  name: string
  role: string
  station: string
  shift: ShiftOptionId
}

export interface StartupWorkspaceSummary {
  operatingDate: string
  prioritizedProjects: StartupProjectPreview[]
  roster: StartupRosterMember[]
  restoredAssignments: number
  startupNotes: string[]
  importSourceLabel?: string
}

export interface StartupCurrentStep {
  title: string
  description: string
}

export interface StartupWorkflowController {
  selectedShift: ShiftOptionId
  operatingDate: string
  currentStep: StartupCurrentStep
  setupStageIndex: number
  setupSteps: StartupSetupStepDefinition[]
  processingSteps: StartupProcessingStepDefinition[]
  currentProcessingIndex: number
  progressMessages: string[]
  progressPercent: number
  canContinue: boolean
  isEditing: boolean
  isRunning: boolean
  isReady: boolean
  workspaceSummary: StartupWorkspaceSummary
  usesImportedSummary: boolean
  setSelectedShift: (shift: ShiftOptionId) => void
  setOperatingDate: (value: string) => void
  next: () => void
  back: () => void
  reset: () => void
  submit: () => void
}