'use client'

/**
 * Project Lifecycle Summary Strip
 * 
 * A compact strip showing project-level lifecycle status:
 * - Overall progress
 * - Cross-wire readiness
 * - Test/Power/BIQ gates
 * - Blocked/Ready counts
 */

import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Zap, 
  TestTube, 
  Power, 
  ClipboardCheck,
  ArrowRight,
  Lock,
  Unlock
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProjectLifecycleSnapshot, CrossWireProjectReadiness } from '@/types/d380-dependency-graph'

// ============================================================================
// GATE INDICATOR
// ============================================================================

interface GateIndicatorProps {
  label: string
  icon: React.ReactNode
  isReady: boolean
  reasons?: string[]
}

function GateIndicator({ label, icon, isReady, reasons = [] }: GateIndicatorProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
            isReady 
              ? 'bg-green-500/10 text-green-600' 
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            {icon}
            <span className="font-medium">{label}</span>
            {isReady ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-xs">
            <div className="font-medium mb-1">
              {label}: {isReady ? 'Ready' : 'Not Ready'}
            </div>
            {reasons.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// METRIC BADGE
// ============================================================================

interface MetricBadgeProps {
  label: string
  value: number
  variant: 'blocked' | 'ready' | 'late' | 'neutral'
  icon?: React.ReactNode
}

function MetricBadge({ label, value, variant, icon }: MetricBadgeProps) {
  if (value === 0) return null
  
  const variantStyles = {
    blocked: 'bg-red-500/10 border-red-500/30 text-red-600',
    ready: 'bg-green-500/10 border-green-500/30 text-green-600',
    late: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
    neutral: 'bg-slate-500/10 border-slate-500/30 text-slate-600',
  }
  
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${variantStyles[variant]}`}>
      {icon}
      {value} {label}
    </Badge>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProjectLifecycleSummaryStripProps {
  snapshot: ProjectLifecycleSnapshot
  crossWireReadiness: CrossWireProjectReadiness
  className?: string
}

export function ProjectLifecycleSummaryStrip({
  snapshot,
  crossWireReadiness,
  className = '',
}: ProjectLifecycleSummaryStripProps) {
  return (
    <Card className={`p-3 ${className}`}>
      <div className="flex items-center gap-4 flex-wrap">
        {/* Overall Progress */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="text-xs text-muted-foreground">Progress</div>
          <div className="flex-1 max-w-[80px]">
            <Progress value={snapshot.overallProgress} className="h-2" />
          </div>
          <div className="text-xs font-medium">{snapshot.overallProgress}%</div>
        </div>
        
        {/* Divider */}
        <div className="h-6 w-px bg-border" />
        
        {/* Counts */}
        <div className="flex items-center gap-2">
          <MetricBadge 
            label="blocked" 
            value={snapshot.blockedAssignments} 
            variant="blocked"
            icon={<Lock className="h-3 w-3" />}
          />
          <MetricBadge 
            label="ready" 
            value={snapshot.readyAssignments} 
            variant="ready"
            icon={<Unlock className="h-3 w-3" />}
          />
          <MetricBadge 
            label="late" 
            value={snapshot.lateAssignments} 
            variant="late"
            icon={<Clock className="h-3 w-3" />}
          />
        </div>
        
        {/* Divider */}
        <div className="h-6 w-px bg-border" />
        
        {/* Stage Gates */}
        <div className="flex items-center gap-2">
          <GateIndicator
            label="Cross Wire"
            icon={<Zap className="h-3 w-3" />}
            isReady={snapshot.crossWireReady}
            reasons={crossWireReadiness.reasons}
          />
          <GateIndicator
            label="Test"
            icon={<TestTube className="h-3 w-3" />}
            isReady={snapshot.testReady}
          />
          <GateIndicator
            label="Power"
            icon={<Power className="h-3 w-3" />}
            isReady={snapshot.powerCheckReady}
          />
          <GateIndicator
            label="BIQ"
            icon={<ClipboardCheck className="h-3 w-3" />}
            isReady={snapshot.biqReady}
          />
        </div>
        
        {/* Next Action */}
        {snapshot.nextRecommendedProjectAction && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>{snapshot.nextRecommendedProjectAction}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ============================================================================
// COMPACT VERSION
// ============================================================================

interface ProjectLifecycleCompactProps {
  snapshot: ProjectLifecycleSnapshot
  className?: string
}

export function ProjectLifecycleCompact({
  snapshot,
  className = '',
}: ProjectLifecycleCompactProps) {
  return (
    <div className={`flex items-center gap-3 text-xs ${className}`}>
      <div className="flex items-center gap-1.5">
        <Progress value={snapshot.overallProgress} className="h-1.5 w-16" />
        <span className="text-muted-foreground">{snapshot.overallProgress}%</span>
      </div>
      
      {snapshot.blockedAssignments > 0 && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-red-500/10 border-red-500/30 text-red-600">
          {snapshot.blockedAssignments} blocked
        </Badge>
      )}
      
      {snapshot.readyAssignments > 0 && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-green-500/10 border-green-500/30 text-green-600">
          {snapshot.readyAssignments} ready
        </Badge>
      )}
      
      {snapshot.crossWireReady && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-600">
          Cross Wire OK
        </Badge>
      )}
    </div>
  )
}
