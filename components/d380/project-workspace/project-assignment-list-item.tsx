import Link from 'next/link'
import { ArrowRight, ExternalLink, ShieldAlert, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProjectWorkspaceAssignmentItemViewModel } from '@/types/d380-project-workspace'

const statusClasses: Record<ProjectWorkspaceAssignmentItemViewModel['statusLabel'], string> = {
  Queued: 'border-border/70 bg-muted/50 text-foreground/68',
  Active: 'border-emerald-300/80 bg-emerald-500/10 text-emerald-700',
  Blocked: 'border-red-300/80 bg-red-500/10 text-red-700',
  Complete: 'border-sky-300/80 bg-sky-500/10 text-sky-700',
}

export function ProjectAssignmentListItem({ assignment }: { assignment: ProjectWorkspaceAssignmentItemViewModel }) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_12px_42px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{assignment.lwcLabel}</div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{assignment.sheetName}</h3>
          <p className="mt-1 text-sm text-foreground/60">{assignment.stageLabel}</p>
        </div>
        <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', statusClasses[assignment.statusLabel])}>
          {assignment.statusLabel}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-foreground/62 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-muted/50 px-3 py-3">Assigned members: {assignment.assignedMemberCount}</div>
        <div className="rounded-2xl bg-muted/50 px-3 py-3">Trainees: {assignment.traineeCount}</div>
        <div className="rounded-2xl bg-muted/50 px-3 py-3">Est. hours: {assignment.estimatedHoursLabel}</div>
        <div className="rounded-2xl bg-muted/50 px-3 py-3">Avg. hours: {assignment.averageHoursLabel}</div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-foreground/44">
          <span>Progress</span>
          <span>{assignment.progressPercent}%</span>
        </div>
        <Progress value={assignment.progressPercent} className="h-2 bg-muted" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/60">
        <div className="flex items-center gap-2"><Users className="size-4" />{assignment.workstationLabel ?? 'Workstation not staged yet'}</div>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground/62">{assignment.statusNote}</p>

      {assignment.blockedReason ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-500/8 px-3 py-3 text-sm leading-6 text-red-700">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>{assignment.blockedReason}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-11 justify-between rounded-2xl bg-muted/40">
          <Link href={assignment.sheetWorkspaceHref}>
            {assignment.sheetWorkspaceLabel}
            <ExternalLink className="size-4" />
          </Link>
        </Button>

        {assignment.stageActionLabel && assignment.stageActionHref ? (
          <Button asChild className="h-11 justify-between rounded-2xl">
            <Link href={assignment.stageActionHref}>
              {assignment.stageActionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}