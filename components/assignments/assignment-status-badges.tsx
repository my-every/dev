'use client'

/**
 * Assignment Status Badges
 * 
 * Minimal UI components for surfacing:
 * - Blocked/Ready/Late badges
 * - Auto-next-stage suggestion
 * - Dependency summary
 */

import { AlertCircle, CheckCircle2, Clock, ArrowRight, Lock, Unlock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { AssignmentDependencyNode } from '@/types/d380-dependency-graph'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageDefinition } from '@/types/d380-assignment-stages'

// ============================================================================
// BLOCKED BADGE
// ============================================================================

interface AssignmentBlockedBadgeProps {
  isBlocked: boolean
  blockedReasons?: string[]
  className?: string
}

export function AssignmentBlockedBadge({
  isBlocked,
  blockedReasons = [],
  className = '',
}: AssignmentBlockedBadgeProps) {
  if (!isBlocked) return null
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="destructive" 
            className={`gap-1 text-[10px] h-5 px-1.5 ${className}`}
          >
            <Lock className="h-3 w-3" />
            Blocked
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs">
            <div className="font-medium mb-1">Blocked by:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {blockedReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// READY BADGE
// ============================================================================

interface AssignmentReadyBadgeProps {
  isReady: boolean
  nextStage?: AssignmentStageId
  className?: string
}

export function AssignmentReadyBadge({
  isReady,
  nextStage,
  className = '',
}: AssignmentReadyBadgeProps) {
  if (!isReady) return null
  
  const nextStageLabel = nextStage ? getStageDefinition(nextStage)?.label : null
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 text-[10px] h-5 px-1.5 bg-green-500/10 border-green-500/30 text-green-600 ${className}`}
          >
            <Unlock className="h-3 w-3" />
            Ready
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            {nextStageLabel 
              ? `Ready to progress to ${nextStageLabel}`
              : 'Ready for next stage'
            }
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// LATE BADGE
// ============================================================================

interface AssignmentLateBadgeProps {
  isLate: boolean
  className?: string
}

export function AssignmentLateBadge({
  isLate,
  className = '',
}: AssignmentLateBadgeProps) {
  if (!isLate) return null
  
  return (
    <Badge 
      variant="outline" 
      className={`gap-1 text-[10px] h-5 px-1.5 bg-amber-500/10 border-amber-500/30 text-amber-600 ${className}`}
    >
      <Clock className="h-3 w-3" />
      Late
    </Badge>
  )
}

// ============================================================================
// AUTO-PROGRESS SUGGESTION BADGE
// ============================================================================

interface AssignmentAutoProgressBadgeProps {
  currentStage: AssignmentStageId
  nextSuggestedStage?: AssignmentStageId
  requiresConfirmation?: boolean
  onProgress?: () => void
  className?: string
}

export function AssignmentAutoProgressBadge({
  currentStage,
  nextSuggestedStage,
  requiresConfirmation = false,
  onProgress,
  className = '',
}: AssignmentAutoProgressBadgeProps) {
  if (!nextSuggestedStage) return null
  
  const currentLabel = getStageDefinition(currentStage)?.label || currentStage
  const nextLabel = getStageDefinition(nextSuggestedStage)?.label || nextSuggestedStage
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 text-[10px] h-5 px-1.5 bg-blue-500/10 border-blue-500/30 text-blue-600 cursor-pointer hover:bg-blue-500/20 transition-colors ${className}`}
            onClick={onProgress}
          >
            <ArrowRight className="h-3 w-3" />
            {nextLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <div>Suggested: {currentLabel} → {nextLabel}</div>
            {requiresConfirmation && (
              <div className="text-muted-foreground mt-1">
                Click to confirm progression
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// DEPENDENCY SUMMARY COUNT
// ============================================================================

interface AssignmentDependencySummaryProps {
  dependencies: number
  unsatisfied: number
  className?: string
}

export function AssignmentDependencySummary({
  dependencies,
  unsatisfied,
  className = '',
}: AssignmentDependencySummaryProps) {
  if (dependencies === 0) return null
  
  const allSatisfied = unsatisfied === 0
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 text-[10px] h-5 px-1.5 ${
              allSatisfied 
                ? 'bg-green-500/10 border-green-500/30 text-green-600'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-600'
            } ${className}`}
          >
            {allSatisfied ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {unsatisfied}/{dependencies}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            {allSatisfied 
              ? `All ${dependencies} dependencies satisfied`
              : `${unsatisfied} of ${dependencies} dependencies unsatisfied`
            }
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// COMBINED STATUS BADGES ROW
// ============================================================================

interface AssignmentStatusBadgesProps {
  node: AssignmentDependencyNode
  showAutoProgress?: boolean
  onProgress?: () => void
  className?: string
}

export function AssignmentStatusBadges({
  node,
  showAutoProgress = true,
  onProgress,
  className = '',
}: AssignmentStatusBadgesProps) {
  const unsatisfiedDeps = node.dependencies.filter(d => !d.satisfied).length
  const totalDeps = node.dependencies.length
  
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      <AssignmentBlockedBadge 
        isBlocked={node.isBlocked}
        blockedReasons={node.readinessReasons}
      />
      <AssignmentReadyBadge 
        isReady={node.isReady}
        nextStage={node.nextSuggestedStage}
      />
      <AssignmentLateBadge isLate={node.isLate} />
      {showAutoProgress && node.isReady && (
        <AssignmentAutoProgressBadge
          currentStage={node.stage}
          nextSuggestedStage={node.nextSuggestedStage}
          onProgress={onProgress}
        />
      )}
      {totalDeps > 0 && (
        <AssignmentDependencySummary
          dependencies={totalDeps}
          unsatisfied={unsatisfiedDeps}
        />
      )}
    </div>
  )
}
