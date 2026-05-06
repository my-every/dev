"use client"

import { useState, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { ShiftId } from "@/types/shifts"
import type { Assignment, TimeDisplayMode } from "@/types/scheduling"
import { ALL_SHIFT_IDS, SHIFT_SCHEDULES } from "@/types/shifts"
import { useScheduling } from "@/contexts/scheduling-context"
import { CombinedShiftTimeline, type Station } from "./combined-shift-timeline"
import { ShiftStationTimeline } from "./shift-station-timeline"
import { TakeoverDialog } from "./takeover-dialog"
import {
  TimeDisplaySplitButton,
  TimeDisplayLegend,
} from "./time-display-filter"
import {
  LWCNavTabs,
  AvailabilityFilterButton,
  type AvailabilityFilter,
} from "./lwc-filter"
import {
  type FloorArea,
  type StationDefinition,
  FLOOR_AREA_META,
  STATION_CATEGORY_COLORS,
} from "@/types/floor-layout"
import {
  LWC_DEFAULT_FILTERS,
  getFilteredStations,
} from "@/types/lwc-config"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react"
import { formatDateDisplay } from "@/lib/time-utils"
import { getShiftForTime } from "@/lib/services/timeline-bridge"

interface ProjectSchedulerProps {
  onDropFromQueue?: (stationId: string, time: string, data: Record<string, unknown>) => void
  onStationClick?: (station: Station) => void
  onStationTimeSelect?: (station: Station, time: string) => void
  className?: string
  onAssignmentClick?: (assignment: Assignment) => void
  onAssignmentMovePersist?: (assignmentId: string, resourceId: string, startTime: string, shiftId: ShiftId) => void
  onAssignmentResizePersist?: (assignmentId: string, startTime: string, endTime: string, shiftId: ShiftId) => void
}

export function ProjectScheduler({
  className,
  onAssignmentClick,
  onDropFromQueue,
  onStationClick,
  onStationTimeSelect,
  onAssignmentMovePersist,
  onAssignmentResizePersist,
}: ProjectSchedulerProps) {
  const {
    resources,
    filteredAssignments,
    selectedDate,
    activeShift,
    setSelectedDate,
    setActiveShift,
    moveAssignment,
    updateAssignment,
    createAssignment,
  } = useScheduling()

  const [zoom, setZoom] = useState(1)
  const [timeDisplayMode, setTimeDisplayMode] =
    useState<TimeDisplayMode>("estimate")
  const [showLegend, setShowLegend] = useState(false)

  // LWC Navigation state - single area selection (tabs instead of multi-select)
  const [selectedFloorArea, setSelectedFloorArea] = useState<FloorArea>("NEW_FLEX")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")

  // Get stations from LWC config based on selected floor area (single selection)
  const lwcStations = useMemo(() => {
    return getFilteredStations([selectedFloorArea])
  }, [selectedFloorArea])

  // Convert LWC StationDefinition to Station type for CombinedShiftTimeline
  const stations: Station[] = useMemo(() => {
    return lwcStations.map((stationDef: StationDefinition) => ({
      id: stationDef.id,
      name: stationDef.label,
      shortName: stationDef.shortLabel,
      description: `${FLOOR_AREA_META[stationDef.floorArea].label} - ${stationDef.category}`,
      floorArea: stationDef.floorArea,
      category: stationDef.category,
      capacity: stationDef.category === "TEST" ? 1 : 2,
    }))
  }, [lwcStations])

  // Filter stations by availability (based on current assignments)
  const filteredStations = useMemo(() => {
    if (availabilityFilter === "all") return stations

    const now = new Date()
    const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

    return stations.filter((station) => {
      // Check if station has any active assignment right now
      const hasActiveAssignment = filteredAssignments.some((a) => {
        const matchesStation = a.resourceId === station.id || 
          resources.some(r => r.id === a.resourceId && r.skills.some(s => 
            s.toLowerCase() === station.name.toLowerCase() ||
            station.id.toLowerCase().includes(s.toLowerCase())
          ))
        const isActive = a.status === "in-progress" || 
          (a.status === "scheduled" && a.startTime <= currentTimeStr && a.endTime > currentTimeStr)
        return matchesStation && isActive
      })

      if (availabilityFilter === "available") return !hasActiveAssignment
      if (availabilityFilter === "occupied") return hasActiveAssignment
      return true
    })
  }, [stations, availabilityFilter, filteredAssignments, resources])

  // Takeover dialog state
  const [takeoverDialogOpen, setTakeoverDialogOpen] = useState(false)
  const [assignmentToTakeover, setAssignmentToTakeover] =
    useState<Assignment | null>(null)

  // Filter resources by shift
  const resourcesByShift = (shiftId: ShiftId) =>
    resources.filter((r) => r.shiftId === shiftId && r.isActive)

  // Filter assignments by shift
  const assignmentsByShift = (shiftId: ShiftId) =>
    filteredAssignments.filter((a) => a.shiftId === shiftId)

  // Navigation handlers
  const goToPreviousDay = useCallback(() => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }, [selectedDate, setSelectedDate])

  const goToNextDay = useCallback(() => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }, [selectedDate, setSelectedDate])

  const goToToday = useCallback(() => {
    setSelectedDate(new Date())
  }, [setSelectedDate])

  // Assignment handlers
  const handleAssignmentMove = useCallback(
    (id: string, newStartTime: string, newResourceId: string) => {
      moveAssignment(id, newStartTime, newResourceId)
      onAssignmentMovePersist?.(id, newResourceId, newStartTime, getShiftForTime(newStartTime))
    },
    [moveAssignment, onAssignmentMovePersist]
  )

  const handleAssignmentResize = useCallback(
    (id: string, newStartTime: string, newEndTime: string) => {
      updateAssignment(id, { startTime: newStartTime, endTime: newEndTime })
      onAssignmentResizePersist?.(id, newStartTime, newEndTime, getShiftForTime(newStartTime))
    },
    [onAssignmentResizePersist, updateAssignment]
  )

  // Takeover handlers
  const handleTakeoverRequest = useCallback((assignment: Assignment) => {
    setAssignmentToTakeover(assignment)
    setTakeoverDialogOpen(true)
  }, [])

  const handleTakeover = useCallback(
    async (
      originalAssignment: Assignment,
      newResourceId: string,
      newShiftId: ShiftId,
      notes?: string
    ) => {
      // Mark original assignment as taken over
      updateAssignment(originalAssignment.id, {
        takenOverBy: `takeover-${Date.now()}`,
        notes: originalAssignment.notes
          ? `${originalAssignment.notes}\n[Handed off to next shift]`
          : "[Handed off to next shift]",
      })

      // Create new assignment for the next shift
      const newAssignment: Omit<Assignment, "id"> = {
        projectId: originalAssignment.projectId,
        projectName: originalAssignment.projectName,
        resourceId: newResourceId,
        shiftId: newShiftId,
        status: "scheduled",
        priority: originalAssignment.priority,
        isOvertime: false,
        // Set times based on new shift schedule
        startTime: SHIFT_SCHEDULES[newShiftId].standardStart,
        endTime: originalAssignment.endTime, // Preserve estimated end
        estimatedStartTime: SHIFT_SCHEDULES[newShiftId].standardStart,
        estimatedEndTime: originalAssignment.estimatedEndTime,
        color: originalAssignment.color,
        isTakeover: true,
        previousAssignmentId: originalAssignment.id,
        notes: notes
          ? `[Takeover] ${notes}`
          : `[Takeover from ${originalAssignment.shiftId} shift]`,
      }

      createAssignment(newAssignment)
    },
    [updateAssignment, createAssignment]
  )

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }, [])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="max-w-max justify-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {formatDateDisplay(selectedDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        {/* Time display filter and zoom */}
        <div className="flex items-center gap-3">
          {/* Time Display Mode Split Button */}
          <TimeDisplaySplitButton
            value={timeDisplayMode}
            onChange={setTimeDisplayMode}
          />

          {/* Legend toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLegend(!showLegend)}
            className={cn(showLegend && "bg-accent")}
          >
            <Info className="h-4 w-4" />
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-[50px] text-center text-sm text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="rounded-lg border bg-card p-3">
          <TimeDisplayLegend />
        </div>
      )}

      {/* Shift tabs */}
      <Tabs
        value={activeShift}
        onValueChange={(value) => setActiveShift(value as ShiftId | "all")}
      >
        <TabsList className=" max-w-max flex flex-wrap items-center bg-muted/30">
          <TabsTrigger value="all" className="gap-2">
            All Shifts
            <Badge variant="secondary" className="ml-1">
              {filteredAssignments.length}
            </Badge>
          </TabsTrigger>
          {ALL_SHIFT_IDS.map((shiftId) => (
            <TabsTrigger key={shiftId} value={shiftId} className="gap-2">
              {SHIFT_SCHEDULES[shiftId].label}
              <Badge variant="secondary" className="ml-1">
                {assignmentsByShift(shiftId).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* All shifts view - side by side combined timeline */}
        <TabsContent value="all" className="mt-4 space-y-4">
              {/* LWC Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-3">
                <LWCNavTabs
                  selectedArea={selectedFloorArea}
                  onChange={setSelectedFloorArea}
                />
            <AvailabilityFilterButton
              value={availabilityFilter}
              onChange={setAvailabilityFilter}
            />
          </div>

          <CombinedShiftTimeline
            stations={filteredStations}
            resources={resources}
            assignments={filteredAssignments}
            timeDisplayMode={timeDisplayMode}
            onAssignmentMove={handleAssignmentMove}
            onAssignmentResize={handleAssignmentResize}
            onAssignmentClick={onAssignmentClick}
            onAssignmentTakeover={handleTakeoverRequest}
            onDropFromQueue={onDropFromQueue}
            onStationClick={onStationClick}
            onStationTimeSelect={onStationTimeSelect}
            initialZoom={zoom}
          />
        </TabsContent>

        {/* Individual shift views */}
        {ALL_SHIFT_IDS.map((shiftId) => (
          <TabsContent key={shiftId} value={shiftId} className="mt-4 space-y-4">
            {/* LWC Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-3">
              <LWCNavTabs
                selectedArea={selectedFloorArea}
                onChange={setSelectedFloorArea}
              />
              <AvailabilityFilterButton
                value={availabilityFilter}
                onChange={setAvailabilityFilter}
              />
            </div>

            <ShiftStationTimeline
              shiftId={shiftId}
              stations={filteredStations}
              resources={resources}
              assignments={assignmentsByShift(shiftId)}
              timeDisplayMode={timeDisplayMode}
              onAssignmentMove={handleAssignmentMove}
              onAssignmentResize={handleAssignmentResize}
              onAssignmentClick={onAssignmentClick}
              onAssignmentTakeover={handleTakeoverRequest}
              onStationClick={onStationClick}
              onStationTimeSelect={onStationTimeSelect}
              initialZoom={zoom}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Takeover Dialog */}
      <TakeoverDialog
        assignment={assignmentToTakeover}
        resources={resources}
        open={takeoverDialogOpen}
        onOpenChange={setTakeoverDialogOpen}
        onTakeover={handleTakeover}
      />
    </div>
  )
}
