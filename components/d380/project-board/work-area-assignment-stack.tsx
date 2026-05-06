import { ArrowRight, Lock, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectBoardAssignmentViewModel } from '@/types/d380-project-board'

const statusClasses: Record<ProjectBoardAssignmentViewModel['status'], string> = {
  UNASSIGNED: 'border-border/70 bg-muted/50 text-foreground/68',
  BLOCKED: 'border-red-300/80 bg-red-500/8 text-red-700',
  IN_PROGRESS: 'border-emerald-300/80 bg-emerald-500/10 text-emerald-700',
  ASSIGNED: 'border-sky-300/80 bg-sky-500/10 text-sky-700',
  COMPLETE: 'border-border/70 bg-muted/50 text-foreground/50',
}

export function WorkAreaAssignmentStack({
  assignments,
  onSelectAssignment,
}: {
  assignments: ProjectBoardAssignmentViewModel[]
  onSelectAssignment?: (assignmentId: string) => void
}) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/65 px-4 py-5 text-sm text-muted-foreground">
        No active assignments staged here yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map(assignment => (
        <div key={assignment.id} className="rounded-2xl border border-border/70 bg-card/78 p-3 shadow-[0_10px_34px_rgba(0,0,0,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/44">{assignment.pdNumber}</div>
              <div className="mt-1 font-medium text-foreground">{assignment.sheetName}</div>
              <div className="text-sm text-foreground/62">{assignment.stageLabel}</div>
            </div>
            <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', statusClasses[assignment.status])}>
              {assignment.statusLabel}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-foreground/56">
            <span>{assignment.priorityLabel}</span>
            <span>{assignment.progressPercent}% progress</span>
          </div>
          {assignment.blockedReason ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/8 px-3 py-2 text-xs leading-5 text-red-700">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{assignment.blockedReason}</span>
            </div>
          ) : null}
          {onSelectAssignment ? (
            <Button variant="ghost" size="sm" className="mt-3 w-full justify-between rounded-xl border border-border/70 bg-muted/40" onClick={() => onSelectAssignment(assignment.id)}>
              {assignment.canPlace ? 'Select assignment' : 'View assignment'}
              {assignment.canPlace ? <ArrowRight className="size-4" /> : <Lock className="size-4" />}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}