'use client'

import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'
import { DashboardWidgetRail } from '@/components/d380/dashboard/dashboard-widget-rail'
import type { DashboardProjectPreview } from '@/types/d380-dashboard'

interface LateProjectsRailProps {
  projects: DashboardProjectPreview[]
}

export function LateProjectsRail({ projects }: LateProjectsRailProps) {
  return (
    <DashboardWidgetRail
      title="Late projects"
      description="Risk-focused cards surfaced on the home route so escalation work stays visible."
    >
      {projects.map(project => (
        <DashboardWidgetCard
          key={project.id}
          eyebrow={project.pdNumber}
          title={project.name}
          description={`${project.stage} • member ${project.member}`}
          badge="Late"
          badgeTone="attention"
          accent="obsidian"
          footer={project.updatedLabel}
          className="min-h-57.5 w-[min(20.625rem,calc(100vw-3rem))] shrink-0"
        >
          <div className="grid gap-3">
            <div className="rounded-2xl border border-[#f4c430]/14 bg-white/6 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Target date</div>
              <div className="mt-2 text-lg font-semibold text-white">{project.targetDate}</div>
            </div>
            <div className="rounded-2xl border border-[#f4c430]/14 bg-white/6 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#f4c430]/60">Status</div>
              <div className="mt-2 text-lg font-semibold text-white">{project.statusLabel}</div>
            </div>
          </div>
        </DashboardWidgetCard>
      ))}
    </DashboardWidgetRail>
  )
}
