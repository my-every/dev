"use client"

import { useMemo, useCallback, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { ShiftId } from "@/types/shifts"
import type { Assignment, Resource, TimeDisplayMode } from "@/types/scheduling"
import { SHIFT_SCHEDULES } from "@/types/shifts"
import { getShiftTimelineBounds, getPriorityColor } from "@/lib/shift-utils"
import { formatDisplayTime, getDurationMinutes } from "@/lib/time-utils"
import { TimelineProvider, useTimeline } from "./timeline-provider"
import { TimelineGrid, TimelineRow } from "./timeline-grid"
import { EnhancedTimelineSlot } from "./enhanced-timeline-slot"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ShiftTimelineProps {
  shiftId: ShiftId
  resources: Resource[]
  assignments: Assignment[]
  timeDisplayMode?: TimeDisplayMode
  className?: string
  onAssignmentMove?: (
    id: string,
    newStartTime: string,
    newResourceId: string
  ) => void
  onAssignmentResize?: (
    id: string,
    newStartTime: string,
    newEndTime: string
  ) => void
  onAssignmentClick?: (assignment: Assignment) => void
  onAssignmentCreate?: (
    resourceId: string,
    startTime: string,
    endTime: string
  ) => void
  onAssignmentTakeover?: (assignment: Assignment) => void
  initialZoom?: number
}

export function ShiftTimeline({
  shiftId,
  resources,
  assignments,
  timeDisplayMode = "estimate",
  className,
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentCreate,
  onAssignmentTakeover,
  initialZoom = 1,
}: ShiftTimelineProps) {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const bounds = getShiftTimelineBounds(shiftId)

  const config = useMemo(
    () => ({
      startHour: bounds.startHour,
      endHour: bounds.endHour,
      snapIntervalMinutes: 15,
      pixelsPerMinute: 2,
      rowHeight: 72,
      minSlotDurationMinutes: 15,
    }),
    [bounds]
  )

  // Get assignments for each resource
  const assignmentsByResource = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const resource of resources) {
      map.set(
        resource.id,
        assignments.filter((a) => a.resourceId === resource.id)
      )
    }
    return map
  }, [resources, assignments])

  // Count statistics by status
  const statusCounts = useMemo(() => {
    const counts = {
      scheduled: 0,
      "in-progress": 0,
      completed: 0,
      blocked: 0,
      takeovers: 0,
    }
    for (const a of assignments) {
      if (a.status in counts) {
        counts[a.status as keyof typeof counts]++
      }
      if (a.isTakeover) {
        counts.takeovers++
      }
    }
    return counts
  }, [assignments])

  return (
    <div className={cn("space-y-2", className)}>
      {/* Shift header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{schedule.label}</h3>
          <Badge variant="outline" className="text-xs">
            {schedule.standardStart} - {schedule.standardEnd}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {statusCounts["in-progress"] > 0 && (
            <Badge variant="default" className="text-xs">
              {statusCounts["in-progress"]} active
            </Badge>
          )}
          {statusCounts.completed > 0 && (
            <Badge variant="secondary" className="text-xs">
              {statusCounts.completed} done
            </Badge>
          )}
          {statusCounts.takeovers > 0 && (
            <Badge
              variant="outline"
              className="border-amber-400 text-xs text-amber-600"
            >
              {statusCounts.takeovers} takeover
              {statusCounts.takeovers !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Timeline */}
      <TimelineProvider config={config} initialZoom={initialZoom}>
        <TimelineGrid columnLabel="Station" showCurrentTime>
          {/* Shift window overlay */}
          <ShiftWindowsOverlay shiftId={shiftId} />

          {/* Resource rows */}
          {resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              assignments={assignmentsByResource.get(resource.id) || []}
              timeDisplayMode={timeDisplayMode}
              onAssignmentMove={onAssignmentMove}
              onAssignmentResize={onAssignmentResize}
              onAssignmentClick={onAssignmentClick}
              onAssignmentCreate={onAssignmentCreate}
              onAssignmentTakeover={onAssignmentTakeover}
            />
          ))}
        </TimelineGrid>
      </TimelineProvider>
    </div>
  )
}

// Shift windows overlay component
interface ShiftWindowsOverlayProps {
  shiftId: ShiftId
}

function ShiftWindowsOverlay({ shiftId }: ShiftWindowsOverlayProps) {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const { timeToPosition, config, zoom } = useTimeline()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ left: 160 }}>
      {schedule.windows.map((window) => {
        const left = timeToPosition(window.startTime)
        const duration = getDurationMinutes(window.startTime, window.endTime)
        const width = duration * config.pixelsPerMinute * zoom

        return (
          <div
            key={window.id}
            className={cn(
              "absolute top-0 h-full opacity-10",
              window.type === "overtime" ? "bg-amber-500" : "bg-primary"
            )}
            style={{ left, width }}
          />
        )
      })}
    </div>
  )
}

// Resource row component
interface ResourceRowProps {
  resource: Resource
  assignments: Assignment[]
  timeDisplayMode: TimeDisplayMode
  onAssignmentMove?: (
    id: string,
    newStartTime: string,
    newResourceId: string
  ) => void
  onAssignmentResize?: (
    id: string,
    newStartTime: string,
    newEndTime: string
  ) => void
  onAssignmentClick?: (assignment: Assignment) => void
  onAssignmentCreate?: (
    resourceId: string,
    startTime: string,
    endTime: string
  ) => void
  onAssignmentTakeover?: (assignment: Assignment) => void
}

