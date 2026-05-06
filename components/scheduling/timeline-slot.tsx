"use client"

import {
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type MouseEvent,
} from "react"
import { cn } from "@/lib/utils"
import { useTimeline } from "./timeline-provider"
import { getDurationMinutes, formatDisplayTime, timeToMinutes, getCurrentTime } from "@/lib/time-utils"

interface TimelineSlotProps {
  id: string
  startTime: string
  endTime: string
  className?: string
  children?: ReactNode
  color?: string
  isDraggable?: boolean
  isResizable?: boolean
  onMove?: (id: string, newStartTime: string) => void
  onResize?: (id: string, newStartTime: string, newEndTime: string) => void
  onClick?: (id: string) => void
  onDoubleClick?: (id: string) => void
}

export function TimelineSlot({
  id,
  startTime,
  endTime,
  className,
  children,
  color,
  isDraggable = true,
  isResizable = true,
  onMove,
  onResize,
  onClick,
  onDoubleClick,
}: TimelineSlotProps) {
  const {
    config,
    timeToPosition,
    positionToTime,
    setIsDragging,
    zoom,
  } = useTimeline()

  const slotRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDraggingSlot, setIsDraggingSlot] = useState(false)
  const [isResizing, setIsResizing] = useState<"start" | "end" | null>(null)
  const dragStartRef = useRef<{
    mouseX: number
    startTime: string
    endTime: string
  } | null>(null)

  // Calculate position and width
  const left = timeToPosition(startTime)
  const duration = getDurationMinutes(startTime, endTime)
  const width = duration * config.pixelsPerMinute * zoom

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isDraggable || isResizing) return
      if ((e.target as HTMLElement).dataset.resizeHandle) return

      e.preventDefault()
      e.stopPropagation()

      dragStartRef.current = {
        mouseX: e.clientX,
        startTime,
        endTime,
      }
      setIsDraggingSlot(true)
      setIsDragging(true)

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (!dragStartRef.current || !slotRef.current) return

        const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
        const deltaMinutes = deltaX / (config.pixelsPerMinute * zoom)
        
        // This is just visual feedback during drag
        // Actual position update happens on mouse up
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
              slotRef.current.style.left = `${left}px`
            }
          } else {
            onMove?.(id, newStartTime)
          }
        } else {
          // Reset position if not moved enough
          if (slotRef.current) {
            slotRef.current.style.left = `${left}px`
          }
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
      startTime,
      endTime,
      config.pixelsPerMinute,
      config.snapIntervalMinutes,
      zoom,
      timeToPosition,
      positionToTime,
      setIsDragging,
      onMove,
      id,
      left,
    ]
  )

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: MouseEvent, edge: "start" | "end") => {
      if (!isResizable) return

      e.preventDefault()
      e.stopPropagation()

      dragStartRef.current = {
        mouseX: e.clientX,
        startTime,
        endTime,
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
              slotRef.current.style.left = `${left}px`
              slotRef.current.style.width = `${width}px`
            }
          } else {
            onResize?.(id, newStartTime, newEndTime)
          }
          } else {
          // Reset if not resized enough
          if (slotRef.current) {
            slotRef.current.style.left = `${left}px`
            slotRef.current.style.width = `${width}px`
          }
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
      startTime,
      endTime,
      config.pixelsPerMinute,
      config.snapIntervalMinutes,
      zoom,
      timeToPosition,
      positionToTime,
      setIsDragging,
      onResize,
      id,
      left,
      width,
    ]
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSlot) return
      e.stopPropagation()
      onClick?.(id)
    },
    [isDraggingSlot, onClick, id]
  )

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onDoubleClick?.(id)
    },
    [onDoubleClick, id]
  )

  return (
    <div
      ref={slotRef}
      className={cn(
        "absolute top-1 bottom-1 flex cursor-pointer items-center rounded-md px-2 text-sm font-medium text-white shadow-sm transition-shadow",
        isDraggingSlot && "cursor-grabbing shadow-lg",
        isHovered && !isDraggingSlot && "shadow-md",
        className
      )}
      style={{
        left,
        width: Math.max(width, 24),
        backgroundColor: color || "hsl(var(--primary))",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Start resize handle */}
      {isResizable && (
        <div
          data-resize-handle="start"
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md hover:bg-white/20"
          onMouseDown={(e) => handleResizeStart(e, "start")}
        />
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {children || (
          <span className="truncate">
            {formatDisplayTime(startTime)} - {formatDisplayTime(endTime)}
          </span>
        )}
      </div>

      {/* End resize handle */}
      {isResizable && (
        <div
          data-resize-handle="end"
          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md hover:bg-white/20"
          onMouseDown={(e) => handleResizeStart(e, "end")}
        />
      )}
    </div>
  )
}
