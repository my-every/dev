"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Search,
  User,
  Clock,
  Star,
  CheckCircle,
  XCircle,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

// User type matching CSV columns
export interface TeamUser {
  badge: string
  pin: string
  requires_pin_change: boolean
  legal_name: string
  preferred_name: string
  initials: string
  role: string
  primary_lwc: string
  shift: number
  email: string
  phone: string
  is_active: boolean
  created_at: string
  updated_at: string
  hire_date: string
  years_experience: number
  skill_brand_list: number
  skill_branding: number
  skill_build_up: number
  skill_wiring: number
  skill_wiring_ipv: number
  skill_box_build: number
  skill_cross_wire: number
  skill_test: number
  skill_pwr_check: number
  skill_biq: number
  skill_green_change: number
}

// Skill rating display
const SKILL_LEVELS = ["N/A", "Trainee", "Basic", "Proficient", "Expert"] as const

// Skill color mapping
function getSkillColor(level: number): string {
  switch (level) {
    case 4: return "bg-green-500"
    case 3: return "bg-blue-500"
    case 2: return "bg-yellow-500"
    case 1: return "bg-orange-500"
    default: return "bg-muted"
  }
}

// Parse CSV data
function parseCSV(csvText: string): TeamUser[] {
  const lines = csvText.trim().split("\n")
  const headers = lines[0].split(",")
  
  return lines.slice(1).map(line => {
    const values = line.split(",")
    const user: Record<string, string | number | boolean> = {}
    
    headers.forEach((header, index) => {
      const value = values[index] || ""
      
      // Type conversion based on field
      if (header === "requires_pin_change" || header === "is_active") {
        user[header] = value === "true"
      } else if (header === "shift" || header.startsWith("skill_") || header === "years_experience") {
        user[header] = parseFloat(value) || 0
      } else {
        user[header] = value
      }
    })
    
    return user as unknown as TeamUser
  })
}

interface UserListProps {
  csvData: string
  onUserSelect?: (user: TeamUser) => void
  selectedUserId?: string
  requiredSkill?: "build_up" | "wiring" | "test" | "box_build" | "branding"
  className?: string
  isLoading?: boolean
  /** Set of user badges that are currently assigned to tasks */
  assignedUserIds?: Set<string>
  /** Filter mode for assigned status */
  assignedFilter?: "all" | "assigned" | "unassigned"
  /** Callback when assigned filter changes */
  onAssignedFilterChange?: (filter: "all" | "assigned" | "unassigned") => void
}

