'use client'

import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'
import { DashboardWidgetRail } from '@/components/d380/dashboard/dashboard-widget-rail'
import type { DashboardProjectPreview } from '@/types/d380-dashboard'

interface UpcomingProjectsRailProps {
  projects: DashboardProjectPreview[]
}

export function UpcomingProjectsRail({ projects }: UpcomingProjectsRailProps) {
  return (
    <DashboardWidgetRail
      title="Upcoming projects"
      description="Priority work staged by startup and ready to move into build lanes next."
    >
      {projects.map(project => (
        <DashboardWidgetCard
          key={project.id}
          eyebrow={project.pdNumber}
          title={project.name}
          description={`${project.units} units • member ${project.member}`}
          badge={project.targetDate}
          accent="cream"
          footer={project.statusLabel}
          className="min-h-55 w-[min(19.375rem,calc(100vw-3rem))] shrink-0"
        >
          <div className="grid gap-3">
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Stage</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{project.stage}</div>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Progress</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{project.progressPercent}%</div>
            </div>
          </div>
        </DashboardWidgetCard>
      ))}
    </DashboardWidgetRail>
  )
}