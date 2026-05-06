'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Clock, 
  User,
  Star,
  Diamond,
  Circle,
  AlertTriangle,
  FileText,
  Printer,
  BadgeCheck,
  Save,
  Loader2,
  Users,
  Timer,
  CloudOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SecureActionModal } from '@/components/d380/auth/secure-action-modal'
import type { D380User } from '@/types/d380-user-session'

// ============================================================================
// TYPES
// ============================================================================

export type SymbolType = 'star' | 'diamond' | 'circle' | 'arrow' | 'none'

export interface StepCompletion {
  userId: string
  badgeNumber: string
  fullName: string
  initials: string
  avatarUrl?: string
  timestamp: Date
}

export interface SubStep {
  id: string
  text: string
  isKeyPoint?: boolean // Red text
  isBold?: boolean
  indent?: number // 0, 1, 2 for nesting
  note?: string // Additional note text
  completion?: StepCompletion
  requiresAuditor?: boolean
  auditorCompletion?: StepCompletion
  requiresVerification?: '1444' | 'nutcert' // Special verifications that need different user
  notApplicable?: boolean // N/A checkbox was checked
}

export interface WorkExecution {
  id: string
  number: number
  title: string
  description?: string
  symbol: SymbolType
  references: string[]
  subSteps: SubStep[]
  specialVerification?: string // e.g., "3/8\" Nutcert Verification", "1444 Verification"
  notes?: string[]
}

export interface SwsSection {
  id: string
  title: string
  phase: 'build-up' | 'wiring' | 'ipv'
  elements: WorkExecution[]
}

// Track all users who contributed to this assignment
export interface ContributingUser {
  id: string
  badgeNumber: string
  fullName: string
  initials: string
  avatarUrl?: string
  role: 'worker' | 'ipv'
  stepsCompleted: number
  firstActivity: Date
  lastActivity: Date
}

interface SwsWorkExecutionTableProps {
  sections: SwsSection[]
  projectInfo: {
    pdNumber?: string
    projectName?: string
    unitNumber?: string
    panel?: string
    date?: string
    revision?: string
  }
  currentUser?: D380User | null
  // User with active session (for auto-stamping regular steps)
  currentSessionUser?: { badge: string; name: string } | null
  onStepComplete?: (executionId: string, stepId: string, completion: StepCompletion) => void
  onStepUncomplete?: (executionId: string, stepId: string) => void
  onAuditorStamp?: (executionId: string, stepId: string, completion: StepCompletion) => void
  onNotApplicable?: (executionId: string, stepId: string, notApplicable: boolean) => void
  onSave?: (sections: SwsSection[]) => Promise<void>
  readOnly?: boolean
  startTime?: Date // When the session started
  // Users who worked on the assignment (can't do IPV)
  assignmentWorkers?: string[]
  // Users who did IPV (for tracking)
  ipvVerifiers?: string[]
  // Callback when a new user contributes
  onUserContribute?: (user: ContributingUser) => void
}

// ============================================================================
// SYMBOL COMPONENT
// ============================================================================

function SymbolIcon({ type, className }: { type: SymbolType; className?: string }) {
  switch (type) {
    case 'star':
      return <Star className={cn('h-4 w-4 fill-amber-400 text-amber-400', className)} />
    case 'diamond':
      return <Diamond className={cn('h-4 w-4 fill-blue-400 text-blue-400', className)} />
    case 'circle':
      return <Circle className={cn('h-4 w-4 fill-emerald-400 text-emerald-400', className)} />
    case 'arrow':
      return <ChevronRight className={cn('h-4 w-4 text-slate-400', className)} />
    default:
      return null
  }
}

// ============================================================================
// COMPLETION STAMP COMPONENT
// ============================================================================

