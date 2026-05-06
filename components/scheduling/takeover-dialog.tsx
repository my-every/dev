"use client"

import { useState, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { Assignment, Resource, AssignmentPriority } from "@/types/scheduling"
import type { ShiftId } from "@/types/shifts"
import { SHIFT_SCHEDULES, ALL_SHIFT_IDS } from "@/types/shifts"
import { formatDisplayTime, getDurationMinutes } from "@/lib/time-utils"
import { getPriorityColor } from "@/lib/shift-utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Clock, User, AlertTriangle } from "lucide-react"

interface TakeoverDialogProps {
  assignment: Assignment | null
  resources: Resource[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTakeover: (
    originalAssignment: Assignment,
    newResourceId: string,
    newShiftId: ShiftId,
    notes?: string
  ) => Promise<void>
}

export function TakeoverDialog({
  assignment,
  resources,
  open,
  onOpenChange,
  onTakeover,
}: TakeoverDialogProps) {
  const [selectedResourceId, setSelectedResourceId] = useState<string>("")
  const [selectedShiftId, setSelectedShiftId] = useState<ShiftId | "">("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter resources by selected shift
  const availableResources = useMemo(() => {
    if (!selectedShiftId) return resources.filter((r) => r.isActive)
    return resources.filter(
      (r) => r.shiftId === selectedShiftId && r.isActive
    )
  }, [resources, selectedShiftId])

  // Get other shifts (not the current assignment's shift)
  const otherShifts = useMemo(() => {
    if (!assignment) return ALL_SHIFT_IDS
    return ALL_SHIFT_IDS.filter((id) => id !== assignment.shiftId)
  }, [assignment])

  // Calculate remaining work
  const remainingInfo = useMemo(() => {
    if (!assignment) return null

    const estimatedDuration = getDurationMinutes(
      assignment.estimatedStartTime || assignment.startTime,
      assignment.estimatedEndTime || assignment.endTime
    )

    // If in progress, calculate how much is done
    let completedMinutes = 0
    if (assignment.actualStartTime) {
      const now = new Date()
      const actualStart = new Date()
      const [hours, minutes] = assignment.actualStartTime.split(":").map(Number)
      actualStart.setHours(hours, minutes, 0, 0)

      if (now > actualStart) {
        completedMinutes = Math.floor(
          (now.getTime() - actualStart.getTime()) / 60000
        )
      }
    }

    const remainingMinutes = Math.max(0, estimatedDuration - completedMinutes)
    const percentComplete =
      estimatedDuration > 0
        ? Math.round((completedMinutes / estimatedDuration) * 100)
        : 0

    return {
      estimatedDuration,
      completedMinutes,
      remainingMinutes,
      percentComplete,
    }
  }, [assignment])

  const handleSubmit = useCallback(async () => {
    if (!assignment || !selectedResourceId || !selectedShiftId) return

    setIsSubmitting(true)
    try {
      await onTakeover(
        assignment,
        selectedResourceId,
        selectedShiftId,
        notes.trim() || undefined
      )
      onOpenChange(false)
      // Reset form
      setSelectedResourceId("")
      setSelectedShiftId("")
      setNotes("")
    } catch (error) {
      console.error("Failed to takeover assignment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    assignment,
    selectedResourceId,
    selectedShiftId,
    notes,
    onTakeover,
    onOpenChange,
  ])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setSelectedResourceId("")
    setSelectedShiftId("")
    setNotes("")
  }, [onOpenChange])

  if (!assignment) return null

  const priorityColor = getPriorityColor(assignment.priority)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-500" />
            Take Over Assignment
          </DialogTitle>
          <DialogDescription>
            Transfer this incomplete assignment to another team member for the
            next shift.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current assignment info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{assignment.projectName}</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDisplayTime(assignment.startTime)} -{" "}
                    {formatDisplayTime(assignment.endTime)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  style={{ borderColor: priorityColor, color: priorityColor }}
                >
                  {assignment.priority}
                </Badge>
              </div>

              {remainingInfo && (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{remainingInfo.remainingMinutes}min remaining</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${remainingInfo.percentComplete}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-muted-foreground">
                    {remainingInfo.percentComplete}%
                  </span>
                </div>
              )}

              {assignment.status === "blocked" && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>This assignment is currently blocked</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shift selection */}
          <div className="space-y-2">
            <Label htmlFor="shift">Target Shift</Label>
            <Select
              value={selectedShiftId}
              onValueChange={(value) => {
                setSelectedShiftId(value as ShiftId)
                setSelectedResourceId("") // Reset resource when shift changes
              }}
            >
              <SelectTrigger id="shift">
                <SelectValue placeholder="Select target shift" />
              </SelectTrigger>
              <SelectContent>
                {otherShifts.map((shiftId) => {
                  const schedule = SHIFT_SCHEDULES[shiftId]
                  return (
                    <SelectItem key={shiftId} value={shiftId}>
                      <div className="flex items-center gap-2">
                        <span>{schedule.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({schedule.standardStart} - {schedule.standardEnd})
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Resource selection */}
          <div className="space-y-2">
            <Label htmlFor="resource">Assign To</Label>
            <Select
              value={selectedResourceId}
              onValueChange={setSelectedResourceId}
              disabled={!selectedShiftId}
            >
              <SelectTrigger id="resource">
                <SelectValue
                  placeholder={
                    selectedShiftId
                      ? "Select team member"
                      : "Select a shift first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableResources.map((resource) => {
                  const initials = resource.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <SelectItem key={resource.id} value={resource.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={resource.avatar}
                            alt={resource.name}
                          />
                          <AvatarFallback className="text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{resource.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {resource.skills.slice(0, 2).join(", ")}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
                {availableResources.length === 0 && selectedShiftId && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No available team members for this shift
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Handoff Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any context or instructions for the next person..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedResourceId || !selectedShiftId || isSubmitting}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            {isSubmitting ? "Transferring..." : "Transfer Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