function ResourceRow({
  resource,
  assignments,
  timeDisplayMode,
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentCreate,
  onAssignmentTakeover,
}: ResourceRowProps) {
  const handleMove = useCallback(
    (id: string, newStartTime: string) => {
      onAssignmentMove?.(id, newStartTime, resource.id)
    },
    [onAssignmentMove, resource.id]
  )

  const handleResize = useCallback(
    (id: string, newStartTime: string, newEndTime: string) => {
      onAssignmentResize?.(id, newStartTime, newEndTime)
    },
    [onAssignmentResize]
  )

  const handleSlotClick = useCallback(
    (id: string) => {
      const assignment = assignments.find((a) => a.id === id)
      if (assignment) {
        onAssignmentClick?.(assignment)
      }
    },
    [assignments, onAssignmentClick]
  )

  // Get initials from name
  const initials = resource.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <TimelineRow
      label={resource.name}
      sublabel={resource.skills.slice(0, 2).join(", ")}
      avatar={
        <Avatar className="h-8 w-8">
          <AvatarImage src={resource.avatar} alt={resource.name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      }
    >
      {assignments.map((assignment) => (
        <AssignmentSlotWithTooltip
          key={assignment.id}
          assignment={assignment}
          timeDisplayMode={timeDisplayMode}
          onMove={handleMove}
          onResize={handleResize}
          onClick={handleSlotClick}
          onTakeover={onAssignmentTakeover}
        />
      ))}
    </TimelineRow>
  )
}

// Assignment slot with tooltip
interface AssignmentSlotWithTooltipProps {
  assignment: Assignment
  timeDisplayMode: TimeDisplayMode
  onMove: (id: string, newStartTime: string) => void
  onResize: (id: string, newStartTime: string, newEndTime: string) => void
  onClick: (id: string) => void
  onTakeover?: (assignment: Assignment) => void
}

function AssignmentSlotWithTooltip({
  assignment,
  timeDisplayMode,
  onMove,
  onResize,
  onClick,
  onTakeover,
}: AssignmentSlotWithTooltipProps) {
  const duration = getDurationMinutes(assignment.startTime, assignment.endTime)
  const estimatedDuration =
    assignment.estimatedStartTime && assignment.estimatedEndTime
      ? getDurationMinutes(
          assignment.estimatedStartTime,
          assignment.estimatedEndTime
        )
      : duration

  // Calculate time comparison for tooltip
  let timeComparison = ""
  if (
    assignment.status === "completed" &&
    assignment.actualEndTime &&
    assignment.estimatedEndTime
  ) {
    const estimatedEnd = assignment.estimatedEndTime
    const actualEnd = assignment.actualEndTime
    const [estH, estM] = estimatedEnd.split(":").map(Number)
    const [actH, actM] = actualEnd.split(":").map(Number)
    const diffMinutes = actH * 60 + actM - (estH * 60 + estM)

    if (diffMinutes < -5) {
      timeComparison = `${Math.abs(diffMinutes)}min early`
    } else if (diffMinutes > 5) {
      timeComparison = `${diffMinutes}min late`
    } else {
      timeComparison = "On time"
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <EnhancedTimelineSlot
              assignment={assignment}
              timeDisplayMode={timeDisplayMode}
              color={assignment.color || getPriorityColor(assignment.priority)}
              onMove={onMove}
              onResize={onResize}
              onClick={onClick}
              onTakeover={onTakeover}
              isDraggable={timeDisplayMode === "estimate"}
              isResizable={timeDisplayMode === "estimate"}
              className={cn(
                assignment.status === "blocked" &&
                  "opacity-80 ring-2 ring-destructive",
                assignment.isOvertime && "ring-1 ring-amber-400"
              )}
            >
              <span className="truncate">{assignment.projectName}</span>
            </EnhancedTimelineSlot>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium">{assignment.projectName}</p>

            {/* Scheduled time */}
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Scheduled: </span>
              {formatDisplayTime(assignment.startTime)} -{" "}
              {formatDisplayTime(assignment.endTime)}
              <span className="ml-1">({duration} min)</span>
            </div>

            {/* Estimated time (if different) */}
            {assignment.estimatedStartTime &&
              (assignment.estimatedStartTime !== assignment.startTime ||
                assignment.estimatedEndTime !== assignment.endTime) && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Estimate: </span>
                  {formatDisplayTime(assignment.estimatedStartTime)} -{" "}
                  {formatDisplayTime(assignment.estimatedEndTime || "")}
                  <span className="ml-1">({estimatedDuration} min)</span>
                </div>
              )}

            {/* Actual time (if started/completed) */}
            {assignment.actualStartTime && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Actual: </span>
                {formatDisplayTime(assignment.actualStartTime)}
                {assignment.actualEndTime &&
                  ` - ${formatDisplayTime(assignment.actualEndTime)}`}
                {timeComparison && (
                  <span
                    className={cn(
                      "ml-2 font-medium",
                      timeComparison.includes("early") && "text-green-600",
                      timeComparison.includes("late") && "text-red-600"
                    )}
                  >
                    ({timeComparison})
                  </span>
                )}
              </div>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-xs capitalize">
                {assignment.status}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {assignment.priority}
              </Badge>
              {assignment.isOvertime && (
                <Badge variant="secondary" className="text-xs">
                  Overtime
                </Badge>
              )}
              {assignment.isTakeover && (
                <Badge
                  variant="outline"
                  className="border-amber-400 text-xs text-amber-600"
                >
                  Takeover
                </Badge>
              )}
            </div>

            {/* Notes */}
            {assignment.notes && (
              <p className="border-t pt-1 text-xs text-muted-foreground">
                {assignment.notes}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
