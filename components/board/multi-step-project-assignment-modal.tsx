'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronsRight,
  Search, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ProfileAvatar } from '@/components/profile/profile-fields'
import {
  Dialog,
  DialogContent,
} from '@/components/dialog/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AccordionMultiselect,
  AccordionMultiselectContent,
  AccordionMultiselectItem,
  AccordionMultiselectOption,
  AccordionMultiselectTrigger,
} from '@/components/ui/accordion-multi-select'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAssignmentRoleLabel, type AssignmentStageRole } from '@/lib/board/stage-workspaces'
import { getDefaultScheduleDateForShift, getDefaultStartTimeForShift, getFollowingShiftId } from '@/lib/board/assignment-flow'
import type {
  BoardAssignmentSelectionInput,
  BoardAssignmentSource,
  BoardAssignmentView,
  BoardCandidateView,
  BoardDataResponse,
} from '@/lib/board/types'
import { cn } from '@/lib/utils'
import { getAllStations, lwcToFloorArea } from '@/types/floor-layout'
import type { ShiftId } from '@/types/shifts'
import { SHIFT_SCHEDULES } from '@/types/shifts'

type AssignmentModalStep = 'placement' | 'projects' | 'team'

const STEP_LABELS: Record<AssignmentModalStep, { title: string; description: string }> = {
  placement: {
    title: 'Placement',
    description: 'Choose shift timing and a default work area.',
  },
  projects: {
    title: 'Projects',
    description: 'Select the queued assignments to schedule.',
  },
  team: {
    title: 'Candidates',
    description: 'Review available members and assign the work.',
  },
}

export interface AssignmentModalTriggerContext {
  source: BoardAssignmentSource
  stationId?: string | null
  stationLabel?: string | null
  shiftId?: ShiftId | null
  startTime?: string | null
  lockWorkArea?: boolean
  preselectedAssignmentIds?: string[]
}

interface MultiStepProjectAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: BoardDataResponse | null
  canAssign: boolean
  actorBadge: string
  actorPin: string
  onActorBadgeChange: (value: string) => void
  onActorPinChange: (value: string) => void
  triggerContext: AssignmentModalTriggerContext | null
  onAssignmentsApplied: () => Promise<void> | void
}

function stageRoleToCategory(stageRole: AssignmentStageRole) {
  switch (stageRole) {
    case 'BUILD_UP':
      return 'BUILD_UP'
    case 'WIRING':
      return 'WIRING'
    case 'BOX_BUILD':
    case 'CROSS_WIRING':
    case 'TEST':
    case 'BIQ':
      return 'TEST'
    default:
      return 'BUILD_UP'
  }
}

