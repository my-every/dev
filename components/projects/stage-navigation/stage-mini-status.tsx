'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

interface StageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
}

export interface StageMiniStatusProps {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  showTooltips?: boolean
  size?: 'xs' | 'sm' | 'md'
  compact?: boolean
  className?: string
}

const sizeClasses = {
  xs: 'h-1.5 w-1.5 gap-0.5',
  sm: 'h-2 w-2 gap-1',
  md: 'h-2.5 w-2.5 gap-1.5',
}

const dotSizeClasses = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
}

export function StageMiniStatus({
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  showTooltips = true,
  size = 'sm',
  compact = false,
  className,
}: StageMiniStatusProps) {
  // Build stage states from props
  const stageStates: StageState[] = stages || ASSIGNMENT_STAGES.map(stage => {
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

  const getStatusColor = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500'
      case 'active':
        return 'bg-blue-500 animate-pulse'
      case 'blocked':
        return 'bg-red-500'
      case 'skipped':
        return 'bg-slate-400'
      default:
        return 'bg-muted-foreground/30'
    }
  }

  const renderDot = (stage: StageState) => {
    const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
    if (!stageDef) return null

    const dot = (
      <button
        type="button"
        onClick={() => onStageClick?.(stage.stageId)}
        disabled={!onStageClick}
        className={cn(
          'rounded-full transition-all',
          dotSizeClasses[size],
          getStatusColor(stage.status),
          onStageClick && 'cursor-pointer hover:scale-125',
          !onStageClick && 'cursor-default'
        )}
      />
    )

    if (!showTooltips) return dot

    return (
      <Tooltip key={stage.stageId}>
        <TooltipTrigger asChild>{dot}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="font-medium">{stageDef.shortLabel}</span>
          <span className="ml-1 capitalize text-muted-foreground">
            ({stage.status})
          </span>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Calculate summary for super compact view
  const completedCount = displayStages.filter(s => s.status === 'completed').length
  const totalCount = displayStages.length

  return (
    <TooltipProvider>
      <div className={cn('flex items-center', sizeClasses[size], className)}>
        {displayStages.map((stage) => renderDot(stage))}
        
        {/* Optional count label */}
        {compact && size !== 'xs' && (
          <span className="ml-1 text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}

// Variant for inline text usage
export function StageMiniStatusInline({
  currentStage,
  completedStages = [],
  compact = true,
}: {
  currentStage: AssignmentStageId
  completedStages?: AssignmentStageId[]
  compact?: boolean
}) {
  const stageDef = ASSIGNMENT_STAGES.find(s => s.id === currentStage)
  const allStages = compact
    ? ASSIGNMENT_STAGES.filter(s => !s.isVerification)
    : ASSIGNMENT_STAGES

  const currentIndex = allStages.findIndex(s => s.id === currentStage)
  const completedCount = allStages.filter(s => completedStages.includes(s.id)).length

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          completedStages.includes(currentStage) ? 'bg-emerald-500' : 'bg-blue-500'
        )}
      />
      <span className="font-medium">{stageDef?.shortLabel || currentStage}</span>
      <span className="text-muted-foreground">
        ({completedCount}/{allStages.length})
      </span>
    </span>
  )
}
