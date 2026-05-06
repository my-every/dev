'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Circle, Lock, Loader2 } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

const stepperVariants = cva('flex items-center', {
  variants: {
    size: {
      sm: 'gap-1',
      md: 'gap-2',
      lg: 'gap-3',
    },
    orientation: {
      horizontal: 'flex-row overflow-x-auto',
      vertical: 'flex-col',
    },
  },
  defaultVariants: {
    size: 'md',
    orientation: 'horizontal',
  },
})

const stepVariants = cva(
  'relative flex items-center justify-center rounded-full border-2 transition-all',
  {
    variants: {
      size: {
        sm: 'h-6 w-6',
        md: 'h-8 w-8',
        lg: 'h-10 w-10',
      },
      status: {
        pending: 'border-muted-foreground/30 bg-background text-muted-foreground',
        active: 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/30',
        completed: 'border-emerald-500 bg-emerald-500 text-white',
        skipped: 'border-slate-400 bg-slate-400 text-white',
        blocked: 'border-red-500 bg-red-100 text-red-500',
      },
    },
    defaultVariants: {
      size: 'md',
      status: 'pending',
    },
  }
)

const connectorVariants = cva('transition-all', {
  variants: {
    size: {
      sm: 'h-0.5 w-4',
      md: 'h-0.5 w-6',
      lg: 'h-0.5 w-8',
    },
    completed: {
      true: 'bg-emerald-500',
      false: 'bg-muted-foreground/20',
    },
  },
  defaultVariants: {
    size: 'md',
    completed: false,
  },
})

interface StageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
}

export interface StageLinearStepperProps extends VariantProps<typeof stepperVariants> {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  showLabels?: boolean
  showTooltips?: boolean
  compact?: boolean
  className?: string
}

export function StageLinearStepper({
  size = 'md',
  orientation = 'horizontal',
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  showLabels = false,
  showTooltips = true,
  compact = false,
  className,
}: StageLinearStepperProps) {
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

  const getStageIcon = (status: AssignmentStageStatus, size: 'sm' | 'md' | 'lg') => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
    
    switch (status) {
      case 'completed':
        return <Check className={iconSize} />
      case 'active':
        return <Loader2 className={cn(iconSize, 'animate-spin')} />
      case 'blocked':
        return <Lock className={iconSize} />
      default:
        return <Circle className={cn(iconSize, 'fill-current')} />
    }
  }

  return (
    <TooltipProvider>
      <div className={cn(stepperVariants({ size, orientation }), className)}>
        {displayStages.map((stage, index) => {
          const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
          if (!stageDef) return null

          const isLast = index === displayStages.length - 1
          const categoryColors = STAGE_CATEGORY_COLORS[stageDef.category]

          const stepContent = (
            <button
              type="button"
              onClick={() => onStageClick?.(stage.stageId)}
              disabled={!onStageClick}
              className={cn(
                stepVariants({ size, status: stage.status }),
                onStageClick && 'cursor-pointer hover:scale-110',
                !onStageClick && 'cursor-default'
              )}
            >
              {getStageIcon(stage.status, size || 'md')}
            </button>
          )

          return (
            <div
              key={stage.stageId}
              className={cn(
                'flex items-center',
                orientation === 'vertical' && 'flex-col'
              )}
            >
              <div className="flex flex-col items-center gap-1">
                {showTooltips ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{stepContent}</TooltipTrigger>
                    <TooltipContent side={orientation === 'vertical' ? 'right' : 'bottom'}>
                      <div className="text-center">
                        <div className="font-medium">{stageDef.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {stageDef.description}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  stepContent
                )}

                {showLabels && (
                  <span
                    className={cn(
                      'text-center text-xs',
                      size === 'sm' && 'max-w-[40px]',
                      size === 'md' && 'max-w-[60px]',
                      size === 'lg' && 'max-w-[80px]',
                      stage.status === 'active'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {stageDef.shortLabel}
                  </span>
                )}
              </div>

              {!isLast && (
                <div
                  className={cn(
                    connectorVariants({
                      size,
                      completed: stage.status === 'completed',
                    }),
                    orientation === 'vertical' && 'h-6 w-0.5'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
