'use client'

import { useMemo, useState } from 'react'
import { BadgeCheck, Layers3, Sparkles, Workflow } from 'lucide-react'

import { AppFloatingActions } from '@/components/layout/app-floating-actions'
import { PriorityQueuePanel } from '@/components/scheduling/priority-queue-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { AssignmentModalTriggerContext } from '@/components/board/multi-step-project-assignment-modal'
import type { BoardMemberView } from '@/lib/board/types'
import { cn } from '@/lib/utils'
import type { FlattenedAssignment } from '@/types/project-manifest'
import type { ShiftId } from '@/types/shifts'

type BoardFloatingActionsProps = {
  queueAssignments: FlattenedAssignment[]
  scheduledCount: number
  canAssign: boolean
  members: BoardMemberView[]
  activeShiftId: ShiftId
  onSelectAssignment: (assignment: FlattenedAssignment) => void
  onOpenAssignmentFlow: (context: AssignmentModalTriggerContext) => void
  onStateChanged: () => Promise<void> | void
}

function QueueLauncherButton({
  pendingCount,
  canAssign,
}: {
  pendingCount: number
  canAssign: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-14 rounded-[1.5rem] border-border/70 bg-background/95 px-4 shadow-lg shadow-black/5 backdrop-blur sm:px-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600">
          <Layers3 className="size-5" />
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="text-sm font-semibold leading-none">Priority Queue</span>
          <span className="mt-1 text-xs text-muted-foreground">
            {canAssign ? 'Schedule pending project work' : 'Review pending project work'}
          </span>
        </div>
        <Badge className="ml-1 rounded-full bg-foreground text-background hover:bg-foreground">
          {pendingCount}
        </Badge>
      </div>
    </Button>
  )
}

function QueuePanel({
  queueAssignments,
  scheduledCount,
  canAssign,
  onSelectAssignment,
  onClose,
}: {
  queueAssignments: FlattenedAssignment[]
  scheduledCount: number
  canAssign: boolean
  onSelectAssignment: (assignment: FlattenedAssignment) => void
  onClose: () => void
}) {
  const totalPartNumbers = useMemo(
    () => queueAssignments.reduce((sum, item) => sum + item.assignment.partNumbers.length, 0),
    [queueAssignments],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-1 pb-4">
        <Badge variant="solid" className="rounded-full">
          {queueAssignments.length} pending
        </Badge>
        <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">
          {scheduledCount} scheduled
        </Badge>
        <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">
          {totalPartNumbers} part numbers
        </Badge>
      </div>

      <div className="min-h-0 flex-1 pt-4">
        <PriorityQueuePanel
          assignments={queueAssignments}
          embedded
          groupBy="project"
          hideAssigned={false}
          className="h-full border-0"
          onItemClick={(item) => {
            if (!canAssign) {
              return
            }

            onSelectAssignment(item)
            onClose()
          }}
        />
      </div>

      <div className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
        {canAssign
          ? 'Drag a queue item onto the timeline or select it here to open the assignment workflow with scheduling defaults.'
          : 'Queue viewing is available here, but badge-gated assignment stays limited to team leads and developers.'}
      </div>
    </div>
  )
}

