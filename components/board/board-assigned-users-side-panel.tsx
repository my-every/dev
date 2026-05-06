"use client"

import { useMemo, useState } from "react"
import { Clock, Search, User, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { BoardMemberView, BoardProjectView } from "@/lib/board/types"

interface AssignedUserEntry {
  member: BoardMemberView
  assignmentCount: number
  projectNames: string[]
  sheetNames: string[]
}

interface BoardAssignedUsersSidePanelProps {
  members: BoardMemberView[]
  projects: BoardProjectView[]
  isLoading?: boolean
  onUserSelect?: (member: BoardMemberView) => void
  selectedBadge?: string | null
  className?: string
}

function getAvailabilityColor(status: BoardMemberView["availabilityStatus"]) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-500"
    case "ON_ASSIGNMENT":
      return "bg-amber-500"
    default:
      return "bg-muted-foreground/30"
  }
}

function getAvailabilityLabel(status: BoardMemberView["availabilityStatus"]) {
  switch (status) {
    case "AVAILABLE":
      return "Available"
    case "ON_ASSIGNMENT":
      return "On Assignment"
    default:
      return "Off Shift"
  }
}

export function BoardAssignedUsersSidePanel({
  members,
  projects,
  isLoading = false,
  onUserSelect,
  selectedBadge,
  className,
}: BoardAssignedUsersSidePanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "available">("all")

  // Build assigned users list from projects
  const assignedUsers = useMemo(() => {
    const assignmentsByBadge = new Map<string, { projectNames: Set<string>; sheetNames: string[]; count: number }>()

    for (const project of projects) {
      for (const assignment of project.assignments) {
        if (assignment.assignedBadge) {
          const existing = assignmentsByBadge.get(assignment.assignedBadge) ?? {
            projectNames: new Set<string>(),
            sheetNames: [],
            count: 0,
          }
          existing.projectNames.add(`${project.pdNumber} ${project.name}`)
          existing.sheetNames.push(assignment.sheetName)
          existing.count += 1
          assignmentsByBadge.set(assignment.assignedBadge, existing)
        }
      }
    }

    const entries: AssignedUserEntry[] = []
    for (const member of members) {
      const assignments = assignmentsByBadge.get(member.badge)
      if (assignments) {
        entries.push({
          member,
          assignmentCount: assignments.count,
          projectNames: Array.from(assignments.projectNames),
          sheetNames: assignments.sheetNames,
        })
      }
    }

    return entries.sort((a, b) => b.assignmentCount - a.assignmentCount)
  }, [members, projects])

  // Available members (not assigned)
  const availableMembers = useMemo(() => {
    const assignedBadges = new Set(assignedUsers.map((u) => u.member.badge))
    return members
      .filter((m) => !assignedBadges.has(m.badge) && m.availabilityStatus === "AVAILABLE")
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [members, assignedUsers])

  // Filter based on search and status
  const filteredAssigned = useMemo(() => {
    let result = assignedUsers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (entry) =>
          entry.member.fullName.toLowerCase().includes(query) ||
          entry.member.preferredName?.toLowerCase().includes(query) ||
          entry.member.badge.toLowerCase().includes(query)
      )
    }

    return result
  }, [assignedUsers, searchQuery])

  const filteredAvailable = useMemo(() => {
    let result = availableMembers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (member) =>
          member.fullName.toLowerCase().includes(query) ||
          member.preferredName?.toLowerCase().includes(query) ||
          member.badge.toLowerCase().includes(query)
      )
    }

    return result
  }, [availableMembers, searchQuery])

  const displayList = statusFilter === "available" ? [] : filteredAssigned
  const displayAvailable = statusFilter === "assigned" ? [] : filteredAvailable

  if (isLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="border-b p-3 space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="border-b p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Team Members</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {assignedUsers.length} assigned
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {/* Status filter */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList className="w-full grid grid-cols-3 h-7">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="assigned" className="text-xs">
              Assigned
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {assignedUsers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="available" className="text-xs">
              Available
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {availableMembers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* User list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Assigned users section */}
          {displayList.length > 0 && (
            <>
              {statusFilter === "all" && (
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Currently Assigned
                </div>
              )}
              {displayList.map((entry) => {
                const isSelected = selectedBadge === entry.member.badge

                return (
                  <button
                    key={entry.member.badge}
                    onClick={() => onUserSelect?.(entry.member)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                      "hover:bg-accent",
                      isSelected && "bg-accent ring-1 ring-primary"
                    )}
                  >
                    {/* Avatar with status indicator */}
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-medium bg-primary/10">
                          {entry.member.initials ?? entry.member.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                          getAvailabilityColor(entry.member.availabilityStatus)
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {entry.member.preferredName ?? entry.member.fullName}
                        </span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {entry.assignmentCount} task{entry.assignmentCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium text-xs">Assigned to:</p>
                              <ul className="text-xs space-y-0.5">
                                {entry.sheetNames.slice(0, 5).map((name, i) => (
                                  <li key={i} className="text-muted-foreground">
                                    {name}
                                  </li>
                                ))}
                                {entry.sheetNames.length > 5 && (
                                  <li className="text-muted-foreground">
                                    +{entry.sheetNames.length - 5} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Assignment count badge */}
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[10px] px-1.5 bg-amber-100 text-amber-700 border-amber-200"
                    >
                      {entry.assignmentCount}
                    </Badge>
                  </button>
                )
              })}
            </>
          )}

          {/* Available users section */}
          {displayAvailable.length > 0 && (
            <>
              {statusFilter === "all" && (
                <div className="px-2 py-1.5 mt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Available
                </div>
              )}
              {displayAvailable.map((member) => {
                const isSelected = selectedBadge === member.badge

                return (
                  <button
                    key={member.badge}
                    onClick={() => onUserSelect?.(member)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                      "hover:bg-accent",
                      isSelected && "bg-accent ring-1 ring-primary"
                    )}
                  >
                    {/* Avatar with status indicator */}
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-medium bg-primary/10">
                          {member.initials ?? member.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                          getAvailabilityColor(member.availabilityStatus)
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {member.preferredName ?? member.fullName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{member.primaryLwc.replace("_", " ")}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span>{member.shift}</span>
                      </div>
                    </div>

                    {/* Available badge */}
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] px-1.5 border-emerald-200 text-emerald-700"
                    >
                      Ready
                    </Badge>
                  </button>
                )
              })}
            </>
          )}

          {/* Empty state */}
          {displayList.length === 0 && displayAvailable.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No team members found</p>
              <p className="text-xs text-muted-foreground/70">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer summary */}
      <div className="border-t p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{members.length} total members</span>
          <span>
            {members.filter((m) => m.availabilityStatus === "AVAILABLE").length} available
          </span>
        </div>
      </div>
    </div>
  )
}
