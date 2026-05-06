'use client'

import { useMemo, useState } from 'react'

import type {
  ShiftOptionId,
  StartupProcessingStepDefinition,
  StartupSetupStepDefinition,
  StartupWorkspaceSummary,
  StartupWorkflowController,
} from '@/types/d380-startup'

const SETUP_STEPS: StartupSetupStepDefinition[] = [
  {
    id: 'SHIFT',
    title: 'Shift context',
    description: 'Select the shift that will own this startup cycle.',
  },
  {
    id: 'DATE',
    title: 'Operating date',
    description: 'Choose the date context used for schedule recovery and sequencing.',
  },
  {
    id: 'REVIEW',
    title: 'Review and launch',
    description: 'Confirm startup details, then build the workspace context.',
  },
]

const PROCESSING_STEPS: StartupProcessingStepDefinition[] = [
  {
    id: 'SCHEDULE_IMPORT',
    title: 'Import schedule inputs',
    description: 'Read shift schedule and handoff context from Share contracts.',
    loaderMessage: 'Importing schedule and prior handoff notes...',
    durationMs: 420,
  },
  {
    id: 'SCHEDULE_PARSE',
    title: 'Normalize schedule data',
    description: 'Validate schedule rows and map them into startup planning models.',
    loaderMessage: 'Normalizing startup schedule rows...',
    durationMs: 420,
  },
  {
    id: 'PROJECT_DISCOVERY',
    title: 'Discover active projects',
    description: 'Resolve active project manifests for the selected shift and date.',
    loaderMessage: 'Discovering active projects and manifests...',
    durationMs: 380,
  },
  {
    id: 'LAYOUT_MATCHING',
    title: 'Match layout state',
    description: 'Attach known drawing and layout snapshots to each project.',
    loaderMessage: 'Matching layout and drawing state...',
    durationMs: 380,
  },
  {
    id: 'ROSTER_LOAD',
    title: 'Load shift roster',
    description: 'Load team members and station coverage for the selected shift.',
    loaderMessage: 'Loading roster and station coverage...',
    durationMs: 360,
  },
  {
    id: 'STATE_RESTORE',
    title: 'Restore carryover state',
    description: 'Rehydrate paused and carryover assignment context.',
    loaderMessage: 'Restoring carryover and in-progress state...',
    durationMs: 360,
  },
  {
    id: 'WORKSPACE_BUILD',
    title: 'Finalize workspace',
    description: 'Build the startup workspace payload for downstream views.',
    loaderMessage: 'Finalizing workspace payload...',
    durationMs: 420,
  },
]

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildDefaultSummary(shift: ShiftOptionId, operatingDate: string): StartupWorkspaceSummary {
  const isFirst = shift === '1st'

  return {
    operatingDate,
    prioritizedProjects: [
      {
        id: 'startup-proj-1',
        pdNumber: isFirst ? 'PD-3801' : 'PD-3808',
        name: isFirst ? 'Day Shift Production Pack' : 'Evening Carryover Pack',
        priority: 1,
        units: isFirst ? 6 : 4,
        targetDate: operatingDate,
        risk: isFirst ? 'healthy' : 'watch',
        preferredShift: shift,
      },
      {
        id: 'startup-proj-2',
        pdNumber: isFirst ? 'PD-3814' : 'PD-3822',
        name: isFirst ? 'Harness Quality Sweep' : 'Overnight Delivery Prep',
        priority: 2,
        units: isFirst ? 3 : 2,
        targetDate: operatingDate,
        risk: 'watch',
        preferredShift: shift,
      },
    ],
    roster: [
      {
        id: `${shift}-member-1`,
        name: isFirst ? 'Alex Rivera' : 'Jordan Kim',
        role: isFirst ? 'Supervisor' : 'Team Lead',
        station: isFirst ? 'Line A1' : 'Line B2',
        shift,
      },
      {
        id: `${shift}-member-2`,
        name: isFirst ? 'Morgan Lee' : 'Taylor Grant',
        role: isFirst ? 'Assembler' : 'QA',
        station: isFirst ? 'Line A3' : 'Inspection B',
        shift,
      },
    ],
    restoredAssignments: isFirst ? 5 : 3,
    startupNotes: [
      `Startup scaffold generated for ${shift} shift on ${operatingDate}.`,
      'Review queue ordering before assignment release.',
      'Confirm roster coverage and workstation allocation.',
    ],
    importSourceLabel: 'Startup scaffold',
  }
}

