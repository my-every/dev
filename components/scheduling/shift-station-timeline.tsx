"use client"

import { useMemo, useCallback, useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { ShiftId } from "@/types/shifts"
import type { Assignment, Resource, TimeDisplayMode } from "@/types/scheduling"
import { SHIFT_SCHEDULES } from "@/types/shifts"
import { getShiftTimelineBounds, getPriorityColor } from "@/lib/shift-utils"
import { formatDisplayTime, getDurationMinutes, getTimeLabels } from "@/lib/time-utils"
import { TimelineProvider, useTimeline } from "./timeline-provider"
import { EnhancedTimelineSlot } from "./enhanced-timeline-slot"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FloorArea } from "@/types/floor-layout"
import { FLOOR_AREA_META } from "@/types/floor-layout"

// Station type
export interface Station {
  id: string
  name: string
  shortName?: string
  description?: string
  floorArea?: FloorArea
  category?: string
  capacity: number
}

interface ShiftStationTimelineProps {
  shiftId: ShiftId
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
  onStationClick?: (station: Station) => void
  onStationTimeSelect?: (station: Station, time: string) => void
  initialZoom?: number
}

export function ShiftStationTimeline({
  shiftId,
  stations,
  resources,
  assignments,
  timeDisplayMode = "estimate",
  className,
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentTakeover,
  onStationClick,
  onStationTimeSelect,
  initialZoom = 1,
}: ShiftStationTimelineProps) {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const bounds = getShiftTimelineBounds(shiftId)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const [visibleFloorArea, setVisibleFloorArea] = useState<FloorArea | null>(null)

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

  const totalWidth = useMemo(() => {
    const totalMinutes = (config.endHour - config.startHour) * 60
    return totalMinutes * config.pixelsPerMinute * initialZoom
  }, [config.startHour, config.endHour, config.pixelsPerMinute, initialZoom])

  const timeLabels = useMemo(() => {
    return getTimeLabels(config.startHour, config.endHour, 60)
  }, [config.startHour, config.endHour])

  // Get assignments grouped by station
  const assignmentsByStation = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const station of stations) {
      const stationAssignments = assignments.filter((a) => {
        const resource = resources.find((r) => r.id === a.resourceId)
        return resource?.skills.some(skill => 
          skill.toLowerCase() === station.name.toLowerCase() ||
          station.id.toLowerCase().includes(skill.toLowerCase())
        ) || a.resourceId === station.id
      })
      map.set(station.id, stationAssignments)
    }
    return map
  }, [stations, assignments, resources])

  // Initialize floor area from first station
  useEffect(() => {
    if (stations.length > 0 && stations[0]?.floorArea) {
      setVisibleFloorArea(stations[0].floorArea)
    }
  }, [stations])

  // Track scroll position for floor area indicator
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const rowHeight = config.rowHeight

    const handleScroll = () => {
      const currentScrollX = scrollContainer.scrollLeft
      const currentScrollY = scrollContainer.scrollTop

      // Sync header scroll with content
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = currentScrollX
      }

      // Calculate which floor area is visible based on vertical scroll
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
  }, [config.rowHeight, stations])

  return (
    <TimelineProvider config={config} initialZoom={initialZoom}>
      <div className={cn("relative overflow-hidden rounded-lg border bg-card", className)}>
        {/* Shift header */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-muted px-4 py-2">
          <div className="flex items-center gap-3">
            <Badge variant="default">{schedule.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {schedule.standardStart} - {schedule.standardEnd}
            </span>
          </div>
        </div>

        {/* Time header row */}
        <div className="sticky top-10 z-20 flex border-b bg-muted/50">
          {/* Station column header */}
          <div className="sticky left-0 z-30 flex h-10 w-48 shrink-0 items-center gap-2 border-r bg-muted px-3">
            {visibleFloorArea && (
              <div className={cn("h-3 w-3 rounded-full", FLOOR_AREA_META[visibleFloorArea].color)} />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {visibleFloorArea ? FLOOR_AREA_META[visibleFloorArea].label : "Station"}
            </span>
          </div>

          {/* Time labels */}
          <div
            ref={headerScrollRef}
            className="flex overflow-hidden"
            style={{ width: `calc(100% - 192px)` }}
          >
            <div className="relative flex" style={{ width: totalWidth }}>
              {timeLabels.map((time) => (
                <div
                  key={time}
                  className="flex h-10 shrink-0 items-center border-r bg-muted/30"
                  style={{ width: 60 * config.pixelsPerMinute * initialZoom }}
                >
                  <span className="px-2 text-xs font-medium text-muted-foreground">
                    {formatDisplayTime(time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide relative overflow-x-auto overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 400px)" }}
        >
          <div 
            className="flex flex-col"
            style={{ width: totalWidth + 192 }}
          >
            {stations.map((station) => (
              <StationRow
                key={station.id}
                station={station}
                assignments={assignmentsByStation.get(station.id) || []}
                timeDisplayMode={timeDisplayMode}
                totalWidth={totalWidth}
                config={config}
                initialZoom={initialZoom}
                onAssignmentMove={onAssignmentMove}
                onAssignmentResize={onAssignmentResize}
                onAssignmentClick={onAssignmentClick}
                onAssignmentTakeover={onAssignmentTakeover}
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
  config: {
    startHour: number
    endHour: number
    pixelsPerMinute: number
    rowHeight: number
  }
  initialZoom: number
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
  onAssignmentMove,
  onAssignmentResize,
  onAssignmentClick,
  onAssignmentTakeover,
  onStationClick,
  onStationTimeSelect,
}: StationRowProps) {
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

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pixelsPerMinute = config.pixelsPerMinute * initialZoom
    const minutesFromStart = Math.floor(x / pixelsPerMinute)
    const totalMinutes = config.startHour * 60 + minutesFromStart
    const snappedMinutes = Math.round(totalMinutes / 15) * 15
    const hours = Math.floor(snappedMinutes / 60)
    const mins = snappedMinutes % 60
    const time = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`

    onStationTimeSelect?.(station, time)
  }, [config.pixelsPerMinute, config.startHour, initialZoom, onStationTimeSelect, station])

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
    const numMatch = (station.shortName || station.name).match(/\d+/)
    const num = numMatch ? numMatch[0] : "1"
    return `${prefix}${num}`
  }

  const abbrev = getCategoryAbbrev()

  // Get floor area color for border
  const floorAreaColor = station.floorArea 
    ? FLOOR_AREA_META[station.floorArea].color 
    : "bg-primary"

  // Get floor area based avatar colors
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

  // Get border color class for the row
  const borderColorClass = station.floorArea
    ? `border-l-4 ${floorAreaColor.replace("bg-", "border-")}`
    : "border-l-4 border-primary"

  return (
    <div className={cn("flex last:border-b-0 transition-colors", borderColorClass)}>
      {/* Station label */}
      <button 
        className="sticky left-0 z-10 flex w-48 shrink-0 items-center gap-2 border-r border-b bg-background hover:bg-accent/50 transition-colors cursor-pointer text-left"
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

      {/* Row content */}
      <div
        className="relative"
        style={{
          width: totalWidth,
          height: config.rowHeight,
          borderBottom: "1px solid transparent",
        }}
        onClick={handleRowClick}
      >
        {/* Grid lines */}
        <GridLines config={config} initialZoom={initialZoom} />

        {/* Assignment slots */}
        {assignments.map((assignment) => (
          <AssignmentSlotWithTooltip
            key={assignment.id}
            assignment={assignment}
            timeDisplayMode={timeDisplayMode}
            config={config}
            initialZoom={initialZoom}
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

// Grid lines component
function GridLines({ 
  config, 
  initialZoom 
}: { 
  config: { startHour: number; endHour: number; pixelsPerMinute: number }
  initialZoom: number 
}) {
  const hours = config.endHour - config.startHour
  const hourWidth = 60 * config.pixelsPerMinute * initialZoom

  return (
    <div className="absolute inset-0 flex">
      {Array.from({ length: hours }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 border-r border-border/50"
          style={{ width: hourWidth }}
        />
      ))}
    </div>
  )
}

// Assignment slot with tooltip
interface AssignmentSlotWithTooltipProps {
  assignment: Assignment
  timeDisplayMode: TimeDisplayMode
  config: {
    startHour: number
    pixelsPerMinute: number
  }
  initialZoom: number
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
  onMove,
  onResize,
  onClick,
  onTakeover,
}: AssignmentSlotWithTooltipProps) {
  const duration = getDurationMinutes(assignment.startTime, assignment.endTime)

  // Calculate position
  const [startH, startM] = assignment.startTime.split(":").map(Number)
  const startMinutesFromBound = (startH - config.startHour) * 60 + startM
  const left = startMinutesFromBound * config.pixelsPerMinute * initialZoom
  const width = duration * config.pixelsPerMinute * initialZoom

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute top-1 bottom-1"
            style={{ left, width }}
            onClick={(event) => event.stopPropagation()}
          >
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
                "h-full",
                assignment.status === "blocked" && "opacity-80 ring-2 ring-destructive",
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
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Scheduled: </span>
              {formatDisplayTime(assignment.startTime)} -{" "}
              {formatDisplayTime(assignment.endTime)}
              <span className="ml-1">({duration} min)</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-xs capitalize">
                {assignment.status}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {assignment.priority}
              </Badge>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
