"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import type { Assignment, AssignmentStatus, AssignmentPriority } from "@/types/scheduling"
import type { TeamUser } from "@/components/scheduling/user-list"
import { useScheduling } from "@/contexts/scheduling-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatDisplayTime, getDurationMinutes } from "@/lib/time-utils"
import { getPriorityColor, getStatusColor } from "@/lib/shift-utils"
import { Clock, Briefcase, AlertCircle, Trash2, Info } from "lucide-react"
import { 
  LWCStationSplitDropdown, 
  detectsShiftRollover, 
  calculateEndTime 
} from "./lwc-station-split-dropdown"

interface AssignmentDialogProps {
  assignment: Assignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  teamUsers?: TeamUser[]
}

const STATUS_OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
  { value: "cancelled", label: "Cancelled" },
]

const PRIORITY_OPTIONS: { value: AssignmentPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export function AssignmentDialog({
  assignment,
  open,
  onOpenChange,
  teamUsers = [],
}: AssignmentDialogProps) {
  const { updateAssignment, deleteAssignment } = useScheduling()

  const [status, setStatus] = useState<AssignmentStatus>("scheduled")
  const [priority, setPriority] = useState<AssignmentPriority>("medium")
  const [notes, setNotes] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Editable time fields
  const [startTime, setStartTime] = useState("08:00")
  
  // Store the original duration from the assignment (in minutes)
  const [estimatedDuration, setEstimatedDuration] = useState(240)
  
  // Assignee selection - support split shifts
  const [firstShiftAssigneeId, setFirstShiftAssigneeId] = useState<string | null>(null)
  const [secondShiftAssigneeId, setSecondShiftAssigneeId] = useState<string | null>(null)

  // Sync state when assignment changes
  useEffect(() => {
    if (assignment) {
      setStatus(assignment.status)
      setPriority(assignment.priority)
      setNotes(assignment.notes || "")
      setStartTime(assignment.startTime)
      // Calculate duration from the assignment's times
      const durationMins = getDurationMinutes(assignment.startTime, assignment.endTime)
      setEstimatedDuration(durationMins)
      // Get assignees from assignment.assignees array
      const assignees = assignment.assignees || []
      const firstShiftUser = assignees.find(a => {
        const user = teamUsers.find(u => u.badge === a.id)
        return user?.shift === 1
      })
      const secondShiftUser = assignees.find(a => {
        const user = teamUsers.find(u => u.badge === a.id)
        return user?.shift === 2
      })
      setFirstShiftAssigneeId(firstShiftUser?.id || assignees[0]?.id || null)
      setSecondShiftAssigneeId(secondShiftUser?.id || null)
    }
  }, [assignment, teamUsers])
  
  // Calculate end time from start time + estimated duration
  const endTime = useMemo(() => {
    return calculateEndTime(startTime, estimatedDuration)
  }, [startTime, estimatedDuration])
  
  // Detect if this assignment requires shift split (crosses 3PM)
  const requiresShiftSplit = useMemo(() => {
    return detectsShiftRollover(startTime, endTime)
  }, [startTime, endTime])
  
  // Get selected assignee details for display
  const firstShiftAssignee = useMemo(() => {
    if (!firstShiftAssigneeId) return null
    return teamUsers.find(u => u.badge === firstShiftAssigneeId) || null
  }, [firstShiftAssigneeId, teamUsers])
  
  const secondShiftAssignee = useMemo(() => {
    if (!secondShiftAssigneeId) return null
    return teamUsers.find(u => u.badge === secondShiftAssigneeId) || null
  }, [secondShiftAssigneeId, teamUsers])

  const handleSave = useCallback(() => {
    if (!assignment) return

    // Build assignees array from shift selections
    const assignees: { id: string; name: string }[] = []
    if (firstShiftAssignee) {
      assignees.push({ id: firstShiftAssignee.badge, name: firstShiftAssignee.preferred_name })
    }
    if (requiresShiftSplit && secondShiftAssignee) {
      assignees.push({ id: secondShiftAssignee.badge, name: secondShiftAssignee.preferred_name })
    }

    updateAssignment(assignment.id, {
      status,
      priority,
      notes: notes.trim() || undefined,
      startTime,
      endTime,
      assignees: assignees.length > 0 ? assignees : assignment.assignees,
    })

    onOpenChange(false)
  }, [assignment, status, priority, notes, startTime, endTime, firstShiftAssignee, secondShiftAssignee, requiresShiftSplit, updateAssignment, onOpenChange])

  const handleDelete = useCallback(() => {
    if (!assignment) return

    deleteAssignment(assignment.id)
    setIsDeleting(false)
    onOpenChange(false)
  }, [assignment, deleteAssignment, onOpenChange])

  if (!assignment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assignment.projectName}
            {assignment.isOvertime && (
              <Badge variant="secondary" className="text-xs">
                Overtime
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Edit assignment details and status
          </DialogDescription>
        </DialogHeader>

        {isDeleting ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Delete this assignment?</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The assignment will be permanently
              removed from the schedule.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleting(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              {/* Time Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
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
                <span>Estimated Duration: {estimatedDuration} min ({Math.floor(estimatedDuration / 60)}h {estimatedDuration % 60}m)</span>
              </div>
              
              {/* Assignee selector with shift split support */}
              <LWCStationSplitDropdown
                teamUsers={teamUsers}
                firstShiftAssigneeId={firstShiftAssigneeId}
                secondShiftAssigneeId={secondShiftAssigneeId}
                requiresShiftSplit={requiresShiftSplit}
                onFirstShiftChange={setFirstShiftAssigneeId}
                onSecondShiftChange={setSecondShiftAssigneeId}
              />
              
              {/* Shift info (read-only) */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                <span className="capitalize">{assignment.shiftId} Shift</span>
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AssignmentStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${getStatusColor(option.value)}`}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as AssignmentPriority)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${getPriorityColor(option.value)}`}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsDeleting(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
