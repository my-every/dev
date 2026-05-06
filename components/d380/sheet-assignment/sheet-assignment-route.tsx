'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  FileText,
  Settings,
  Shield,
  Lock,
  Printer,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'

import { StageLinearStepper } from '@/components/projects/stage-navigation/stage-linear-stepper'
import { MetadataCard, MetadataCardGrid } from '@/components/projects/metadata-card'
import { SecureActionModal } from '@/components/d380/auth/secure-action-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  getStageDefinition,
  getNextStage,
  getPreviousStage,
  type AssignmentStageId,
  type AssignmentStageState,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

// ============================================================================
// Types
// ============================================================================

interface SheetAssignmentRouteProps {
  projectId: string
  sheetName: string
  initialStage?: string
  /** Stage states loaded from Share/_mock files - if not provided, defaults to empty */
  stageStates?: AssignmentStageState[]
  /** Whether sheet has external/cross-wire locations */
  hasExternalLocations?: boolean
  /** Total wire count */
  totalWires?: number
  /** External wire count */
  externalWires?: number
}

interface StageSession {
  stageId: AssignmentStageId
  startedBy: { badge: string; name: string }
  startedAt: string
  isIPVRequired: boolean
  ipvCompletedBy?: { badge: string; name: string }
  ipvCompletedAt?: string
}

interface AuthContext {
  action: 'start_stage' | 'complete_stage' | 'ipv_verify'
  targetStage: AssignmentStageId
  blockedBadge?: string // If IPV, the badge that cannot complete it
}

// ============================================================================
// Helpers
// ============================================================================

function buildDefaultStageStates(): AssignmentStageState[] {
  return ASSIGNMENT_STAGES.map((stage, index) => ({
    stageId: stage.id,
    status: index === 0 ? 'completed' : 'pending' as AssignmentStageStatus,
  }))
}

function getStageStatus(
  stageId: AssignmentStageId,
  currentStage: AssignmentStageId,
  completedStages: AssignmentStageId[],
  activeSession: StageSession | null
): AssignmentStageStatus {
  if (completedStages.includes(stageId)) return 'completed'
  if (stageId === currentStage && activeSession?.stageId === stageId) return 'active'
  if (stageId === currentStage) return 'ready'

  const stageDef = getStageDefinition(stageId)
  const currentStageDef = getStageDefinition(currentStage)
  if (stageDef && currentStageDef && stageDef.order < currentStageDef.order) {
    return 'completed'
  }

  return 'pending'
}

// ============================================================================
// Stage Content Components
// ============================================================================

interface StageContentProps {
  stageId: AssignmentStageId
  projectId: string
  sheetName: string
  session: StageSession | null
  onStartSession: () => void
  onCompleteStage: () => void
  hasExternalLocations?: boolean
  totalWires?: number
  externalWires?: number
}