function CompletionStamp({ completion, size = 'default' }: { completion: StepCompletion; size?: 'sm' | 'default' }) {
  const isSmall = size === 'sm'
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-2 rounded-md border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
            isSmall ? 'px-1.5 py-0.5' : 'px-2 py-1'
          )}>
            <Avatar className={isSmall ? 'h-5 w-5' : 'h-6 w-6'}>
              {completion.avatarUrl ? (
                <AvatarImage src={completion.avatarUrl} alt={completion.fullName} />
              ) : null}
              <AvatarFallback className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                {completion.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className={cn(
                'font-medium text-emerald-700 dark:text-emerald-300 leading-none',
                isSmall ? 'text-[10px]' : 'text-xs'
              )}>
                {completion.initials}
              </span>
              <span className={cn(
                'text-emerald-600/70 dark:text-emerald-400/70 leading-none',
                isSmall ? 'text-[9px]' : 'text-[10px]'
              )}>
                {new Date(completion.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-background border text-foreground">
          <div className="space-y-1">
            <div className="font-semibold">{completion.fullName}</div>
            <div className="text-xs text-muted-foreground">Initials: {completion.initials}</div>
            <div className="text-xs text-muted-foreground">Badge: {completion.badgeNumber}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(completion.timestamp).toLocaleString()}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// SUB-STEP ROW COMPONENT
// ============================================================================

interface SubStepRowProps {
  step: SubStep
  executionId: string
  onComplete: (stepId: string) => void
  onUncomplete?: (stepId: string) => void
  onVerificationStamp?: (stepId: string) => void
  onNotApplicable?: (stepId: string, notApplicable: boolean) => void
  readOnly?: boolean
}

function SubStepRow({ step, executionId, onComplete, onUncomplete, onVerificationStamp, onNotApplicable, readOnly }: SubStepRowProps) {
  const isCompleted = !!step.completion
  const isNotApplicable = step.notApplicable
  const needsVerification = step.requiresVerification && isCompleted && !step.auditorCompletion && !isNotApplicable
  
  return (
    <div 
      className={cn(
        'group flex items-start gap-3 py-2 px-3 rounded-md transition-colors',
        step.indent === 1 && 'ml-6',
        step.indent === 2 && 'ml-12',
        isNotApplicable ? 'bg-slate-100/50 dark:bg-slate-800/30 opacity-60' :
        isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
      )}
    >
      {/* Checkbox - clickable to toggle complete/uncomplete */}
      <div className="pt-0.5 shrink-0">
        {isNotApplicable ? (
          <div className="h-5 w-5 rounded-sm bg-slate-400 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">N/A</span>
          </div>
        ) : isCompleted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!readOnly && onUncomplete) {
                onUncomplete(step.id)
              }
            }}
            disabled={readOnly || !onUncomplete}
            className={cn(
              "h-5 w-5 rounded-sm bg-emerald-500 flex items-center justify-center",
              "hover:bg-red-500 transition-colors cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
              (readOnly || !onUncomplete) && "cursor-default hover:bg-emerald-500"
            )}
            aria-label="Uncheck step"
          >
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!readOnly) {
                onComplete(step.id)
              }
            }}
            disabled={readOnly}
            className={cn(
              "h-5 w-5 rounded-sm border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center",
              "hover:border-blue-500 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-950/30",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              "transition-colors cursor-pointer",
              readOnly && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Mark step as complete"
          />
        )}
      </div>
      
      {/* Step Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-relaxed',
          step.isKeyPoint && 'text-red-600 dark:text-red-400',
          step.isBold && 'font-semibold',
          isNotApplicable && 'line-through',
          isCompleted && !step.isKeyPoint && !isNotApplicable && 'text-slate-500 dark:text-slate-400'
        )}>
          {step.text}
        </p>
        {step.note && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
            NOTE: {step.note}
          </p>
        )}
      </div>
      
      {/* Completion Stamps & Verification */}
      <div className="flex items-center gap-2 shrink-0">
        {step.completion && !isNotApplicable && (
          <CompletionStamp completion={step.completion} size="sm" />
        )}
        
        {/* Special verification stamp area (1444 or Nutcert) */}
        {step.requiresVerification && !isNotApplicable && (
          <>
            {step.auditorCompletion ? (
              <div className="flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5 text-amber-500" />
                <CompletionStamp completion={step.auditorCompletion} size="sm" />
              </div>
            ) : needsVerification ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVerificationStamp?.(step.id)}
                disabled={readOnly}
                className="h-7 text-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              >
                <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                {step.requiresVerification === '1444' ? '1444 Verify' : '3/8" Verify'}
              </Button>
            ) : null}
          </>
        )}
        
        {/* N/A checkbox for verification steps */}
        {step.requiresVerification && !isCompleted && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!readOnly) {
                      onNotApplicable?.(step.id, !isNotApplicable)
                    }
                  }}
                  disabled={readOnly}
                  className={cn(
                    "h-6 px-2 rounded text-[10px] font-medium border transition-colors",
                    isNotApplicable
                      ? "bg-slate-200 dark:bg-slate-700 border-slate-400 text-slate-600 dark:text-slate-300"
                      : "bg-transparent border-slate-300 dark:border-slate-600 text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  N/A
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-background border">
                <span className="text-xs">Mark as Not Applicable</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION FOOTER COMPONENT
// ============================================================================

interface SectionFooterProps {
  section: SwsSection
  contributingUsers: Map<string, ContributingUser>
}

function SectionFooter({ section, contributingUsers }: SectionFooterProps) {
  // Get all completions from this section
  const allCompletions: StepCompletion[] = []
  section.elements.forEach(element => {
    element.subSteps.forEach(step => {
      if (step.completion) {
        allCompletions.push(step.completion)
      }
      if (step.auditorCompletion) {
        allCompletions.push(step.auditorCompletion)
      }
    })
  })
  
  // Get unique users who worked on this section
  const sectionUsers = new Map<string, { completion: StepCompletion; count: number; lastActivity: Date }>()
  allCompletions.forEach(completion => {
    const existing = sectionUsers.get(completion.badgeNumber)
    if (existing) {
      sectionUsers.set(completion.badgeNumber, {
        completion,
        count: existing.count + 1,
        lastActivity: new Date(completion.timestamp) > existing.lastActivity 
          ? new Date(completion.timestamp) 
          : existing.lastActivity
      })
    } else {
      sectionUsers.set(completion.badgeNumber, {
        completion,
        count: 1,
        lastActivity: new Date(completion.timestamp)
      })
    }
  })
  
  // Calculate section progress
  const totalSteps = section.elements.flatMap(e => e.subSteps).length
  const completedSteps = section.elements.flatMap(e => e.subSteps.filter(s => s.completion)).length
  const isComplete = completedSteps === totalSteps && totalSteps > 0
  
  // Get first and last activity time
  const timestamps = allCompletions.map(c => new Date(c.timestamp).getTime())
  const firstActivity = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null
  const lastActivity = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  
  if (sectionUsers.size === 0) {
    return null
  }
  
  return (
    <div className={cn(
      "mt-3 p-4 rounded-lg border",
      isComplete 
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Section Completed By
        </span>
        {isComplete && (
          <Badge className="bg-emerald-500 text-white text-xs">
            <Check className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        )}
      </div>
      
      <div className="flex flex-wrap gap-3">
        {Array.from(sectionUsers.entries()).map(([badge, data]) => (
          <div 
            key={badge}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              isComplete
                ? "bg-white dark:bg-slate-950 border-emerald-200 dark:border-emerald-800"
                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            )}
          >
            <Avatar className="h-10 w-10">
              {data.completion.avatarUrl ? (
                <AvatarImage src={data.completion.avatarUrl} alt={data.completion.fullName} />
              ) : null}
              <AvatarFallback className={cn(
                "text-sm font-semibold",
                isComplete
                  ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                  : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              )}>
                {data.completion.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {data.completion.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                Badge: {data.completion.badgeNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.lastActivity.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <Badge variant="secondary" className="ml-2 text-xs">
              {data.count} steps
            </Badge>
          </div>
        ))}
      </div>
      
      {/* Time range */}
      {firstActivity && lastActivity && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Started: {firstActivity.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1">
            <Check className="h-3 w-3" />
            <span>Last Activity: {lastActivity.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// WORK ELEMENT ROW COMPONENT
// ============================================================================

interface WorkExecutionRowProps {
  element: WorkExecution
  isExpanded: boolean
  onToggle: () => void
  onStepComplete: (executionId: string, stepId: string) => void
  onStepUncomplete?: (executionId: string, stepId: string) => void
  onVerificationStamp?: (executionId: string, stepId: string) => void
  onNotApplicable?: (executionId: string, stepId: string, notApplicable: boolean) => void
  readOnly?: boolean
}

function WorkExecutionRow({ 
  element, 
  isExpanded, 
  onToggle, 
  onStepComplete,
  onStepUncomplete,
  onVerificationStamp,
  onNotApplicable,
  readOnly 
}: WorkExecutionRowProps) {
  const completedSteps = element.subSteps.filter(s => s.completion).length
  const totalSteps = element.subSteps.length
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  const isComplete = completedSteps === totalSteps && totalSteps > 0
  
  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-all',
      isComplete 
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20' 
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
    )}>
      {/* Header Row - Always Visible */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-4 p-4 text-left transition-colors',
          'hover:bg-slate-50 dark:hover:bg-slate-900/50',
          isExpanded && 'border-b border-slate-200 dark:border-slate-800'
        )}
      >
        {/* Expand/Collapse Icon */}
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
        </div>
        
        {/* Step Number */}
        <div className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
          isComplete 
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
        )}>
          {element.number}
        </div>
        
        {/* Symbol */}
        <div className="shrink-0 w-6">
          <SymbolIcon type={element.symbol} />
        </div>
        
        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {element.title}
          </h3>
          {element.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {element.description}
            </p>
          )}
          {element.references.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {element.references.map((ref, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {ref}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        {/* Progress */}
        <div className="shrink-0 flex items-center gap-3">
          {element.specialVerification && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
              {element.specialVerification}
            </Badge>
          )}
          
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isComplete ? 'bg-emerald-500' : 'bg-blue-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={cn(
              'text-xs font-medium tabular-nums',
              isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            )}>
              {completedSteps}/{totalSteps}
            </span>
          </div>
        </div>
      </button>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-1 bg-slate-50/50 dark:bg-slate-900/30">
              {/* Notes */}
              {element.notes && element.notes.length > 0 && (
                <div className="mb-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  {element.notes.map((note, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                      <span className="font-semibold">NOTE:</span> {note}
                    </p>
                  ))}
                </div>
              )}
              
              {/* Sub-steps */}
              {element.subSteps.map((step) => (
                <SubStepRow
                  key={step.id}
                  step={step}
                  executionId={execution.id}
                  onComplete={(stepId) => onStepComplete(execution.id, stepId)}
                  onUncomplete={onStepUncomplete ? (stepId) => onStepUncomplete(execution.id, stepId) : undefined}
                  onVerificationStamp={(stepId) => onVerificationStamp?.(execution.id, stepId)}
                  onNotApplicable={(stepId, na) => onNotApplicable?.(execution.id, stepId, na)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SwsWorkExecutionTable({
  sections,
  projectInfo,
  currentUser,
  currentSessionUser,
  onStepComplete,
  onStepUncomplete,
  onAuditorStamp,
  onNotApplicable,
  onSave,
  readOnly = false,
  startTime,
  assignmentWorkers = [],
  ipvVerifiers = [],
  onUserContribute,
}: SwsWorkExecutionTableProps) {
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set())
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean
    action: 'complete' | 'auditor'
    executionId: string
    stepId: string
  } | null>(null)
  
  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesRef = useRef(false)
  
  // Running timer state
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Contributing users tracking
  const [contributingUsers, setContributingUsers] = useState<Map<string, ContributingUser>>(new Map())
  
  // Running timer effect
  useEffect(() => {
    if (!startTime) return
    
    const interval = setInterval(() => {
      const now = new Date()
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      setElapsedTime(elapsed)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startTime])
  
  // Format elapsed time as HH:MM:SS
  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Autosave effect - debounced save when changes occur
  useEffect(() => {
    if (!pendingChangesRef.current || !onSave) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Set new timeout for autosave (2 seconds after last change)
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onSave(sections)
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        pendingChangesRef.current = false
        
        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000)
      } catch {
        setSaveStatus('error')
      }
    }, 2000)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [sections, onSave])
  
  // Track user contribution
  const trackUserContribution = useCallback((user: D380User, role: 'worker' | 'ipv') => {
    setContributingUsers(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(user.id)
      const now = new Date()
      
      if (existing) {
        newMap.set(user.id, {
          ...existing,
          stepsCompleted: existing.stepsCompleted + 1,
          lastActivity: now,
        })
      } else {
        const newUser: ContributingUser = {
          id: user.id,
          badgeNumber: user.badgeNumber,
          fullName: user.fullName,
          initials: user.initials,
          avatarUrl: user.avatarUrl,
          role,
          stepsCompleted: 1,
          firstActivity: now,
          lastActivity: now,
        }
        newMap.set(user.id, newUser)
        onUserContribute?.(newUser)
      }
      
      return newMap
    })
  }, [onUserContribute])
  
  const toggleExecution = useCallback((executionId: string) => {
    setExpandedExecutions(prev => {
      const next = new Set(prev)
      if (next.has(executionId)) {
        next.delete(executionId)
      } else {
        next.add(executionId)
      }
      return next
    })
  }, [])
  
  const expandAll = useCallback(() => {
    const allIds = sections.flatMap(s => s.elements.map(e => e.id))
    setExpandedExecutions(new Set(allIds))
  }, [sections])
  
  const collapseAll = useCallback(() => {
    setExpandedExecutions(new Set())
  }, [])
  
  // Auto-stamp regular steps without auth (use current session user)
  const handleStepComplete = useCallback((executionId: string, stepId: string) => {
    if (!currentSessionUser) return
    
    // Create completion from current session user
    const completion: StepCompletion = {
      userId: `user-${currentSessionUser.badge}`,
      badgeNumber: currentSessionUser.badge,
      fullName: currentSessionUser.name,
      initials: currentSessionUser.name.split(' ').map(n => n[0]).join('').toUpperCase() || currentSessionUser.badge.slice(0, 2),
      timestamp: new Date()
    }
    
    pendingChangesRef.current = true
    onStepComplete?.(executionId, stepId, completion)
    
    // Track contribution
    const user: D380User = {
      id: completion.userId,
      badgeNumber: completion.badgeNumber,
      fullName: completion.fullName,
      initials: completion.initials,
      role: 'ASSEMBLER'
    }
    trackUserContribution(user, 'worker')
  }, [currentSessionUser, onStepComplete, trackUserContribution])
  
  // Uncomplete (uncheck) a step - remove the completion
  const handleStepUncomplete = useCallback((executionId: string, stepId: string) => {
    pendingChangesRef.current = true
    onStepUncomplete?.(executionId, stepId)
  }, [onStepUncomplete])
  
  // Special verification stamps (1444 or Nutcert) - requires DIFFERENT user
  const handleVerificationStamp = useCallback((executionId: string, stepId: string) => {
    setAuthModal({ isOpen: true, action: 'auditor', executionId, stepId })
  }, [])
  
  // N/A handler
  const handleNotApplicable = useCallback((executionId: string, stepId: string, notApplicable: boolean) => {
    pendingChangesRef.current = true
    onNotApplicable?.(executionId, stepId, notApplicable)
  }, [onNotApplicable])
  
  const handleAuthSuccess = useCallback((user: D380User) => {
    if (!authModal) return
    
    // Check if user is blocked (same user who did the work can't verify)
    if (assignmentWorkers.includes(user.badgeNumber)) {
      setAuthModal(null)
      return
    }
    
    const completion: StepCompletion = {
      userId: user.id,
      badgeNumber: user.badgeNumber,
      fullName: user.fullName,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
      timestamp: new Date()
    }
    
    // Mark pending changes for autosave
    pendingChangesRef.current = true
    
    // Special verification stamps go to auditorCompletion
    onAuditorStamp?.(authModal.executionId, authModal.stepId, completion)
    trackUserContribution(user, 'ipv')
    
    setAuthModal(null)
  }, [authModal, onAuditorStamp, assignmentWorkers, trackUserContribution])
  
  // Calculate overall progress
  const totalSteps = sections.flatMap(s => s.elements.flatMap(e => e.subSteps)).length
  const completedSteps = sections.flatMap(s => s.elements.flatMap(e => e.subSteps.filter(st => st.completion))).length
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Standard Work Sheet - In-Process Validation
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Process Description: PANEL BUILD &amp; WIRE
            </p>
          </div>
          <div className="flex items-start gap-4">
            {/* Running Timer */}
            {startTime && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-lg font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {formatElapsedTime(elapsedTime)}
                </span>
              </div>
            )}
            
            {/* Autosave Status */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
              saveStatus === 'idle' && "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground",
              saveStatus === 'saving' && "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
              saveStatus === 'saved' && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300",
              saveStatus === 'error' && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
            )}>
              {saveStatus === 'idle' && (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Auto-save enabled</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved {lastSavedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <CloudOff className="h-3.5 w-3.5" />
                  <span>Save failed</span>
                </>
              )}
            </div>
            
            <div className="text-right text-sm">
              <div className="font-mono text-xs text-muted-foreground">
                SWS-IPV_D380_ASY_PNL BUILD-WIRE_1.2
              </div>
              <div className="text-xs text-muted-foreground">REV: 1.2 | 3/11/2026</div>
            </div>
          </div>
        </div>
        
        {/* Project Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs text-muted-foreground">PD#/Project</span>
            <p className="text-sm font-medium">{projectInfo.pdNumber || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Unit #</span>
            <p className="text-sm font-medium">{projectInfo.unitNumber || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Panel</span>
            <p className="text-sm font-medium">{projectInfo.panel || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Date</span>
            <p className="text-sm font-medium">{projectInfo.date || '—'}</p>
          </div>
        </div>
        
        {/* Legend & Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">Process Steps:</span>
            <span className="font-semibold text-foreground">Bold</span>
            <span>/</span>
            <span className="text-red-600 dark:text-red-400 font-medium">Red text is key points</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll} className="text-xs">
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs">
              Collapse All
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print
            </Button>
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className={cn(
              "text-lg font-bold tabular-nums",
              overallProgress === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            )}>
              {overallProgress}%
            </span>
          </div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div 
              className={cn(
                'h-full rounded-full',
                overallProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{completedSteps} of {totalSteps} steps completed</span>
            {overallProgress === 100 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" /> Complete
              </span>
            )}
          </div>
        </div>
        
        {/* Contributing Users */}
        {contributingUsers.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Contributors ({contributingUsers.size})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(contributingUsers.values()).map((user) => (
                <TooltipProvider key={user.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs",
                        user.role === 'worker' 
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                      )}>
                        <Avatar className="h-5 w-5">
                          {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                          ) : null}
                          <AvatarFallback className={cn(
                            "text-[9px] font-semibold",
                            user.role === 'worker'
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                              : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                          )}>
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          "font-medium",
                          user.role === 'worker'
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-amber-700 dark:text-amber-300"
                        )}>
                          {user.initials}
                        </span>
                        <Badge variant="secondary" className={cn(
                          "h-5 px-1.5 text-[10px]",
                          user.role === 'worker'
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                            : "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400"
                        )}>
                          {user.stepsCompleted}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs bg-background border text-foreground">
                      <div className="space-y-1">
                        <div className="font-semibold">{user.fullName}</div>
                        <div className="text-xs text-muted-foreground">Initials: {user.initials}</div>
                        <div className="text-xs text-muted-foreground">Badge: {user.badgeNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          Role: {user.role === 'worker' ? 'Build/Wire Worker' : 'Verification Inspector'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Steps Completed: {user.stepsCompleted}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last Active: {user.lastActivity.toLocaleTimeString()}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Sections */}
      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className={cn(
              'text-base font-bold uppercase tracking-wide',
              section.phase === 'build-up' && 'text-blue-600 dark:text-blue-400',
              section.phase === 'wiring' && 'text-amber-600 dark:text-amber-400',
              section.phase === 'ipv' && 'text-emerald-600 dark:text-emerald-400'
            )}>
              {section.title}
            </h3>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <Badge variant="outline" className={cn(
              'text-xs',
              section.phase === 'build-up' && 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
              section.phase === 'wiring' && 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
              section.phase === 'ipv' && 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400'
            )}>
              {section.elements.length} Sections
            </Badge>
          </div>
          
          <div className="space-y-2">
            {section.elements.map((element) => (
              <WorkExecutionRow
                key={execution.id}
                element={element}
                isExpanded={expandedExecutions.has(execution.id)}
                onToggle={() => toggleExecution(execution.id)}
                onStepComplete={handleStepComplete}
                onStepUncomplete={onStepUncomplete ? handleStepUncomplete : undefined}
                onVerificationStamp={handleVerificationStamp}
                onNotApplicable={handleNotApplicable}
                readOnly={readOnly || !currentSessionUser}
              />
            ))}
          </div>
          
          {/* Section Footer */}
          <SectionFooter 
            section={section} 
            contributingUsers={contributingUsers} 
          />
        </div>
      ))}
      
      {/* Auth Modal - Only for Special Verifications (1444 or Nutcert) */}
      {authModal && (
        <SecureActionModal
          open={authModal.isOpen}
          onClose={() => setAuthModal(null)}
          action="IPV_VERIFY"
          title="Verification Required"
          description="A different user must verify this step. The person who completed the build-up work cannot perform this verification."
          onSubmit={async (badge, pin) => {
            // Simulate validation - in production, validate against backend
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Create user object from badge
            const user: D380User = {
              id: `user-${badge}`,
              badgeNumber: badge,
              fullName: badge === '12345' ? 'John Smith' : 
                        badge === '67890' ? 'Jane Doe' : 
                        `User ${badge}`,
              initials: badge === '12345' ? 'JS' : 
                        badge === '67890' ? 'JD' : 
                        badge.split('').slice(0, 2).map(c => c.toUpperCase()).join(''),
              role: 'QA',
            }
            handleAuthSuccess(user)
          }}
          blockedBadges={assignmentWorkers}
          blockedMessage="You cannot verify your own work. A different user must perform this verification."
        />
      )}
    </div>
  )
}
