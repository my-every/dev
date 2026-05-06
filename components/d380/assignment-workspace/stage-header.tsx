import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AssignmentWorkspaceStageViewModel } from '@/types/d380-assignment-workspace'

const badgeClasses: Record<AssignmentWorkspaceStageViewModel['displayState'], string> = {
  current: 'border-emerald-300/80 bg-emerald-500/12 text-emerald-800',
  available: 'border-border/70 bg-muted/50 text-foreground/68',
  blocked: 'border-red-300/80 bg-red-500/10 text-red-700',
  future: 'border-border/70 bg-muted/40 text-foreground/46',
  complete: 'border-sky-300/80 bg-sky-500/10 text-sky-700',
}

export function StageHeader({ stage }: { stage: AssignmentWorkspaceStageViewModel }) {
  return (
    <div className="flex w-full items-start justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{stage.id}</div>
        <div className="mt-1 text-lg font-semibold text-foreground">{stage.title}</div>
        <p className="mt-1 text-sm leading-6 text-foreground/60">{stage.description}</p>
      </div>
      <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', badgeClasses[stage.displayState])}>
        {stage.statusLabel}
      </Badge>
    </div>
  )
}