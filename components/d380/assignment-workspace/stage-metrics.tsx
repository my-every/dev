import { Badge } from '@/components/ui/badge'
import type { AssignmentWorkspaceStageViewModel } from '@/types/d380-assignment-workspace'

export function StageMetrics({ stage }: { stage: AssignmentWorkspaceStageViewModel }) {
  return (
    <div className="grid gap-3 text-sm text-foreground/62 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl bg-muted/50 px-4 py-4">Assigned: {stage.assignedMembers.length}</div>
      <div className="rounded-2xl bg-muted/50 px-4 py-4">Trainees: {stage.traineeMembers.length}</div>
      <div className="rounded-2xl bg-muted/50 px-4 py-4">Estimated: {stage.estimatedHoursLabel}</div>
      <div className="rounded-2xl bg-muted/50 px-4 py-4">Elapsed: {stage.elapsedHoursLabel}</div>
      <div className="rounded-2xl bg-muted/50 px-4 py-4 md:col-span-2 xl:col-span-4">{stage.dependencySummary}</div>
      <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
        {stage.assignedMembers.map(member => <Badge key={member.id} variant="outline" className="rounded-full border-border/70 bg-card px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{member.name}</Badge>)}
        {stage.traineeMembers.map(member => <Badge key={member.id} variant="outline" className="rounded-full border-amber-300/80 bg-amber-400/16 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-950">Trainee {member.name}</Badge>)}
      </div>
    </div>
  )
}