export function useStartupWorkflow(initialSummary?: StartupWorkspaceSummary): StartupWorkflowController {
  const [selectedShift, setSelectedShift] = useState<ShiftOptionId>('1st')
  const [operatingDate, setOperatingDate] = useState(todayIsoDate())
  const [setupStageIndex, setSetupStageIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0)
  const [progressMessages, setProgressMessages] = useState<string[]>([])

  const usesImportedSummary = Boolean(initialSummary)

  const workspaceSummary = useMemo(() => {
    if (initialSummary) {
      return initialSummary
    }

    return buildDefaultSummary(selectedShift, operatingDate)
  }, [initialSummary, operatingDate, selectedShift])

  const currentStep = useMemo(() => {
    if (isRunning) {
      const processing = PROCESSING_STEPS[Math.min(currentProcessingIndex, PROCESSING_STEPS.length - 1)]
      return {
        title: processing?.title ?? 'Preparing workspace',
        description: processing?.description ?? 'Building startup context...',
      }
    }

    const setupStep = SETUP_STEPS[Math.min(setupStageIndex, SETUP_STEPS.length - 1)]
    return {
      title: setupStep?.title ?? 'Startup setup',
      description: setupStep?.description ?? 'Configure startup context.',
    }
  }, [currentProcessingIndex, isRunning, setupStageIndex])

  const progressPercent = useMemo(() => {
    if (isReady) {
      return 100
    }

    if (isRunning) {
      return Math.round((currentProcessingIndex / PROCESSING_STEPS.length) * 100)
    }

    return Math.round((setupStageIndex / SETUP_STEPS.length) * 30)
  }, [currentProcessingIndex, isReady, isRunning, setupStageIndex])

  const canContinue = useMemo(() => {
    if (setupStageIndex === 1) {
      return /^\d{4}-\d{2}-\d{2}$/.test(operatingDate)
    }

    return true
  }, [operatingDate, setupStageIndex])

  const next = () => {
    setSetupStageIndex(current => Math.min(current + 1, SETUP_STEPS.length - 1))
  }

  const back = () => {
    setSetupStageIndex(current => Math.max(current - 1, 0))
  }

  const reset = () => {
    setSelectedShift('1st')
    setOperatingDate(todayIsoDate())
    setSetupStageIndex(0)
    setIsEditing(true)
    setIsRunning(false)
    setIsReady(false)
    setCurrentProcessingIndex(0)
    setProgressMessages([])
  }

  const submit = () => {
    setIsEditing(false)
    setIsRunning(true)
    setIsReady(false)
    setCurrentProcessingIndex(0)
    setProgressMessages([])

    let accumulatedDelay = 0

    PROCESSING_STEPS.forEach((step, index) => {
      accumulatedDelay += step.durationMs
      window.setTimeout(() => {
        setCurrentProcessingIndex(index + 1)
        setProgressMessages(previous => [...previous, step.loaderMessage])

        if (index === PROCESSING_STEPS.length - 1) {
          setIsRunning(false)
          setIsReady(true)
        }
      }, accumulatedDelay)
    })
  }

  return {
    selectedShift,
    operatingDate,
    currentStep,
    setupStageIndex,
    setupSteps: SETUP_STEPS,
    processingSteps: PROCESSING_STEPS,
    currentProcessingIndex,
    progressMessages,
    progressPercent,
    canContinue,
    isEditing,
    isRunning,
    isReady,
    workspaceSummary,
    usesImportedSummary,
    setSelectedShift,
    setOperatingDate,
    next,
    back,
    reset,
    submit,
  }
}
