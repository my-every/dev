import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { StageActionsBar } from '@/components/d380/assignment-workspace/stage-actions-bar'
import { StageChecklist } from '@/components/d380/assignment-workspace/stage-checklist'
import { StageCommentsPanel } from '@/components/d380/assignment-workspace/stage-comments-panel'
import { StageHeader } from '@/components/d380/assignment-workspace/stage-header'
import { StageMetrics } from '@/components/d380/assignment-workspace/stage-metrics'
import type { AssignmentWorkspaceStageViewModel } from '@/types/d380-assignment-workspace'

export function StageAccordionItem({
  stage,
  onStart,
  onResume,
  onComplete,
  onToggleBlocked,
  onToggleChecklistItem,
  onCommentChange,
}: {
  stage: AssignmentWorkspaceStageViewModel
  onStart: () => void
  onResume: () => void
  onComplete: () => void
  onToggleBlocked: () => void
  onToggleChecklistItem: (checklistItemId: string) => void
  onCommentChange: (value: string) => void
}) {
  return (
    <AccordionItem value={stage.id} className="border-none">
      <Card className={cn('rounded-[30px] border py-0 shadow-[0_12px_42px_rgba(0,0,0,0.06)]', stage.isActionable ? 'border-primary bg-accent/45' : stage.displayState === 'future' ? 'border-border/60 bg-card/72' : 'border-border/70 bg-card')}>
        <CardContent className="px-5 py-4">
          <AccordionTrigger className="py-0 hover:no-underline">
            <StageHeader stage={stage} />
          </AccordionTrigger>
          <AccordionContent className="pt-5">
            <div className="space-y-5">
              <StageMetrics stage={stage} />
              {stage.blockedReason ? <div className="rounded-2xl bg-red-500/8 px-4 py-3 text-sm leading-6 text-red-700">{stage.blockedReason}</div> : null}
              <div className="rounded-2xl bg-muted/50 px-4 py-4 text-sm leading-6 text-foreground/62">{stage.note}</div>
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <StageChecklist items={stage.checklist} onToggle={onToggleChecklistItem} disabled={stage.displayState === 'future' || stage.status === 'COMPLETE'} />
                <StageCommentsPanel value={stage.comment} onChange={onCommentChange} disabled={stage.status === 'COMPLETE'} />
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-foreground/56">
                {stage.startedAtLabel ? <div className="rounded-full bg-muted/50 px-3 py-2">Started {stage.startedAtLabel}</div> : null}
                {stage.completedAtLabel ? <div className="rounded-full bg-muted/50 px-3 py-2">Completed {stage.completedAtLabel}</div> : null}
              </div>
              <StageActionsBar stage={stage} onStart={onStart} onResume={onResume} onComplete={onComplete} onToggleBlocked={onToggleBlocked} />
            </div>
          </AccordionContent>
        </CardContent>
      </Card>
    </AccordionItem>
  )
}