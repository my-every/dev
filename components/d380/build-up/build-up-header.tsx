import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { BuildUpHeaderViewModel } from '@/types/d380-build-up'

export function BuildUpHeader({
  header,
  operatingDateLabel,
}: {
  header: BuildUpHeaderViewModel
  operatingDateLabel: string
}) {
  return (
    <Card className="rounded-[36px] border border-border/70 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_92%,white),color-mix(in_oklab,var(--color-muted)_88%,transparent))] py-0 shadow-xl">
      <CardContent className="grid gap-8 px-5 py-5 sm:px-7 sm:py-7 xl:grid-cols-[1.3fr_0.9fr] xl:px-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-foreground/48">
            <span>D380 Build Up workflow</span>
            <span className="text-foreground/26">/</span>
            <span>{operatingDateLabel}</span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">
                {header.pdNumber}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">
                {header.revisionLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-muted/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-foreground/72">
                {header.shiftLabel}
              </Badge>
            </div>

            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {header.projectName}
              </h1>
              <p className="mt-2 text-lg text-foreground/72">{header.panelName} · {header.unit}</p>
            </div>

            <p className="max-w-3xl text-base leading-7 text-foreground/66">{header.statusNote}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-primary/25 bg-primary/12 px-4 py-4 text-foreground">
              <div className="text-[11px] uppercase tracking-[0.2em] text-primary/75">Drawing</div>
              <div className="mt-2 text-sm leading-6 text-foreground/90">{header.drawingTitle}</div>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-card/78 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/46">Current section</div>
              <div className="mt-2 text-sm font-medium text-foreground">{header.currentSectionLabel}</div>
              <div className="mt-1 text-sm text-foreground/62">{header.currentStatusLabel}</div>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-card/78 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/46">Lead continuity</div>
              <div className="mt-2 text-sm leading-6 text-foreground/72">{header.leadSummary}</div>
            </div>
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