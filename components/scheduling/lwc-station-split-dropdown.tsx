"use client"

import { useState, useMemo } from "react"
import type { TeamUser } from "@/components/scheduling/user-list"
import type { FloorArea, StationDefinition } from "@/types/floor-layout"
import { OFFSKID_STATIONS, ONSKID_STATIONS, NEW_FLEX_STATIONS, FLOOR_AREA_META } from "@/types/floor-layout"
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
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ChevronsUpDown, Check, User } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

export interface ShiftAssignee {
  id: string
  name: string
  shift: 1 | 2
}

export interface LWCStationSplitDropdownProps {
  /** All available team users */
  teamUsers: TeamUser[]
  /** Currently selected 1st shift assignee ID */
  firstShiftAssigneeId: string | null
  /** Currently selected 2nd shift assignee ID (optional, only for split assignments) */
  secondShiftAssigneeId?: string | null
  /** Whether this assignment spans both shifts */
  requiresShiftSplit: boolean
  /** Callback when 1st shift assignee changes */
  onFirstShiftChange: (userId: string | null) => void
  /** Callback when 2nd shift assignee changes */
  onSecondShiftChange?: (userId: string | null) => void
  /** Optional filter to show only users from specific floor area */
  floorAreaFilter?: FloorArea
  /** Optional station for context */
  station?: StationDefinition
  /** Class name for the container */
  className?: string
}

// ============================================================================
// Assignee Selector Component
// ============================================================================

interface AssigneeSelectorProps {
  label: string
  shiftLabel: string
  users: TeamUser[]
  selectedUserId: string | null
  onSelect: (userId: string | null) => void
  placeholder?: string
}

function AssigneeSelector({
  label,
  shiftLabel,
  users,
  selectedUserId,
  onSelect,
  placeholder = "Select assignee...",
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false)
  
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return users.find(u => u.badge === selectedUserId) || null
  }, [selectedUserId, users])

  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">
        {label}
        <Badge variant="outline" className="text-[10px] font-normal">
          {shiftLabel}
        </Badge>
      </Label>
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
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {selectedUser.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{selectedUser.preferred_name}</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{placeholder}</span>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search team members..." />
            <CommandList>
              <CommandEmpty>No team member found.</CommandEmpty>
              <CommandGroup>
                {/* Clear option */}
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedUserId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">None</span>
                </CommandItem>
                {users.map((user) => (
                  <CommandItem
                    key={user.badge}
                    value={`${user.preferred_name} ${user.badge}`}
                    onSelect={() => {
                      onSelect(user.badge)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedUserId === user.badge ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Avatar className="mr-2 h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{user.preferred_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.primary_lwc} | {user.years_experience.toFixed(1)}y exp
                      </span>
                    </div>
                  </CommandItem>
                ))}
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

export function LWCStationSplitDropdown({
  teamUsers,
  firstShiftAssigneeId,
  secondShiftAssigneeId,
  requiresShiftSplit,
  onFirstShiftChange,
  onSecondShiftChange,
  floorAreaFilter,
  station,
  className,
}: LWCStationSplitDropdownProps) {
  // Filter users by shift
  const firstShiftUsers = useMemo(() => {
    let users = teamUsers.filter(u => u.shift === 1)
    if (floorAreaFilter) {
      users = users.filter(u => u.primary_lwc === floorAreaFilter || u.secondary_lwc === floorAreaFilter)
    }
    return users.sort((a, b) => b.years_experience - a.years_experience)
  }, [teamUsers, floorAreaFilter])

  const secondShiftUsers = useMemo(() => {
    let users = teamUsers.filter(u => u.shift === 2)
    if (floorAreaFilter) {
      users = users.filter(u => u.primary_lwc === floorAreaFilter || u.secondary_lwc === floorAreaFilter)
    }
    return users.sort((a, b) => b.years_experience - a.years_experience)
  }, [teamUsers, floorAreaFilter])

  return (
    <div className={cn("space-y-3", className)}>
      {/* 1st Shift Assignee */}
      <AssigneeSelector
        label="1st Shift Assignee"
        shiftLabel="04:00 - 14:30"
        users={firstShiftUsers}
        selectedUserId={firstShiftAssigneeId}
        onSelect={onFirstShiftChange}
        placeholder="Select 1st shift assignee..."
      />

      {/* 2nd Shift Assignee (only shown if shift split is required) */}
      {requiresShiftSplit && (
        <AssigneeSelector
          label="2nd Shift Assignee"
          shiftLabel="15:00 - 23:00"
          users={secondShiftUsers}
          selectedUserId={secondShiftAssigneeId || null}
          onSelect={onSecondShiftChange || (() => {})}
          placeholder="Select 2nd shift assignee (optional)..."
        />
      )}

      {/* Shift split indicator */}
      {requiresShiftSplit && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md">
          <span className="font-medium">Shift Rollover:</span>
          <span>This assignment spans across shift change (3:00 PM)</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Check if a time range spans the shift boundary (3:00 PM / 15:00) */
export function detectsShiftRollover(startTime: string, endTime: string): boolean {
  const SHIFT_BOUNDARY = 15 * 60 // 15:00 in minutes
  
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  
  // Shift rollover if:
  // - Start is before 15:00 AND end is at or after 15:00
  return startMinutes < SHIFT_BOUNDARY && endMinutes >= SHIFT_BOUNDARY
}

/** Get the shift for a given time */
export function getShiftForTime(time: string): 1 | 2 {
  const [hours] = time.split(':').map(Number)
  return hours < 15 ? 1 : 2
}

/** Calculate end time from start time and duration in minutes */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, mins] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMins = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}
