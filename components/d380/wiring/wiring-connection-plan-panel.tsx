import { Card, CardContent } from '@/components/ui/card'
import type { WiringConnectionPlan } from '@/types/d380-wiring'

function buildTopEntries(group: Record<string, string[]>) {
  return Object.entries(group)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 4)
}

export function WiringConnectionPlanPanel({ plan }: { plan: WiringConnectionPlan }) {
  const topDevices = buildTopEntries(plan.byDevice)
  const topBundles = buildTopEntries(plan.byBundle)
  const topHarnesses = buildTopEntries(plan.byHarness)
  const groups = [
    { id: 'device', title: 'By device', entries: topDevices },
    { id: 'bundle', title: 'By bundle', entries: topBundles },
    { id: 'harness', title: 'By harness', entries: topHarnesses },
  ]

  return (
    <Card className="rounded-4xl border border-border/70 bg-card py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Connection Plan</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Point-to-point grouping for today&apos;s routed connection workload.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-primary/25 bg-primary/12 px-4 py-4 text-foreground">
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary/75">Total connections</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{plan.totalConnections}</div>
          </div>
          <div className="rounded-[22px] bg-muted/50 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Bundles</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{Object.keys(plan.byBundle).length}</div>
          </div>
          <div className="rounded-[22px] bg-muted/50 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">Harnesses</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{Object.keys(plan.byHarness).length}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map(group => (
            <div key={group.id} className="rounded-3xl bg-muted/50 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{group.title}</div>
              <div className="mt-3 space-y-3">
                {group.entries.map(([label, connectionIds]) => (
                  <div key={label} className="rounded-[18px] border border-border/70 bg-card px-3 py-3">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="mt-1 text-sm text-foreground/60">{connectionIds.length} connection{connectionIds.length === 1 ? '' : 's'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}