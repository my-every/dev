'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Lock } from 'lucide-react'

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
  {
    variants: {
      status: {
        pending: 'border-muted bg-muted/50 text-muted-foreground hover:bg-muted',
        ready: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
        active: 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/20',
        completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        skipped: 'border-slate-200 bg-slate-100 text-slate-500',
        blocked: 'border-red-200 bg-red-50 text-red-600',
      },
      size: {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
        lg: 'px-4 py-2 text-base',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'md',
    },
  }
)

interface StageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
}

export interface StagePillTabsProps extends VariantProps<typeof pillVariants> {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  showIcons?: boolean
  showCategory?: boolean
  compact?: boolean
  scrollable?: boolean
  className?: string
}

export function StagePillTabs({
  size = 'md',
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  showIcons = true,
  showCategory = false,
  compact = false,
  scrollable = true,
  className,
}: StagePillTabsProps) {
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

  const content = (
    <div className={cn('flex gap-2', className)}>
      {displayStages.map((stage) => {
        const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
        if (!stageDef) return null

        const categoryColors = STAGE_CATEGORY_COLORS[stageDef.category]

        return (
          <button
            key={stage.stageId}
            type="button"
            onClick={() => onStageClick?.(stage.stageId)}
            disabled={!onStageClick}
            className={cn(
              pillVariants({ status: stage.status, size }),
              onStageClick && 'cursor-pointer',
              !onStageClick && 'cursor-default',
              showCategory && stage.status === 'pending' && [
                categoryColors.bg,
                categoryColors.text,
                categoryColors.border,
              ]
            )}
          >
            {showIcons && stage.status === 'completed' && (
              <Check className="h-3.5 w-3.5" />
            )}
            {showIcons && stage.status === 'blocked' && (
              <Lock className="h-3.5 w-3.5" />
            )}
            {stageDef.shortLabel}
          </button>
        )
      })}
    </div>
  )

  if (scrollable) {
    return (
      <ScrollArea className="w-full whitespace-nowrap">
        {content}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    )
  }

  return content
}
