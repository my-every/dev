'use client'

/**
 * Assignment Work Log Component
 * 
 * Displays a log of who worked on the assignment, organized by stage,
 * with clock in/out times and shift information.
 */

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Clock,
  User,
  LogIn,
  LogOut,
  Pause,
  CheckCircle2,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Calendar,
  Timer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/d380-user-session'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageDefinition } from '@/types/d380-assignment-stages'

// ============================================================================
// Types
// ============================================================================

export interface WorkLogEntry {
  id: string
  assignmentId: string
  badge: string
  userName: string
  userInitials: string
  userRole: UserRole
  shift: '1st' | '2nd' | 'FIRST' | 'SECOND'
  stage: string
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'HANDOFF'
  clockInAt: string
  clockOutAt: string | null
  durationMinutes: number | null
  notes: string | null
}

interface AssignmentWorkLogProps {
  assignmentId: string
  entries: WorkLogEntry[]
  currentStage?: AssignmentStageId
  className?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatShift(shift: string): string {
  if (shift === 'FIRST' || shift === '1st' || shift === '1') return '1st'
  if (shift === 'SECOND' || shift === '2nd' || shift === '2') return '2nd'
  return shift
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '--'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

function getActionIcon(action: WorkLogEntry['action']) {
  switch (action) {
    case 'CLOCK_IN':
      return <LogIn className="h-3.5 w-3.5 text-green-500" />
    case 'CLOCK_OUT':
      return <LogOut className="h-3.5 w-3.5 text-slate-500" />
    case 'PAUSE':
      return <Pause className="h-3.5 w-3.5 text-amber-500" />
    case 'RESUME':
      return <LogIn className="h-3.5 w-3.5 text-blue-500" />
    case 'COMPLETE':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
    case 'HANDOFF':
      return <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500" />
    default:
      return <Clock className="h-3.5 w-3.5" />
  }
}

function getActionLabel(action: WorkLogEntry['action']): string {
  switch (action) {
    case 'CLOCK_IN': return 'Started'
    case 'CLOCK_OUT': return 'Stopped'
    case 'PAUSE': return 'Paused'
    case 'RESUME': return 'Resumed'
    case 'COMPLETE': return 'Completed'
    case 'HANDOFF': return 'Handed Off'
    default: return action
  }
}

// ============================================================================
// Components
// ============================================================================

function WorkLogEntryRow({ entry }: { entry: WorkLogEntry }) {
  const clockInDate = new Date(entry.clockInAt)
  const clockOutDate = entry.clockOutAt ? new Date(entry.clockOutAt) : null
  const isActive = !entry.clockOutAt

  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 rounded-lg',
      isActive ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900' : 'bg-muted/50'
    )}>
      {/* Mobile: Compact header row */}
      <div className="flex items-center gap-2 sm:contents">
        {/* User Avatar/Initials */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
          {entry.userInitials}
        </div>

        {/* Mobile: Name + Action */}
        <div className="flex-1 flex items-center justify-between sm:hidden">
          <span className="font-medium text-sm truncate">{entry.userName}</span>
          <div className="flex items-center gap-1 shrink-0">
            {getActionIcon(entry.action)}
            <span className="text-xs text-muted-foreground">
              {getActionLabel(entry.action)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Desktop: Full name row */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{entry.userName}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {entry.userRole}
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-1.5 py-0',
              formatShift(entry.shift) === '1st'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            )}
          >
            {formatShift(entry.shift)} Shift
          </Badge>
          {isActive && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-500">
              Active
            </Badge>
          )}
        </div>

        {/* Mobile: Badges row */}
        <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {entry.userRole}
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-1.5 py-0',
              formatShift(entry.shift) === '1st'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
            )}
          >
            {formatShift(entry.shift)}
          </Badge>
          {isActive && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-500">
              Active
            </Badge>
          )}
        </div>

        {/* Times - responsive grid */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-3 gap-y-1 sm:gap-4 mt-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <LogIn className="h-3 w-3 shrink-0" />
            <span className="truncate">{format(clockInDate, 'MMM d, h:mm a')}</span>
          </div>
          {clockOutDate && (
            <div className="flex items-center gap-1">
              <LogOut className="h-3 w-3 shrink-0" />
              <span>{format(clockOutDate, 'h:mm a')}</span>
            </div>
          )}
          {entry.durationMinutes !== null && (
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 shrink-0" />
              <span>{formatDuration(entry.durationMinutes)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {entry.notes && (
          <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">
            {entry.notes}
          </p>
        )}
      </div>

      {/* Desktop: Action Badge */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {getActionIcon(entry.action)}
        <span className="text-xs text-muted-foreground">
          {getActionLabel(entry.action)}
        </span>
      </div>
    </div>
  )
}

function StageSection({
  stage,
  entries,
  isExpanded,
  onToggle,
}: {
  stage: string
  entries: WorkLogEntry[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const stageInfo = getStageDefinition(stage as AssignmentStageId)
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0)
  const uniqueWorkers = new Set(entries.map(e => e.badge)).size
  const hasActiveSession = entries.some(e => !e.clockOutAt)

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-between px-2 sm:px-3 py-2 h-auto min-h-[44px]',
            hasActiveSession && 'bg-green-50 dark:bg-green-950/20'
          )}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium text-sm sm:text-base truncate">{stageInfo?.label || stage}</span>
            {hasActiveSession && (
              <Badge className="text-[10px] bg-green-500 shrink-0">Active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground shrink-0">
            <span className="hidden sm:inline">{uniqueWorkers} worker{uniqueWorkers !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">{uniqueWorkers}w</span>
            <span className="hidden sm:inline">{entries.length} session{entries.length !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">{entries.length}s</span>
            <span>{formatDuration(totalMinutes)}</span>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 p-2 pl-4 sm:pl-4">
          {entries.map(entry => (
            <WorkLogEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignmentWorkLog({
  assignmentId,
  entries,
  currentStage,
  className,
}: AssignmentWorkLogProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())

  // Group entries by stage
  const entriesByStage = entries.reduce((acc, entry) => {
    const stage = entry.stage
    if (!acc[stage]) acc[stage] = []
    acc[stage].push(entry)
    return acc
  }, {} as Record<string, WorkLogEntry[]>)

  // Sort entries within each stage by clockInAt (newest first)
  Object.keys(entriesByStage).forEach(stage => {
    entriesByStage[stage].sort((a, b) =>
      new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime()
    )
  })

  // Auto-expand current stage
  useEffect(() => {
    if (currentStage) {
      setExpandedStages(prev => new Set([...prev, currentStage]))
    }
  }, [currentStage])

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) {
        next.delete(stage)
      } else {
        next.add(stage)
      }
      return next
    })
  }

  // Calculate totals
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0)
  const uniqueWorkers = new Set(entries.map(e => e.badge)).size
  const hasActiveSession = entries.some(e => !e.clockOutAt)

  if (entries.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card p-6 text-center', className)}>
        <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-medium text-muted-foreground">No Work History</h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          This assignment hasn&apos;t been started yet.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
          <h3 className="font-semibold">Work Log</h3>
          {hasActiveSession && (
            <Badge className="bg-green-500 text-[10px] sm:text-xs">Active</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>{uniqueWorkers}</span>
            <span className="hidden sm:inline">worker{uniqueWorkers !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>{formatDuration(totalMinutes)}</span>
            <span className="hidden sm:inline">total</span>
          </div>
        </div>
      </div>

      {/* Stage Sections */}
      <div className="divide-y">
        {Object.entries(entriesByStage).map(([stage, stageEntries]) => (
          <StageSection
            key={stage}
            stage={stage}
            entries={stageEntries}
            isExpanded={expandedStages.has(stage)}
            onToggle={() => toggleStage(stage)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Compact Work Log (for cards/headers)
// ============================================================================

interface CompactWorkLogProps {
  entries: WorkLogEntry[]
  maxDisplay?: number
  className?: string
}

export function CompactWorkLog({ entries, maxDisplay = 3, className }: CompactWorkLogProps) {
  const hasActiveSession = entries.some(e => !e.clockOutAt)
  const recentEntries = entries.slice(0, maxDisplay)
  const totalWorkers = new Set(entries.map(e => e.badge)).size

  if (entries.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Worker avatars */}
      <div className="flex -space-x-2">
        {recentEntries.map((entry, i) => (
          <div
            key={entry.id}
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-background',
              entry.clockOutAt === null
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}
            title={`${entry.userName} (${formatShift(entry.shift)} Shift)`}
            style={{ zIndex: maxDisplay - i }}
          >
            {entry.userInitials}
          </div>
        ))}
        {totalWorkers > maxDisplay && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-muted text-muted-foreground border-2 border-background">
            +{totalWorkers - maxDisplay}
          </div>
        )}
      </div>

      {hasActiveSession && (
        <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
          In Progress
        </Badge>
      )}
    </div>
  )
}

export default AssignmentWorkLog
