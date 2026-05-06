'use client'

import { ChevronRight, Check, MoreHorizontal } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export interface StageBreadcrumbProps {
  currentStage: AssignmentStageId
  stages?: StageState[]
  completedStages?: AssignmentStageId[]
  onStageClick?: (stageId: AssignmentStageId) => void
  maxVisible?: number
  showCheckmarks?: boolean
  className?: string
}

export function StageBreadcrumb({
  currentStage,
  stages,
  completedStages = [],
  onStageClick,
  maxVisible = 5,
  showCheckmarks = true,
  className,
}: StageBreadcrumbProps) {
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

  // Find current stage index
  const currentIndex = stageStates.findIndex(s => s.stageId === currentStage)
  
  // Determine which stages to show
  let visibleStages: StageState[] = []
  let hiddenStages: StageState[] = []
  let showEllipsisBefore = false
  let showEllipsisAfter = false

  if (stageStates.length <= maxVisible) {
    visibleStages = stageStates
  } else {
    // Always show first, current, and surrounding stages
    const start = Math.max(0, currentIndex - Math.floor((maxVisible - 2) / 2))
    const end = Math.min(stageStates.length, start + maxVisible - 1)
    
    visibleStages = stageStates.slice(start, end)
    
    if (start > 0) {
      showEllipsisBefore = true
      hiddenStages = stageStates.slice(0, start)
    }
    if (end < stageStates.length) {
      showEllipsisAfter = true
    }
  }

  const renderStageItem = (stage: StageState, isLast: boolean) => {
    const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
    if (!stageDef) return null

    const isActive = stage.status === 'active'
    const isCompleted = stage.status === 'completed'

    if (isActive) {
      return (
        <BreadcrumbItem key={stage.stageId}>
          <BreadcrumbPage className="flex items-center gap-1.5 font-medium text-blue-600">
            {stageDef.shortLabel}
          </BreadcrumbPage>
          {!isLast && (
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
          )}
        </BreadcrumbItem>
      )
    }

    return (
      <BreadcrumbItem key={stage.stageId}>
        <BreadcrumbLink
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onStageClick?.(stage.stageId)
          }}
          className={cn(
            'flex items-center gap-1.5 transition-colors',
            isCompleted && 'text-emerald-600 hover:text-emerald-700',
            !isCompleted && 'text-muted-foreground hover:text-foreground'
          )}
        >
          {showCheckmarks && isCompleted && (
            <Check className="h-3.5 w-3.5" />
          )}
          {stageDef.shortLabel}
        </BreadcrumbLink>
        {!isLast && (
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
        )}
      </BreadcrumbItem>
    )
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {/* Hidden stages dropdown (before) */}
        {showEllipsisBefore && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {hiddenStages.map((stage) => {
                    const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stage.stageId)
                    if (!stageDef) return null

                    return (
                      <DropdownMenuItem
                        key={stage.stageId}
                        onClick={() => onStageClick?.(stage.stageId)}
                        className={cn(
                          'gap-2',
                          stage.status === 'completed' && 'text-emerald-600'
                        )}
                      >
                        {showCheckmarks && stage.status === 'completed' && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {stageDef.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
          </>
        )}

        {/* Visible stages */}
        {visibleStages.map((stage, index) =>
          renderStageItem(stage, index === visibleStages.length - 1 && !showEllipsisAfter)
        )}

        {/* Ellipsis for hidden stages (after) */}
        {showEllipsisAfter && (
          <BreadcrumbItem>
            <span className="text-muted-foreground">...</span>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
