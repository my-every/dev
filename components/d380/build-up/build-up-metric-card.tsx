import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BuildUpMetricCardViewModel } from '@/types/d380-build-up'

const toneClasses: Record<BuildUpMetricCardViewModel['tone'], string> = {
  neutral: 'bg-card/82 text-foreground',
  positive: 'bg-emerald-50/92 text-emerald-950',
  attention: 'bg-amber-100/92 text-amber-950',
}

export function BuildUpMetricCard({ metric }: { metric: BuildUpMetricCardViewModel }) {
  return (
    <Card className={cn('rounded-[28px] border border-border/70 py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)]', toneClasses[metric.tone])}>
      <CardContent className="space-y-3 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/46">{metric.label}</div>
        <div className="text-3xl font-semibold tracking-tight">{metric.value}</div>
        <p className="text-sm leading-6 text-foreground/62">{metric.detail}</p>
      </CardContent>
    </Card>
  )
}