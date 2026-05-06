'use client'

/**
 * Project Lifecycle Snapshot Component
 * 
 * Displays a complete project lifecycle overview including:
 * - Overall progress
 * - Stage distribution
 * - Gate readiness (Cross-Wire, Test, Power Check, BIQ)
 * - Blocked/Ready assignment counts
 * - Next recommended action
 * 
 * Uses the dependency graph to derive all state.
 */

import { useMemo } from 'react'
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  Package,
  Plug,
  TestTube,
  Unlock,
  X,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ProjectLifecycleSnapshot, CrossWireProjectReadiness } from '@/types/d380-dependency-graph'

// ============================================================================
// Types
// ============================================================================

interface ProjectLifecycleSnapshotProps {
  snapshot: ProjectLifecycleSnapshot
  crossWireReadiness?: CrossWireProjectReadiness
  onClose?: () => void
  className?: string
}

// ============================================================================
// Gate Status Card
// ============================================================================

interface GateStatusProps {
  label: string
  isReady: boolean
  progress?: number
  icon: React.ReactNode
  reasons?: string[]
}

function GateStatus({ label, isReady, progress, icon, reasons }: GateStatusProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border p-3 transition-colors',
      isReady 
        ? 'border-emerald-500/20 bg-emerald-500/10' 
        : 'border-amber-500/20 bg-amber-500/10'
    )}>
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        isReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {isReady ? (
            <Badge variant="outline" className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/20 px-1.5 text-[10px] text-emerald-400">
              <Unlock className="h-3 w-3" />
              Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 gap-1 border-amber-500/30 bg-amber-500/20 px-1.5 text-[10px] text-amber-400">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
        )}
        {reasons && reasons.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={reasons[0]}>
            {reasons[0]}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  label: string
  value: number
  total?: number
  tone?: 'neutral' | 'positive' | 'warning' | 'error'
  sublabel?: string
}

function StatCard({ label, value, total, tone = 'neutral', sublabel }: StatCardProps) {
  const toneColors = {
    neutral: 'text-foreground',
    positive: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  }
  
  const toneBg = {
    neutral: 'bg-muted/30',
    positive: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    error: 'bg-red-500/10',
  }

  return (
    <div className={cn('rounded-xl p-3 border border-border/30', toneBg[tone])}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', toneColors[tone])}>
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-muted-foreground">/{total}</span>
        )}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

// ============================================================================
// Compact Horizontal Lifecycle Bar (for SubHeader placement)
// ============================================================================

interface CompactLifecycleBarProps {
  snapshot: ProjectLifecycleSnapshot
  crossWireReadiness?: CrossWireProjectReadiness
  onExpand?: () => void
  className?: string
}

