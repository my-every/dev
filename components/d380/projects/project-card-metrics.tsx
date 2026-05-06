'use client'

import { Layers3, PlayCircle, ShieldAlert, Waypoints } from 'lucide-react'

interface ProjectCardMetricsProps {
  units: number
  assignmentCounts: {
    total: number
    complete: number
    active: number
    blocked: number
  }
}

export function ProjectCardMetrics({ units, assignmentCounts }: ProjectCardMetricsProps) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-3">
      <div className="flex min-h-24 min-w-0 flex-col justify-between rounded-2xl bg-muted/50 px-2.5 py-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-foreground/42 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em] xl:text-[11px] xl:tracking-[0.22em]">
          <Layers3 className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Units</span>
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{units}</div>
      </div>
      <div className="flex min-h-24 min-w-0 flex-col justify-between rounded-2xl bg-muted/50 px-2.5 py-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-foreground/42 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em] xl:text-[11px] xl:tracking-[0.22em]">
          <Waypoints className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Assignments</span>
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{assignmentCounts.complete}/{assignmentCounts.total}</div>
      </div>
      <div className="flex min-h-24 min-w-0 flex-col justify-between rounded-2xl bg-muted/50 px-2.5 py-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-foreground/42 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em] xl:text-[11px] xl:tracking-[0.22em]">
          <PlayCircle className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Active</span>
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{assignmentCounts.active}</div>
      </div>
      <div className="flex min-h-24 min-w-0 flex-col justify-between rounded-2xl bg-muted/50 px-2.5 py-3 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-foreground/42 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em] xl:text-[11px] xl:tracking-[0.22em]">
          <ShieldAlert className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Blocked</span>
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground sm:text-xl">{assignmentCounts.blocked}</div>
      </div>
    </div>
  )
}