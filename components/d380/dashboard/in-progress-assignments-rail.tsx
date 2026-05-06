'use client'

import { Badge } from '@/components/ui/badge'
import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'
import { DashboardWidgetRail } from '@/components/d380/dashboard/dashboard-widget-rail'
import type { DashboardAssignmentPreview } from '@/types/d380-dashboard'
import { cn } from '@/lib/utils'

interface InProgressAssignmentsRailProps {
  assignments: DashboardAssignmentPreview[]
}

const statusClasses = {
  queued: 'bg-sky-100 text-sky-950',
  active: 'bg-emerald-100 text-emerald-950',
  watch: 'bg-amber-100 text-amber-950',
} as const

export function InProgressAssignmentsRail({ assignments }: InProgressAssignmentsRailProps) {
  return (
    <DashboardWidgetRail
      title="In-progress assignments"
      description="Live assignment previews with stations, members, and due windows from the current workspace."
    >
      {assignments.map(assignment => (
        <DashboardWidgetCard
          key={assignment.id}
          eyebrow={assignment.projectName}
          title={assignment.sheetName}
          description={`${assignment.station} • ${assignment.assignee}`}
          accent="cream"
          footer={assignment.dueLabel}
          className="min-h-55 w-[min(20rem,calc(100vw-3rem))] shrink-0"
        >
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <Badge className={cn('border-0 capitalize', statusClasses[assignment.status])}>{assignment.status}</Badge>
              <div className="text-sm font-medium text-foreground/58">{assignment.progressPercent}% complete</div>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Due window</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{assignment.dueLabel}</div>
            </div>
          </div>
        </DashboardWidgetCard>
      ))}
    </DashboardWidgetRail>
  )
}
