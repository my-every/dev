import { ArrowRightLeft, Clock3, LayoutTemplate, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AssignmentWorkspaceHeaderViewModel } from '@/types/d380-assignment-workspace'

const statusClasses: Record<AssignmentWorkspaceHeaderViewModel['currentStatusLabel'], string> = {
  'Not Started': 'border-border/70 bg-muted/50 text-foreground/68',
  'In Progress': 'border-emerald-300/80 bg-emerald-500/12 text-emerald-800',
  Blocked: 'border-red-300/80 bg-red-500/12 text-red-800',
  Complete: 'border-sky-300/80 bg-sky-500/12 text-sky-800',
}

export function AssignmentWorkspaceHeader({
  header,
  operatingDateLabel,
  onSimulateHandoff,
}: {
  header: AssignmentWorkspaceHeaderViewModel
  operatingDateLabel: string
  onSimulateHandoff: () => void
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="bg-primary text-primary-foreground">/380/projects/{header.projectId}/{header.sheetName}</Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-card/60 text-foreground/62">{header.revisionLabel}</Badge>
        </div>
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">{header.pdNumber}</div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">{header.sheetName} execution workspace</h1>
          <p className="max-w-3xl text-base leading-7 text-foreground/68 md:text-lg">{header.statusNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/60">
          <div className="rounded-full bg-card/70 px-3 py-2">Project {header.projectName}</div>
          <div className="rounded-full bg-card/70 px-3 py-2">Current stage {header.currentStageLabel}</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[28px] border border-border/70 bg-card/78 p-5 shadow-[0_18px_80px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-primary/10 px-4 py-4 text-foreground">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/58"><Clock3 className="size-4" />Operating date</div>
          <div className="mt-3 text-2xl font-semibold">{operatingDateLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><LayoutTemplate className="size-4" />Workstation</div>
          <div className="mt-3 text-xl font-semibold">{header.workstationTypeLabel}</div>
          <div className="mt-1 text-sm text-foreground/58">{header.workstationLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground">
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Stage status</div>
          <Badge variant="outline" className={cn('mt-3 rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', statusClasses[header.currentStatusLabel])}>{header.currentStatusLabel}</Badge>
          <div className="mt-2 text-sm text-foreground/58">Target {header.targetDateLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42"><UserRound className="size-4" />Shift / LWC</div>
          <div className="mt-3 text-xl font-semibold">{header.shiftLabel}</div>
          <div className="mt-1 text-sm text-foreground/58">{header.lwcLabel}</div>
        </div>
        <div className="rounded-2xl bg-card px-4 py-4 text-foreground md:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Shift handoff seam</div>
          <p className="mt-2 text-sm leading-6 text-foreground/60">{header.handoffSummary}</p>
          <Button className="mt-4 rounded-full" onClick={onSimulateHandoff}>
            <ArrowRightLeft className="size-4" />
            Simulate shift handoff
          </Button>
        </div>
      </div>
    </section>
  )
}