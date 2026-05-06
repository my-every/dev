"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Clock,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react"
import type { ProjectManifest, PriorityLevel } from "@/types/project-manifest"
import { formatMinutesToTime } from "@/lib/services"
import { FLOOR_AREA_META, type FloorArea } from "@/types/floor-layout"

// ============================================================================
// Priority Indicator Component
// ============================================================================

interface PriorityIndicatorProps {
  level: PriorityLevel
  className?: string
}

function PriorityIndicator({ level, className }: PriorityIndicatorProps) {
  const config: Record<PriorityLevel, { bg: string; label: string }> = {
    critical: { bg: "bg-red-500", label: "Critical" },
    high: { bg: "bg-orange-500", label: "High" },
    medium: { bg: "bg-yellow-500", label: "Medium" },
    low: { bg: "bg-green-500", label: "Low" },
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              config[level].bg,
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{config[level].label} Priority</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Assignment Status Counts Component
// ============================================================================

interface StatusCountsProps {
  completed: number
  inProgress: number
  blocked: number
  notStarted: number
}

function StatusCounts({ completed, inProgress, blocked, notStarted }: StatusCountsProps) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>{completed}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{completed} completed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-blue-600">
              <Circle className="h-3 w-3 fill-current" />
              <span>{inProgress}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{inProgress} in progress</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {blocked > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                <span>{blocked}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{blocked} blocked</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Circle className="h-3 w-3" />
              <span>{notStarted}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{notStarted} not started</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// ============================================================================
// Main Project Manifest Card Component
// ============================================================================

interface ProjectManifestCardProps {
  manifest: ProjectManifest
  onClick?: (manifest: ProjectManifest) => void
  className?: string
}

export function ProjectManifestCard({
  manifest,
  onClick,
  className,
}: ProjectManifestCardProps) {
  const { aggregates } = manifest
  const lwcMeta = FLOOR_AREA_META[manifest.lwcType as FloorArea]

  // Format due date
  const dueDate = new Date(manifest.dueDate)
  const dueDateStr = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  // Calculate days until due
  const now = new Date()
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        aggregates?.highestPriority === "critical" && "border-red-300",
        aggregates?.highestPriority === "high" && "border-orange-300",
        className
      )}
      onClick={() => onClick?.(manifest)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* LWC Badge */}
            {lwcMeta && (
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white",
                  lwcMeta.color
                )}
              >
                {lwcMeta.label.charAt(0)}
              </div>
            )}
            <div>
              <CardTitle className="text-sm">{manifest.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {manifest.pdNumber} | Rev {manifest.revision}
              </p>
            </div>
          </div>

          {/* Priority indicator */}
          {aggregates && (
            <PriorityIndicator level={aggregates.highestPriority} />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{aggregates?.overallProgress ?? 0}%</span>
          </div>
          <Progress value={aggregates?.overallProgress ?? 0} className="h-1.5" />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          {/* Assignment counts */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="h-3 w-3" />
            <span>
              {aggregates?.completedAssignments ?? 0}/{aggregates?.totalAssignments ?? 0}
            </span>
          </div>

          {/* Status counts */}
          {aggregates && (
            <StatusCounts
              completed={aggregates.completedAssignments}
              inProgress={aggregates.inProgressAssignments}
              blocked={aggregates.blockedAssignments}
              notStarted={
                aggregates.totalAssignments -
                aggregates.completedAssignments -
                aggregates.inProgressAssignments -
                aggregates.blockedAssignments
              }
            />
          )}
        </div>

        {/* Time and date row */}
        <div className="flex items-center justify-between border-t pt-2">
          {/* Time remaining */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {aggregates
                ? formatMinutesToTime(aggregates.totalRemainingMinutes)
                : "0m"}{" "}
              remaining
            </span>
          </div>

          {/* Due date */}
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              daysUntilDue < 0 && "text-red-600",
              daysUntilDue >= 0 && daysUntilDue <= 2 && "text-orange-600",
              daysUntilDue > 2 && "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3" />
            <span>
              {daysUntilDue < 0
                ? `${Math.abs(daysUntilDue)}d overdue`
                : daysUntilDue === 0
                  ? "Due today"
                  : `Due ${dueDateStr}`}
            </span>
          </div>
        </div>

        {/* Priority breakdown */}
        {aggregates && (
          <div className="flex items-center gap-2 border-t pt-2">
            {aggregates.priorityCounts.critical > 0 && (
              <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
                <AlertCircle className="h-2.5 w-2.5" />
                {aggregates.priorityCounts.critical}
              </Badge>
            )}
            {aggregates.priorityCounts.high > 0 && (
              <Badge className="h-5 bg-orange-500 px-1.5 text-[10px] hover:bg-orange-600">
                {aggregates.priorityCounts.high} high
              </Badge>
            )}
            {aggregates.priorityCounts.medium > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {aggregates.priorityCounts.medium} med
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Project Manifest List Component
// ============================================================================

interface ProjectManifestListProps {
  manifests: ProjectManifest[]
  onManifestClick?: (manifest: ProjectManifest) => void
  className?: string
}

export function ProjectManifestList({
  manifests,
  onManifestClick,
  className,
}: ProjectManifestListProps) {
  // Sort by highest priority
  const sortedManifests = [...manifests].sort((a, b) => {
    const priorityOrder: PriorityLevel[] = ["critical", "high", "medium", "low"]
    const aIndex = priorityOrder.indexOf(a.aggregates?.highestPriority ?? "low")
    const bIndex = priorityOrder.indexOf(b.aggregates?.highestPriority ?? "low")
    return aIndex - bIndex
  })

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {sortedManifests.map((manifest) => (
        <ProjectManifestCard
          key={manifest.id}
          manifest={manifest}
          onClick={onManifestClick}
        />
      ))}
    </div>
  )
}
