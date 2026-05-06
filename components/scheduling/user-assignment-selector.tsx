"use client"

import { useState, useMemo, useCallback } from "react"
import type { TeamUser } from "@/components/scheduling/user-list"
import type { FloorArea } from "@/types/floor-layout"
import { FLOOR_AREA_META } from "@/types/floor-layout"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronsUpDown, Check, User, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useUserTimeTracking,
  type UserAvailabilityStatus,
} from "@/contexts/user-time-tracking-context"
import { UserStatusDot, STATUS_CONFIG } from "./user-status-indicator"

// ============================================================================
// Shift Constants
// ============================================================================

const SHIFT_BOUNDARY = "15:00" // 3:00 PM
const FIRST_SHIFT_START = "04:00"
const FIRST_SHIFT_END = "14:30"
const SECOND_SHIFT_START = "14:30"
const SECOND_SHIFT_END = "01:00"

// ============================================================================
// Types
// ============================================================================

export interface UserAssignmentSelection {
  firstShiftUserId: string | null
  secondShiftUserId: string | null
}

interface UserAssignmentSelectorProps {
  /** All available team users */
  teamUsers: TeamUser[]
  /** Assignment start time (HH:mm format) */
  startTime: string
  /** Assignment estimated end time (HH:mm format) */
  endTime: string
  /** Currently selected user IDs */
  selection: UserAssignmentSelection
  /** Callback when selection changes */
  onSelectionChange: (selection: UserAssignmentSelection) => void
  /** Optional filter to show only users from specific floor area */
  floorAreaFilter?: FloorArea
  /** Set of user IDs that are already assigned (from context or prop) */
  assignedUserIds?: Set<string>
  /** Class name */
  className?: string
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Get shift for a time string (HH:mm) */
function getShiftForTime(time: string): 1 | 2 {
  const [hours] = time.split(":").map(Number)
  // 1st shift: 4:00 AM - 2:30 PM (before 15:00)
  // 2nd shift: 2:30 PM - 1:00 AM (15:00 and after, or before 4:00)
  if (hours >= 4 && hours < 15) return 1
  return 2
}

/** Check if assignment spans across shift boundary */
function detectsShiftRollover(startTime: string, endTime: string): boolean {
  const startShift = getShiftForTime(startTime)
  const endShift = getShiftForTime(endTime)
  return startShift !== endShift
}

/** Format shift time range for display */
function formatShiftTimeRange(shift: 1 | 2): string {
  if (shift === 1) return `${FIRST_SHIFT_START} - ${FIRST_SHIFT_END}`
  return `${SECOND_SHIFT_START} - ${SECOND_SHIFT_END}`
}

// ============================================================================
// User Selector Sub-Component
// ============================================================================

interface ShiftUserSelectorProps {
  label: string
  shift: 1 | 2
  users: TeamUser[]
  selectedUserId: string | null
  onSelect: (userId: string | null) => void
  assignedUserIds: Set<string>
  getUserStatus: (userId: string) => UserAvailabilityStatus
  showAvailabilityFilter?: boolean
}

function ShiftUserSelector({
  label,
  shift,
  users,
  selectedUserId,
  onSelect,
  assignedUserIds,
  getUserStatus,
  showAvailabilityFilter = true,
}: ShiftUserSelectorProps) {
  const [open, setOpen] = useState(false)
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available">("all")

  // Filter users by shift and optionally by availability
  const filteredUsers = useMemo(() => {
    let result = users.filter(u => u.shift === shift && u.is_active)
    
    if (availabilityFilter === "available") {
      result = result.filter(u => !assignedUserIds.has(u.badge))
    }
    
    // Sort: available first, then by experience
    return result.sort((a, b) => {
      const aAssigned = assignedUserIds.has(a.badge)
      const bAssigned = assignedUserIds.has(b.badge)
      if (aAssigned !== bAssigned) return aAssigned ? 1 : -1
      return b.years_experience - a.years_experience
    })
  }, [users, shift, availabilityFilter, assignedUserIds])

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return users.find(u => u.badge === selectedUserId) || null
  }, [selectedUserId, users])

  const availableCount = useMemo(() => {
    return users.filter(u => 
      u.shift === shift && 
      u.is_active && 
      !assignedUserIds.has(u.badge)
    ).length
  }, [users, shift, assignedUserIds])

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          {label}
          <Badge variant="outline" className="text-[10px] font-normal">
            {formatShiftTimeRange(shift)}
          </Badge>
        </Label>
        <span className="text-xs text-muted-foreground">
          {availableCount} available
        </span>
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between h-10"
          >
            <div className="flex items-center gap-2">
              {selectedUser ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {selectedUser.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{selectedUser.preferred_name}</span>
                  <UserStatusDot 
                    status={getUserStatus(selectedUser.badge)} 
                    className="ml-1"
                  />
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Select {shift === 1 ? "1st" : "2nd"} shift assignee...
                  </span>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search team members..." />
            
            {/* Availability filter tabs */}
            {showAvailabilityFilter && (
              <div className="px-2 pt-2">
                <Tabs 
                  value={availabilityFilter} 
                  onValueChange={(v) => setAvailabilityFilter(v as "all" | "available")}
                >
                  <TabsList className="w-full grid grid-cols-2 h-8">
                    <TabsTrigger value="all" className="text-xs">
                      All ({users.filter(u => u.shift === shift && u.is_active).length})
                    </TabsTrigger>
                    <TabsTrigger value="available" className="text-xs">
                      Available ({availableCount})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
            
            <CommandList>
              <CommandEmpty>No team member found.</CommandEmpty>
              
              {/* None option */}
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedUserId === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">None</span>
                </CommandItem>
              </CommandGroup>
              
              <CommandSeparator />
              
              {/* User list */}
              <CommandGroup heading={`${shift === 1 ? "1st" : "2nd"} Shift Team`}>
                {filteredUsers.map((user) => {
                  const isAssigned = assignedUserIds.has(user.badge)
                  const status = getUserStatus(user.badge)
                  const statusConfig = STATUS_CONFIG[status]
                  
                  return (
                    <CommandItem
                      key={user.badge}
                      value={`${user.preferred_name} ${user.badge}`}
                      onSelect={() => {
                        onSelect(user.badge)
                        setOpen(false)
                      }}
                      className={cn(
                        isAssigned && "opacity-60"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedUserId === user.badge ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Avatar className="mr-2 h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {user.preferred_name}
                          </span>
                          <UserStatusDot status={status} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {user.primary_lwc?.replace(/_/g, " ")} | {user.years_experience}y exp
                        </span>
                      </div>
                      {isAssigned && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0 text-[9px] px-1.5",
                            statusConfig.bgColor,
                            statusConfig.color
                          )}
                        >
                          {statusConfig.label}
                        </Badge>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function UserAssignmentSelector({
  teamUsers,
  startTime,
  endTime,
  selection,
  onSelectionChange,
  floorAreaFilter,
  assignedUserIds: propAssignedUserIds,
  className,
}: UserAssignmentSelectorProps) {
  const { getUserState, getAssignedUserIds } = useUserTimeTracking()
  
  // Use context or prop for assigned users
  const assignedUserIds = useMemo(() => {
    return propAssignedUserIds || getAssignedUserIds()
  }, [propAssignedUserIds, getAssignedUserIds])
  
  // Check if assignment requires shift split
  const requiresShiftSplit = useMemo(() => {
    return detectsShiftRollover(startTime, endTime)
  }, [startTime, endTime])
  
  // Get the starting shift
  const startingShift = useMemo(() => getShiftForTime(startTime), [startTime])
  
  // Filter users by floor area if specified
  const filteredUsers = useMemo(() => {
    if (!floorAreaFilter) return teamUsers
    return teamUsers.filter(u => u.primary_lwc === floorAreaFilter)
  }, [teamUsers, floorAreaFilter])
  
  // Get user status from context
  const getUserStatus = useCallback((userId: string): UserAvailabilityStatus => {
    return getUserState(userId).status
  }, [getUserState])
  
  // Handle first shift selection
  const handleFirstShiftChange = useCallback((userId: string | null) => {
    onSelectionChange({
      ...selection,
      firstShiftUserId: userId,
    })
  }, [selection, onSelectionChange])
  
  // Handle second shift selection
  const handleSecondShiftChange = useCallback((userId: string | null) => {
    onSelectionChange({
      ...selection,
      secondShiftUserId: userId,
    })
  }, [selection, onSelectionChange])

  return (
    <div className={cn("grid gap-4", className)}>
      {/* Shift rollover warning */}
      {requiresShiftSplit && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Shift crossover detected</p>
            <p className="text-xs mt-0.5 text-amber-700">
              This assignment spans from {startTime} to {endTime}, crossing the shift change at 3:00 PM.
              You can assign different team members for each shift.
            </p>
          </div>
        </div>
      )}
      
      {/* Floor area indicator */}
      {floorAreaFilter && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>
            Showing {FLOOR_AREA_META[floorAreaFilter]?.label || floorAreaFilter} team members
          </span>
        </div>
      )}
      
      {/* First shift / Primary selector */}
      <ShiftUserSelector
        label={requiresShiftSplit ? "1st Shift Assignee" : "Assignee"}
        shift={startingShift}
        users={filteredUsers}
        selectedUserId={selection.firstShiftUserId}
        onSelect={handleFirstShiftChange}
        assignedUserIds={assignedUserIds}
        getUserStatus={getUserStatus}
      />
      
      {/* Second shift selector (only if split) */}
      {requiresShiftSplit && (
        <ShiftUserSelector
          label="2nd Shift Assignee"
          shift={startingShift === 1 ? 2 : 1}
          users={filteredUsers}
          selectedUserId={selection.secondShiftUserId}
          onSelect={handleSecondShiftChange}
          assignedUserIds={assignedUserIds}
          getUserStatus={getUserStatus}
        />
      )}
    </div>
  )
}

// Re-export utility functions
export { detectsShiftRollover, getShiftForTime, formatShiftTimeRange }
