"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Clock,
  Users,
  Layers,
  CheckCircle,
  AlertCircle,
  Search,
  Wrench,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Station } from "./combined-shift-timeline"
import type { FlattenedAssignment } from "@/types/project-manifest"
import type { TeamUser } from "./user-list"
import { parseTimeToMinutes, formatMinutesToTime } from "@/lib/services/priority-service"

// Map stage to required skill
const STAGE_SKILL_MAP: Record<string, "build_up" | "wiring" | "test" | "box_build" | "branding"> = {
  "BUILD_UP": "build_up",
  "BUILD_UP_1": "build_up",
  "BUILD_UP_2": "build_up",
  "WIRING": "wiring",
  "WIRE_1": "wiring",
  "WIRE_2": "wiring",
  "TEST_1": "test",
  "TEST_2": "test",
  "READY_TO_TEST": "test",
  "BOX_BUILD": "box_build",
  "BRANDING": "branding",
  "READY_TO_LAY": "build_up",
}

interface StationAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  station: Station | null
  queueAssignments: FlattenedAssignment[]
  users: TeamUser[]
  onAssign: (assignment: FlattenedAssignment, user: TeamUser, startTime: string) => void
  isLoading?: boolean
}

export function StationAssignmentModal({
  open,
  onOpenChange,
  station,
  queueAssignments,
  users,
  onAssign,
  isLoading = false,
}: StationAssignmentModalProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<FlattenedAssignment | null>(null)
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null)
  // Default start time to current time rounded to nearest 15 minutes
  const getDefaultStartTime = useCallback(() => {
    const now = new Date()
    const minutes = Math.ceil(now.getMinutes() / 15) * 15
    const hours = now.getHours() + (minutes >= 60 ? 1 : 0)
    const adjustedMinutes = minutes >= 60 ? 0 : minutes
    return `${hours.toString().padStart(2, "0")}:${adjustedMinutes.toString().padStart(2, "0")}`
  }, [])
  const [startTime, setStartTime] = useState(getDefaultStartTime)
  const [userSearchQuery, setUserSearchQuery] = useState("")
  
  // Update start time when modal opens
  useEffect(() => {
    if (open) {
      setStartTime(getDefaultStartTime())
    }
  }, [open, getDefaultStartTime])

  // Filter assignments relevant to this station's type
  const relevantAssignments = useMemo(() => {
    if (!station) return []

    // Filter by station category matching assignment stage
    return queueAssignments.filter(qa => {
      const stage = qa.assignment.stage
      // BUILD_UP stations get BUILD_UP tasks
      if (station.category === "BUILD_UP") {
        return stage.includes("BUILD_UP") || stage === "READY_TO_LAY"
      }
      // WIRING stations get WIRING tasks
      if (station.category === "WIRING") {
        return stage.includes("WIRE") || stage === "WIRING"
      }
      // TEST stations get TEST tasks
      if (station.category === "TEST") {
        return stage.includes("TEST")
      }
      return true
    })
  }, [station, queueAssignments])

  // Get required skill based on selected assignment
  const requiredSkill = useMemo(() => {
    if (!selectedAssignment) return undefined
    return STAGE_SKILL_MAP[selectedAssignment.assignment.stage] || "build_up"
  }, [selectedAssignment])

  // Filter and sort users by required skill
  const filteredUsers = useMemo(() => {
    let result = users.filter(u => u.is_active)

    // Search filter
    if (userSearchQuery) {
      const query = userSearchQuery.toLowerCase()
      result = result.filter(u =>
        u.preferred_name.toLowerCase().includes(query) ||
        u.initials.toLowerCase().includes(query)
      )
    }

    // Sort by required skill
    if (requiredSkill) {
      const skillKey = `skill_${requiredSkill}` as keyof TeamUser
      result = result.sort((a, b) => {
        const aSkill = (a[skillKey] as number) || 0
        const bSkill = (b[skillKey] as number) || 0
        return bSkill - aSkill
      })
    }

    return result
  }, [users, userSearchQuery, requiredSkill])

  // Handle assign action
  const handleAssign = () => {
    if (!selectedAssignment || !selectedUser) return
    onAssign(selectedAssignment, selectedUser, startTime)
    onOpenChange(false)
    // Reset state
    setSelectedAssignment(null)
    setSelectedUser(null)
    setStartTime("08:00")
  }

  // Get skill level display with numeric value
  const getSkillBadge = (user: TeamUser, skill: string) => {
    const skillKey = `skill_${skill}` as keyof TeamUser
    const level = (user[skillKey] as number) || 0
    const labels = ["N/A", "Trainee", "Basic", "Proficient", "Expert"]
    const colors = ["bg-muted text-muted-foreground", "bg-orange-500 text-white", "bg-yellow-500 text-white", "bg-blue-500 text-white", "bg-green-500 text-white"]
    
    return (
      <div className="flex items-center gap-1">
        <Badge className={cn("text-[10px]", colors[level] || colors[0])}>
          {labels[level] || labels[0]}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
          L{level}
        </span>
      </div>
    )
  }

  if (!station) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white",
                station.category === "BUILD_UP" && "bg-green-500",
                station.category === "WIRING" && "bg-blue-500",
                station.category === "TEST" && "bg-yellow-500",
                station.category === "SUPPORT" && "bg-purple-500",
              )}
            >
              {station.category === "BUILD_UP" ? "B" : station.category === "WIRING" ? "W" : station.category === "TEST" ? "T" : "S"}
            </div>
            <span>{station.name}</span>
          </DialogTitle>
          <DialogDescription>
            {station.floorArea.replace("_", " ")} - {station.category.replace("_", " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 h-[400px]">
          {/* Left: Assignment selection */}
          <div className="flex flex-col border rounded-lg overflow-hidden h-full">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Select Assignment
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {relevantAssignments.length} tasks matching this station type
              </p>
            </div>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : relevantAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <Layers className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No matching tasks</p>
                  <p className="text-xs text-muted-foreground/70">
                    No assignments in queue match this station type
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {relevantAssignments.map((qa) => {
                    const isSelected = selectedAssignment?.assignment.sheetSlug === qa.assignment.sheetSlug
                    // Calculate total estimated time from buildUpEstTime + wireListEstTime
                    const buildUpMins = parseTimeToMinutes(qa.assignment.buildUpEstTime || "0m")
                    const wireMins = parseTimeToMinutes(qa.assignment.wireListEstTime || "0m")
                    const totalEstMinutes = buildUpMins + wireMins
                    const estTimeDisplay = formatMinutesToTime(totalEstMinutes)

                    return (
                      <button
                        key={`${qa.project.id}-${qa.assignment.sheetSlug}`}
                        onClick={() => setSelectedAssignment(qa)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-accent"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {qa.assignment.sheetName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {qa.project.name} ({qa.project.pdNumber})
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {qa.assignment.stage.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {estTimeDisplay}
                          </span>
                          {qa.assignment.unitType && (
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {qa.assignment.unitType}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right: User selection */}
          <div className="flex flex-col border rounded-lg overflow-hidden h-full">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign Team Member
              </h3>
              {requiredSkill && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sorted by {requiredSkill.replace("_", " ")} skill
                </p>
              )}
            </div>

            {/* Search */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            
            {/* Column headers */}
            <div className="px-4 py-1.5 border-b bg-muted/30 flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span className="w-8" />
              <span className="flex-1">Name</span>
              <span className="w-20 text-center">Skill</span>
              <span className="w-10 text-center">Shift</span>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 p-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.slice(0, 15).map((user) => {
                    const isSelected = selectedUser?.badge === user.badge

                    return (
                      <button
                        key={user.badge}
                        onClick={() => setSelectedUser(user)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary/10 ring-1 ring-primary"
                            : "hover:bg-accent"
                        )}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium truncate">
                            {user.preferred_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.years_experience.toFixed(1)}y exp
                          </p>
                        </div>
                        <div className="w-20 flex justify-center shrink-0">
                          {requiredSkill && getSkillBadge(user, requiredSkill)}
                        </div>
                        <div className="w-10 flex justify-center shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              user.shift === 1 ? "border-blue-200 text-blue-700" : "border-orange-200 text-orange-700"
                            )}
                          >
                            {user.shift === 1 ? "1st" : "2nd"}
                          </Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer: Time selection and confirm */}
        <div className="flex items-end gap-4 pt-4 border-t">
          <div className="flex-1">
            <Label htmlFor="start-time" className="text-sm">Start Time</Label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1"
            />
          </div>

          {selectedAssignment && (
            <div className="flex-1 text-sm">
              <p className="text-muted-foreground">Estimated Duration</p>
              <p className="font-medium">
                {formatMinutesToTime(
                  parseTimeToMinutes(selectedAssignment.assignment.buildUpEstTime || "0m") +
                  parseTimeToMinutes(selectedAssignment.assignment.wireListEstTime || "0m")
                )}
              </p>
            </div>
          )}

          <Button
            onClick={handleAssign}
            disabled={!selectedAssignment || !selectedUser}
            className="px-6"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Assign to Station
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
