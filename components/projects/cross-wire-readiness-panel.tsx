'use client'

/**
 * Cross-Wire Readiness Panel
 * 
 * Displays detailed cross-wire gate status including:
 * - Panel progress toward READY_TO_HANG
 * - Box build progress
 * - Individual panel status list
 * - Cross-wire candidate assignments
 * 
 * Used in the project detail view to help Team Leads understand
 * when cross-wire work can begin.
 */

import { useMemo } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Plug,
  Layers,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CrossWireProjectReadiness, AssignmentDependencyNode } from '@/types/d380-dependency-graph'
import type { MappedAssignment } from './project-assignment-mapping-modal'
import { getStageOrderIndex } from '@/lib/assignment/stage-lifecycle'

// ============================================================================
// Types
// ============================================================================

interface CrossWireReadinessPanelProps {
  readiness: CrossWireProjectReadiness
  assignments?: MappedAssignment[]
  onAssignmentClick?: (sheetSlug: string) => void
  className?: string
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface ProgressIndicatorProps {
  label: string
  current: number
  required: number
  icon: React.ReactNode
}

function ProgressIndicator({ label, current, required, icon }: ProgressIndicatorProps) {
  const isMet = current >= required
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-semibold tabular-nums',
            isMet ? 'text-emerald-600' : 'text-amber-600'
          )}>
            {Math.round(current)}%
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">{required}% req</span>
          {isMet && <Check className="h-4 w-4 text-emerald-500" />}
        </div>
      </div>
      <Progress 
        value={current} 
        className={cn('h-2', isMet ? 'bg-emerald-100' : 'bg-amber-100')}
      />
    </div>
  )
}

// ============================================================================
// Panel Assignment Item
// ============================================================================

interface PanelAssignmentItemProps {
  assignment: MappedAssignment
  onClick?: () => void
}

function PanelAssignmentItem({ assignment, onClick }: PanelAssignmentItemProps) {
  const readyToHangIndex = getStageOrderIndex('READY_TO_HANG')
  const currentIndex = getStageOrderIndex(assignment.selectedStage)
  const isReadyToHang = currentIndex >= readyToHangIndex
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors',
        isReadyToHang 
          ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50' 
          : 'border-border hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded',
          isReadyToHang ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
        )}>
          {isReadyToHang ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
        </div>
        <span className="truncate text-sm font-medium">{assignment.sheetName}</span>
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          'shrink-0 text-[10px]',
          isReadyToHang ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : ''
        )}
      >
        {assignment.selectedStage.replace(/_/g, ' ')}
      </Badge>
    </button>
  )
}

// ============================================================================
// Cross-Wire Candidate Item
// ============================================================================

interface CrossWireCandidateItemProps {
  assignment: MappedAssignment
  isBlocked: boolean
  onClick?: () => void
}

function CrossWireCandidateItem({ assignment, isBlocked, onClick }: CrossWireCandidateItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors',
        isBlocked
          ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
          : 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded',
          isBlocked ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
        )}>
          <Plug className="h-3.5 w-3.5" />
        </div>
        <span className="truncate text-sm font-medium">{assignment.sheetName}</span>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 text-[10px]',
          isBlocked ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-emerald-300 bg-emerald-100 text-emerald-700'
        )}
      >
        {isBlocked ? 'Blocked' : 'Ready'}
      </Badge>
    </button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CrossWireReadinessPanel({
  readiness,
  assignments = [],
  onAssignmentClick,
  className,
}: CrossWireReadinessPanelProps) {
  // Get panel assignments (have wire rows, not cross-wire type)
  const panelAssignments = useMemo(() => {
    if (assignments.length === 0) return []
    return assignments.filter(a => 
      a.requiresWireSws && 
      !a.requiresCrossWireSws &&
      a.selectedSwsType.includes('PANEL')
    )
  }, [assignments])
  
  // Get cross-wire candidate assignments
  const crossWireCandidates = useMemo(() => {
    if (assignments.length === 0) return []
    return assignments.filter(a => 
      a.requiresCrossWireSws || 
      a.selectedSwsType.includes('CROSS')
    )
  }, [assignments])
  
  // If no cross-wire candidates, show simplified view
  if (crossWireCandidates.length === 0) {
    return (
      <Card className={cn('rounded-2xl border border-border/70', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Plug className="h-4 w-4 text-muted-foreground" />
            Cross-Wire Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Check className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">No Cross-Wire Required</p>
              <p className="text-xs text-muted-foreground">
                This project has no cross-wire assignments
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={cn('rounded-2xl border border-border/70', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Plug className="h-4 w-4 text-muted-foreground" />
            Cross-Wire Readiness
          </CardTitle>
          {readiness.isReady ? (
            <Badge className="gap-1 bg-emerald-500">
              <Check className="h-3 w-3" />
              Gate Open
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Gate Locked
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Thresholds */}
        <div className="space-y-3 rounded-lg border p-3">
          <ProgressIndicator
            label="Panels Ready to Hang"
            current={readiness.readyToHangProgress}
            required={50}
            icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          />
          <ProgressIndicator
            label="Box Build Progress"
            current={readiness.boxBuildProgress}
            required={25}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        
        {/* Reasons */}
        {readiness.reasons.length > 0 && (
          <div className="space-y-1">
            {readiness.reasons.map((reason, i) => (
              <div 
                key={i}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Panel Assignments */}
        {panelAssignments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Panel Progress ({panelAssignments.filter(a => 
                getStageOrderIndex(a.selectedStage) >= getStageOrderIndex('READY_TO_HANG')
              ).length}/{panelAssignments.length})
            </h4>
            <ScrollArea className="h-32">
              <div className="space-y-1.5 pr-3">
                {panelAssignments.map((assignment) => (
                  <PanelAssignmentItem
                    key={assignment.sheetSlug}
                    assignment={assignment}
                    onClick={() => onAssignmentClick?.(assignment.sheetSlug)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Cross-Wire Candidates */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cross-Wire Assignments ({readiness.readyAssignments.length}/{crossWireCandidates.length} ready)
          </h4>
          <div className="space-y-1.5">
            {crossWireCandidates.map((assignment) => (
              <CrossWireCandidateItem
                key={assignment.sheetSlug}
                assignment={assignment}
                isBlocked={readiness.blockedAssignments.includes(assignment.sheetSlug)}
                onClick={() => onAssignmentClick?.(assignment.sheetSlug)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
