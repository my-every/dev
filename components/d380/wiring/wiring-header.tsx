import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { WiringHeaderViewModel } from '@/types/d380-wiring'

export function WiringHeader({ header, operatingDateLabel }: { header: WiringHeaderViewModel; operatingDateLabel: string }) {
  return (
    <Card className="rounded-[36px] border border-border/70 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_92%,white),color-mix(in_oklab,var(--color-muted)_88%,transparent))] py-0 shadow-xl">
      <CardContent className="grid gap-8 px-5 py-5 sm:px-7 sm:py-7 xl:grid-cols-[1.3fr_0.9fr] xl:px-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-foreground/48">
            <span>D380 Wiring workflow</span>
            <span className="text-foreground/26">/</span>
            <span>{operatingDateLabel}</span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">{header.pdNumber}</Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">{header.revisionLabel}</Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">{header.shiftLabel}</Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">{header.sheetName}</Badge>
            </div>

            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{header.projectName}</h1>
              <p className="mt-2 text-lg text-foreground/72">Wirelist-driven execution for {header.sheetName}</p>
            </div>

            <p className="max-w-3xl text-base leading-7 text-foreground/66">{header.statusNote}</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-primary/25 bg-primary/14 p-6 text-foreground shadow-lg">
          <div className="text-[11px] uppercase tracking-[0.24em] text-primary/76">Current execution gate</div>
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-[22px] border border-primary/20 bg-background/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/56">Current section</div>
              <div className="mt-2 font-medium text-foreground">{header.currentSectionLabel}</div>
            </div>
            <div className="rounded-[22px] border border-primary/20 bg-background/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/56">Section status</div>
              <div className="mt-2 text-foreground/86">{header.currentStatusLabel}</div>
            </div>
            <div className="rounded-[22px] border border-primary/20 bg-background/72 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/56">Lead continuity</div>
              <div className="mt-2 text-foreground/86">{header.leadSummary}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}