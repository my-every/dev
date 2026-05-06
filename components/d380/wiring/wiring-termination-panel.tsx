import { Card, CardContent } from '@/components/ui/card'
import type { TerminationPlan } from '@/types/d380-wiring'

export function WiringTerminationPanel({ plan }: { plan: TerminationPlan }) {
  const groups = [
    { id: 'relay', title: 'Relay / timer', items: plan.relayConnections },
    { id: 'module', title: 'Module', items: plan.moduleConnections },
    { id: 'terminal', title: 'Terminal', items: plan.terminalConnections },
    { id: 'busbar', title: 'Bus bar', items: plan.busBarConnections },
  ]

  return (
    <Card className="rounded-4xl border border-border/70 bg-card py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Termination</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Termination families and ferrule-risk warnings derived from the seeded connections.</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(group => (
            <div key={group.id} className="rounded-[24px] bg-muted/50 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{group.title}</div>
              <div className="mt-3 space-y-2">
                {group.items.length > 0 ? group.items.map(item => (
                  <div key={item} className="rounded-[18px] border border-border/70 bg-card px-3 py-3 text-sm leading-6 text-foreground/68">{item}</div>
                )) : (
                  <div className="rounded-[18px] border border-border/70 bg-card px-3 py-3 text-sm leading-6 text-foreground/50">No connections staged in this family.</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] bg-amber-100 px-4 py-4 text-amber-950">
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-900/72">Ferrule warnings</div>
          <div className="mt-3 space-y-2">
            {plan.ferruleWarnings.length > 0 ? plan.ferruleWarnings.map(item => (
              <div key={item} className="rounded-[18px] bg-card/72 px-3 py-3 text-sm leading-6">{item}</div>
            )) : (
              <div className="rounded-[18px] bg-card/72 px-3 py-3 text-sm leading-6">No ferrule warnings are currently staged.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}