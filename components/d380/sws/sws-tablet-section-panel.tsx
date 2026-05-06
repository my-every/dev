'use client'

import { useState } from 'react'
import { Play, CheckCircle, AlertTriangle, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { SwsSectionDefinition, SwsTabletSectionActivity, SwsSectionStamp } from '@/types/d380-sws'

interface SwsTabletSectionPanelProps {
  section: SwsSectionDefinition
  activity?: SwsTabletSectionActivity
  onStart: (badge: string) => void
  onComplete: (badge: string) => void
  onAddBadge?: (badge: string) => void
  onRemoveBadge?: (badge: string) => void
}

/**
 * Interactive section panel for tablet mode execution.
 * Handles badge entry, start/complete actions, and multi-user collaboration.
 */
export function SwsTabletSectionPanel({
  section,
  activity,
  onStart,
  onComplete,
  onAddBadge,
  onRemoveBadge,
}: SwsTabletSectionPanelProps) {
  const [showBadgeDialog, setShowBadgeDialog] = useState(false)
  const [badgeInput, setBadgeInput] = useState('')
  const [pendingAction, setPendingAction] = useState<'START' | 'COMPLETE' | null>(null)

  const status = activity?.status ?? 'PENDING'
  const isPending = status === 'PENDING'
  const isInProgress = status === 'IN_PROGRESS'
  const isComplete = status === 'COMPLETE'
  const isBlocked = status === 'BLOCKED'

  const handleActionClick = (action: 'START' | 'COMPLETE') => {
    setPendingAction(action)
    setBadgeInput('')
    setShowBadgeDialog(true)
  }

  const handleBadgeSubmit = () => {
    if (!badgeInput.trim()) return

    if (pendingAction === 'START') {
      onStart(badgeInput.trim())
    } else if (pendingAction === 'COMPLETE') {
      onComplete(badgeInput.trim())
    }

    setShowBadgeDialog(false)
    setBadgeInput('')
    setPendingAction(null)
  }

  return (
    <>
      <div
        className={cn(
          'rounded-lg border p-4 transition-colors',
          isPending && 'bg-muted/30 border-muted',
          isInProgress && 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
          isComplete && 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
          isBlocked && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusIcon status={status} />
              <h4 className="text-sm font-medium">{section.title}</h4>
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0">
            {isPending && (
              <Button
                size="sm"
                onClick={() => handleActionClick('START')}
                className="h-8"
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
            {isInProgress && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleActionClick('COMPLETE')}
                className="h-8 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Button>
            )}
          </div>
        </div>

        {/* Work elements */}
        {section.workExecutions && section.workExecutions.length > 0 && (
          <div className="mt-3 pl-6 space-y-1">
            {section.workExecutions.map((element, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-muted-foreground/50">•</span>
                <span>{element}</span>
              </div>
            ))}
          </div>
        )}

        {/* Activity info */}
        {(isInProgress || isComplete) && activity && (
          <div className="mt-3 pt-3 border-t border-foreground/10">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {/* Timestamps */}
              {activity.startedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Started: {formatTime(activity.startedAt)}</span>
                </div>
              )}
              {activity.completedAt && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>Done: {formatTime(activity.completedAt)}</span>
                </div>
              )}

              {/* Active badges */}
              {activity.activeBadges && activity.activeBadges.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{activity.activeBadges.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Stamp history */}
            {activity.stamps && activity.stamps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {activity.stamps.map((stamp, i) => (
                  <StampBadge key={i} stamp={stamp} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badge input dialog */}
      <Dialog open={showBadgeDialog} onOpenChange={setShowBadgeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'START' ? 'Start Section' : 'Complete Section'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-muted-foreground">
              Enter your badge number to {pendingAction === 'START' ? 'start' : 'complete'} this section:
            </label>
            <Input
              value={badgeInput}
              onChange={e => setBadgeInput(e.target.value)}
              placeholder="Badge #"
              className="mt-2"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleBadgeSubmit()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBadgeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBadgeSubmit} disabled={!badgeInput.trim()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusIcon({ status }: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED' }) {
  switch (status) {
    case 'PENDING':
      return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
    case 'IN_PROGRESS':
      return <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
    case 'COMPLETE':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'BLOCKED':
      return <AlertTriangle className="h-4 w-4 text-red-600" />
  }
}

function StampBadge({ stamp }: { stamp: SwsSectionStamp }) {
  const isStart = stamp.action === 'START'
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono',
        isStart
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      )}
    >
      <span className="font-medium">{stamp.badge}</span>
      <span className="text-muted-foreground">{formatTime(stamp.timestamp)}</span>
    </span>
  )
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
