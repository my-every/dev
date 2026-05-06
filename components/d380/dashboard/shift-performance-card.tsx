'use client'

import type { DashboardShiftSnapshot } from '@/types/d380-dashboard'

import { DashboardWidgetCard } from '@/components/d380/dashboard/dashboard-widget-card'

interface ShiftPerformanceCardProps {
  firstShift: DashboardShiftSnapshot
  secondShift: DashboardShiftSnapshot
}

const metrics = [
  { key: 'completedAssignments', label: 'Assignments' },
  { key: 'utilizationPercent', label: 'Utilization' },
  { key: 'qualityPercent', label: 'Quality' },
  { key: 'handoffReadyPercent', label: 'Handoff ready' },
] as const

export function ShiftPerformanceCard({ firstShift, secondShift }: ShiftPerformanceCardProps) {
  return (
    <DashboardWidgetCard
      eyebrow="Shift comparison"
      title="1st vs 2nd shift"
      description="Compare output, utilization, and handoff readiness without leaving the home route."
      badge="Live"
      badgeTone="positive"
      accent="amber"
      footer="Use this seam for a future leaderboard provider"
      className="h-full"
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/42">
          <span>Metric</span>
          <span>{firstShift.label}</span>
          <span>{secondShift.label}</span>
        </div>
        {metrics.map(metric => (
          <div key={metric.key} className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-3 text-sm">
            <span className="font-medium text-foreground/72">{metric.label}</span>
            <span className="text-lg font-semibold text-foreground">
              {String(firstShift[metric.key])}
              {metric.key === 'utilizationPercent' || metric.key === 'qualityPercent' || metric.key === 'handoffReadyPercent' ? '%' : ''}
            </span>
            <span className="text-lg font-semibold text-foreground">
              {String(secondShift[metric.key])}
              {metric.key === 'utilizationPercent' || metric.key === 'qualityPercent' || metric.key === 'handoffReadyPercent' ? '%' : ''}
            </span>
          </div>
        ))}
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <div className="rounded-2xl bg-black px-4 py-3 text-[#f4c430]">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#f4c430]/70">Cycle time</div>
            <div className="mt-2 text-2xl font-semibold">{firstShift.avgCycleHours}h</div>
          </div>
          <div className="rounded-2xl bg-card px-4 py-3 text-foreground">
            <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">Cycle time</div>
            <div className="mt-2 text-2xl font-semibold">{secondShift.avgCycleHours}h</div>
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  )
}