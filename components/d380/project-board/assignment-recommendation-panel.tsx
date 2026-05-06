import { Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectBoardAssignmentViewModel } from '@/types/d380-project-board'

export function AssignmentRecommendationPanel({
  title,
  assignments,
  onSelectAssignment,
}: {
  title: string
  assignments: ProjectBoardAssignmentViewModel[]
  onSelectAssignment: (assignmentId: string) => void
}) {
  return (
    <div className="space-y-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/44">
        <Sparkles className="size-4" />
        {title}
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">
          No eligible recommendations are available for this station yet.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(assignment => (
            <div key={assignment.id} className="rounded-2xl border border-border/70 bg-accent/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{assignment.pdNumber}</div>
                  <div className="mt-1 font-medium text-foreground">{assignment.sheetName}</div>
                  <div className="text-sm text-foreground/60">{assignment.stageLabel} · {assignment.requiredRoleLabel}</div>
                </div>
                <Badge variant="outline" className={cn('rounded-full border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', assignment.canPlace ? 'text-foreground/64' : 'text-red-700')}>
                  {assignment.priorityLabel}
                </Badge>
              </div>
              <div className="mt-3 space-y-1.5 text-sm leading-6 text-foreground/62">
                {assignment.recommendationReasons.length > 0 ? assignment.recommendationReasons.map(reason => (
                  <div key={reason}>• {reason}</div>
                )) : <div>• {assignment.statusNote}</div>}
              </div>
              <Button variant="ghost" className="mt-3 w-full justify-between rounded-xl border border-border/70 bg-background" onClick={() => onSelectAssignment(assignment.id)}>
                Stage assignment
                <Sparkles className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}