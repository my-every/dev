"use client"

import { useMemo, useCallback, useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ShiftId } from "@/types/shifts"
import type { Assignment, Resource, TimeDisplayMode } from "@/types/scheduling"
import { ALL_SHIFT_IDS, SHIFT_SCHEDULES } from "@/types/shifts"
import { getShiftTimelineBounds, getPriorityColor } from "@/lib/shift-utils"
import { formatDisplayTime, getDurationMinutes, getTimeLabels } from "@/lib/time-utils"
import { TimelineProvider, useTimeline } from "./timeline-provider"
import { EnhancedTimelineSlot } from "./enhanced-timeline-slot"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { FloorArea } from "@/types/floor-layout"
import { FLOOR_AREA_META } from "@/types/floor-layout"

// Station type representing a work area
export interface Station {
  id: string
  name: string
  shortName?: string
  description?: string
  icon?: string
  floorArea?: FloorArea
  category?: StationCategory
  capacity: number // How many projects can run simultaneously
}

interface CombinedShiftTimelineProps {
  stations: Station[]
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
  onAssignmentTakeover?: (assignment: Assignment) => void
  onDropFromQueue?: (stationId: string, time: string, data: Record<string, unknown>) => void
  onStationClick?: (station: Station) => void
  onStationTimeSelect?: (station: Station, time: string) => void
  initialZoom?: number
}

