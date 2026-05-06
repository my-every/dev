"use client"

import { cn } from "@/lib/utils"
import { ALL_SHIFT_IDS } from "@/types/shifts"
import { useShiftCapacity } from "@/hooks/use-shift-capacity"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, TrendingUp, AlertTriangle, Users } from "lucide-react"

interface CapacityStatsBarProps {
  className?: string
}

export function CapacityStatsBar({ className }: CapacityStatsBarProps) {
  const capacities = useShiftCapacity()

  // Calculate totals across all shifts
  const totals = {
    totalStandardMinutes: 0,
    totalOvertimeMinutes: 0,
    assignedStandardMinutes: 0,
    assignedOvertimeMinutes: 0,
    remainingStandardMinutes: 0,
    remainingOvertimeMinutes: 0,
  }

  for (const shiftId of ALL_SHIFT_IDS) {
    const capacity = capacities[shiftId]
    totals.totalStandardMinutes += capacity.totalStandardMinutes
    totals.totalOvertimeMinutes += capacity.totalOvertimeMinutes
    totals.assignedStandardMinutes += capacity.assignedStandardMinutes
    totals.assignedOvertimeMinutes += capacity.assignedOvertimeMinutes
    totals.remainingStandardMinutes += capacity.remainingStandardMinutes
    totals.remainingOvertimeMinutes += capacity.remainingOvertimeMinutes
  }

  const totalCapacity = totals.totalStandardMinutes + totals.totalOvertimeMinutes
  const totalAssigned = totals.assignedStandardMinutes + totals.assignedOvertimeMinutes
  const overallUtilization = totalCapacity > 0 
    ? Math.round((totalAssigned / totalCapacity) * 100) 
    : 0

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-4", className)}>
        {/* Utilization with progress */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Progress 
                  value={overallUtilization} 
                  className={cn(
                    "h-2 w-20",
                    overallUtilization > 90 && "[&>div]:bg-amber-500"
                  )} 
                />
                <span className="text-sm font-medium">{overallUtilization}%</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Overall Utilization</p>
            <p className="text-xs text-muted-foreground">
              {formatMinutes(totalAssigned)} / {formatMinutes(totalCapacity)}
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border" />

        {/* Capacity */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatMinutes(totalCapacity)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total Capacity</p>
          </TooltipContent>
        </Tooltip>

        {/* Remaining */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-primary">
                {formatMinutes(totals.remainingStandardMinutes + totals.remainingOvertimeMinutes)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Remaining Capacity</p>
          </TooltipContent>
        </Tooltip>

        {/* Overtime indicator */}
        {totals.assignedOvertimeMinutes > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {formatMinutes(totals.assignedOvertimeMinutes)} OT
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Overtime Used</p>
                <p className="text-xs text-muted-foreground">
                  of {formatMinutes(totals.totalOvertimeMinutes)} available
                </p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

// Helper to format minutes as hours
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
