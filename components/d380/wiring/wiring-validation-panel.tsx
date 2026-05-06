import { Card, CardContent } from '@/components/ui/card'
import type { ValidationPlan } from '@/types/d380-wiring'

export function WiringValidationPanel({ plan }: { plan: ValidationPlan }) {
  const groups = [
    { id: 'pull', title: 'Pull test', count: plan.pullTestConnectionIds.length },
    { id: 'polarity', title: 'Polarity', count: plan.polarityValidationIds.length },
    { id: 'bird-cage', title: 'Bird cage', count: plan.birdCageInspectionIds.length },
    { id: 'strip', title: 'Strip length', count: plan.stripLengthInspectionIds.length },
  ]

  return (
    <Card className="rounded-4xl border border-border/70 bg-card py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Validation</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Pull-test, polarity, strip-length, and discrepancy checks for IPV readiness.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groups.map(group => (
            <div key={group.id} className="rounded-[22px] bg-muted/50 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{group.title}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{group.count}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 px-4 py-4 text-foreground">
          <div className="text-[11px] uppercase tracking-[0.2em] text-destructive/80">Discrepancy</div>
          <div className="mt-3 space-y-2">
            {plan.discrepancyChecks.length > 0 ? plan.discrepancyChecks.map(item => (
              <div key={item} className="rounded-[18px] border border-destructive/20 bg-card px-3 py-3 text-sm leading-6">{item}</div>
            )) : (
              <div className="rounded-[18px] border border-destructive/20 bg-card px-3 py-3 text-sm leading-6">No validation discrepancies are currently staged.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}