function getCompatibleStationsForAssignment(assignment: BoardAssignmentView, lwcType: string) {
  const floorArea = lwcToFloorArea(lwcType)
  const category = stageRoleToCategory(assignment.stageRole)

  return getAllStations()
    .filter(station => station.floorArea === floorArea && station.category === category)
    .map(station => ({
      id: station.id,
      label: `${station.shortLabel} · ${station.label}`,
      shortLabel: station.shortLabel,
    }))
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}m`
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

function getComponentExperienceLabel(matchCount: number) {
  if (matchCount >= 5) return 'Strong component experience'
  if (matchCount >= 2) return 'Some component experience'
  if (matchCount >= 1) return 'Worked with similar components'
  return 'No recorded component history yet'
}

function getAvailabilityLabel(candidate: BoardCandidateView, shiftId: ShiftId) {
  if (candidate.availabilityStatus === 'AVAILABLE' && candidate.availabilityShiftId === shiftId) {
    return 'Available this shift'
  }
  if (candidate.availabilityStatus === 'ON_ASSIGNMENT') {
    return 'On assignment'
  }
  if (candidate.shift.startsWith(shiftId === '1st' ? '1' : '2')) {
    return 'Not badged in yet'
  }
  return 'Other shift'
}

export function MultiStepProjectAssignmentModal({
  open,
  onOpenChange,
  data,
  canAssign,
  actorBadge,
  actorPin,
  onActorBadgeChange,
  onActorPinChange,
  triggerContext,
  onAssignmentsApplied,
}: MultiStepProjectAssignmentModalProps) {
  const recommendedShift = useMemo(() => getFollowingShiftId(), [])
  const [step, setStep] = useState<AssignmentModalStep>('placement')
  const [selectedShiftId, setSelectedShiftId] = useState<ShiftId>(recommendedShift)
  const [scheduledDate, setScheduledDate] = useState<string>(getDefaultScheduleDateForShift(recommendedShift))
  const [defaultWorkAreaId, setDefaultWorkAreaId] = useState<string>('none')
  const [defaultStartTime, setDefaultStartTime] = useState<string>(getDefaultStartTimeForShift(recommendedShift))
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [lwcFilter, setLwcFilter] = useState<string>('all')
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([])
  const [assignmentPlacements, setAssignmentPlacements] = useState<Record<string, string>>({})
  const [selectedCandidateBadge, setSelectedCandidateBadge] = useState<string | null>(null)
  const [candidateState, setCandidateState] = useState<{
    isLoading: boolean
    error: string | null
    candidates: BoardCandidateView[]
  }>({ isLoading: false, error: null, candidates: [] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const steps = useMemo<AssignmentModalStep[]>(() => (
    triggerContext?.lockWorkArea ? ['projects', 'team'] : ['placement', 'projects', 'team']
  ), [triggerContext?.lockWorkArea])

  const allAssignments = useMemo(() => {
    if (!data) {
      return []
    }

    return data.projects.flatMap(project =>
      project.assignments.map(assignment => ({
        project,
        assignment,
      })),
    )
  }, [data])

  useEffect(() => {
    if (!open) {
      return
    }

    const nextShift = triggerContext?.shiftId ?? recommendedShift
    const nextDefaultStation = triggerContext?.stationId ?? 'none'
    setSelectedShiftId(nextShift)
    setScheduledDate(getDefaultScheduleDateForShift(nextShift))
    setDefaultStartTime(triggerContext?.startTime ?? getDefaultStartTimeForShift(nextShift))
    setDefaultWorkAreaId(nextDefaultStation)
    setStep(triggerContext?.lockWorkArea ? 'projects' : 'placement')
    setSearchQuery('')
    setStageFilter('all')
    setLwcFilter('all')
    setSelectedAssignmentIds(triggerContext?.preselectedAssignmentIds ?? [])
    setAssignmentPlacements(
      Object.fromEntries((triggerContext?.preselectedAssignmentIds ?? []).map(id => [id, nextDefaultStation])),
    )
    setSelectedCandidateBadge(null)
    setCandidateState({ isLoading: false, error: null, candidates: [] })
    setSubmitError(null)
  }, [open, triggerContext, recommendedShift])

  const eligibleAssignments = useMemo(() => {
    return allAssignments
      .filter(({ assignment }) => !assignment.assignedBadge)
      .filter(({ assignment }) => assignment.status !== 'COMPLETED' && assignment.status !== 'BLOCKED')
      .filter(({ assignment }) => stageFilter === 'all' || assignment.stageRole === stageFilter)
      .filter(({ project }) => lwcFilter === 'all' || project.lwcType === lwcFilter)
      .filter(({ assignment, project }) => {
        if (!searchQuery.trim()) {
          return true
        }

        const query = searchQuery.trim().toLowerCase()
        return (
          project.name.toLowerCase().includes(query)
          || project.pdNumber.toLowerCase().includes(query)
          || assignment.sheetName.toLowerCase().includes(query)
        )
      })
  }, [allAssignments, lwcFilter, searchQuery, stageFilter])

  const selectedAssignments = useMemo(() => {
    return selectedAssignmentIds
      .map(id => allAssignments.find(entry => entry.assignment.assignmentId === id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }, [allAssignments, selectedAssignmentIds])

  const selectedCandidate = useMemo(
    () => candidateState.candidates.find(candidate => candidate.badge === selectedCandidateBadge) ?? null,
    [candidateState.candidates, selectedCandidateBadge],
  )

  const stageOptions = useMemo(() => (
    Array.from(new Set(allAssignments.map(entry => entry.assignment.stageRole))).sort((a, b) => a.localeCompare(b)) as AssignmentStageRole[]
  ), [allAssignments])

  const lwcOptions = useMemo(() => (
    Array.from(new Set(allAssignments.map(entry => entry.project.lwcType).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  ), [allAssignments])

  const stationOptions = useMemo(() => (
    getAllStations().map(station => ({
      id: station.id,
      label: `${station.shortLabel} · ${station.label}`,
    }))
  ), [])
  const defaultWorkAreaLabel = useMemo(
    () => stationOptions.find(option => option.id === defaultWorkAreaId)?.label ?? triggerContext?.stationLabel ?? defaultWorkAreaId,
    [defaultWorkAreaId, stationOptions, triggerContext?.stationLabel],
  )

  const currentStepIndex = steps.indexOf(step)
  const isFirstStep = currentStepIndex <= 0
  const isLastStep = currentStepIndex === steps.length - 1
  const currentStepperValue = currentStepIndex + 1

  const canNavigateToStep = (targetValue: number) => {
    if (targetValue <= currentStepperValue) {
      return true
    }

    for (let index = currentStepperValue; index < targetValue; index += 1) {
      const priorStep = steps[index - 1]
      if (priorStep === 'placement' && !selectedShiftId) {
        return false
      }

      if (priorStep === 'projects' && selectedAssignments.length === 0) {
        return false
      }
    }

    return true
  }

  useEffect(() => {
    if (!open || step !== 'team' || selectedAssignments.length === 0) {
      return
    }

    let cancelled = false
    setCandidateState({ isLoading: true, error: null, candidates: [] })

    void fetch('/api/board/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentIds: selectedAssignments.map(entry => entry.assignment.assignmentId),
        shiftId: selectedShiftId,
      }),
    })
      .then(async (response) => {
        const payload = await response.json() as { error?: string, candidates?: BoardCandidateView[] }
        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load candidates.')
        }

        return payload.candidates ?? []
      })
      .then((candidates) => {
        if (!cancelled) {
          setCandidateState({ isLoading: false, error: null, candidates })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCandidateState({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load candidates.',
            candidates: [],
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, selectedAssignments, selectedShiftId, step])

  const canContinue = useMemo(() => {
    if (step === 'placement') {
      return Boolean(selectedShiftId)
    }
    if (step === 'projects') {
      return selectedAssignments.length > 0
    }
    return true
  }, [defaultWorkAreaId, selectedAssignments.length, selectedShiftId, step])

  const handleToggleAssignment = (assignmentId: string, checked: boolean) => {
    setSelectedAssignmentIds(current => (
      checked
        ? Array.from(new Set([...current, assignmentId]))
        : current.filter(id => id !== assignmentId)
    ))

    setAssignmentPlacements(current => {
      if (!checked) {
        const next = { ...current }
        delete next[assignmentId]
        return next
      }

      return {
        ...current,
        [assignmentId]: current[assignmentId] ?? defaultWorkAreaId,
      }
    })
  }

  const handleAssignToMember = async (memberBadge: string) => {
    if (selectedAssignments.length === 0) {
      return
    }

    const promptedBadge = window.prompt('Enter authorizing badge', actorBadge)
    if (promptedBadge === null) {
      return
    }

    const normalizedBadge = promptedBadge.replace(/\D/g, '')
    if (!normalizedBadge) {
      setSubmitError('Authorizing badge is required.')
      return
    }

    const promptedPin = window.prompt(`Enter 4-digit PIN for badge ${normalizedBadge}`, '')
    if (promptedPin === null) {
      return
    }

    const normalizedPin = promptedPin.replace(/\D/g, '').slice(0, 4)
    if (!/^\d{4}$/.test(normalizedPin)) {
      setSubmitError('A valid 4-digit PIN is required.')
      return
    }

    onActorBadgeChange(normalizedBadge)
    onActorPinChange(normalizedPin)

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const items: BoardAssignmentSelectionInput[] = selectedAssignments.map((entry, index) => ({
        assignmentId: entry.assignment.assignmentId,
        workAreaId: assignmentPlacements[entry.assignment.assignmentId] && assignmentPlacements[entry.assignment.assignmentId] !== 'none'
          ? assignmentPlacements[entry.assignment.assignmentId]
          : defaultWorkAreaId !== 'none'
            ? defaultWorkAreaId
            : null,
        queueIndex: index,
      }))

      const response = await fetch('/api/board/assign/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorBadge: normalizedBadge,
          actorPin: normalizedPin,
          memberBadge,
          items,
          shiftId: selectedShiftId,
          scheduledDate,
          startTime: defaultStartTime,
          source: triggerContext?.source ?? 'timeline',
        }),
      })

      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Assignment failed.')
      }

      await onAssignmentsApplied()
      onActorPinChange('')
      onOpenChange(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Assignment failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (!canContinue) {
      return
    }

    const nextStep = steps[currentStepIndex + 1]
    if (nextStep) {
      setStep(nextStep)
    }
  }

  const handleBack = () => {
    const previousStep = steps[currentStepIndex - 1]
    if (previousStep) {
      setStep(previousStep)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        clickBehaviour="none"
        className="flex max-h-[80vh] w-[min(1200px,96vw)] flex-col overflow-hidden bg-background p-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Project Assignment Workflow</h2>
            <p className="text-sm text-muted-foreground">
              Use one reusable assignment flow for stations, queue picks, and other board actions.
            </p>
          </div>
          {triggerContext?.source ? (
            <Badge variant="dot" className="rounded-full">
              Source: {triggerContext.source}
            </Badge>
          ) : null}
        </div>

        <div className="border-b border-border/70 px-6 py-4">
          <Stepper
            value={currentStepperValue}
            onValueChange={(value) => {
              const nextStep = steps[value - 1]
              if (!nextStep) {
                return
              }

              if (canNavigateToStep(value)) {
                setStep(nextStep)
              }
            }}
            indicators={{
              completed: <Check className="size-3 text-white" />,
            }}
          >
            <StepperNav className="rounded-xl bg-gray-100 p-2 text-gray-900 dark:bg-zinc-900 dark:text-zinc-100 sm:p-3">
              {steps.map((stepKey, index) => {
                const stepValue = index + 1
                const isCompleted = stepValue < currentStepperValue
                const isLocked = !canNavigateToStep(stepValue)
                const isCurrent = stepValue === currentStepperValue

                return (
                  <StepperItem
                    key={stepKey}
                    step={stepValue}
                    completed={isCompleted}
                    disabled={isLocked}
                    className="relative items-start sm:flex-1"
                  >
                    <StepperTrigger
                      className={cn(
                        'group w-full items-center rounded-lg px-1 py-1 text-left sm:items-start sm:px-0 sm:py-0',
                        isLocked && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <StepperIndicator
                        className={cn(
                          'h-5 w-5 border-2 bg-white text-[10px] dark:bg-zinc-900 sm:h-6 sm:w-6 sm:text-xs',
                          isCompleted && 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500',
                          isCurrent && 'border-green-600 text-green-600 dark:border-green-500 dark:text-green-500',
                          !isCompleted && !isCurrent && 'border-gray-300 text-gray-500 dark:border-zinc-700 dark:text-zinc-500',
                        )}
                      >
                        {!isCompleted ? stepValue.toString().padStart(2, '0') : null}
                      </StepperIndicator>
                      <div className="min-w-0">
                        <StepperTitle
                          className={cn(
                            'text-[10px] font-medium sm:text-xs',
                            isCompleted && 'text-gray-900 dark:text-zinc-100',
                            isCurrent && 'text-green-600 dark:text-green-500',
                            !isCompleted && !isCurrent && 'text-gray-500 dark:text-zinc-500',
                          )}
                        >
                          {STEP_LABELS[stepKey].title}
                        </StepperTitle>
                      </div>
                    </StepperTrigger>
                    {index < steps.length - 1 ? (
                      <StepperSeparator
                        className={cn(
                          'ml-2 hidden h-0.5 flex-1 self-center rounded-full sm:flex',
                          isCompleted ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-300 dark:bg-zinc-700',
                        )}
                      />
                    ) : null}
                  </StepperItem>
                )
              })}
            </StepperNav>
          </Stepper>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-6 py-5 lg:grid-cols-[minmax(0,1.8fr)_360px]">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-border/70">
            {step === 'placement' ? (
              <div className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select
                    value={selectedShiftId}
                    onValueChange={(value) => {
                      const nextShift = value as ShiftId
                      setSelectedShiftId(nextShift)
                      setScheduledDate(getDefaultScheduleDateForShift(nextShift))
                      setDefaultStartTime(getDefaultStartTimeForShift(nextShift))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['1st', '2nd'] as ShiftId[]).map((shiftId, index) => (
                        <SelectItem key={shiftId} value={shiftId} index={index}>
                          {SHIFT_SCHEDULES[shiftId].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Scheduled Date</Label>
                    <Input value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Queue Start Time</Label>
                    <Input value={defaultStartTime} onChange={(event) => setDefaultStartTime(event.target.value)} type="time" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Default Work Area</Label>
                  <Select value={defaultWorkAreaId} onValueChange={setDefaultWorkAreaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" index={0}>Choose later per project</SelectItem>
                      {stationOptions.map((station, index) => (
                        <SelectItem key={station.id} value={station.id} index={index + 1}>
                          {station.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {step === 'projects' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="grid gap-3 border-b border-border/70 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="relative md:col-span-2 xl:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-9"
                      placeholder="Search project or PD#"
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" index={0}>All stages</SelectItem>
                        {stageOptions.map((option, index) => (
                          <SelectItem key={option} value={option} index={index + 1}>{getAssignmentRoleLabel(option)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  <Select value={lwcFilter} onValueChange={setLwcFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" index={0}>All types</SelectItem>
                      {lwcOptions.map((option, index) => (
                        <SelectItem key={option} value={option} index={index + 1}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-3 p-4">
                    {eligibleAssignments.map(({ project, assignment }) => {
                      const checked = selectedAssignmentIds.includes(assignment.assignmentId)
                      const compatibleStations = getCompatibleStationsForAssignment(assignment, project.lwcType)

                      return (
                        <div
                          key={assignment.assignmentId}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'w-full rounded-2xl border p-4 text-left transition-colors',
                            checked ? 'border-primary bg-primary/5' : 'border-border/70 bg-card hover:border-primary/30 hover:bg-accent/20',
                          )}
                          onClick={() => handleToggleAssignment(assignment.assignmentId, !checked)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleToggleAssignment(assignment.assignmentId, !checked)
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => handleToggleAssignment(assignment.assignmentId, Boolean(value))}
                              onClick={(event) => event.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{assignment.sheetName}</span>
                                <Badge variant="dot" className="rounded-full">{project.pdNumber}</Badge>
                                <Badge className="rounded-full">{assignment.stageRoleLabel}</Badge>
                                <Badge variant="dot" className="rounded-full">{formatMinutes(assignment.estimatedMinutes)}</Badge>
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {project.name} · {project.lwcType || 'NEW_FLEX'} · Unit {project.unitNumber || 'TBD'}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-2.5 py-1">
                                  {assignment.partNumbers.length} components tracked
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1">
                                  {checked ? 'Selected' : 'Click anywhere to select'}
                                </span>
                              </div>

                              {checked ? (
                                <div className="mt-4 space-y-2">
                                  <Label className="text-xs">Work Area Override</Label>
                                  <Select
                                    value={assignmentPlacements[assignment.assignmentId] ?? defaultWorkAreaId}
                                    onValueChange={(value) => setAssignmentPlacements(current => ({
                                      ...current,
                                      [assignment.assignmentId]: value,
                                    }))}
                                  >
                                    <SelectTrigger
                                      className="max-w-sm"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <SelectValue placeholder="Use default work area" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" index={0}>Use default placement</SelectItem>
                                      {compatibleStations.map((station, index) => (
                                        <SelectItem key={station.id} value={station.id} index={index + 1}>
                                          {station.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {eligibleAssignments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                        No unassigned project stages matched the current filters.
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            ) : null}

            {step === 'team' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-border/70 p-4">
                  <div className="text-sm text-muted-foreground">
                    Candidates for {SHIFT_SCHEDULES[selectedShiftId].label}
                  </div>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-4">
                    {candidateState.isLoading ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading candidate members...
                      </div>
                    ) : null}

                    {candidateState.error ? (
                      <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {candidateState.error}
                      </div>
                    ) : null}

                    {!candidateState.isLoading && !candidateState.error ? (
                      <AccordionMultiselect
                        value={selectedCandidateBadge ? [selectedCandidateBadge] : []}
                        onValueChange={(values) => setSelectedCandidateBadge(values.at(-1) ?? null)}
                        className="space-y-3"
                      >
                        {candidateState.candidates.map(candidate => (
                          <AccordionMultiselectItem
                            key={candidate.badge}
                            value={candidate.badge}
                            className={cn(
                              'rounded-2xl border border-border/70 px-4 py-4 transition-colors',
                              selectedCandidateBadge === candidate.badge
                                ? 'bg-primary/5'
                                : 'bg-card hover:bg-accent/20',
                            )}
                          >
                            <AccordionMultiselectTrigger className="items-start py-0">
                              <div className="flex min-w-0 items-start gap-3 text-left">
                                <ProfileAvatar
                                  fullName={candidate.fullName}
                                  preferredName={candidate.preferredName ?? undefined}
                                  colorKey={candidate.badge}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-semibold">{candidate.preferredName || candidate.fullName}</span>
                                    <Badge variant="dot" className="rounded-full">{candidate.badge}</Badge>
                                    {selectedCandidateBadge === candidate.badge ? (
                                      <Badge className="rounded-full bg-primary text-primary-foreground">Selected</Badge>
                                    ) : null}
                                    {candidate.isRecommended ? (
                                      <Badge className="rounded-full bg-emerald-600 text-white">Recommended</Badge>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span>{candidate.primaryLwc || 'No LWC'}</span>
                                    <span>•</span>
                                    <span>{candidate.shift}</span>
                                    <span>•</span>
                                    <span>{candidate.yearsExperience.toFixed(1)}y exp</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge className="rounded-full">
                                      Skill {candidate.stageSkillScore}
                                    </Badge>
                                    <Badge variant="dot" className="rounded-full">
                                      {getAvailabilityLabel(candidate, selectedShiftId)}
                                    </Badge>
                                    <Badge variant="dot" className="rounded-full">
                                      {getComponentExperienceLabel(candidate.partNumberMatchCount)}
                                    </Badge>
                                    <Badge variant="dot" className="rounded-full">
                                      {candidate.activeAssignmentsCount} queued
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </AccordionMultiselectTrigger>
                            <AccordionMultiselectContent>
                              <AccordionMultiselectOption
                                value={candidate.badge}
                                showCheckbox
                                className="rounded-xl border border-border/60 bg-background/70 p-3"
                              >
                                <div className="text-sm font-medium">Assign to this candidate</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Selecting this candidate enables scheduling.
                                </div>
                              </AccordionMultiselectOption>

                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl bg-accent/35 p-4">
                                  <div className="mb-2 text-sm font-medium">Experience Summary</div>
                                  <div className="flex flex-wrap gap-2">
                                    {candidate.stageSkillSummary.map(item => (
                                      <Badge key={item} variant="dot" className="rounded-full">
                                        {item}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="mt-3 text-sm text-muted-foreground">
                                    {getComponentExperienceLabel(candidate.partNumberMatchCount)}
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-accent/35 p-4">
                                  <div className="mb-2 text-sm font-medium">Current Queue</div>
                                  <div className="space-y-2 text-sm">
                                    {candidate.activeAssignments.length ? candidate.activeAssignments.map(active => (
                                      <div key={active.assignmentId} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                                        <div className="font-medium">{active.sheetName}</div>
                                        <div className="text-xs text-muted-foreground">{active.stageRoleLabel} · {active.pdNumber}</div>
                                      </div>
                                    )) : (
                                      <div className="text-muted-foreground">No active queued projects.</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </AccordionMultiselectContent>
                          </AccordionMultiselectItem>
                        ))}
                        {candidateState.candidates.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-muted-foreground">
                            No team members are available for candidate review right now.
                          </div>
                        ) : null}
                      </AccordionMultiselect>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-accent/35 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selection Summary</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Shift</span>
                  <span className="font-medium">{SHIFT_SCHEDULES[selectedShiftId].label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{scheduledDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Default Work Area</span>
                  <span className="font-medium">{defaultWorkAreaId === 'none' ? 'Per project' : defaultWorkAreaLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Selected Projects</span>
                  <span className="font-medium">{selectedAssignments.length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected Work</div>
              <div className="space-y-3">
                {selectedAssignments.length ? selectedAssignments.map(({ project, assignment }) => (
                  <div key={assignment.assignmentId} className="rounded-xl border border-border/60 px-3 py-3">
                    <div className="font-medium">{assignment.sheetName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {project.pdNumber} · {assignment.stageRoleLabel} · {formatMinutes(assignment.estimatedMinutes)}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {assignment.partNumbers.length} components tracked for competency matching
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">No projects selected yet.</div>
                )}
                {selectedAssignments.length > 1 ? (
                  <div className="rounded-xl bg-accent/40 px-3 py-3 text-xs text-muted-foreground">
                    These assignments will be added to the selected member&apos;s queue in the order shown.
                  </div>
                ) : null}
              </div>
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {!isFirstStep ? (
              <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                Back
              </Button>
            ) : null}
            {!isLastStep ? (
              <Button onClick={handleNext} disabled={!canContinue} className="w-full sm:w-auto">
                Continue
                <ChevronsRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (selectedCandidateBadge) {
                    void handleAssignToMember(selectedCandidateBadge)
                  }
                }}
                disabled={!selectedCandidateBadge || isSubmitting}
                className={cn('w-full sm:min-w-[320px] md:min-w-105', !selectedCandidateBadge ? 'opacity-70' : '')}
              >
                {isSubmitting
                  ? 'Scheduling assignments...'
                  : selectedCandidate
                    ? `Schedule ${selectedAssignments.length} Assignment${selectedAssignments.length === 1 ? '' : 's'}`
                    : 'Choose a candidate'}
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
