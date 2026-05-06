"use client"

import { useCallback, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { Assignment, AssignmentStatus } from "@/types/scheduling"
import { useScheduling } from "@/contexts/scheduling-context"
import { useAssignmentProgress, useInProgressAssignments } from "@/hooks/use-assignment-progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { formatDisplayTime, getDurationMinutes } from "@/lib/time-utils"
import { getStatusColor, getPriorityColor } from "@/lib/shift-utils"
import { Play, Pause, CheckCircle, AlertCircle, Clock, User, Search, Calendar } from "lucide-react"

// Status filter options
const STATUS_FILTERS: { value: AssignmentStatus | "all"; label: string; color: string }[] = [
  { value: "all", label: "All", color: "bg-muted" },
  { value: "scheduled", label: "Scheduled", color: "bg-blue-500" },
  { value: "in-progress", label: "In Progress", color: "bg-yellow-500" },
  { value: "completed", label: "Completed", color: "bg-green-500" },
  { value: "blocked", label: "Blocked", color: "bg-red-500" },
]

interface AssignmentTrackerProps {
  className?: string
  onAssignmentClick?: (assignment: Assignment) => void
}

export function AssignmentTracker({
  className,
  onAssignmentClick,
}: AssignmentTrackerProps) {
  const { assignments } = useScheduling()
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Get all assignments with their progress
  const allItemsWithProgress = useMemo(() => {
    return assignments.map(assignment => {
      const totalMinutes = getDurationMinutes(assignment.startTime, assignment.endTime)
      const now = new Date()
      const startTime = new Date()
      const [startHours, startMins] = assignment.startTime.split(':').map(Number)
      startTime.setHours(startHours, startMins, 0, 0)
      
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 60000))
      const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes)
      const percentComplete = Math.min(100, Math.round((elapsedMinutes / totalMinutes) * 100))
      
      let status: "not-started" | "in-progress" | "completed" | "overdue" = "not-started"
      if (assignment.status === "completed") {
        status = "completed"
      } else if (elapsedMinutes > totalMinutes) {
        status = "overdue"
      } else if (elapsedMinutes > 0) {
        status = "in-progress"
      }
      
      return {
        assignment,
        progress: { totalMinutes, elapsedMinutes, remainingMinutes, percentComplete, status }
      }
    })
  }, [assignments])
  
  // Filter assignments by status and search
  const filteredItems = useMemo(() => {
    return allItemsWithProgress.filter(({ assignment }) => {
      // Status filter
      if (statusFilter !== "all" && assignment.status !== statusFilter) {
        return false
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = assignment.name?.toLowerCase().includes(query)
        const matchesProject = assignment.projectName?.toLowerCase().includes(query)
        if (!matchesName && !matchesProject) {
          return false
        }
      }
      return true
    })
  }, [allItemsWithProgress, statusFilter, searchQuery])
  
  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assignments.length }
    for (const { assignment } of allItemsWithProgress) {
      counts[assignment.status] = (counts[assignment.status] || 0) + 1
    }
    return counts
  }, [allItemsWithProgress, assignments.length])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Active Assignments
          </CardTitle>
          <Badge variant="outline">{filteredItems.length}</Badge>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Status filters */}
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              variant={statusFilter === value ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setStatusFilter(value)}
            >
              {label}
              <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                {statusCounts[value] || 0}
              </Badge>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground px-4">
            <CheckCircle className="mb-2 h-8 w-8" />
            <p>No assignments found</p>
            <p className="text-sm">
              {statusFilter === "all" 
                ? "No assignments scheduled yet" 
                : `No ${statusFilter.replace("-", " ")} assignments`}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-3">
              {filteredItems.map(({ assignment, progress }) => (
                <TrackerItem
                  key={assignment.id}
                  assignment={assignment}
                  progress={progress}
                  onClick={() => onAssignmentClick?.(assignment)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// Individual tracker item
interface TrackerItemProps {
  assignment: Assignment
  progress: {
    totalMinutes: number
    elapsedMinutes: number
    remainingMinutes: number
    percentComplete: number
    status: "not-started" | "in-progress" | "completed" | "overdue"
  }
  onClick?: () => void
}

function TrackerItem({ assignment, progress, onClick }: TrackerItemProps) {
  const { resources, setAssignmentStatus } = useScheduling()
  const resource = resources.find((r) => r.id === assignment.resourceId)
  
  // Get assignee from assignment.assignees array first, fallback to resource
  const assignee = assignment.assignees?.[0]
  const assigneeName = assignee?.name || resource?.name || "Unknown"

  const handleStatusChange = useCallback(
    (status: AssignmentStatus) => {
      setAssignmentStatus(assignment.id, status)
    },
    [assignment.id, setAssignmentStatus]
  )

  const initials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        progress.status === "overdue" && "border-destructive/50 bg-destructive/5",
        onClick && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={resource?.avatar} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{assignment.projectName}</span>
              {progress.status === "overdue" && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
              {assignment.isOvertime && (
                <Badge variant="secondary" className="text-xs">
                  OT
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{assigneeName}</span>
              <span className="text-border">|</span>
              <span>
                {formatDisplayTime(assignment.startTime)} - {formatDisplayTime(assignment.endTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {assignment.status === "scheduled" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleStatusChange("in-progress")}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          {assignment.status === "in-progress" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleStatusChange("blocked")}
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600"
                onClick={() => handleStatusChange("completed")}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {assignment.status === "blocked" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleStatusChange("in-progress")}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {progress.elapsedMinutes}m elapsed
          </span>
          <span className="font-medium">{progress.percentComplete}%</span>
          <span className="text-muted-foreground">
            {progress.remainingMinutes}m remaining
          </span>
        </div>
        <Progress
          value={progress.percentComplete}
          className={cn(
            "h-1.5",
            progress.status === "overdue" && "[&>div]:bg-destructive"
          )}
        />
      </div>
    </div>
  )
}

// Standalone assignment card for individual tracking
interface AssignmentCardProps {
  assignmentId: string
  className?: string
  onStatusChange?: (status: AssignmentStatus) => void
}

export function AssignmentCard({
  assignmentId,
  className,
  onStatusChange,
}: AssignmentCardProps) {
  const { assignments, resources, setAssignmentStatus } = useScheduling()
  const progress = useAssignmentProgress(assignmentId)

  const assignment = assignments.find((a) => a.id === assignmentId)
  if (!assignment || !progress) return null

  const resource = resources.find((r) => r.id === assignment.resourceId)
  const duration = getDurationMinutes(assignment.startTime, assignment.endTime)

  const handleStatusChange = useCallback(
    (status: AssignmentStatus) => {
      setAssignmentStatus(assignmentId, status)
      onStatusChange?.(status)
    },
    [assignmentId, setAssignmentStatus, onStatusChange]
  )

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{assignment.projectName}</CardTitle>
          <Badge
            variant="outline"
            className={cn("capitalize", getStatusColor(assignment.status))}
          >
            {assignment.status}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <User className="h-3 w-3" />
          {resource?.name || "Unknown"}
          <span className="text-border">|</span>
          {formatDisplayTime(assignment.startTime)} - {formatDisplayTime(assignment.endTime)}
          <span className="text-border">|</span>
          {duration}m
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.percentComplete}%</span>
          </div>
          <Progress value={progress.percentComplete} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress.elapsedMinutes}m elapsed</span>
            <span>{progress.remainingMinutes}m remaining</span>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2">
          {assignment.status === "scheduled" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleStatusChange("in-progress")}
            >
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          {assignment.status === "in-progress" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleStatusChange("blocked")}
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Block
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleStatusChange("completed")}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </>
          )}
          {assignment.status === "blocked" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleStatusChange("in-progress")}
            >
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
