'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

interface StageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
}

export interface StageProgressBarProps {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  showMarkers?: boolean
  showLabels?: boolean
  height?: 'sm' | 'md' | 'lg'
  className?: string
}

const heightClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const markerSizeClasses = {
  sm: 'h-3 w-3 -top-0.5',
  md: 'h-4 w-4 -top-0.5',
  lg: 'h-5 w-5 -top-0.5',
}

export function StageProgressBar({
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  showMarkers = true,
  showLabels = false,
  height = 'md',
  className,
}: StageProgressBarProps) {
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

  // Calculate progress percentage
  const totalStages = stageStates.length
  const completedCount = stageStates.filter(s => s.status === 'completed').length
  const activeIndex = stageStates.findIndex(s => s.status === 'active')
  
  // Progress includes completed stages plus partial progress on active
  const progressPercent = activeIndex >= 0
    ? ((completedCount + 0.5) / totalStages) * 100
    : (completedCount / totalStages) * 100

  const getStatusColor = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500'
      case 'active':
        return 'bg-blue-500 animate-pulse'
      case 'blocked':
        return 'bg-red-500'
      default:
        return 'bg-muted-foreground/20'
    }
  }

  return (
    <TooltipProvider>
      <div className={cn('relative', className)}>
        {/* Background track */}
        <div
          className={cn(
            'w-full rounded-full bg-muted',
            heightClasses[height]
          )}
        >
          {/* Progress fill */}
          <div
            className={cn(
              'rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500',
              heightClasses[height]
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stage markers */}
        {showMarkers && (
          <div className="absolute inset-x-0 top-0 flex justify-between">
            {stageStates.map((stage, index) => {
              const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
              if (!stageDef) return null

              const leftPercent = (index / (totalStages - 1)) * 100
              const categoryColors = STAGE_CATEGORY_COLORS[stageDef.category]

              return (
                <Tooltip key={stage.stageId}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onStageClick?.(stage.stageId)}
                      disabled={!onStageClick}
                      className={cn(
                        'absolute rounded-full border-2 border-background transition-all',
                        markerSizeClasses[height],
                        getStatusColor(stage.status),
                        onStageClick && 'cursor-pointer hover:scale-125',
                        !onStageClick && 'cursor-default'
                      )}
                      style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">{stageDef.label}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {stage.status}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}

        {/* Labels below */}
        {showLabels && (
          <div className="mt-4 flex justify-between">
            {stageStates
              .filter((_, index) => index % 3 === 0 || index === stageStates.length - 1)
              .map((stage) => {
                const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
                if (!stageDef) return null

                return (
                  <span
                    key={stage.stageId}
                    className={cn(
                      'text-xs',
                      stage.status === 'active'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {stageDef.shortLabel}
                  </span>
                )
              })}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
