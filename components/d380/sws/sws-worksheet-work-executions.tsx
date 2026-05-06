'use client'

import { useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import type { SwsExecutionMode, SwsSectionDefinition, SwsTabletSectionActivity, SwsSectionStamp } from '@/types/d380-sws'

interface SwsWorksheetWorkExecutionsProps {
  sections: SwsSectionDefinition[]
  mode: SwsExecutionMode
  sectionActivity?: Map<string, SwsTabletSectionActivity>
  onSectionToggle?: (sectionId: string, checked: boolean) => void
  onSectionStart?: (sectionId: string) => void
  onSectionComplete?: (sectionId: string) => void
}

/**
 * Renders the work elements / process steps table for an SWS worksheet.
 * In PRINT_MANUAL mode, shows checkbox rows for manual check-off.
 * In TABLET_INTERACTIVE mode, shows interactive completion with timestamps.
 */
export function SwsWorksheetWorkExecutions({
  sections,
  mode,
  sectionActivity,
  onSectionToggle,
  onSectionStart,
  onSectionComplete,
}: SwsWorksheetWorkExecutionsProps) {
  return (
    <div className="border border-foreground/20 rounded-sm overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-muted/50 border-b border-foreground/20 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <div className="w-6" />
        <div>Work Execution</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-24 text-center">Stamp</div>
      </div>

      {/* Work element rows */}
      <div className="divide-y divide-foreground/10">
        {sections.map((section, index) => (
          <WorkExecutionRow
            key={section.id}
            section={section}
            index={index + 1}
            mode={mode}
            activity={sectionActivity?.get(section.id)}
            onToggle={checked => onSectionToggle?.(section.id, checked)}
            onStart={() => onSectionStart?.(section.id)}
            onComplete={() => onSectionComplete?.(section.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface WorkExecutionRowProps {
  section: SwsSectionDefinition
  index: number
  mode: SwsExecutionMode
  activity?: SwsTabletSectionActivity
  onToggle?: (checked: boolean) => void
  onStart?: () => void
  onComplete?: () => void
}

function WorkExecutionRow({
  section,
  index,
  mode,
  activity,
  onToggle,
  onStart,
  onComplete,
}: WorkExecutionRowProps) {
  const [manualChecked, setManualChecked] = useState(false)

  const isComplete = activity?.status === 'COMPLETE'
  const isInProgress = activity?.status === 'IN_PROGRESS'
  const isPending = !activity || activity.status === 'PENDING'

  const handleManualToggle = (checked: boolean) => {
    setManualChecked(checked)
    onToggle?.(checked)
  }

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-3 items-start',
        isComplete && 'bg-green-50 dark:bg-green-950/20',
        isInProgress && 'bg-blue-50 dark:bg-blue-950/20'
      )}
    >
      {/* Checkbox / Step number */}
      <div className="w-6 flex items-center justify-center">
        {mode === 'PRINT_MANUAL' ? (
          <Checkbox
            checked={manualChecked}
            onCheckedChange={handleManualToggle}
            className="h-5 w-5"
          />
        ) : (
          <span className="text-xs font-mono text-muted-foreground">{index}.</span>
        )}
      </div>

      {/* Work element content */}
      <div className="space-y-1">
        <div className="text-sm font-medium">{section.title}</div>
        {section.description && (
          <div className="text-xs text-muted-foreground">{section.description}</div>
        )}
        {section.workExecutions && section.workExecutions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {section.workExecutions.map((element, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-muted-foreground/50">•</span>
                <span>{element}</span>
              </li>
            ))}
          </ul>
        )}
        {section.references && section.references.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Ref: </span>
            {section.references.join(', ')}
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="w-20 flex items-center justify-center">
        {mode === 'TABLET_INTERACTIVE' ? (
          <TabletStatusBadge status={activity?.status ?? 'PENDING'} />
        ) : (
          <PrintStatusIndicator checked={manualChecked} />
        )}
      </div>

      {/* Stamp area */}
      <div className="w-24">
        {mode === 'TABLET_INTERACTIVE' ? (
          <TabletStampArea
            activity={activity}
            onStart={onStart}
            onComplete={onComplete}
          />
        ) : (
          <PrintStampBox />
        )}
      </div>
    </div>
  )
}

function TabletStatusBadge({ status }: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED' }) {
  const variants = {
    PENDING: 'bg-muted text-muted-foreground',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    COMPLETE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }

  const labels = {
    PENDING: 'Pending',
    IN_PROGRESS: 'Active',
    COMPLETE: 'Done',
    BLOCKED: 'Blocked',
  }

  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', variants[status])}>
      {labels[status]}
    </span>
  )
}

function PrintStatusIndicator({ checked }: { checked: boolean }) {
  return (
    <div className={cn(
      'w-6 h-6 rounded border-2 flex items-center justify-center',
      checked ? 'border-green-600 bg-green-100' : 'border-muted-foreground/30'
    )}>
      {checked && <Check className="h-4 w-4 text-green-600" />}
    </div>
  )
}

function TabletStampArea({
  activity,
  onStart,
  onComplete,
}: {
  activity?: SwsTabletSectionActivity
  onStart?: () => void
  onComplete?: () => void
}) {
  if (!activity || activity.status === 'PENDING') {
    return (
      <button
        onClick={onStart}
        className="w-full h-8 border border-dashed border-muted-foreground/30 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        Start
      </button>
    )
  }

  if (activity.status === 'IN_PROGRESS') {
    return (
      <button
        onClick={onComplete}
        className="w-full h-8 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
      >
        Complete
      </button>
    )
  }

  // Complete - show stamps
  const stamps = activity.stamps ?? []
  const lastStamp = stamps[stamps.length - 1]

  return (
    <div className="text-xs space-y-0.5">
      {lastStamp && (
        <>
          <div className="font-mono text-muted-foreground">{lastStamp.badge}</div>
          <div className="text-muted-foreground/60">
            {new Date(lastStamp.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </>
      )}
    </div>
  )
}

function PrintStampBox() {
  return (
    <div className="h-12 border border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">Stamp</span>
    </div>
  )
}
