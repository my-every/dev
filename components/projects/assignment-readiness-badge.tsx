'use client'

/**
 * Assignment Readiness Badge
 * 
 * A minimal badge component that shows the readiness state of an assignment.
 * Can be used in kanban cards, list items, or anywhere assignment status is shown.
 * 
 * States:
 * - Ready: Green, shows next suggested stage
 * - Blocked: Amber, shows tooltip with blocking reasons
 * - Late: Red, indicates behind schedule
 * - Complete: Emerald, terminal state
 */

import { AlertCircle, Check, ChevronRight, Clock, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AssignmentNodeStatus } from '@/hooks/use-assignment-dependency-graph'

// ============================================================================
// Types
// ============================================================================

interface AssignmentReadinessBadgeProps {
  status: AssignmentNodeStatus
  showNextStage?: boolean
  showTooltip?: boolean
  size?: 'sm' | 'md'
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function AssignmentReadinessBadge({
  status,
  showNextStage = false,
  showTooltip = true,
  size = 'sm',
  className,
}: AssignmentReadinessBadgeProps) {
  const { isBlocked, isReady, blockedReasons, nextStage, node } = status
  
  // Determine badge content
  let icon: React.ReactNode
  let label: string
  let variant: 'ready' | 'blocked' | 'late' | 'complete' | 'neutral'
  
  if (node?.stage === 'FINISHED_BIQ') {
    icon = <Check className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    label = 'Complete'
    variant = 'complete'
  } else if (node?.isLate) {
    icon = <Clock className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    label = 'Late'
    variant = 'late'
  } else if (isBlocked) {
    icon = <Lock className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    label = 'Blocked'
    variant = 'blocked'
  } else if (isReady) {
    icon = <ChevronRight className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    label = showNextStage && nextStage ? nextStage.replace(/_/g, ' ') : 'Ready'
    variant = 'ready'
  } else {
    icon = <AlertCircle className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    label = 'Pending'
    variant = 'neutral'
  }
  
  // Style variants
  const variantStyles = {
    ready: 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    blocked: 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200',
    late: 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200',
    complete: 'border-emerald-400 bg-emerald-500 text-white',
    neutral: 'border-border bg-muted text-muted-foreground',
  }
  
  const sizeStyles = {
    sm: 'h-5 gap-1 px-1.5 text-[10px]',
    md: 'h-6 gap-1.5 px-2 text-xs',
  }
  
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-medium transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {icon}
      {label}
    </Badge>
  )
  
  // If no tooltip or no blocking reasons, return just the badge
  if (!showTooltip || !isBlocked || blockedReasons.length === 0) {
    return badge
  }
  
  // With tooltip showing blocked reasons
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs"
          align="start"
        >
          <div className="space-y-1">
            <p className="font-medium text-xs">Blocked by:</p>
            <ul className="text-xs space-y-0.5">
              {blockedReasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">-</span>
                  <span>{reason}</span>
                </li>
              ))}
              {blockedReasons.length > 3 && (
                <li className="text-muted-foreground">
                  +{blockedReasons.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Simplified Props Version
// ============================================================================

interface SimpleReadinessBadgeProps {
  isBlocked: boolean
  isReady: boolean
  isLate?: boolean
  isComplete?: boolean
  nextStage?: string
  blockedReasons?: string[]
  showNextStage?: boolean
  showTooltip?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function SimpleReadinessBadge({
  isBlocked,
  isReady,
  isLate = false,
  isComplete = false,
  nextStage,
  blockedReasons = [],
  showNextStage = false,
  showTooltip = true,
  size = 'sm',
  className,
}: SimpleReadinessBadgeProps) {
  // Convert to AssignmentNodeStatus format
  const status: AssignmentNodeStatus = {
    node: isComplete ? { stage: 'FINISHED_BIQ', isLate } as any : { isLate } as any,
    isBlocked,
    isReady,
    blockedReasons,
    nextStage,
    unlocks: [],
  }
  
  return (
    <AssignmentReadinessBadge
      status={status}
      showNextStage={showNextStage}
      showTooltip={showTooltip}
      size={size}
      className={className}
    />
  )
}
