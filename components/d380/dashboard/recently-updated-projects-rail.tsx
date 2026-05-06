'use client'

import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'
import { DashboardWidgetRail } from '@/components/d380/dashboard/dashboard-widget-rail'
import type { DashboardProjectPreview } from '@/types/d380-dashboard'

interface RecentlyUpdatedProjectsRailProps {
  projects: DashboardProjectPreview[]
}

export function RecentlyUpdatedProjectsRail({ projects }: RecentlyUpdatedProjectsRailProps) {
  return (
    <DashboardWidgetRail
      title="Recently updated projects"
      description="Latest activity across the workspace so leads can jump from the dashboard into the freshest changes."
    >
      {projects.map(project => (
        <DashboardWidgetCard
          key={project.id}
          eyebrow={project.updatedLabel}
          title={project.name}
          description={`${project.pdNumber} • ${project.stage}`}
          badge={project.risk}
          badgeTone={project.risk === 'late' ? 'attention' : project.risk === 'watch' ? 'attention' : 'positive'}
          accent="amber"
          footer={project.statusLabel}
          className="min-h-52.5 w-[min(18.75rem,calc(100vw-3rem))] shrink-0"
        >
          <div className="rounded-2xl bg-card/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">Member</div>
            <div className="mt-2 text-lg font-semibold text-foreground">{project.member}</div>
          </div>
        </DashboardWidgetCard>
      ))}
    </DashboardWidgetRail>
  )
}