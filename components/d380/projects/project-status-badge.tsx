'use client'

import { Badge } from '@/components/ui/badge'
import type { ProjectsBoardLifecycleColumnId } from '@/types/d380-projects-board'
import { cn } from '@/lib/utils'

interface ProjectStatusBadgeProps {
  stage: ProjectsBoardLifecycleColumnId
  label: string
}

const stageClasses: Record<ProjectsBoardLifecycleColumnId, string> = {
  UPCOMING: 'border border-border bg-card text-foreground',
  KITTED: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-0',
  CONLAY: 'bg-primary/15 text-primary border-0',
  CONASY: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0',
  TEST: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-0',
  PWR_CHECK: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-0',
  BIQ: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0',
  COMPLETED: 'bg-emerald-600 text-emerald-50 border-0',
}

export function ProjectStatusBadge({ stage, label }: ProjectStatusBadgeProps) {
  return <Badge className={cn(stageClasses[stage])}>{label}</Badge>
}