function BuildUpStageContent({
  session,
  onStartSession,
  onCompleteStage,
  projectId,
  sheetName,
}: StageContentProps) {
  if (!session) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Play className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Start Build Up</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Authenticate with your badge and PIN to begin the build up process.
          Follow the guided sections for mechanical mounting, rails, and terminal blocks.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" onClick={onStartSession} className="gap-2">
            <Shield className="h-5 w-5" />
            Sign In to Start
          </Button>
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href={`/projects/${projectId}/assignments/${sheetName}/build-up?print=true`}>
              <Printer className="h-5 w-5" />
              Print Worksheet
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Active session - show build up interface
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium">{session.startedBy.name}</div>
            <div className="text-sm text-muted-foreground">Badge: {session.startedBy.badge}</div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      </div>

      {/* Build up sections placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Build Up Sections</CardTitle>
          <CardDescription>Complete each section in order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Mechanical Mounting', 'DIN Rails', 'Terminal Blocks', 'Base Assembly'].map((section, i) => (
              <div
                key={section}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  i === 0 ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : 'border-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
                    i === 0 ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                  )}>
                    {i + 1}
                  </div>
                  <span className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{section}</span>
                </div>
                {i === 0 && <Badge>Current</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onCompleteStage} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Complete Build Up
        </Button>
      </div>
    </div>
  )
}

function IPVStageContent({
  stageId,
  session,
  onStartSession,
  onCompleteStage,
}: StageContentProps) {
  const prevStage = getPreviousStage(stageId)
  const ipvNumber = stageId.replace('IPV', '')

  if (!session) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Shield className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">In-Process Verification {ipvNumber}</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          A <strong>different user</strong> must verify the {prevStage?.label || 'previous stage'} work.
          The person who completed the previous stage cannot perform this verification.
        </p>
        <Button size="lg" onClick={onStartSession} className="gap-2">
          <Shield className="h-5 w-5" />
          Sign In to Verify
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">Verification in Progress</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          Verifying {prevStage?.label || 'previous stage'} completion by {session.startedBy.name}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Visual inspection complete', 'All connections verified', 'Documentation checked', 'No defects found'].map((item, i) => (
              <div key={item} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="h-6 w-6 rounded border-2 border-muted-foreground/30" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onCompleteStage} className="gap-2 bg-amber-500 hover:bg-amber-600">
          <CheckCircle2 className="h-4 w-4" />
          Complete Verification
        </Button>
      </div>
    </div>
  )
}

function WiringStageContent({
  session,
  onStartSession,
  onCompleteStage,
  projectId,
  sheetName,
  totalWires = 186,
}: StageContentProps) {
  if (!session) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <FileText className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Start Wiring</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Authenticate to begin point-to-point wiring. The wire list contains {totalWires} wires to complete.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" onClick={onStartSession} className="gap-2">
            <Shield className="h-5 w-5" />
            Sign In to Start
          </Button>
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href={`/projects/${projectId}/${sheetName}`}>
              <FileText className="h-5 w-5" />
              View Wire List
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium">{session.startedBy.name}</div>
            <div className="text-sm text-muted-foreground">Badge: {session.startedBy.badge}</div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      </div>

      {/* Wire list embed placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Wire List</CardTitle>
            <CardDescription>{totalWires} wires total</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}/${sheetName}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Screen
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Wire list component will render here
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Semantic grouping, search, and completion tracking
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onCompleteStage} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Complete Wiring
        </Button>
      </div>
    </div>
  )
}

function CrossWiringStageContent({
  session,
  onStartSession,
  onCompleteStage,
  projectId,
  sheetName,
  hasExternalLocations = false,
  externalWires = 0,
}: StageContentProps) {
  if (!hasExternalLocations) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <CheckCircle2 className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Cross Wiring Required</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          This sheet does not have any external location wires.
          You can skip this stage and proceed to Test Ready.
        </p>
        <Button onClick={onCompleteStage} variant="outline" className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Skip to Next Stage
        </Button>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <ExternalLink className="h-10 w-10 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Start Cross Wiring</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {externalWires} wires connect to external locations.
          Authenticate to begin cross-panel wiring.
        </p>
        <Button size="lg" onClick={onStartSession} className="gap-2">
          <Shield className="h-5 w-5" />
          Sign In to Start
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert className="border-purple-300 bg-purple-50 dark:bg-purple-950/30">
        <ExternalLink className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800 dark:text-purple-200">External Wiring Mode</AlertTitle>
        <AlertDescription className="text-purple-700 dark:text-purple-300">
          Showing only {externalWires} wires with external locations
        </AlertDescription>
      </Alert>

      {/* External wire list placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">External Location Wires</CardTitle>
          <CardDescription>Cross-panel and external connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ExternalLink className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Filtered wire list showing external locations only
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onCompleteStage} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Complete Cross Wiring
        </Button>
      </div>
    </div>
  )
}

function GenericStageContent({
  stageId,
  session,
  onStartSession,
  onCompleteStage,
}: StageContentProps) {
  const stageDef = getStageDefinition(stageId)

  if (!session) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Play className="h-10 w-10 text-slate-600 dark:text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Start {stageDef?.label}</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {stageDef?.description}
        </p>
        <Button size="lg" onClick={onStartSession} className="gap-2">
          <Shield className="h-5 w-5" />
          Sign In to Start
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-500 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium">{session.startedBy.name}</div>
            <div className="text-sm text-muted-foreground">Badge: {session.startedBy.badge}</div>
          </div>
        </div>
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Stage-specific content for {stageDef?.label}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onCompleteStage} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Complete {stageDef?.label}
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SheetAssignmentRoute({
  projectId,
  sheetName,
  initialStage,
  stageStates,
  hasExternalLocations = false,
  totalWires = 186,
  externalWires = 24,
}: SheetAssignmentRouteProps) {
  // Stage navigation state
  const [currentStage, setCurrentStage] = useState<AssignmentStageId>(
    (initialStage as AssignmentStageId) || 'BUILD_UP'
  )
  const [completedStages, setCompletedStages] = useState<AssignmentStageId[]>([])
  const [activeSession, setActiveSession] = useState<StageSession | null>(null)

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authContext, setAuthContext] = useState<AuthContext | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Scroll container ref
  const timelineRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Build resolved stage states
  const resolvedStageStates: AssignmentStageState[] = useMemo(() => {
    return ASSIGNMENT_STAGES.map(stage => ({
      stageId: stage.id,
      status: getStageStatus(stage.id, currentStage, completedStages, activeSession),
    }))
  }, [currentStage, completedStages, activeSession])

  const currentStageDef = getStageDefinition(currentStage)
  const nextStageDef = getNextStage(currentStage)
  const progress = Math.round((completedStages.length / ASSIGNMENT_STAGES.length) * 100)

  // Check scroll state
  const checkScrollState = useCallback(() => {
    if (timelineRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = timelineRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }, [])

  // Auto-scroll to current stage
  useEffect(() => {
    checkScrollState()
    if (timelineRef.current) {
      const currentIndex = ASSIGNMENT_STAGES.findIndex(s => s.id === currentStage)
      const stageWidth = 100
      const scrollPosition = Math.max(0, (currentIndex * stageWidth) - (timelineRef.current.clientWidth / 2) + (stageWidth / 2))
      timelineRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' })
    }
  }, [currentStage, checkScrollState])

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      const scrollAmount = 200
      timelineRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  // Handle stage click
  const handleStageClick = useCallback((stageId: AssignmentStageId) => {
    const stageDef = getStageDefinition(stageId)
    const stageState = resolvedStageStates.find(s => s.stageId === stageId)

    // Can click on completed stages or the current/next available stage
    if (stageState?.status === 'completed' || stageState?.status === 'active' || stageState?.status === 'pending') {
      const currentIndex = ASSIGNMENT_STAGES.findIndex(s => s.id === currentStage)
      const targetIndex = ASSIGNMENT_STAGES.findIndex(s => s.id === stageId)

      // Don't allow jumping ahead beyond next stage
      if (targetIndex <= currentIndex + 1 || completedStages.includes(stageId)) {
        setCurrentStage(stageId)
        // Clear session if switching stages
        if (stageId !== activeSession?.stageId) {
          setActiveSession(null)
        }
      }
    }
  }, [currentStage, completedStages, resolvedStageStates, activeSession])

  // Handle start session
  const handleStartSession = useCallback(() => {
    const stageDef = getStageDefinition(currentStage)
    setAuthContext({
      action: stageDef?.isVerification ? 'ipv_verify' : 'start_stage',
      targetStage: currentStage,
      // For IPV, block the user who completed the previous stage
      blockedBadge: stageDef?.isVerification ? activeSession?.startedBy.badge : undefined,
    })
    setAuthError(null)
    setAuthModalOpen(true)
  }, [currentStage, activeSession])

  // Handle complete stage
  const handleCompleteStage = useCallback(() => {
    const stageDef = getStageDefinition(currentStage)

    // Mark current stage as completed
    setCompletedStages(prev => [...prev, currentStage])

    // Move to next stage
    const nextStage = getNextStage(currentStage)
    if (nextStage) {
      setCurrentStage(nextStage.id)
    }

    // Clear session
    setActiveSession(null)
  }, [currentStage])

  // Handle auth submit
  const handleAuthSubmit = useCallback(async (badge: string, pin: string) => {
    setIsSubmitting(true)
    setAuthError(null)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800))

    // Check if this is an IPV and the same user is trying to verify
    if (authContext?.action === 'ipv_verify' && authContext.blockedBadge === badge) {
      setAuthError('You cannot verify your own work. A different user must perform IPV.')
      setIsSubmitting(false)
      return
    }

    // Mock user lookup
    const userName = badge === '12345' ? 'John Smith' :
      badge === '67890' ? 'Jane Doe' :
        `User ${badge}`

    // Create session
    setActiveSession({
      stageId: currentStage,
      startedBy: { badge, name: userName },
      startedAt: new Date().toISOString(),
      isIPVRequired: currentStageDef?.isVerification || false,
    })

    setIsSubmitting(false)
    setAuthModalOpen(false)
    setAuthContext(null)
  }, [authContext, currentStage, currentStageDef])

  // Render stage content based on current stage
  const renderStageContent = () => {
    const commonProps: StageContentProps = {
      stageId: currentStage,
      projectId,
      sheetName,
      session: activeSession,
      onStartSession: handleStartSession,
      onCompleteStage: handleCompleteStage,
      hasExternalLocations,
      totalWires,
      externalWires,
    }

    switch (currentStage) {
      case 'BUILD_UP':
        return <BuildUpStageContent {...commonProps} />
      case 'WIRING_IPV':
      case 'CROSS_WIRE_IPV':
        return <IPVStageContent {...commonProps} />
      case 'WIRING':
        return <WiringStageContent {...commonProps} />
      case 'CROSS_WIRE':
        return <CrossWiringStageContent {...commonProps} />
      default:
        return <GenericStageContent {...commonProps} />
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              Project
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              Assignments
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{sheetName}</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                <Link href={`/projects/${projectId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{sheetName}</h1>
                <p className="text-sm text-muted-foreground">
                  {currentStageDef?.label} - {currentStageDef?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {progress}% Complete
              </Badge>
              {activeSession && (
                <Badge variant="secondary" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {activeSession.startedBy.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Navigation Timeline */}
      <div className="border-b bg-background">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-2 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => scrollTimeline('left')}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div
              ref={timelineRef}
              className="flex-1 overflow-x-auto scrollbar-none"
              onScroll={checkScrollState}
            >
              <StageLinearStepper
                currentStage={currentStage}
                stages={resolvedStageStates}
                onStageClick={handleStageClick}
                showLabels
                showTooltips
                size="md"
                className="px-2"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => scrollTimeline('right')}
              disabled={!canScrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Stage Content */}
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{currentStageDef?.label}</CardTitle>
                    <CardDescription>{currentStageDef?.description}</CardDescription>
                  </div>
                  <Badge
                    variant={activeSession ? 'default' : 'secondary'}
                    className={activeSession ? 'bg-blue-500' : ''}
                  >
                    {activeSession ? 'Active' : 'Ready'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderStageContent()}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{progress}%</span>
                    <Badge variant="secondary">
                      {completedStages.length}/{ASSIGNMENT_STAGES.length}
                    </Badge>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{totalWires}</div>
                    <div className="text-xs text-muted-foreground">Total Wires</div>
                  </div>
                  {hasExternalLocations && (
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                      <div className="text-2xl font-bold text-purple-600">{externalWires}</div>
                      <div className="text-xs text-purple-600/70">External</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link href={`/projects/${projectId}/${sheetName}`}>
                    <FileText className="h-4 w-4" />
                    View Wire List
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link href={`/projects/${projectId}/${sheetName}?print=true`}>
                    <Printer className="h-4 w-4" />
                    Print Wire List
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <SecureActionModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false)
          setAuthContext(null)
          setAuthError(null)
        }}
        action={authContext?.action === 'ipv_verify' ? 'IPV_VERIFY' : 'START_STAGE'}
        onSubmit={handleAuthSubmit}
        isSubmitting={isSubmitting}
        error={authError}
        title={
          authContext?.action === 'ipv_verify'
            ? 'In-Process Verification'
            : `Start ${currentStageDef?.label}`
        }
        description={
          authContext?.action === 'ipv_verify'
            ? 'A different user must verify this stage. Enter your credentials.'
            : 'Enter your badge and PIN to begin working on this stage.'
        }
        showNumpad
      />
    </main>
  )
}
