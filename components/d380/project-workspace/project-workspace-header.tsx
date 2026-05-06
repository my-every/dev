import { AlertTriangle, CalendarClock, Layers3, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProjectWorkspaceHeaderViewModel } from '@/types/d380-project-workspace'

const riskClasses: Record<ProjectWorkspaceHeaderViewModel['risk'], string> = {
  healthy: 'border-emerald-300/80 bg-emerald-500/12 text-emerald-800',
  watch: 'border-amber-300/90 bg-amber-400/18 text-amber-950',
  late: 'border-red-300/80 bg-red-500/12 text-red-800',
}

export function ProjectWorkspaceHeader({ header, operatingDateLabel }: { header: ProjectWorkspaceHeaderViewModel; operatingDateLabel: string }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr] xl:items-end">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="bg-primary text-primary-foreground">/380/projects/{header.id}</Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-card/60 text-foreground/62">{header.revisionLabel}</Badge>
        </div>
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">{header.pdNumber}</div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">{header.name}</h1>
          <p className="max-w-3xl text-base leading-7 text-foreground/68 md:text-lg">{header.statusNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/60">
          <div className="flex items-center gap-2 rounded-full bg-card/70 px-3 py-2"><CalendarClock className="size-4" />Target {header.targetDateLabel}</div>
          <div className="flex items-center gap-2 rounded-full bg-card/70 px-3 py-2"><Layers3 className="size-4" />{header.lifecycleLabel}</div>
          <div className="flex items-center gap-2 rounded-full bg-card/70 px-3 py-2"><UserRound className="size-4" />{header.member}</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[28px] border border-border/70 bg-card/78 p-5 shadow-[0_18px_80px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-primary/10 px-4 py-4 text-foreground">
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/58">Operating date</div>
          <div className="mt-3 text-2xl font-semibold">{operatingDateLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground">
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Shift / LWC</div>
          <div className="mt-3 text-xl font-semibold">{header.shiftLabel} · {header.lwcLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground md:col-span-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42">
            <AlertTriangle className="size-4" />Status
          </div>
          <Badge variant="outline" className={cn('mt-3 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]', riskClasses[header.risk])}>{header.risk}</Badge>
          <p className="mt-3 text-sm leading-6 text-foreground/60">{header.leadSummary}</p>
        </div>
      </div>
    </section>
  )
}