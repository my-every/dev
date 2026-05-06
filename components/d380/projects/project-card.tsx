'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ArrowRight } from 'lucide-react'

import { ProjectCardMetrics } from '@/components/d380/projects/project-card-metrics'
import { ProjectStatusBadge } from '@/components/d380/projects/project-status-badge'
import { TargetRiskBadge } from '@/components/d380/projects/target-risk-badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import type { ProjectsBoardProjectCardViewModel } from '@/types/d380-projects-board'
import { cn } from '@/lib/utils'

interface ProjectCardProps {
  project: ProjectsBoardProjectCardViewModel
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isNotesOpen, setIsNotesOpen] = useState(false)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border/70 bg-card/88 p-4 shadow-[0_14px_50px_rgba(0,0,0,0.08)] backdrop-blur-sm',
        project.isLate && 'border-red-300/70 ring-1 ring-red-300/60',
      )}
    >
      <div className="space-y-4 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex flex-1 flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/42">{project.pdNumber}</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{project.name}</h3>
            <div className="mt-1 text-sm text-foreground/58">{project.member} • {project.shiftLabel}</div>
          </div>
          <ProjectStatusBadge stage={project.lifecycleStage} label={project.lifecycleLabel} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm text-foreground/58">
            <span>Lifecycle progress</span>
            <span className="font-medium text-foreground">{project.progressPercent}%</span>
          </div>
          <Progress
            value={project.progressPercent}
            className={cn(
              'h-2.5 bg-muted **:data-[slot=progress-indicator]:bg-primary',
              project.risk === 'late' && '**:data-[slot=progress-indicator]:bg-red-500',
              project.risk === 'watch' && '**:data-[slot=progress-indicator]:bg-amber-500',
            )}
          />
        </div>

        <TargetRiskBadge risk={project.risk} targetDateLabel={project.targetDateLabel} />

        <ProjectCardMetrics units={project.units} assignmentCounts={project.assignmentCounts} />

        <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen} className="rounded-2xl border border-border/60 bg-muted/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm font-medium text-foreground/72">Project Notes</div>
                <div className="mt-1 text-xs text-foreground/50">
                  {project.lateReason ? 'Status note and late reason' : 'Status note'}
                </div>
              </div>
              <ChevronDown className={cn('size-4 text-muted/85 transition-transform', isNotesOpen && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-4 pb-4">
            <div>
              <span className="mb-1 block text-sm font-medium text-foreground/72">Notes:</span>
              <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-6 text-foreground/72">
                {project.statusNote}
              </div>
            </div>

            {project.lateReason ? (
              <div>
                <span className="mb-1 block text-sm font-medium text-red-900/80">Late Reason:</span>
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
                  {project.lateReason}
                </div>
              </div>
            ) : null}
          </CollapsibleContent>
        </Collapsible>

        <Button asChild className="w-full justify-between rounded-2xl">
          <Link href={`/380/projects/${project.id}`}>
            Open Project Workspace
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </motion.article>
  )
}