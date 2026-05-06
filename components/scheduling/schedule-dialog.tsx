"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Clock,
  Layers,
  MapPin,
  CheckCircle,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FlattenedAssignment } from "@/types/project-manifest"
import type { TeamUser } from "./user-list"
import type { Station } from "./combined-shift-timeline"
import type { FloorArea } from "@/types/floor-layout"
import { FLOOR_AREA_META, NEW_FLEX_STATIONS, OFFSKID_STATIONS, ONSKID_STATIONS } from "@/types/floor-layout"
import { 
  LWCStationSplitDropdown, 
  detectsShiftRollover, 
  calculateEndTime 
} from "./lwc-station-split-dropdown"
import { parseTimeToMinutes, formatMinutesToTime } from "@/lib/services/priority-service"

// ============================================================================
// Types
// ============================================================================

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The assignment to schedule from the queue */
  assignment: FlattenedAssignment | null
  /** All team users for assignee selection */
  teamUsers: TeamUser[]
  /** All available stations */
  stations: Station[]
  /** Set of user IDs currently assigned to tasks */
  assignedUserIds?: Set<string>
  /** Callback when scheduling is confirmed */
  onSchedule: (
    assignment: FlattenedAssignment,
    stationId: string,
    startTime: string,
    firstShiftAssignee: TeamUser | null,
    secondShiftAssignee: TeamUser | null
  ) => void
}

// ============================================================================
// Component
// ============================================================================

export function ScheduleDialog({
  open,
  onOpenChange,
  assignment,
  teamUsers,
  stations,
  assignedUserIds = new Set(),
  onSchedule,
}: ScheduleDialogProps) {
  // State
  const [selectedStationId, setSelectedStationId] = useState<string>("")
  const [firstShiftAssigneeId, setFirstShiftAssigneeId] = useState<string | null>(null)
  const [secondShiftAssigneeId, setSecondShiftAssigneeId] = useState<string | null>(null)
  
  // Default start time to current time rounded to nearest 15 minutes
  const getDefaultStartTime = useCallback(() => {
    const now = new Date()
    const minutes = Math.ceil(now.getMinutes() / 15) * 15
    const hours = now.getHours() + (minutes >= 60 ? 1 : 0)
    const adjustedMinutes = minutes >= 60 ? 0 : minutes
    return `${hours.toString().padStart(2, "0")}:${adjustedMinutes.toString().padStart(2, "0")}`
  }, [])
  
  const [startTime, setStartTime] = useState(getDefaultStartTime)
  
  // Reset state when dialog opens/closes or assignment changes
  useEffect(() => {
    if (open && assignment) {
      setStartTime(getDefaultStartTime())
      setSelectedStationId("")
      setFirstShiftAssigneeId(null)
      setSecondShiftAssigneeId(null)
    }
  }, [open, assignment, getDefaultStartTime])
  
  // Calculate duration from assignment estimates
  const estimatedDuration = useMemo(() => {
    if (!assignment) return 60
    const buildUp = parseTimeToMinutes(assignment.assignment.buildUpEstTime || "0m")
    const wireList = parseTimeToMinutes(assignment.assignment.wireListEstTime || "0m")
    return buildUp + wireList
  }, [assignment])
  
  // Calculate end time
  const endTime = useMemo(() => {
    return calculateEndTime(startTime, estimatedDuration)
  }, [startTime, estimatedDuration])
  
  // Check if shift split is required
  const requiresShiftSplit = useMemo(() => {
    return detectsShiftRollover(startTime, endTime)
  }, [startTime, endTime])
  
  // Get the assignment's LWC type
  const lwcType = assignment?.project.lwcType as FloorArea | undefined
  
  // Filter stations by LWC type
  const filteredStations = useMemo(() => {
    if (!lwcType) return stations
    return stations.filter(s => s.floorArea === lwcType)
  }, [stations, lwcType])
  
  // Get assignees
  const firstShiftAssignee = useMemo(() => {
    if (!firstShiftAssigneeId) return null
    return teamUsers.find(u => u.badge === firstShiftAssigneeId) || null
  }, [firstShiftAssigneeId, teamUsers])
  
  const secondShiftAssignee = useMemo(() => {
    if (!secondShiftAssigneeId) return null
    return teamUsers.find(u => u.badge === secondShiftAssigneeId) || null
  }, [secondShiftAssigneeId, teamUsers])
  
  // Check if form is valid
  const isValid = selectedStationId && firstShiftAssigneeId
  
  // Handle schedule
  const handleSchedule = useCallback(() => {
    if (!assignment || !isValid) return
    
    onSchedule(
      assignment,
      selectedStationId,
      startTime,
      firstShiftAssignee,
      secondShiftAssignee
    )
    
    onOpenChange(false)
  }, [assignment, isValid, selectedStationId, startTime, firstShiftAssignee, secondShiftAssignee, onSchedule, onOpenChange])
  
  if (!assignment) return null
  
  const { project } = assignment
  const lwcMeta = lwcType ? FLOOR_AREA_META[lwcType] : null
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {lwcMeta && (
              <div className={cn("h-3 w-3 rounded-full", lwcMeta.color)} />
            )}
            <div>
              <DialogTitle>{assignment.assignment.sheetName}</DialogTitle>
              <DialogDescription>
                {project.name} ({project.pdNumber})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Assignment Info */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{assignment.assignment.stage.replace(/_/g, " ")}</Badge>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatMinutesToTime(estimatedDuration)}</span>
            </div>
            {assignment.assignment.unitType && (
              <Badge variant="secondary">{assignment.assignment.unitType}</Badge>
            )}
          </div>
          
          {/* Station Selection */}
          <div className="space-y-2">
            <Label>Station</Label>
            <Select value={selectedStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a station..." />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-48">
                  {filteredStations.length > 0 ? (
                    filteredStations.map(station => (
                      <SelectItem key={station.id} value={station.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{station.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {station.type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No stations available for {lwcMeta?.label || "this LWC"}
                    </div>
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
            {lwcMeta && (
              <p className="text-xs text-muted-foreground">
                Showing stations for {lwcMeta.label}
              </p>
            )}
          </div>
          
          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime" className="flex items-center gap-1.5">
                Est. End Time
                <Info className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>
          
          {/* Duration display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Duration: {estimatedDuration} min ({Math.floor(estimatedDuration / 60)}h {estimatedDuration % 60}m)
            </span>
          </div>
          
          {/* Assignee Selection with Shift Split Support */}
          <LWCStationSplitDropdown
            teamUsers={teamUsers}
            firstShiftAssigneeId={firstShiftAssigneeId}
            secondShiftAssigneeId={secondShiftAssigneeId}
            requiresShiftSplit={requiresShiftSplit}
            onFirstShiftChange={setFirstShiftAssigneeId}
            onSecondShiftChange={setSecondShiftAssigneeId}
            floorAreaFilter={lwcType}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!isValid}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Schedule Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