export function CompactLifecycleBar({
  snapshot,
  crossWireReadiness,
  onExpand,
  className,
}: CompactLifecycleBarProps) {
  if (!snapshot) return null

  const progressColor = snapshot.overallProgress >= 80 ? 'bg-emerald-500' 
    : snapshot.overallProgress >= 50 ? 'bg-blue-500'
    : snapshot.overallProgress >= 25 ? 'bg-amber-500' 
    : 'bg-slate-500'

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-card/50 border border-border/50',
      className
    )}>
      {/* Progress */}
      <div className="flex items-center gap-3 min-w-[140px]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">Progress</span>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Progress value={snapshot.overallProgress} className={cn('h-2 w-16', progressColor)} />
          <span className="text-sm font-semibold tabular-nums">{snapshot.overallProgress}%</span>
        </div>
      </div>

      <div className="h-5 w-px bg-border/50 hidden sm:block" />

      {/* Quick Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Total:</span>
          <span className="text-sm font-semibold">{snapshot.totalAssignments}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Ready:</span>
          <span className="text-sm font-semibold text-emerald-500">{snapshot.readyAssignments}</span>
        </div>
        {snapshot.blockedAssignments > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Blocked:</span>
            <span className="text-sm font-semibold text-amber-500">{snapshot.blockedAssignments}</span>
          </div>
        )}
        {snapshot.lateAssignments > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Late:</span>
            <span className="text-sm font-semibold text-red-500">{snapshot.lateAssignments}</span>
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-border/50 hidden md:block" />

      {/* Stage Gates - Compact */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Gates:</span>
        <div className="flex items-center gap-1">
          <Badge 
            variant="outline" 
            className={cn(
              'h-6 px-2 text-[10px]',
              crossWireReadiness?.isReady 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' 
                : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
            )}
          >
            <Plug className="h-3 w-3 mr-1" />
            Cross Wire
          </Badge>
          <Badge 
            variant="outline" 
            className={cn(
              'h-6 px-2 text-[10px]',
              snapshot.testReady 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' 
                : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
            )}
          >
            <TestTube className="h-3 w-3 mr-1" />
            Test
          </Badge>
          <Badge 
            variant="outline" 
            className={cn(
              'h-6 px-2 text-[10px]',
              snapshot.powerCheckReady 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' 
                : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
            )}
          >
            <Zap className="h-3 w-3 mr-1" />
            Power
          </Badge>
          <Badge 
            variant="outline" 
            className={cn(
              'h-6 px-2 text-[10px]',
              snapshot.biqReady 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' 
                : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
            )}
          >
            <Package className="h-3 w-3 mr-1" />
            BIQ
          </Badge>
        </div>
      </div>

      {/* Expand Button */}
      {onExpand && (
        <>
          <div className="flex-1" />
          <button
            onClick={onExpand}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Details
            <ChevronRight className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Full Lifecycle Card (for modal/expanded view)
// ============================================================================

export function ProjectLifecycleSnapshotCard({
  snapshot,
  crossWireReadiness,
  onClose,
  className,
}: ProjectLifecycleSnapshotProps) {
  // Early return if snapshot is not available
  if (!snapshot) {
    return null
  }
  
  // Derive progress color
  const progressColor = useMemo(() => {
    if (snapshot.overallProgress >= 80) return 'bg-emerald-500'
    if (snapshot.overallProgress >= 50) return 'bg-blue-500'
    if (snapshot.overallProgress >= 25) return 'bg-amber-500'
    return 'bg-slate-500'
  }, [snapshot.overallProgress])

  return (
    <Card className={cn('rounded-xl border border-border/50 bg-card/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Activity className="h-4 w-4 text-primary" />
            Project Lifecycle
          </CardTitle>
          <div className="flex items-center gap-2">
            {snapshot.isComplete && (
              <Badge className="gap-1 bg-emerald-500">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Badge>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-semibold">{snapshot.overallProgress}%</span>
          </div>
          <Progress value={snapshot.overallProgress} className={cn('h-2', progressColor)} />
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Total"
            value={snapshot.totalAssignments}
            tone="neutral"
          />
          <StatCard
            label="Ready"
            value={snapshot.readyAssignments}
            tone={snapshot.readyAssignments > 0 ? 'positive' : 'neutral'}
            sublabel="Can progress"
          />
          <StatCard
            label="Blocked"
            value={snapshot.blockedAssignments}
            tone={snapshot.blockedAssignments > 0 ? 'warning' : 'neutral'}
            sublabel="Dependencies"
          />
          <StatCard
            label="Late"
            value={snapshot.lateAssignments}
            tone={snapshot.lateAssignments > 0 ? 'error' : 'neutral'}
            sublabel="Behind schedule"
          />
        </div>

        {/* Stage Gates */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stage Gates
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <GateStatus
              label="Cross-Wire"
              isReady={crossWireReadiness?.isReady ?? false}
              progress={crossWireReadiness?.readyToHangProgress}
              icon={<Plug className="h-4 w-4" />}
              reasons={crossWireReadiness?.reasons}
            />
            <GateStatus
              label="Test"
              isReady={snapshot.testReady ?? false}
              icon={<TestTube className="h-4 w-4" />}
              reasons={snapshot.testReady ? ['All cross-wire complete'] : ['Cross-wire in progress']}
            />
            <GateStatus
              label="Power Check"
              isReady={snapshot.powerCheckReady ?? false}
              icon={<Zap className="h-4 w-4" />}
              reasons={snapshot.powerCheckReady ? ['All tests passed'] : ['Tests in progress']}
            />
            <GateStatus
              label="BIQ"
              isReady={snapshot.biqReady ?? false}
              icon={<Package className="h-4 w-4" />}
              reasons={snapshot.biqReady ? ['Power check complete'] : ['Power check pending']}
            />
          </div>
        </div>

        {/* Next Recommended Action */}
        {snapshot.nextRecommendedProjectAction && !snapshot.isComplete && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <ChevronRight className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-primary">
                Next Action
              </div>
              <p className="text-sm font-medium text-foreground">
                {snapshot.nextRecommendedProjectAction}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
