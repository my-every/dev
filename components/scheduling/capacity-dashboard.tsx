"use client"

import { cn } from "@/lib/utils"
import type { ShiftId } from "@/types/shifts"
import { ALL_SHIFT_IDS, SHIFT_SCHEDULES } from "@/types/shifts"
import { useShiftCapacity } from "@/hooks/use-shift-capacity"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, TrendingUp, AlertTriangle } from "lucide-react"

interface CapacityDashboardProps {
  className?: string
}

export function CapacityDashboard({ className }: CapacityDashboardProps) {
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
    <div className={cn("space-y-4", className)}>
      {/* Overall stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Capacity"
          value={formatMinutes(totalCapacity)}
          description="Available work hours"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Assigned"
          value={formatMinutes(totalAssigned)}
          description={`${overallUtilization}% utilization`}
          icon={<TrendingUp className="h-4 w-4" />}
          variant={overallUtilization > 90 ? "warning" : "default"}
        />
        <StatCard
          title="Remaining"
          value={formatMinutes(totals.remainingStandardMinutes + totals.remainingOvertimeMinutes)}
          description="Available capacity"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Overtime Used"
          value={formatMinutes(totals.assignedOvertimeMinutes)}
          description={`of ${formatMinutes(totals.totalOvertimeMinutes)} available`}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={totals.assignedOvertimeMinutes > 0 ? "warning" : "default"}
        />
      </div>

      {/* Per-shift capacity cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {ALL_SHIFT_IDS.map((shiftId) => (
          <ShiftCapacityCard
            key={shiftId}
            shiftId={shiftId}
            capacity={capacities[shiftId]}
          />
        ))}
      </div>
    </div>
  )
}

// Stat card component
interface StatCardProps {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  variant?: "default" | "warning"
}

function StatCard({ title, value, description, icon, variant = "default" }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn(
          "text-muted-foreground",
          variant === "warning" && "text-amber-500"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

// Shift capacity card component
interface ShiftCapacityCardProps {
  shiftId: ShiftId
  capacity: {
    totalStandardMinutes: number
    totalOvertimeMinutes: number
    assignedStandardMinutes: number
    assignedOvertimeMinutes: number
    remainingStandardMinutes: number
    remainingOvertimeMinutes: number
    utilizationPercent: number
  }
}

function ShiftCapacityCard({ shiftId, capacity }: ShiftCapacityCardProps) {
  const schedule = SHIFT_SCHEDULES[shiftId]
  
  const standardUsagePercent = capacity.totalStandardMinutes > 0
    ? Math.round((capacity.assignedStandardMinutes / capacity.totalStandardMinutes) * 100)
    : 0
  
  const overtimeUsagePercent = capacity.totalOvertimeMinutes > 0
    ? Math.round((capacity.assignedOvertimeMinutes / capacity.totalOvertimeMinutes) * 100)
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{schedule.label}</CardTitle>
            <CardDescription>
              {schedule.standardStart} - {schedule.standardEnd}
            </CardDescription>
          </div>
          <Badge
            variant={capacity.utilizationPercent > 90 ? "destructive" : "secondary"}
          >
            {capacity.utilizationPercent}% utilized
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Standard hours */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Standard Hours</span>
            <span>
              {formatMinutes(capacity.assignedStandardMinutes)} /{" "}
              {formatMinutes(capacity.totalStandardMinutes)}
            </span>
          </div>
          <Progress value={standardUsagePercent} className="h-2" />
        </div>

        {/* Overtime hours */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Overtime
            </span>
            <span>
              {formatMinutes(capacity.assignedOvertimeMinutes)} /{" "}
              {formatMinutes(capacity.totalOvertimeMinutes)}
            </span>
          </div>
          <Progress 
            value={overtimeUsagePercent} 
            className={cn(
              "h-2",
              overtimeUsagePercent > 0 && "[&>div]:bg-amber-500"
            )} 
          />
        </div>

        {/* Remaining capacity */}
        <div className="flex items-center justify-between pt-2 text-sm border-t">
          <span className="font-medium">Remaining Capacity</span>
          <span className="font-medium text-primary">
            {formatMinutes(capacity.remainingStandardMinutes + capacity.remainingOvertimeMinutes)}
          </span>
        </div>
      </CardContent>
    </Card>
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