function BadgeStatusDialog({
  open,
  onOpenChange,
  members,
  defaultShiftId,
  onStateChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: BoardMemberView[]
  defaultShiftId: ShiftId
  onStateChanged: () => Promise<void> | void
}) {
  const [action, setAction] = useState<'badge_in' | 'badge_out'>('badge_in')
  const [badge, setBadge] = useState('')
  const [pin, setPin] = useState('')
  const [shiftId, setShiftId] = useState<ShiftId>(defaultShiftId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [assignmentContext, setAssignmentContext] = useState<{
    pdNumber: string
    sheetName: string
    stage: string
    swsType: string | null
    operationCode: string | null
    progressPercent: number
    completedSections: number
    totalSections: number
    remainingSections: number
    hasStarted: boolean
    actions: {
      openWorkspaceHref: string
      openPrintHref: string | null
    }
  } | null>(null)

  const selectedMember = useMemo(
    () => members.find(member => member.badge === badge) ?? null,
    [badge, members],
  )

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    setFeedback(null)
    setAssignmentContext(null)

    try {
      const response = await fetch('/api/board/member-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          badge,
          pin,
          shiftId,
        }),
      })

      const payload = await response.json() as {
        error?: string
        message?: string
        assignmentContext?: {
          pdNumber: string
          sheetName: string
          stage: string
          swsType: string | null
          operationCode: string | null
          progressPercent: number
          completedSections: number
          totalSections: number
          remainingSections: number
          hasStarted: boolean
          actions: {
            openWorkspaceHref: string
            openPrintHref: string | null
          }
        } | null
      }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update badge state.')
      }

      setPin('')
      setFeedback(payload.message ?? null)
      setAssignmentContext(payload.assignmentContext ?? null)
      await onStateChanged()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update badge state.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>Badge In / Out</DialogTitle>
          <DialogDescription>
            Badge in starts the assigned work automatically when there is scheduled board work. Badge out closes the live work segment and returns the member to off shift.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={action === 'badge_in' ? 'primary' : 'outline'} onClick={() => setAction('badge_in')}>
              Badge In
            </Button>
            <Button type="button" variant={action === 'badge_out' ? 'primary' : 'outline'} onClick={() => setAction('badge_out')}>
              Badge Out
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Input
                value={badge}
                onChange={(event) => setBadge(event.target.value.replace(/\D/g, ''))}
                placeholder="Badge"
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-2">
              <Input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="PIN"
                inputMode="numeric"
                type="password"
              />
            </div>
          </div>

          {action === 'badge_in' ? (
            <p className="text-xs text-muted-foreground">
              Current scheduling window: {shiftId}. If this member already has scheduled work for that shift, the badge-in will start it automatically.
            </p>
          ) : null}

          {selectedMember ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{selectedMember.preferredName ?? selectedMember.fullName}</span>
                <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">{selectedMember.shift}</Badge>
                <Badge
                  variant="solid"
                  className={cn(
                    'rounded-full',
                    selectedMember.availabilityStatus === 'AVAILABLE' && 'bg-emerald-500/12 text-emerald-700',
                    selectedMember.availabilityStatus === 'ON_ASSIGNMENT' && 'bg-blue-500/12 text-blue-700',
                  )}
                >
                  {selectedMember.availabilityStatus}
                </Badge>
              </div>
            </div>
          ) : null}

          {feedback ? (
            <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              <div>{feedback}</div>
              {assignmentContext ? (
                <div className="mt-3 rounded-2xl border border-emerald-200/70 bg-background/80 p-3 text-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {action === 'badge_in'
                          ? assignmentContext.hasStarted ? 'Assignment Continued' : 'Assignment Ready'
                          : 'Clock Out Summary'}
                      </p>
                      <p className="truncate font-semibold">
                        {assignmentContext.pdNumber} · {assignmentContext.sheetName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stage {assignmentContext.stage.replace(/_/g, ' ')}
                        {assignmentContext.swsType ? ` · SWS ${assignmentContext.swsType}` : ''}
                        {assignmentContext.operationCode ? ` · OP ${assignmentContext.operationCode}` : ''}
                      </p>
                    </div>
                    <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">
                      {assignmentContext.progressPercent}% complete
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">
                      {assignmentContext.completedSections}/{assignmentContext.totalSections} sections
                    </Badge>
                    <Badge variant="solid" className="rounded-full bg-muted text-foreground hover:bg-muted">
                      {assignmentContext.remainingSections} remaining
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => window.location.assign(assignmentContext.actions.openWorkspaceHref)}
                    >
                      Open Workspace
                    </Button>
                    {assignmentContext.actions.openPrintHref ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.assign(assignmentContext.actions.openPrintHref!)}
                      >
                        Print SWS
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
       
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!badge || !pin || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : action === 'badge_in' ? 'Badge In' : 'Badge Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BoardFloatingActions({
  queueAssignments,
  scheduledCount,
  canAssign,
  members,
  activeShiftId,
  onSelectAssignment,
  onOpenAssignmentFlow,
  onStateChanged,
}: BoardFloatingActionsProps) {
  const isMobile = useIsMobile()
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isBadgeOpen, setIsBadgeOpen] = useState(false)
  const availableCount = useMemo(
    () => members.filter(member => member.availabilityStatus === 'AVAILABLE' && member.availabilityShiftId === activeShiftId).length,
    [activeShiftId, members],
  )

  return (
    <>
      <div className="flex items-center gap-2">
        <AppFloatingActions
          extraButtons={canAssign ? (
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-12 rounded-full text-muted-foreground"
              onClick={() => {
                onOpenAssignmentFlow({
                  source: 'card',
                })
              }}
              aria-label="Open project assignment flow"
            >
              <Workflow className="size-5" />
            </Button>
          ) : null}
        />

        <Button
          type="button"
          variant="outline"
          className="h-14 rounded-[1.5rem] border-border/70 bg-background/95 px-4 shadow-lg shadow-black/5 backdrop-blur sm:px-5"
          onClick={() => setIsBadgeOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
              <BadgeCheck className="size-5" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-semibold leading-none">Badge State</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {availableCount} available this shift
              </span>
            </div>
          </div>
        </Button>

        {isMobile ? (
          <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-[1.5rem] border-border/70 bg-background/95 px-4 shadow-lg shadow-black/5 backdrop-blur"
              onClick={() => setIsQueueOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600">
                  <Layers3 className="size-5" />
                </div>
                <Badge className="rounded-full bg-foreground text-background hover:bg-foreground">
                  {queueAssignments.length}
                </Badge>
              </div>
            </Button>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] px-4 pb-6">
              <SheetHeader className="px-1 pb-2">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Layers3 className="size-4" />
                  Priority Queue
                </SheetTitle>
                <SheetDescription>
                  Review pending project assignments and drag them onto the scheduler or open the badge-gated assignment flow.
                </SheetDescription>
              </SheetHeader>
              <QueuePanel
                queueAssignments={queueAssignments}
                scheduledCount={scheduledCount}
                canAssign={canAssign}
                onSelectAssignment={onSelectAssignment}
                onClose={() => setIsQueueOpen(false)}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <Popover open={isQueueOpen} onOpenChange={setIsQueueOpen}>
            <PopoverTrigger asChild>
              <div>
                <QueueLauncherButton
                  pendingCount={queueAssignments.length}
                  canAssign={canAssign}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              sideOffset={12}
              className="w-[min(92vw,_38rem)] rounded-[1.75rem] border-border/70 p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <Layers3 className="size-4" />
                    Priority Queue
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pull pending sheets into the scheduler without pinning the queue to the board layout.
                  </p>
                </div>
         
              </div>

              <div className="h-[min(70vh,_42rem)]">
                <QueuePanel
                  queueAssignments={queueAssignments}
                  scheduledCount={scheduledCount}
                  canAssign={canAssign}
                  onSelectAssignment={onSelectAssignment}
                  onClose={() => setIsQueueOpen(false)}
                />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <BadgeStatusDialog
        open={isBadgeOpen}
        onOpenChange={setIsBadgeOpen}
        members={members}
        defaultShiftId={activeShiftId}
        onStateChanged={onStateChanged}
      />
    </>
  )
}
