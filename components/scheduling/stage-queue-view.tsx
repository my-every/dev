"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, Users, GripVertical, AlertTriangle } from "lucide-react"
import type { FlattenedAssignment, PriorityLevel } from "@/types/project-manifest"
import type { AssignmentStageId, AssignmentStageCategory } from "@/types/d380-assignment-stages"
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages"
import { groupByStage, formatMinutesToTime } from "@/lib/services"
import { FLOOR_AREA_META, type FloorArea } from "@/types/floor-layout"

// ============================================================================
// Stage Column Card Component
// ============================================================================

interface StageColumnCardProps {
  item: FlattenedAssignment
  onDragStart?: (item: FlattenedAssignment) => void
  onDragEnd?: () => void
  onClick?: (item: FlattenedAssignment) => void
}

function StageColumnCard({
  item,
  onDragStart,
  onDragEnd,
  onClick,
}: StageColumnCardProps) {
  const { assignment, project, priority } = item

  const priorityColors: Record<PriorityLevel, string> = {
    critical: "border-l-red-500 bg-red-50/50",
    high: "border-l-orange-500 bg-orange-50/50",
    medium: "border-l-yellow-500",
    low: "border-l-green-500",
  }

  const lwcMeta = FLOOR_AREA_META[project.lwcType as FloorArea]

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-md border border-l-4 bg-card p-2 shadow-sm transition-all hover:shadow-md",
        priorityColors[priority.level]
      )}
      draggable
      onDragStart={() => onDragStart?.(item)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onClick?.(item)}
    >
      {/* Header */}
      <div className="flex items-start gap-1">
        <GripVertical className="mt-0.5 h-3 w-3 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">
            {assignment.sheetName}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {project.name}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-1.5 flex items-center gap-1.5">
        {/* LWC indicator */}
        {lwcMeta && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-white",
                    lwcMeta.color
                  )}
                >
                  {lwcMeta.label.charAt(0)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{lwcMeta.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Time remaining */}
        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>
            {priority.remainingMinutes > 0
              ? formatMinutesToTime(priority.remainingMinutes)
              : "!"}
          </span>
        </div>

        {/* Priority indicator for critical/high */}
        {(priority.level === "critical" || priority.level === "high") && (
          <AlertTriangle
            className={cn(
              "ml-auto h-3 w-3",
              priority.level === "critical" ? "text-red-500" : "text-orange-500"
            )}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Stage Column Component
// ============================================================================

interface StageColumnProps {
  stageId: AssignmentStageId
  items: FlattenedAssignment[]
  onDragStart?: (item: FlattenedAssignment) => void
  onDragEnd?: () => void
  onDrop?: (stageId: AssignmentStageId) => void
  onItemClick?: (item: FlattenedAssignment) => void
  isDragOver?: boolean
  className?: string
}

function StageColumn({
  stageId,
  items,
  onDragStart,
  onDragEnd,
  onDrop,
  onItemClick,
  isDragOver,
  className,
}: StageColumnProps) {
  const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === stageId)
  if (!stageDef) return null

  const categoryColors: Record<AssignmentStageCategory, string> = {
    queue: "bg-blue-100 text-blue-800",
    build: "bg-purple-100 text-purple-800",
    verify: "bg-amber-100 text-amber-800",
    test: "bg-cyan-100 text-cyan-800",
    final: "bg-emerald-100 text-emerald-800",
  }

  // Count by priority
  const criticalCount = items.filter((i) => i.priority.level === "critical").length
  const highCount = items.filter((i) => i.priority.level === "high").length

  return (
    <div
      className={cn(
        "flex h-full w-56 shrink-0 flex-col rounded-lg border bg-muted/30",
        isDragOver && "ring-2 ring-primary ring-offset-2",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
      }}
      onDrop={() => onDrop?.(stageId)}
    >
      {/* Column Header */}
      <div className="shrink-0 border-b bg-card/50 p-2">
        <div className="flex items-center justify-between">
          <Badge
            size="sm"
            color="gray"
            className={cn("text-[10px]", categoryColors[stageDef.category])}
          >
            {stageDef.shortLabel}
          </Badge>
          <div className="flex items-center gap-1">
            {criticalCount > 0 && (
              <Badge size="sm" color="red" className="h-4 px-1 text-[10px]">
                {criticalCount}
              </Badge>
            )}
            {highCount > 0 && (
              <Badge size="sm" color="orange" className="h-4 px-1 text-[10px]">
                {highCount}
              </Badge>
            )}
            <Badge variant="dot" size="sm" className="h-4 px-1 text-[10px]">
              {items.length}
            </Badge>
          </div>
        </div>
        <p className="mt-1 text-xs font-medium">{stageDef.label}</p>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {items.map((item) => (
            <StageColumnCard
              key={`${item.project.id}-${item.assignment.sheetSlug}`}
              item={item}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={onItemClick}
            />
          ))}
          {items.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground">
              No assignments
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// Main Stage Queue View Component
// ============================================================================

interface StageQueueViewProps {
  assignments: FlattenedAssignment[]
  showQueueStagesOnly?: boolean
  onDragStart?: (item: FlattenedAssignment) => void
  onStageDrop?: (item: FlattenedAssignment, newStage: AssignmentStageId) => void
  onItemClick?: (item: FlattenedAssignment) => void
  className?: string
}

export function StageQueueView({
  assignments,
  showQueueStagesOnly = false,
  onDragStart,
  onStageDrop,
  onItemClick,
  className,
}: StageQueueViewProps) {
  const [draggedItem, setDraggedItem] = useState<FlattenedAssignment | null>(null)
  const [dragOverStage, setDragOverStage] = useState<AssignmentStageId | null>(null)

  // Group assignments by stage
  const groupedByStage = useMemo(() => {
    return groupByStage(assignments)
  }, [assignments])

  // Filter stages to show
  const stagesToShow = useMemo(() => {
    let stages = ASSIGNMENT_STAGES
    if (showQueueStagesOnly) {
      stages = stages.filter((s) => s.isQueue || s.category === "build")
    }
    return stages
  }, [showQueueStagesOnly])

  const handleDragStart = (item: FlattenedAssignment) => {
    setDraggedItem(item)
    onDragStart?.(item)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverStage(null)
  }

  const handleDrop = (stageId: AssignmentStageId) => {
    if (draggedItem) {
      onStageDrop?.(draggedItem, stageId)
    }
    handleDragEnd()
  }

  // Calculate summary stats
  const totalAssignments = assignments.length
  const criticalCount = assignments.filter((a) => a.priority.level === "critical").length
  const highCount = assignments.filter((a) => a.priority.level === "high").length

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Stage Queue
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge color="red" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-orange-500 hover:bg-orange-600">
                {highCount} High
              </Badge>
            )}
            <Badge variant="dot">{totalAssignments} Total</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="flex gap-3 p-4">
            {stagesToShow.map((stage) => (
              <StageColumn
                key={stage.id}
                stageId={stage.id}
                items={groupedByStage[stage.id] ?? []}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onItemClick={onItemClick}
                isDragOver={dragOverStage === stage.id}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
