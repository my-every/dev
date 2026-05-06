import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AssignmentWorkspaceRailWidgetViewModel } from '@/types/d380-assignment-workspace'

export function AssignmentRailWidget({ widget }: { widget: AssignmentWorkspaceRailWidgetViewModel }) {
  return (
    <Card className="rounded-[28px] border border-border/70 bg-card/84 py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <CardContent className="space-y-4 px-5 py-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">{widget.eyebrow}</div>
          <h3 className="mt-2 text-xl font-semibold text-foreground">{widget.title}</h3>
          <p className="mt-2 text-sm leading-6 text-foreground/62">{widget.description}</p>
        </div>

        <div className="grid gap-3 grid-cols-3">
          {widget.metrics.map(metric => (
            <div key={metric.id} className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/50">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {widget.items.map(item => (
            <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <p className="mt-1 text-sm leading-6 text-foreground/62">{item.detail}</p>
            </div>
          ))}
        </div>

        <Button asChild variant="outline" className="w-full rounded-2xl bg-muted/40 text-foreground/72">
          <Link href={widget.actionHref}>{widget.actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
