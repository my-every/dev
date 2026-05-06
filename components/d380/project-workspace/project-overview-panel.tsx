'use client'

import { ArrowRight, CheckCircle2, Circle, Clock, Layers, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { ProjectMetricCard } from '@/components/d380/project-workspace/project-metric-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  type AssignmentStageId,
} from '@/types/d380-assignment-stages'
import type { ProjectWorkspaceOverviewViewModel } from '@/types/d380-project-workspace'

// Per-category node color classes
const categoryNodeColors: Record<string, { ring: string; bg: string; connector: string }> = {
  setup:  { ring: 'ring-slate-300',   bg: 'bg-slate-100',   connector: 'bg-slate-200' },
  build:  { ring: 'ring-blue-300',    bg: 'bg-blue-100',    connector: 'bg-blue-200' },
  verify: { ring: 'ring-amber-300',   bg: 'bg-amber-100',   connector: 'bg-amber-200' },
  test:   { ring: 'ring-emerald-300', bg: 'bg-emerald-100', connector: 'bg-emerald-200' },
  final:  { ring: 'ring-sky-300',  bg: 'bg-sky-100',  connector: 'bg-sky-200' },
}

interface StageTimelineEntry {
  id: AssignmentStageId
  label: string
  shortLabel: string
  category: string
  isVerification: boolean
  status: 'completed' | 'active' | 'pending'
  completedAt?: string
  count: number
}

function QuickActionCard({
  icon: Icon,
  label,
  description,
  href,
  variant = 'default',
}: {
  icon: React.ElementType
  label: string
  description: string
  href: string
  variant?: 'default' | 'primary'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border p-4 transition-all hover:shadow-md',
        variant === 'primary'
          ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10'
          : 'border-border/70 bg-card hover:border-border hover:bg-accent/30'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          variant === 'primary' ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground/60'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-foreground/60">{description}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-foreground/60" />
    </Link>
  )
}

function StageTimeline({ stages }: { stages: StageTimelineEntry[] }) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-0">
        {stages.map((stage, idx) => {
          const colors = categoryNodeColors[stage.category] ?? categoryNodeColors.build
          const isCompleted = stage.status === 'completed'
          const isActive = stage.status === 'active'
          const isLast = idx === stages.length - 1

          return (
            <div key={stage.id} className="flex items-start">
              {/* Stage node + label */}
              <div className="flex w-[88px] flex-col items-center gap-2">
                {/* Node */}
                <div
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full ring-2 transition-all',
                    isCompleted
                      ? 'bg-emerald-500 ring-emerald-400'
                      : isActive
                      ? cn('ring-2', colors.ring, colors.bg)
                      : cn('bg-muted ring-border/40')
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
                  ) : isActive ? (
                    <Loader2 className={cn('h-4 w-4 animate-spin', `text-${stage.category}-600`)} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>

                {/* Label + date */}
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <span
                    className={cn(
                      'text-[11px] font-semibold leading-tight',
                      isCompleted
                        ? 'text-emerald-600'
                        : isActive
                        ? 'text-foreground'
                        : 'text-foreground/40'
                    )}
                  >
                    {stage.shortLabel}
                  </span>
                  {isCompleted && stage.completedAt ? (
                    <span className="text-[10px] leading-tight text-emerald-500/80">
                      {stage.completedAt}
                    </span>
                  ) : isActive ? (
                    <span className="text-[10px] leading-tight text-blue-500">In Progress</span>
                  ) : (
                    <span className="text-[10px] leading-tight text-foreground/30">—</span>
                  )}
                  {stage.count > 0 && (
                    <span
                      className={cn(
                        'mt-0.5 rounded-full px-1.5 py-px text-[9px] font-bold',
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mt-[18px] h-[2px] w-6 flex-shrink-0 rounded-full bg-border/50" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface StageCompletionData {
  stageId: AssignmentStageId
  completedAt: string // formatted short date e.g. "Mar 19"
}

interface ProjectOverviewPanelProps {
  overview: ProjectWorkspaceOverviewViewModel
  stageCompletions?: StageCompletionData[]
  currentStage?: AssignmentStageId
}

export function ProjectOverviewPanel({
  overview,
  stageCompletions = [],
  currentStage,
}: ProjectOverviewPanelProps) {
  // Build a lookup map from props (data loaded from Share/_mock files)
  const completionMap = new Map<AssignmentStageId, string>()
  for (const entry of stageCompletions) {
    completionMap.set(entry.stageId, entry.completedAt)
  }

  // Build timeline entries for all 13 stages from ASSIGNMENT_STAGES definition
  const timelineStages: StageTimelineEntry[] = ASSIGNMENT_STAGES.map(stage => {
    const overviewEntry = overview.stageSummary.find(
      s => s.label.toUpperCase() === stage.label.toUpperCase()
    )
    const completedAt = completionMap.get(stage.id)
    const isCompleted = !!completedAt
    const isActive = !isCompleted && stage.id === currentStage
    return {
      id: stage.id,
      label: stage.label,
      shortLabel: stage.shortLabel,
      category: stage.category,
      isVerification: stage.isVerification,
      status: isCompleted ? 'completed' : isActive ? 'active' : 'pending',
      completedAt,
      count: overviewEntry?.count ?? 0,
    }
  })

  const totalAssignments = overview.stageSummary.reduce((sum, s) => sum + s.count, 0) || overview.metrics[2]?.value || 0
  const completedStages = timelineStages.filter(s => s.status === 'completed').length
  const inProgressCount = timelineStages.filter(s => s.status === 'active').length

  return (
    <section className="space-y-6">
      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map(metric => (
          <ProjectMetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Stage Distribution Timeline — all 13 stages */}
      <Card className="rounded-3xl border border-border/70 bg-card">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">
                Stage Distribution
              </div>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                {totalAssignments} Assignments &mdash; {completedStages} of {timelineStages.length} stages complete
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground/50">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-border" /> Pending
              </span>
            </div>
          </div>

          <StageTimeline stages={timelineStages} />

          {/* Category legend */}
          <div className="flex flex-wrap gap-3 border-t border-border/40 pt-4">
            {(['setup', 'build', 'verify', 'test', 'final'] as const).map(cat => {
              const c = STAGE_CATEGORY_COLORS[cat]
              return (
                <span
                  key={cat}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize',
                    c.bg, c.text, c.border
                  )}
                >
                  {cat}
                </span>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          icon={Layers}
          label="View All Assignments"
          description={`${totalAssignments} sheets ready for work`}
          href="#"
          variant="primary"
        />
        <QuickActionCard
          icon={Clock}
          label="In Progress"
          description={`${inProgressCount} stage${inProgressCount !== 1 ? 's' : ''} active`}
          href="#"
        />
        <QuickActionCard
          icon={CheckCircle2}
          label="Completed"
          description={`${completedStages} of ${timelineStages.length} stages done`}
          href="#"
        />
      </div>

      {/* Activity Summary - replaces Risk and Lead Summary */}
      <Card className="rounded-3xl border border-border/70 bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">
                Recent Activity
              </div>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Project timeline and updates
              </h2>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl text-xs">
              View Full History
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {/* Activity items - using existing data */}
            {overview.riskIndicators.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3 text-sm text-foreground/70"
              >
                <div className="h-2 w-2 rounded-full bg-primary/60" />
                <span>{item}</span>
              </div>
            ))}
            {overview.riskIndicators.length === 0 && (
              <div className="rounded-xl bg-muted/30 px-4 py-6 text-center text-sm text-foreground/50">
                No recent activity to display
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
