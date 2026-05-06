"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Building2, Circle } from "lucide-react"
import {
  FLOOR_AREAS,
  FLOOR_AREA_META,
  type FloorArea,
} from "@/types/floor-layout"

// ============================================================================
// LWC Navigation Tabs (Single Selection)
// ============================================================================

interface LWCNavTabsProps {
  /** Currently selected floor area */
  selectedArea: FloorArea
  /** Callback when area changes */
  onChange: (area: FloorArea) => void
  /** Optional count per area for badges */
  areaCounts?: Record<FloorArea, number>
  /** Class name for the container */
  className?: string
}

/** Navigation tabs for switching between LWC floor areas (single selection) */
export function LWCNavTabs({ selectedArea, onChange, areaCounts, className }: LWCNavTabsProps) {
  // Only show main floor areas (not FLOAT or NTB)
  const mainAreas: FloorArea[] = ["NEW_FLEX", "ONSKID", "OFFSKID"]
  
  return (
    <Tabs value={selectedArea} onValueChange={(v) => onChange(v as FloorArea)} className={className}>
      <TabsList className="h-10">
        {mainAreas.map((area) => {
          const meta = FLOOR_AREA_META[area]
          const count = areaCounts?.[area]
          
          return (
            <TabsTrigger
              key={area}
              value={area}
              className="gap-2 px-4 data-[state=active]:shadow-sm"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  meta.color
                )}
              />
              <span>{meta.label}</span>
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

// ============================================================================
// LWC Floor Area Filter
// ============================================================================

interface LWCFilterProps {
  selectedAreas: FloorArea[]
  onChange: (areas: FloorArea[]) => void
  className?: string
}

export function LWCFilter({ selectedAreas, onChange, className }: LWCFilterProps) {
  const allSelected = selectedAreas.length === FLOOR_AREAS.length
  const noneSelected = selectedAreas.length === 0

  const handleToggleArea = (area: FloorArea) => {
    if (selectedAreas.includes(area)) {
      onChange(selectedAreas.filter((a) => a !== area))
    } else {
      onChange([...selectedAreas, area])
    }
  }

  const handleSelectAll = () => {
    onChange([...FLOOR_AREAS])
  }

  const handleClearAll = () => {
    onChange([])
  }

  // Get display label
  const displayLabel = useMemo(() => {
    if (allSelected || noneSelected) return "All Areas"
    if (selectedAreas.length === 1) {
      return FLOOR_AREA_META[selectedAreas[0]].label
    }
    return `${selectedAreas.length} Areas`
  }, [selectedAreas, allSelected, noneSelected])

  return (
    <div className={cn("flex items-center", className)}>
      {/* Split button - main areas as individual buttons */}
      <div className="flex items-center rounded-lg border bg-muted/50 p-1">
        {FLOOR_AREAS.filter(area => area !== "FLOAT" && area !== "NTB").map((area) => {
          const meta = FLOOR_AREA_META[area]
          const isSelected = selectedAreas.includes(area)

          return (
            <Button
              key={area}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 gap-1.5 px-3 text-xs font-medium transition-all",
                isSelected && "shadow-sm"
              )}
              onClick={() => handleToggleArea(area)}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  meta.color
                )}
              />
              {meta.label}
            </Button>
          )
        })}

        {/* Dropdown for additional options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Floor
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {FLOOR_AREAS.map((area) => {
              const meta = FLOOR_AREA_META[area]
              return (
                <DropdownMenuCheckboxItem
                  key={area}
                  checked={selectedAreas.includes(area)}
                  onCheckedChange={() => handleToggleArea(area)}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", meta.color)} />
                    {meta.label}
                  </span>
                </DropdownMenuCheckboxItem>
              )
            })}

            <DropdownMenuSeparator />
            <div className="flex gap-1 p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={handleClearAll}
              >
                Clear
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ============================================================================
// Availability Filter
// ============================================================================

export type AvailabilityFilter = "all" | "available" | "occupied"

interface AvailabilityFilterProps {
  value: AvailabilityFilter
  onChange: (value: AvailabilityFilter) => void
  className?: string
}

export function AvailabilityFilterButton({
  value,
  onChange,
  className,
}: AvailabilityFilterProps) {
  return (
    <div className={cn("flex items-center rounded-lg border bg-muted/50 p-1", className)}>
      <Button
        variant={value === "all" ? "accent" : "ghost"}
        size="sm"
        className="h-8 px-3 text-xs font-medium"
        onClick={() => onChange("all")}
      >
        All
      </Button>
      <Button
        variant={value === "available" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 gap-1.5 px-3 text-xs font-medium",
          value === "available" && "bg-green-200 hover:bg-green-300"
        )}
        onClick={() => onChange("available")}
      >
       
        Available
      </Button>
      <Button
        variant={value === "occupied" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 gap-1.5 px-3 text-xs font-medium",
          value === "occupied" && "bg-amber-300 hover:bg-amber-400"
        )}
        onClick={() => onChange("occupied")}
      >
     
        Occupied
      </Button>
    </div>
  )
}

// ============================================================================
// Combined LWC Control Bar
// ============================================================================

interface LWCControlBarProps {
  selectedAreas: FloorArea[]
  onAreasChange: (areas: FloorArea[]) => void
  availabilityFilter: AvailabilityFilter
  onAvailabilityChange: (value: AvailabilityFilter) => void
  className?: string
}

export function LWCControlBar({
  selectedAreas,
  onAreasChange,
  availabilityFilter,
  onAvailabilityChange,
  className,
}: LWCControlBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <LWCFilter selectedAreas={selectedAreas} onChange={onAreasChange} />
      <AvailabilityFilterButton
        value={availabilityFilter}
        onChange={onAvailabilityChange}
      />
    </div>
  )
}
