'use client'

import { Check, Circle, Lock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  STAGE_CATEGORY_COLORS,
  getStagesByCategory,
  type AssignmentStageCategory,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

interface StageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
}

export interface StagePhaseGroupsProps {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  layout?: 'horizontal' | 'vertical'
  showDescriptions?: boolean
  className?: string
}

const categoryLabels: Record<AssignmentStageCategory, string> = {
  setup: 'Setup',
  build: 'Build',
  verify: 'Verify',
  test: 'Test',
  final: 'Final',
}

const categoryOrder: AssignmentStageCategory[] = ['setup', 'build', 'verify', 'test', 'final']

export function StagePhaseGroups({
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  layout = 'horizontal',
  showDescriptions = false,
  className,
}: StagePhaseGroupsProps) {
  // Build stage states from props
  const stageStates: Map<AssignmentStageId, AssignmentStageStatus> = new Map()
  
  if (stages) {
    stages.forEach(s => stageStates.set(s.stageId, s.status))
  } else {
    ASSIGNMENT_STAGES.forEach(stage => {
      let status: AssignmentStageStatus = 'pending'
      if (completedStages.includes(stage.id)) {
        status = 'completed'
      } else if (stage.id === currentStage) {
        status = 'active'
      }
      stageStates.set(stage.id, status)
    })
  }

  const getStatusIcon = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="h-3.5 w-3.5" />
      case 'active':
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case 'blocked':
        return <Lock className="h-3.5 w-3.5" />
      default:
        return <Circle className="h-3 w-3 fill-current opacity-30" />
    }
  }

  const getStatusClasses = (status: AssignmentStageStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'active':
        return 'bg-blue-500 text-white border-blue-500 shadow-sm'
      case 'blocked':
        return 'bg-red-50 text-red-600 border-red-200'
      case 'skipped':
        return 'bg-slate-100 text-slate-500 border-slate-200'
      default:
        return 'bg-muted text-muted-foreground border-muted'
    }
  }

  // Calculate category completion
  const getCategoryProgress = (category: AssignmentStageCategory) => {
    const categoryStages = getStagesByCategory(category)
    const completed = categoryStages.filter(s => stageStates.get(s.id) === 'completed').length
    return { completed, total: categoryStages.length }
  }

  return (
    <div
      className={cn(
        'flex gap-4',
        layout === 'vertical' && 'flex-col',
        className
      )}
    >
      {categoryOrder.map((category) => {
        const categoryStages = getStagesByCategory(category)
        if (categoryStages.length === 0) return null

        const colors = STAGE_CATEGORY_COLORS[category]
        const progress = getCategoryProgress(category)
        const isComplete = progress.completed === progress.total

        return (
          <Card
            key={category}
            className={cn(
              'flex-1 overflow-hidden',
              isComplete && 'border-emerald-200 bg-emerald-50/50'
            )}
          >
            <CardContent className="p-3">
              {/* Category Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs font-semibold',
                      colors.bg,
                      colors.text
                    )}
                  >
                    {categoryLabels[category]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                {isComplete && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </div>

              {/* Stage Pills */}
              <div className="flex flex-wrap gap-1.5">
                {categoryStages.map((stageDef) => {
                  const status = stageStates.get(stageDef.id) || 'pending'

                  return (
                    <button
                      key={stageDef.id}
                      type="button"
                      onClick={() => onStageClick?.(stageDef.id)}
                      disabled={!onStageClick}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-all',
                        getStatusClasses(status),
                        onStageClick && 'cursor-pointer hover:opacity-80',
                        !onStageClick && 'cursor-default'
                      )}
                      title={stageDef.description}
                    >
                      {getStatusIcon(status)}
                      {stageDef.shortLabel}
                    </button>
                  )
                })}
              </div>

              {/* Descriptions (optional) */}
              {showDescriptions && (
                <div className="mt-2 space-y-1">
                  {categoryStages.map((stageDef) => {
                    const status = stageStates.get(stageDef.id) || 'pending'
                    if (status !== 'active') return null

                    return (
                      <p
                        key={stageDef.id}
                        className="text-xs text-muted-foreground"
                      >
                        {stageDef.description}
                      </p>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
