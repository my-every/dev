'use client'

import { Check, Circle, Lock, Loader2, Clock, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  type AssignmentStageId,
  type AssignmentStageState,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

export interface StageVerticalTimelineProps {
  currentStage: AssignmentStageId
  stages?: AssignmentStageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  showDetails?: boolean
  compact?: boolean
  className?: string
}

export function StageVerticalTimeline({
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  showDetails = true,
  compact = false,
  className,
}: StageVerticalTimelineProps) {
  // Build stage states from props
  const stageStates: AssignmentStageState[] = stages || ASSIGNMENT_STAGES.map(stage => {
    let status: AssignmentStageStatus = 'pending'
    if (completedStages.includes(stage.id)) {
      status = 'completed'
    } else if (stage.id === currentStage) {
      status = 'active'
    }
    return { stageId: stage.id, status }
  })

  // Filter to only show key stages in compact mode
  const displayStages = compact
    ? stageStates.filter(s => {
        const def = ASSIGNMENT_STAGES.find(d => d.id === s.stageId)
        return def && !def.isVerification
      })
    : stageStates

  const getStatusIcon = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4" />
      case 'active':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'blocked':
        return <Lock className="h-4 w-4" />
      case 'ready':
        return <Circle className="h-3 w-3" />
      default:
        return <Circle className="h-3 w-3 fill-current" />
    }
  }

  const getStatusClasses = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500 text-white border-emerald-500'
      case 'active':
        return 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/30'
      case 'ready':
        return 'bg-amber-50 text-amber-700 border-amber-400'
      case 'blocked':
        return 'bg-red-100 text-red-500 border-red-500'
      case 'skipped':
        return 'bg-slate-400 text-white border-slate-400'
      default:
        return 'bg-background text-muted-foreground border-muted-foreground/30'
    }
  }

  const getConnectorClasses = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500'
      default:
        return 'bg-muted-foreground/20'
    }
  }

  return (
    <div className={cn('relative', className)}>
      {displayStages.map((stage, index) => {
        const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
        if (!stageDef) return null

        const isLast = index === displayStages.length - 1
        const categoryColors = STAGE_CATEGORY_COLORS[stageDef.category]

        return (
          <div key={stage.stageId} className="relative flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onStageClick?.(stage.stageId)}
                disabled={!onStageClick}
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  getStatusClasses(stage.status),
                  onStageClick && 'cursor-pointer hover:scale-110',
                  !onStageClick && 'cursor-default'
                )}
              >
                {getStatusIcon(stage.status)}
              </button>
              
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[24px]',
                    getConnectorClasses(stage.status)
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-medium',
                        stage.status === 'active' && 'text-blue-600',
                        stage.status === 'completed' && 'text-emerald-600',
                        stage.status === 'blocked' && 'text-red-600'
                      )}
                    >
                      {stageDef.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        categoryColors.bg,
                        categoryColors.text
                      )}
                    >
                      {stageDef.category}
                    </Badge>
                  </div>
                  
                  {showDetails && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stageDef.description}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <Badge
                  variant={stage.status === 'active' ? 'default' : 'outline'}
                  className={cn(
                    'shrink-0 capitalize',
                    stage.status === 'completed' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    stage.status === 'blocked' && 'border-red-200 bg-red-50 text-red-700'
                  )}
                >
                  {stage.status}
                </Badge>
              </div>

              {/* Additional details for completed stages */}
              {showDetails && stage.status === 'completed' && (stage.completedAt || stage.completedBy || stage.duration) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {stage.completedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {stage.completedAt}
                    </span>
                  )}
                  {stage.completedBy && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {stage.completedBy}
                    </span>
                  )}
                  {stage.duration && (
                    <span className="flex items-center gap-1">
                      {Math.round(stage.duration / 60)}h {stage.duration % 60}m
                    </span>
                  )}
                </div>
              )}

              {/* Blocked reason */}
              {stage.status === 'blocked' && stage.blockedReason && (
                <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {stage.blockedReason}
                </div>
              )}

              {/* Notes */}
              {stage.notes && (
                <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {stage.notes}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
