import { Card, CardContent } from '@/components/ui/card'
import type { RoutingPlan } from '@/types/d380-wiring'

export function WiringRoutingPanel({ plan }: { plan: RoutingPlan }) {
  const groups = [
    { id: 'panduct', title: 'Panduct', items: plan.panductPaths },
    { id: 'console', title: 'Console', items: plan.consoleRoutes },
    { id: 'under-rail', title: 'Under rail', items: plan.underRailConnections },
    { id: 'over-rail', title: 'Over rail', items: plan.overRailConnections },
  ]

  return (
    <Card className="rounded-4xl border border-border/70 bg-card py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Routing</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Panduct, under-rail, over-rail, and console path hints.</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(group => (
            <div key={group.id} className="rounded-[24px] bg-muted/50 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{group.title}</div>
              <div className="mt-3 space-y-2">
                {group.items.length > 0 ? group.items.map(item => (
                  <div key={item} className="rounded-[18px] border border-border/70 bg-card px-3 py-3 text-sm leading-6 text-foreground/68">{item}</div>
                )) : (
                  <div className="rounded-[18px] border border-border/70 bg-card px-3 py-3 text-sm leading-6 text-foreground/50">No routes staged in this group.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}