export function UserList({
  csvData,
  onUserSelect,
  selectedUserId,
  requiredSkill,
  className,
  isLoading = false,
  assignedUserIds = new Set(),
  assignedFilter = "all",
  onAssignedFilterChange,
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [shiftFilter, setShiftFilter] = useState<"all" | "1" | "2">("all")
  
  const users = useMemo(() => parseCSV(csvData), [csvData])
  
  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let result = users.filter(user => user.is_active)
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(user =>
        user.preferred_name.toLowerCase().includes(query) ||
        user.legal_name.toLowerCase().includes(query) ||
        user.badge.includes(query)
      )
    }
    
    // Shift filter
    if (shiftFilter !== "all") {
      result = result.filter(user => user.shift === parseInt(shiftFilter))
    }
    
    // Assigned filter
    if (assignedFilter === "assigned") {
      result = result.filter(user => assignedUserIds.has(user.badge))
    } else if (assignedFilter === "unassigned") {
      result = result.filter(user => !assignedUserIds.has(user.badge))
    }
    
    // Sort by relevant skill if specified
    if (requiredSkill) {
      const skillKey = `skill_${requiredSkill}` as keyof TeamUser
      result = result.sort((a, b) => {
        const aSkill = (a[skillKey] as number) || 0
        const bSkill = (b[skillKey] as number) || 0
        return bSkill - aSkill
      })
    } else {
      // Default sort by years of experience
      result = result.sort((a, b) => b.years_experience - a.years_experience)
    }
    
    return result
  }, [users, searchQuery, shiftFilter, requiredSkill, assignedFilter, assignedUserIds])
  
  // Get user's primary skill level for a task
  const getRelevantSkillLevel = (user: TeamUser): number => {
    if (!requiredSkill) return 0
    const skillKey = `skill_${requiredSkill}` as keyof TeamUser
    return (user[skillKey] as number) || 0
  }
  
  if (isLoading) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="p-3 border-b space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="border-b p-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or badge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        {/* Shift tabs */}
        <Tabs value={shiftFilter} onValueChange={(v) => setShiftFilter(v as "all" | "1" | "2")}>
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs">
              All Shifts
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {users.filter(u => u.is_active).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="1" className="text-xs">
              1st Shift
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {users.filter(u => u.is_active && u.shift === 1).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="2" className="text-xs">
              2nd Shift
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {users.filter(u => u.is_active && u.shift === 2).length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Assigned filter - only show if onAssignedFilterChange is provided */}
        {onAssignedFilterChange && (
          <Tabs value={assignedFilter} onValueChange={(v) => onAssignedFilterChange(v as "all" | "assigned" | "unassigned")}>
            <TabsList className="w-full grid grid-cols-3 h-8">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs">
                Assigned
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {users.filter(u => u.is_active && assignedUserIds.has(u.badge)).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="text-xs">
                Available
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {users.filter(u => u.is_active && !assignedUserIds.has(u.badge)).length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredUsers.length} team members</span>
          {requiredSkill && (
            <Badge variant="outline" className="text-[10px]">
              Sorted by {requiredSkill.replace("_", " ")} skill
            </Badge>
          )}
        </div>
      </div>
      
      {/* User list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredUsers.map((user) => {
            const skillLevel = getRelevantSkillLevel(user)
            const isSelected = selectedUserId === user.badge
            
            return (
              <button
                key={user.badge}
                onClick={() => onUserSelect?.(user)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                  "hover:bg-accent",
                  isSelected && "bg-accent ring-1 ring-primary"
                )}
              >
                {/* Avatar */}
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs font-medium bg-primary/10">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">
                      {user.preferred_name}
                    </span>
                    {user.role === "TEAM_LEAD" && (
                      <Star className="h-3 w-3 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{user.primary_lwc.replace("_", " ")}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{user.years_experience.toFixed(1)}y exp</span>
                  </div>
                </div>
                
                {/* Skill indicator */}
                {requiredSkill && skillLevel > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                i < skillLevel ? getSkillColor(skillLevel) : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{SKILL_LEVELS[skillLevel]} at {requiredSkill.replace("_", " ")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Busy indicator */}
                {assignedUserIds.has(user.badge) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px] px-1.5 bg-amber-100 text-amber-700 border-amber-200"
                        >
                          Busy
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Currently assigned to a task</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Shift badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] px-1.5",
                    user.shift === 1 ? "border-blue-200 text-blue-700" : "border-orange-200 text-orange-700"
                  )}
                >
                  {user.shift === 1 ? "1st" : "2nd"}
                </Badge>
              </button>
            )
          })}
          
          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No team members found</p>
              <p className="text-xs text-muted-foreground/70">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// Skeleton loading dropdown for user assignment
interface UserAssignmentDropdownProps {
  users: TeamUser[]
  selectedUser?: TeamUser
  onSelect: (user: TeamUser) => void
  requiredSkill?: "build_up" | "wiring" | "test" | "box_build" | "branding"
  isLoading?: boolean
  className?: string
}

export function UserAssignmentDropdown({
  users,
  selectedUser,
  onSelect,
  requiredSkill,
  isLoading = false,
  className,
}: UserAssignmentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Sort and filter users by skill
  const sortedUsers = useMemo(() => {
    let result = users.filter(u => u.is_active)
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(u =>
        u.preferred_name.toLowerCase().includes(query) ||
        u.initials.toLowerCase().includes(query)
      )
    }
    
    if (requiredSkill) {
      const skillKey = `skill_${requiredSkill}` as keyof TeamUser
      result = result.sort((a, b) => {
        const aSkill = (a[skillKey] as number) || 0
        const bSkill = (b[skillKey] as number) || 0
        return bSkill - aSkill
      })
    }
    
    return result
  }, [users, searchQuery, requiredSkill])
  
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected user display */}
      {selectedUser ? (
        <div className="flex items-center gap-2 p-2 rounded-lg border bg-accent/50">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{selectedUser.initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">{selectedUser.preferred_name}</p>
            <p className="text-xs text-muted-foreground">{selectedUser.primary_lwc}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null as unknown as TeamUser)}
            className="h-6 px-2 text-xs"
          >
            Change
          </Button>
        </div>
      ) : (
        <>
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          {/* User options */}
          <ScrollArea className="h-48">
            <div className="space-y-1">
              {sortedUsers.slice(0, 10).map((user) => {
                const skillKey = requiredSkill ? `skill_${requiredSkill}` as keyof TeamUser : null
                const skillLevel = skillKey ? (user[skillKey] as number) || 0 : 0
                
                return (
                  <button
                    key={user.badge}
                    onClick={() => onSelect(user)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{user.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.preferred_name}</p>
                      <p className="text-xs text-muted-foreground">{user.years_experience.toFixed(1)}y exp</p>
                    </div>
                    {requiredSkill && skillLevel > 0 && (
                      <Badge variant="secondary" className={cn("text-[10px]", getSkillColor(skillLevel), "text-white")}>
                        {SKILL_LEVELS[skillLevel]}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}

export { parseCSV }
