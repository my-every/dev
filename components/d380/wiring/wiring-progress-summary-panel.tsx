import { AlertTriangle, CheckCircle2, FileCheck2, PlugZap, Workflow } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { WiringProgressSummaryViewModel } from '@/types/d380-wiring'

export function WiringProgressSummaryPanel({ summary }: { summary: WiringProgressSummaryViewModel }) {
  return (
    <Card className="rounded-4xl border border-border/70 bg-card/84 py-0 shadow-lg">
      <CardContent className="space-y-6 px-6 py-6 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">Wiring progress summary</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Section and connection readiness for the current execution lane.</h2>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/68">{summary.completionPercent}% complete</Badge>
        </div>

        <Progress value={summary.completionPercent} className="h-2 bg-muted **:data-[slot=progress-indicator]:bg-primary" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-primary/25 bg-primary/12 px-4 py-4 text-foreground">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary/75"><Workflow className="size-4" />Sections</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{summary.completedSections}/{summary.totalSections}</div>
            <div className="mt-2 text-sm text-foreground/70">{summary.blockedSections} blocked section{summary.blockedSections === 1 ? '' : 's'} still holding release.</div>
          </div>
          <div className="rounded-[22px] border border-primary/20 bg-primary/10 px-4 py-4 text-foreground">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary/75"><CheckCircle2 className="size-4" />Completed</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{summary.completedConnections}</div>
            <div className="mt-2 text-sm">{summary.totalConnections} total connections in the slice.</div>
          </div>
          <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 px-4 py-4 text-foreground">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-destructive/80"><AlertTriangle className="size-4" />Blocked</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{summary.blockedConnections}</div>
            <div className="mt-2 text-sm">{summary.blockedSections} blocked section{summary.blockedSections === 1 ? '' : 's'} / blocked connection count.</div>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/46"><PlugZap className="size-4" />Current actionable</div>
            <div className="mt-3 text-base font-semibold text-foreground">{summary.currentActionableSectionLabel}</div>
            <div className="mt-2 text-sm text-foreground/62">Current execution gate for the next wiring release.</div>
          </div>

          <div className="grid gap-4 md:col-span-2 xl:col-span-4 xl:grid-cols-2">
            <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/46"><FileCheck2 className="size-4" />Export readiness</div>
              <div className="mt-3 text-base font-semibold text-foreground">{summary.exportReady ? 'Ready to release' : 'Still gated'}</div>
              <div className="mt-2 text-sm text-foreground/62">{summary.exportReadinessLabel}</div>
            </div>
            <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/46"><FileCheck2 className="size-4" />IPV readiness</div>
              <div className="mt-3 text-base font-semibold text-foreground">{summary.ipvReady ? 'Ready for IPV' : 'IPV gated'}</div>
              <div className="mt-2 text-sm text-foreground/62">{summary.ipvReadinessLabel}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}