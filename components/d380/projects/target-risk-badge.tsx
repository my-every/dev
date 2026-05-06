'use client'

import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { ProjectsBoardRiskLevel } from '@/types/d380-projects-board'
import { cn } from '@/lib/utils'

interface TargetRiskBadgeProps {
  risk: ProjectsBoardRiskLevel
  targetDateLabel: string
}

const riskClasses: Record<ProjectsBoardRiskLevel, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0',
  watch: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0',
  late: 'bg-red-500/15 text-red-700 dark:text-red-300 border-0',
}

const riskLabel: Record<ProjectsBoardRiskLevel, string> = {
  healthy: 'On target',
  watch: 'Watch target',
  late: 'Late target',
}

const riskIcon = {
  healthy: ShieldCheck,
  watch: Clock3,
  late: AlertTriangle,
} as const

export function TargetRiskBadge({ risk, targetDateLabel }: TargetRiskBadgeProps) {
  const Icon = riskIcon[risk]

  return (
    <Badge className={cn('gap-1.5', riskClasses[risk])}>
      <Icon className="size-3.5" />
      {riskLabel[risk]} • {targetDateLabel}
    </Badge>
  )
}