export function CombinedShiftTimeline({
  stations,
  resources,
  assignments,
  timeDisplayMode = "estimate",
  className,
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentTakeover,
  onDropFromQueue,
  onStationClick,
  onStationTimeSelect,
  initialZoom = 1,
}: CombinedShiftTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const [activeShiftIndicator, setActiveShiftIndicator] = useState<ShiftId>("1st")
  const [visibleFloorArea, setVisibleFloorArea] = useState<FloorArea | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const hasScrolledToCurrentTime = useRef(false)

  // Calculate combined timeline bounds (4AM to midnight)
  const combinedBounds = useMemo(() => {
    const firstShiftBounds = getShiftTimelineBounds("1st")
    const secondShiftBounds = getShiftTimelineBounds("2nd")
    return {
      startHour: Math.min(firstShiftBounds.startHour, 4), // Start at 4AM
      endHour: Math.max(secondShiftBounds.endHour, 24), // End at midnight
    }
  }, [])

  const config = useMemo(
    () => ({
      startHour: combinedBounds.startHour,
      endHour: combinedBounds.endHour,
      snapIntervalMinutes: 15,
      pixelsPerMinute: 2,
      rowHeight: 72,
      minSlotDurationMinutes: 15,
    }),
    [combinedBounds]
  )

  // Generate time labels for the entire day
  const timeLabels = useMemo(() => {
    return getTimeLabels(combinedBounds.startHour, combinedBounds.endHour, 60)
  }, [combinedBounds])

  // Initialize floor area from first station
  useEffect(() => {
    if (stations.length > 0 && stations[0]?.floorArea) {
      setVisibleFloorArea(stations[0].floorArea)
    }
  }, [stations])
  
  // Set mounted state and initialize current time on client only
  useEffect(() => {
    setIsMounted(true)
    setCurrentTime(new Date())
    
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  
  // Calculate current time position in pixels (only when mounted)
  const currentTimePosition = useMemo(() => {
    if (!currentTime) return 0
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const startMinutes = combinedBounds.startHour * 60
    const pixelsFromStart = (currentMinutes - startMinutes) * config.pixelsPerMinute * initialZoom
    return pixelsFromStart
  }, [currentTime, combinedBounds.startHour, config.pixelsPerMinute, initialZoom])
  
  // Auto-scroll to current time on mount (only once, after client hydration)
  useEffect(() => {
    if (!isMounted) return
    if (hasScrolledToCurrentTime.current) return
    if (!scrollContainerRef.current) return
    if (currentTimePosition <= 0) return
    
    const scrollContainer = scrollContainerRef.current
    const containerWidth = scrollContainer.clientWidth
    const sidebarWidth = 192 // w-48 = 12rem = 192px
    
    // Scroll so current time is roughly 1/3 from the left edge (after sidebar)
    const targetScrollX = Math.max(0, currentTimePosition - (containerWidth - sidebarWidth) / 3)
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollContainer.scrollTo({ left: targetScrollX, behavior: "auto" })
      hasScrolledToCurrentTime.current = true
    })
  }, [isMounted, currentTimePosition])

  // Track scroll position to update shift indicator, floor area indicator, and sync header
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const pixelsPerMinute = config.pixelsPerMinute * initialZoom
    const boundaryPosition = (15 - combinedBounds.startHour) * 60 * pixelsPerMinute
    const rowHeight = config.rowHeight

    const handleScroll = () => {
      const currentScrollX = scrollContainer.scrollLeft
      const currentScrollY = scrollContainer.scrollTop

      // Sync header scroll with content
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = currentScrollX
      }

      // Calculate which shift is visible based on horizontal scroll position
      if (currentScrollX > boundaryPosition - 200) {
        setActiveShiftIndicator("2nd")
      } else {
        setActiveShiftIndicator("1st")
      }

      // Calculate which floor area is visible based on vertical scroll position
      const visibleRowIndex = Math.floor(currentScrollY / rowHeight)
      
      if (stations.length > 0 && visibleRowIndex < stations.length) {
        const visibleStation = stations[visibleRowIndex]
        if (visibleStation?.floorArea) {
          setVisibleFloorArea(visibleStation.floorArea)
        }
      }
    }

    scrollContainer.addEventListener("scroll", handleScroll)
    return () => scrollContainer.removeEventListener("scroll", handleScroll)
  }, [config.pixelsPerMinute, config.rowHeight, initialZoom, combinedBounds.startHour, stations])

  // Get assignments grouped by station
  const assignmentsByStation = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    
    for (const station of stations) {
      // Get all assignments for resources at this station
      // Direct match: resourceId === station.id (e.g., NEW_FLEX_buildUpTable1)
      const stationAssignments = assignments.filter((a) => {
        // Direct station ID match (primary method for dropped assignments)
        if (a.resourceId === station.id) {
          return true
        }
        
        // Legacy: resource skills match station name
        const resource = resources.find((r) => r.id === a.resourceId)
        if (resource?.skills.some(skill => 
          skill.toLowerCase() === station.name.toLowerCase()
        )) {
          return true
        }
        
        return false
      })
      map.set(station.id, stationAssignments)
    }
    return map
  }, [stations, assignments, resources])

  // Calculate total width
  const totalWidth = useMemo(() => {
    const totalMinutes = (combinedBounds.endHour - combinedBounds.startHour) * 60
    return totalMinutes * config.pixelsPerMinute * initialZoom
  }, [combinedBounds, config.pixelsPerMinute, initialZoom])

  return (
    <TimelineProvider config={config} initialZoom={initialZoom}>
      <div className={cn("relative overflow-hidden rounded-lg border bg-card", className)}>
        {/* Sticky shift indicator - shows only the active shift */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-muted px-4 py-2">
          <div className="flex items-center gap-3">
            {activeShiftIndicator === "1st" ? (
              <>
                <Badge variant="default">1st Shift</Badge>
                <span className="text-xs text-muted-foreground">04:00 - 14:30</span>
              </>
            ) : (
              <>
                <Badge variant="default">2nd Shift</Badge>
                <span className="text-xs text-muted-foreground">15:00 - 23:00</span>
              </>
            )}
          </div>
        </div>

        {/* Header row with time labels */}
        <div className="sticky top-10 z-20 flex border-b bg-muted/50">
          {/* Station column header - fixed, shows current floor area */}
          <div className="sticky left-0 z-30 flex h-10 w-48 shrink-0 items-center gap-2 border-r bg-muted px-3">
            {visibleFloorArea && (
              <div className={cn("h-3 w-3 rounded-full", FLOOR_AREA_META[visibleFloorArea].color)} />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {visibleFloorArea ? FLOOR_AREA_META[visibleFloorArea].label : "Station"}
            </span>
          </div>

          {/* Time labels - synced with content scroll */}
          <div
            ref={headerScrollRef}
            className="flex overflow-hidden"
            style={{ width: `calc(100% - 192px)` }}
          >
            <div 
              className="relative flex" 
              style={{ width: totalWidth }}
            >
              {/* Current time marker in header (client-only) */}
              {isMounted && currentTime && currentTimePosition > 0 && currentTimePosition < totalWidth && (
                <div 
                  className="absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
                  style={{ left: currentTimePosition }}
                />
              )}
              {timeLabels.map((time, index) => {
                const hour = parseInt(time.split(":")[0])
                const isShiftBoundary = hour === 15 // 3PM boundary
                const is1stShift = hour < 15
                
                return (
                  <div
                    key={time}
                    className={cn(
                      "flex h-10 shrink-0 items-center border-r",
                      isShiftBoundary && "border-r-2 border-r-primary",
                      is1stShift ? "bg-blue-50/50" : "bg-amber-50/50"
                    )}
                    style={{ width: 60 * config.pixelsPerMinute * initialZoom }}
                  >
                    <span className="px-2 text-xs font-medium text-muted-foreground">
                      {formatDisplayTime(time)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Scrollable content container */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide relative overflow-x-auto overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 350px)" }}
        >
          <div 
            className="relative flex flex-col"
            style={{ width: totalWidth + 192 }} // totalWidth + station column width
          >
            {/* Current time indicator line (client-only to avoid hydration mismatch) */}
            {isMounted && currentTime && currentTimePosition > 0 && currentTimePosition < totalWidth && (
              <div 
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ 
                  left: 192 + currentTimePosition, // sidebar width + position
                  width: 2,
                }}
              >
                {/* Time indicator line */}
                <div className="w-0.5 h-full bg-red-500 shadow-sm" />
                {/* Triangle marker at top */}
                <div 
                  className="absolute -top-1 -left-1.5 w-0 h-0"
                  style={{
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "8px solid rgb(239 68 68)",
                  }}
                />
                {/* Current time label */}
                <div className="absolute -top-6 -translate-x-1/2 left-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium shadow-sm">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            )}
            
            {/* Station rows */}
            {stations.map((station) => (
              <StationRow
                key={station.id}
                station={station}
                assignments={assignmentsByStation.get(station.id) || []}
                timeDisplayMode={timeDisplayMode}
                totalWidth={totalWidth}
                config={config}
                initialZoom={initialZoom}
                combinedBounds={combinedBounds}
                onAssignmentMove={onAssignmentMove}
                onAssignmentResize={onAssignmentResize}
                onAssignmentClick={onAssignmentClick}
                onAssignmentTakeover={onAssignmentTakeover}
                onDropFromQueue={onDropFromQueue}
                onStationClick={onStationClick}
                onStationTimeSelect={onStationTimeSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </TimelineProvider>
  )
}

// Station row component
interface StationRowProps {
  station: Station
  assignments: Assignment[]
  timeDisplayMode: TimeDisplayMode
  totalWidth: number
  config: typeof CONFIG
  initialZoom: number
  combinedBounds: { startHour: number; endHour: number }
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
  onAssignmentTakeover?: (assignment: Assignment) => void
  onDropFromQueue?: (stationId: string, time: string, data: Record<string, unknown>) => void
  onStationClick?: (station: Station) => void
  onStationTimeSelect?: (station: Station, time: string) => void
}

function StationRow({
  station,
  assignments,
  timeDisplayMode,
  totalWidth,
  config,
  initialZoom,
  combinedBounds,
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentTakeover,
  onDropFromQueue,
  onStationClick,
  onStationTimeSelect,
}: StationRowProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const handleMove = useCallback(
    (id: string, newStartTime: string) => {
      onAssignmentMove?.(id, newStartTime, station.id)
    },
    [onAssignmentMove, station.id]
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

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    try {
      const jsonData = e.dataTransfer.getData("application/json")
      
      if (!jsonData) {
        return
      }
      
      const data = JSON.parse(jsonData)
      
      if (data.type !== "priority-queue-item") {
        return
      }
      
      // Calculate drop time based on x position
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pixelsPerMinute = config.pixelsPerMinute * initialZoom
      const minutesFromStart = Math.floor(x / pixelsPerMinute)
      const totalMinutes = combinedBounds.startHour * 60 + minutesFromStart
      
      // Snap to 15-minute intervals
      const snappedMinutes = Math.round(totalMinutes / 15) * 15
      const hours = Math.floor(snappedMinutes / 60)
      const mins = snappedMinutes % 60
      const time = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
      
      onDropFromQueue?.(station.id, time, data)
    } catch (err) {
      console.error("Error in handleDrop:", err)
    }
  }, [config.pixelsPerMinute, initialZoom, combinedBounds.startHour, onDropFromQueue, station.id])

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pixelsPerMinute = config.pixelsPerMinute * initialZoom
    const minutesFromStart = Math.floor(x / pixelsPerMinute)
    const totalMinutes = combinedBounds.startHour * 60 + minutesFromStart
    const snappedMinutes = Math.round(totalMinutes / 15) * 15
    const hours = Math.floor(snappedMinutes / 60)
    const mins = snappedMinutes % 60
    const time = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`

    onStationTimeSelect?.(station, time)
  }, [combinedBounds.startHour, config.pixelsPerMinute, initialZoom, onStationTimeSelect, station])

  // Get category-based abbreviation (B1, W1, T1, S1)
  const getCategoryAbbrev = () => {
    if (!station.category) return "ST"
    const prefixMap: Record<string, string> = {
      BUILD_UP: "B",
      WIRING: "W",
      TEST: "T",
      STATION: "S",
    }
    const prefix = prefixMap[station.category] || "S"
    // Extract number from station id or shortLabel
    const numMatch = (station.shortName || station.name).match(/\d+/)
    const num = numMatch ? numMatch[0] : "1"
    return `${prefix}${num}`
  }

  const abbrev = getCategoryAbbrev()

  // Get floor area color for accent and border
  const floorAreaColor = station.floorArea 
    ? FLOOR_AREA_META[station.floorArea].color 
    : "bg-primary"

  // Get floor area based avatar colors (light bg, dark text)
  const getAvatarColors = () => {
    if (!station.floorArea) return { bg: "bg-gray-200", text: "text-gray-700" }
    const colorMap: Record<FloorArea, { bg: string; text: string }> = {
      NEW_FLEX: { bg: "bg-green-200", text: "text-green-700" },
      ONSKID: { bg: "bg-blue-200", text: "text-blue-700" },
      OFFSKID: { bg: "bg-yellow-200", text: "text-yellow-700" },
      FLOAT: { bg: "bg-purple-200", text: "text-purple-700" },
      NTB: { bg: "bg-red-200", text: "text-red-700" },
    }
    return colorMap[station.floorArea]
  }

  const avatarColors = getAvatarColors()

  // Get border color class for the row - use same color as floor area
  const borderColorClass = station.floorArea
    ? `border-l-4 ${floorAreaColor.replace("bg-", "border-")}`
    : "border-l-4 border-primary"

  return (
    <div 
      className={cn(
        "flex border-b last:border-b-0 transition-colors",
        borderColorClass
      )}
    >
      {/* Station label - sticky to left with floor area accent - CLICKABLE */}
      <button 
        className="sticky left-0 z-10 flex w-48 shrink-0 items-center gap-2 border-r bg-background hover:bg-accent/50 transition-colors cursor-pointer text-left"
        style={{ height: config.rowHeight }}
        onClick={() => onStationClick?.(station)}
      >
        <div className="flex items-center gap-2 px-3">
          <Avatar className={cn("h-8 w-8", avatarColors.bg)}>
            <AvatarFallback className={cn("text-[10px] font-semibold", avatarColors.text)}>
              {abbrev}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {station.shortName || station.name}
            </div>
            {station.description && (
              <div className="truncate text-[10px] text-muted-foreground">
                {station.description}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Row content - shows both shifts side by side - DROP TARGET */}
      <div
        className={cn("relative", isDragOver && "bg-primary/10")}
        style={{
          width: totalWidth,
          height: config.rowHeight,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleRowClick}
      >
        {/* Shift background zones */}
        <ShiftBackgroundZones 
          config={config} 
          initialZoom={initialZoom} 
          combinedBounds={combinedBounds}
        />

        {/* Grid lines */}
        <GridLines 
          config={config} 
          initialZoom={initialZoom} 
          combinedBounds={combinedBounds}
        />

        {/* Assignment slots */}
        {assignments.map((assignment) => (
          <AssignmentSlotWithTooltip
            key={assignment.id}
            assignment={assignment}
            timeDisplayMode={timeDisplayMode}
            config={config}
            initialZoom={initialZoom}
            combinedBounds={combinedBounds}
            onMove={handleMove}
            onResize={handleResize}
            onClick={handleSlotClick}
            onTakeover={onAssignmentTakeover}
          />
        ))}
      </div>
    </div>
  )
}

// Shift background zones
interface ShiftBackgroundZonesProps {
  config: { pixelsPerMinute: number }
  initialZoom: number
  combinedBounds: { startHour: number; endHour: number }
}

function ShiftBackgroundZones({ config, initialZoom, combinedBounds }: ShiftBackgroundZonesProps) {
  const pixelsPerMinute = config.pixelsPerMinute * initialZoom
  
  // 1st shift: 4AM - 3PM (with overtime from 4AM-6AM)
  const firstShiftStart = 0 // From start
  const firstShiftEnd = (15 - combinedBounds.startHour) * 60 * pixelsPerMinute
  
  // 2nd shift: 3PM - midnight
  const secondShiftStart = firstShiftEnd
  const secondShiftEnd = (combinedBounds.endHour - combinedBounds.startHour) * 60 * pixelsPerMinute

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 1st shift zone */}
      <div
        className="absolute top-0 h-full bg-blue-50/30"
        style={{ left: firstShiftStart, width: firstShiftEnd }}
      />
      {/* 2nd shift zone */}
      <div
        className="absolute top-0 h-full bg-amber-50/30"
        style={{ left: secondShiftStart, width: secondShiftEnd - secondShiftStart }}
      />
      {/* Shift boundary line */}
      <div
        className="absolute top-0 h-full w-0.5 bg-primary/30"
        style={{ left: firstShiftEnd }}
      />
    </div>
  )
}

// Grid lines component
interface GridLinesProps {
  config: { pixelsPerMinute: number; startHour: number; endHour: number }
  initialZoom: number
  combinedBounds: { startHour: number; endHour: number }
}

function GridLines({ config, initialZoom, combinedBounds }: GridLinesProps) {
  const pixelsPerMinute = config.pixelsPerMinute * initialZoom
  const hourWidth = 60 * pixelsPerMinute

  const lines = useMemo(() => {
    const result: number[] = []
    for (let h = combinedBounds.startHour; h <= combinedBounds.endHour; h++) {
      const left = (h - combinedBounds.startHour) * hourWidth
      result.push(left)
    }
    return result
  }, [combinedBounds, hourWidth])

  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map((left, index) => {
        const hour = combinedBounds.startHour + index
        const isShiftBoundary = hour === 15
        return (
          <div
            key={index}
            className={cn(
              "absolute top-0 h-full border-l",
              isShiftBoundary 
                ? "border-l-2 border-primary/50" 
                : "border-border/40"
            )}
            style={{ left }}
          />
        )
      })}
    </div>
  )
}

// Assignment slot with tooltip for combined timeline
interface AssignmentSlotWithTooltipProps {
  assignment: Assignment
  timeDisplayMode: TimeDisplayMode
  config: { pixelsPerMinute: number; startHour: number }
  initialZoom: number
  combinedBounds: { startHour: number; endHour: number }
  onMove: (id: string, newStartTime: string) => void
  onResize: (id: string, newStartTime: string, newEndTime: string) => void
  onClick: (id: string) => void
  onTakeover?: (assignment: Assignment) => void
}

function AssignmentSlotWithTooltip({
  assignment,
  timeDisplayMode,
  config,
  initialZoom,
  combinedBounds,
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
          <div onClick={(event) => event.stopPropagation()}>
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

            {/* Shift indicator */}
            <Badge variant="outline" className="text-xs">
              {assignment.shiftId} Shift
            </Badge>

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
