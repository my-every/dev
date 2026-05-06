"use client"

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
  type MouseEvent,
} from "react"
import { cn } from "@/lib/utils"
import { useTimeline } from "./timeline-provider"
import {
  getDurationMinutes,
  formatDisplayTime,
  timeToMinutes,
  getCurrentTime,
} from "@/lib/time-utils"
import type {
  Assignment,
  TimeDisplayMode,
  CompletionComparison,
} from "@/types/scheduling"
import { Clock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface EnhancedTimelineSlotProps {
  assignment: Assignment
  timeDisplayMode: TimeDisplayMode
  className?: string
  children?: ReactNode
  color?: string
  isDraggable?: boolean
  isResizable?: boolean
  onMove?: (id: string, newStartTime: string) => void
  onResize?: (id: string, newStartTime: string, newEndTime: string) => void
  onClick?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onTakeover?: (assignment: Assignment) => void
}

interface SlotDimensions {
  left: number
  width: number
  estimateLeft?: number
  estimateWidth?: number
  completionLeft?: number
  completionWidth?: number
}

function getCompletionComparison(
  estimatedEnd: string,
  actualEnd: string
): CompletionComparison {
  const estimatedMinutes = timeToMinutes(estimatedEnd)
  const actualMinutes = timeToMinutes(actualEnd)
  const difference = actualMinutes - estimatedMinutes

  if (difference < -5) return "early"
  if (difference > 5) return "late"
  return "on-time"
}

function formatTimeDifference(estimatedEnd: string, actualEnd: string): string {
  const estimatedMinutes = timeToMinutes(estimatedEnd)
  const actualMinutes = timeToMinutes(actualEnd)
  const difference = Math.abs(actualMinutes - estimatedMinutes)

  if (difference < 5) return "On time"

  const hours = Math.floor(difference / 60)
  const minutes = difference % 60

  const timeStr =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return actualMinutes < estimatedMinutes
    ? `${timeStr} early`
    : `${timeStr} late`
}

export function EnhancedTimelineSlot({
  assignment,
  timeDisplayMode,
  className,
  children,
  color,
  isDraggable = true,
  isResizable = true,
  onMove,
  onResize,
  onClick,
  onDoubleClick,
  onTakeover,
}: EnhancedTimelineSlotProps) {
  const { config, timeToPosition, positionToTime, setIsDragging, zoom } =
    useTimeline()

  const slotRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDraggingSlot, setIsDraggingSlot] = useState(false)
  const [isResizing, setIsResizing] = useState<"start" | "end" | null>(null)
  const dragStartRef = useRef<{
    mouseX: number
    startTime: string
    endTime: string
  } | null>(null)

  // Calculate dimensions based on time display mode
  const dimensions = useMemo<SlotDimensions>(() => {
    const currentTime = getCurrentTime()
    const now = timeToMinutes(currentTime)

    // Base dimensions from scheduled time
    const scheduledStart = assignment.startTime
    const scheduledEnd = assignment.endTime

    // Estimate dimensions (original scheduled)
    const estimatedStart = assignment.estimatedStartTime || scheduledStart
    const estimatedEnd = assignment.estimatedEndTime || scheduledEnd
    const estimateLeft = timeToPosition(estimatedStart)
    const estimateDuration = getDurationMinutes(estimatedStart, estimatedEnd)
    const estimateWidth = estimateDuration * config.pixelsPerMinute * zoom

    // Current time dimensions (actual start to now)
    const actualStart = assignment.actualStartTime || scheduledStart
    const actualStartMinutes = timeToMinutes(actualStart)

    let currentLeft = timeToPosition(actualStart)
    let currentWidth = 0

    if (
      assignment.status === "in-progress" &&
      now >= actualStartMinutes
    ) {
      // Show from actual start to current time
      const currentDuration = now - actualStartMinutes
      currentWidth = Math.max(
        currentDuration * config.pixelsPerMinute * zoom,
        24
      )
    } else if (assignment.status === "scheduled") {
      // Not started yet - show nothing for current mode
      currentWidth = 0
    } else if (
      assignment.status === "completed" &&
      assignment.actualEndTime
    ) {
      // Completed - show actual duration
      const completedDuration = getDurationMinutes(
        actualStart,
        assignment.actualEndTime
      )
      currentWidth = completedDuration * config.pixelsPerMinute * zoom
    }

    // Completion dimensions (if completed)
    let completionLeft = timeToPosition(actualStart)
    let completionWidth = 0

    if (assignment.status === "completed" && assignment.actualEndTime) {
      const completedDuration = getDurationMinutes(
        actualStart,
        assignment.actualEndTime
      )
      completionWidth = completedDuration * config.pixelsPerMinute * zoom
    }

    // Return dimensions based on mode
    switch (timeDisplayMode) {
      case "estimate":
        return {
          left: estimateLeft,
          width: estimateWidth,
          estimateLeft,
          estimateWidth,
        }
      case "current":
        if (assignment.status === "scheduled") {
          // Show estimate with different styling for scheduled items
          return {
            left: estimateLeft,
            width: estimateWidth,
            estimateLeft,
            estimateWidth,
          }
        }
        return {
          left: currentLeft,
          width: currentWidth,
          estimateLeft,
          estimateWidth,
        }
      case "completion":
        if (assignment.status === "completed" && assignment.actualEndTime) {
          return {
            left: completionLeft,
            width: completionWidth,
            estimateLeft,
            estimateWidth,
            completionLeft,
            completionWidth,
          }
        }
        // Fall back to estimate for non-completed
        return {
          left: estimateLeft,
          width: estimateWidth,
          estimateLeft,
          estimateWidth,
        }
      default:
        return {
          left: estimateLeft,
          width: estimateWidth,
        }
    }
  }, [
    assignment,
    timeDisplayMode,
    timeToPosition,
    config.pixelsPerMinute,
    zoom,
  ])

  // Completion comparison
  const completionComparison = useMemo<CompletionComparison | null>(() => {
    if (
      assignment.status !== "completed" ||
      !assignment.actualEndTime ||
      !assignment.estimatedEndTime
    ) {
      return null
    }
    return getCompletionComparison(
      assignment.estimatedEndTime,
      assignment.actualEndTime
    )
  }, [assignment])

  // Can this assignment be taken over?
  const canTakeover = useMemo(() => {
    return (
      assignment.status !== "completed" &&
      assignment.status !== "cancelled" &&
      !assignment.takenOverBy &&
      onTakeover
    )
  }, [assignment, onTakeover])

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isDraggable || isResizing) return
      if ((e.target as HTMLElement).dataset.resizeHandle) return

      e.preventDefault()
      e.stopPropagation()

      dragStartRef.current = {
        mouseX: e.clientX,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
      }
      setIsDraggingSlot(true)
      setIsDragging(true)

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (!dragStartRef.current || !slotRef.current) return

        const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
        const originalLeft = timeToPosition(dragStartRef.current.startTime)
        slotRef.current.style.left = `${originalLeft + deltaX}px`
      }

      const handleMouseUp = (upEvent: globalThis.MouseEvent) => {
        if (!dragStartRef.current) return

        const deltaX = upEvent.clientX - dragStartRef.current.mouseX
        const deltaMinutes = deltaX / (config.pixelsPerMinute * zoom)

        if (Math.abs(deltaMinutes) >= config.snapIntervalMinutes / 2) {
          const newStartTime = positionToTime(
            timeToPosition(dragStartRef.current.startTime) + deltaX
          )
          
          // Validate: don't allow scheduling in the past
          const currentTime = getCurrentTime()
          const currentMinutes = timeToMinutes(currentTime)
          const newStartMinutes = timeToMinutes(newStartTime)
          
          if (newStartMinutes < currentMinutes) {
            // Reset position if trying to move to the past
            if (slotRef.current) {
              slotRef.current.style.left = `${dimensions.left}px`
            }
          } else {
            onMove?.(assignment.id, newStartTime)
          }
        } else if (slotRef.current) {
          slotRef.current.style.left = `${dimensions.left}px`
        }

        dragStartRef.current = null
        setIsDraggingSlot(false)
        setIsDragging(false)

        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [
      isDraggable,
      isResizing,
      assignment,
      config.pixelsPerMinute,
      config.snapIntervalMinutes,
      zoom,
      timeToPosition,
      positionToTime,
      setIsDragging,
      onMove,
      dimensions.left,
    ]
  )

  // Handle resize
  const handleResizeStart = useCallback(
    (e: MouseEvent, edge: "start" | "end") => {
      if (!isResizable) return

      e.preventDefault()
      e.stopPropagation()

      dragStartRef.current = {
        mouseX: e.clientX,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
      }
      setIsResizing(edge)
      setIsDragging(true)

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (!dragStartRef.current || !slotRef.current) return

        const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
        const originalDuration = getDurationMinutes(
          dragStartRef.current.startTime,
          dragStartRef.current.endTime
        )
        const originalWidth = originalDuration * config.pixelsPerMinute * zoom

        if (edge === "start") {
          const originalLeft = timeToPosition(dragStartRef.current.startTime)
          slotRef.current.style.left = `${originalLeft + deltaX}px`
          slotRef.current.style.width = `${originalWidth - deltaX}px`
        } else {
          slotRef.current.style.width = `${originalWidth + deltaX}px`
        }
      }

      const handleMouseUp = (upEvent: globalThis.MouseEvent) => {
        if (!dragStartRef.current) return

        const deltaX = upEvent.clientX - dragStartRef.current.mouseX
        const deltaMinutes = deltaX / (config.pixelsPerMinute * zoom)

        if (Math.abs(deltaMinutes) >= config.snapIntervalMinutes / 2) {
          let newStartTime = dragStartRef.current.startTime
          let newEndTime = dragStartRef.current.endTime

          if (edge === "start") {
            newStartTime = positionToTime(
              timeToPosition(dragStartRef.current.startTime) + deltaX
            )
          } else {
            newEndTime = positionToTime(
              timeToPosition(dragStartRef.current.endTime) + deltaX
            )
          }

          // Validate: don't allow start time to be in the past
          const currentTime = getCurrentTime()
          const currentMinutes = timeToMinutes(currentTime)
          const newStartMinutes = timeToMinutes(newStartTime)
          
          if (newStartMinutes < currentMinutes) {
            // Reset if trying to resize into the past
            if (slotRef.current) {
              slotRef.current.style.left = `${dimensions.left}px`
              slotRef.current.style.width = `${dimensions.width}px`
            }
          } else {
            onResize?.(assignment.id, newStartTime, newEndTime)
          }
        } else if (slotRef.current) {
          slotRef.current.style.left = `${dimensions.left}px`
          slotRef.current.style.width = `${dimensions.width}px`
        }

        dragStartRef.current = null
        setIsResizing(null)
        setIsDragging(false)

        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [
      isResizable,
      assignment,
      config.pixelsPerMinute,
      config.snapIntervalMinutes,
      zoom,
      timeToPosition,
      positionToTime,
      setIsDragging,
      onResize,
      dimensions,
    ]
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSlot) return
      e.stopPropagation()
      onClick?.(assignment.id)
    },
    [isDraggingSlot, onClick, assignment.id]
  )

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onDoubleClick?.(assignment.id)
    },
    [onDoubleClick, assignment.id]
  )

  const handleTakeover = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onTakeover?.(assignment)
    },
    [onTakeover, assignment]
  )

  // Determine slot styling based on mode with distinct backgrounds
  const slotStyles = useMemo(() => {
    const baseColor = color || "hsl(var(--primary))"

    // Base styles with colored left border
    const baseStyles = {
      borderLeftColor: baseColor,
      borderLeftWidth: "4px",
    }

    switch (timeDisplayMode) {
      case "estimate":
        // Estimate: muted background with subtle blur effect
        return {
          ...baseStyles,
          backgroundColor: "oklch(0.97 0 0 / 0.6)", // Light gray with transparency
          backdropFilter: "blur(2px)",
        }
      case "current":
        // Current time: solid white background
        return {
          ...baseStyles,
          backgroundColor: "#ffffff",
        }
      case "completion":
        // Completion: green-100 background with dynamic border color
        let completionBorderColor = baseColor
        if (assignment.status === "completed" && assignment.actualEndTime && assignment.estimatedEndTime) {
          const comparison = getCompletionComparison(assignment.estimatedEndTime, assignment.actualEndTime)
          if (comparison === "early") completionBorderColor = "#16a34a" // green-600
          else if (comparison === "late") completionBorderColor = "#dc2626" // red-600
          else completionBorderColor = "#d97706" // amber-600
        }
        return {
          ...baseStyles,
          backgroundColor: "#dcfce7", // green-100
          borderLeftColor: completionBorderColor,
        }
      default:
        return {
          ...baseStyles,
          backgroundColor: "hsl(var(--card))",
        }
    }
  }, [timeDisplayMode, assignment.status, color, assignment.actualEndTime, assignment.estimatedEndTime])

  // Don't render if width is 0
  if (dimensions.width <= 0) {
    return null
  }

  // In current mode, don't render scheduled (not started) assignments
  if (timeDisplayMode === "current" && assignment.status === "scheduled") {
    return null
  }

  return (
    <>
      {/* Estimate ghost (shown in completion mode for comparison) */}
      {timeDisplayMode === "completion" &&
        assignment.status === "completed" &&
        dimensions.estimateWidth && (
          <div
            className="absolute rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20"
            style={{
              left: dimensions.estimateLeft,
              width: dimensions.estimateWidth,
              top: "50%",
              transform: "translateY(-50%)",
              height: "48px",
            }}
          />
        )}

      {/* Main slot */}
      <div
        ref={slotRef}
        className={cn(
          "absolute flex cursor-pointer items-center rounded-md border border-border px-2 text-sm font-medium text-foreground shadow-sm transition-shadow",
          // Interactive states
          isDraggingSlot && "cursor-grabbing shadow-lg",
          isHovered && !isDraggingSlot && "shadow-md ring-2 ring-primary/20",
          // Takeover indicator
          assignment.isTakeover && "ring-2 ring-amber-400 ring-offset-1",
          className
        )}
        style={{
          left: dimensions.left,
          width: Math.max(dimensions.width, 24),
          top: "50%",
          transform: "translateY(-50%)",
          height: "48px",
          ...slotStyles,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Start resize handle */}
        {isResizable && timeDisplayMode === "estimate" && (
          <div
            data-resize-handle="start"
            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md hover:bg-white/20"
            onMouseDown={(e) => handleResizeStart(e, "start")}
          />
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1">
          {/* Avatar(s) */}
          {assignment.assignees && assignment.assignees.length > 0 && (
            <div className="flex shrink-0 -space-x-2">
              {assignment.assignees.length === 1 ? (
                <Avatar className="h-6 w-6 border-2 border-card">
                  <AvatarImage
                    src={assignment.assignees[0].avatar}
                    alt={assignment.assignees[0].name}
                  />
                  <AvatarFallback className="text-[10px] font-medium">
                    {assignment.assignees[0].name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                // Avatar group for multiple assignees
                <>
                  {assignment.assignees.slice(0, 3).map((assignee) => (
                    <Avatar
                      key={assignee.id}
                      className="h-6 w-6 border-2 border-card"
                    >
                      <AvatarImage src={assignee.avatar} alt={assignee.name} />
                      <AvatarFallback className="text-[10px] font-medium">
                        {assignee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {assignment.assignees.length > 3 && (
                    <Avatar className="h-6 w-6 border-2 border-card bg-muted">
                      <AvatarFallback className="text-[10px] font-medium">
                        +{assignment.assignees.length - 3}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </>
              )}
            </div>
          )}

          {/* Status icon */}
          {timeDisplayMode === "current" &&
            assignment.status === "in-progress" && (
              <Clock className="h-3.5 w-3.5 shrink-0 animate-pulse text-muted-foreground" />
            )}
          {timeDisplayMode === "completion" &&
            assignment.status === "completed" && (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
            )}
          {assignment.isTakeover && (
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col">
            {children || (
              <span className="truncate font-medium">{assignment.projectName}</span>
            )}
            {assignment.assignees &&
              assignment.assignees.length === 1 &&
              dimensions.width > 120 && (
                <span className="truncate text-xs text-muted-foreground">
                  {assignment.assignees[0].name}
                </span>
              )}
          </div>

          {/* Time difference indicator (completion mode) */}
          {timeDisplayMode === "completion" &&
            assignment.status === "completed" &&
            assignment.actualEndTime &&
            assignment.estimatedEndTime &&
            dimensions.width > 100 && (
              <span
                className={cn(
                  "ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                  completionComparison === "early" &&
                    "bg-green-100 text-green-700",
                  completionComparison === "late" && "bg-red-100 text-red-700",
                  completionComparison === "on-time" &&
                    "bg-amber-100 text-amber-700"
                )}
              >
                {formatTimeDifference(
                  assignment.estimatedEndTime,
                  assignment.actualEndTime
                )}
              </span>
            )}
        </div>

        {/* End resize handle */}
        {isResizable && timeDisplayMode === "estimate" && (
          <div
            data-resize-handle="end"
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md hover:bg-white/20"
            onMouseDown={(e) => handleResizeStart(e, "end")}
          />
        )}

        {/* Takeover button (shown on hover for incomplete assignments) */}
        {canTakeover && isHovered && (
          <button
            onClick={handleTakeover}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600"
            title="Take over this assignment"
          >
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </>
  )
}

// Time display mode indicator component
interface TimeDisplayIndicatorProps {
  mode: TimeDisplayMode
  className?: string
}

export function TimeDisplayIndicator({
  mode,
  className,
}: TimeDisplayIndicatorProps) {
  const config = {
    estimate: {
      icon: Clock,
      label: "Estimate",
      description: "Scheduled duration",
    },
    current: {
      icon: AlertCircle,
      label: "Current",
      description: "Actual progress",
    },
    completion: {
      icon: CheckCircle2,
      label: "Completion",
      description: "Final vs estimated",
    },
  }

  const { icon: Icon, label, description } = config[mode]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
