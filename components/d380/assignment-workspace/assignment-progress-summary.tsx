import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import type { AssignmentProgressSummaryViewModel } from '@/types/d380-assignment-workspace'

export function AssignmentProgressSummary({ summary }: { summary: AssignmentProgressSummaryViewModel }) {
  return (
    <Card className="rounded-4xl border border-border/70 bg-card py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Assignment progress</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Current stage progression and execution posture.</h2>
        </div>
        <div className="space-y-3 rounded-[28px] bg-accent/35 px-5 py-5">
          <div className="flex items-center justify-between text-sm text-foreground/62">
            <span>{summary.completedStagesCount} of {summary.totalStages} stages complete</span>
            <span>{summary.completionPercent}%</span>
          </div>
          <Progress value={summary.completionPercent} className="h-3 bg-muted" />
        </div>
        <div className="grid gap-3 text-sm text-foreground/62 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-muted/50 px-4 py-4">Current: {summary.currentStageLabel}</div>
          <div className="rounded-2xl bg-muted/50 px-4 py-4">Next: {summary.nextStageLabel ?? 'Awaiting completion'}</div>
          <div className="rounded-2xl bg-muted/50 px-4 py-4">Hours: {summary.elapsedVsEstimatedLabel}</div>
          <div className="rounded-2xl bg-muted/50 px-4 py-4">Blocked: {summary.blockedCount}</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-4 text-sm text-foreground/72">{summary.handoffSummary}</div>
      </CardContent>
    </Card>
  )
}