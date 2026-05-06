import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProjectWorkspaceMetricCardViewModel } from '@/types/d380-project-workspace'

const toneClasses: Record<ProjectWorkspaceMetricCardViewModel['tone'], string> = {
  neutral: 'bg-card text-foreground',
  positive: 'bg-emerald-50 text-emerald-950',
  attention: 'bg-amber-100 text-amber-950',
}

export function ProjectMetricCard({ metric }: { metric: ProjectWorkspaceMetricCardViewModel }) {
  return (
    <Card className={cn('rounded-[28px] border border-border/70 py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)]', toneClasses[metric.tone])}>
      <CardContent className="space-y-3 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">{metric.label}</div>
        <div className="text-3xl font-semibold tracking-tight">{metric.value}</div>
        <p className="text-sm leading-6 text-foreground/62">{metric.detail}</p>
      </CardContent>
    </Card>
  )
}