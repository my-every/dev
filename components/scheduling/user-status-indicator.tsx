"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, Coffee, CheckCircle, XCircle, Briefcase } from "lucide-react"
import {
  useUserTimeTracking,
  type UserAvailabilityStatus,
  type UserTimeState,
} from "@/contexts/user-time-tracking-context"

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: typeof Clock
  dotColor: string
}

const STATUS_CONFIG: Record<UserAvailabilityStatus, StatusConfig> = {
  available: {
    label: "Available",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: CheckCircle,
    dotColor: "bg-emerald-500",
  },
  busy: {
    label: "Busy",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: Briefcase,
    dotColor: "bg-amber-500",
  },
  "on-break": {
    label: "On Break",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Coffee,
    dotColor: "bg-blue-500",
  },
  offline: {
    label: "Offline",
    color: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    icon: XCircle,
    dotColor: "bg-gray-400",
  },
}

// ============================================================================
// UserStatusIndicator Component
// ============================================================================

interface UserStatusIndicatorProps {
  userId: string
  /** Display variant */
  variant?: "badge" | "dot" | "icon" | "full"
  /** Size of the indicator */
  size?: "sm" | "md" | "lg"
  /** Show tooltip with details */
  showTooltip?: boolean
  /** Additional class name */
  className?: string
}

export function UserStatusIndicator({
  userId,
  variant = "badge",
  size = "md",
  showTooltip = true,
  className,
}: UserStatusIndicatorProps) {
  const { getUserState } = useUserTimeTracking()
  const state = getUserState(userId)
  const config = STATUS_CONFIG[state.status]
  const Icon = config.icon

  const sizeClasses = {
    sm: {
      dot: "h-2 w-2",
      icon: "h-3 w-3",
      badge: "text-[10px] px-1.5 py-0",
      text: "text-xs",
    },
    md: {
      dot: "h-2.5 w-2.5",
      icon: "h-4 w-4",
      badge: "text-xs px-2 py-0.5",
      text: "text-sm",
    },
    lg: {
      dot: "h-3 w-3",
      icon: "h-5 w-5",
      badge: "text-sm px-2.5 py-1",
      text: "text-base",
    },
  }

  const content = useMemo(() => {
    switch (variant) {
      case "dot":
        return (
          <span
            className={cn(
              "rounded-full",
              config.dotColor,
              sizeClasses[size].dot,
              className
            )}
          />
        )
      case "icon":
        return (
          <Icon
            className={cn(
              config.color,
              sizeClasses[size].icon,
              className
            )}
          />
        )
      case "full":
        return (
          <div className={cn("flex items-center gap-1.5", className)}>
            <span
              className={cn(
                "rounded-full",
                config.dotColor,
                sizeClasses[size].dot
              )}
            />
            <span className={cn(config.color, sizeClasses[size].text)}>
              {config.label}
            </span>
          </div>
        )
      case "badge":
      default:
        return (
          <Badge
            variant="outline"
            className={cn(
              config.color,
              config.bgColor,
              config.borderColor,
              sizeClasses[size].badge,
              className
            )}
          >
            {config.label}
          </Badge>
        )
    }
  }, [variant, config, size, className])

  if (!showTooltip) {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <UserStatusTooltipContent state={state} config={config} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Tooltip Content
// ============================================================================

interface UserStatusTooltipContentProps {
  state: UserTimeState
  config: StatusConfig
}

function UserStatusTooltipContent({ state, config }: UserStatusTooltipContentProps) {
  const Icon = config.icon

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <Icon className="h-3.5 w-3.5" />
        <span>{config.label}</span>
      </div>
      
      {state.clockRecord && (
        <div className="text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Clocked in: {new Date(state.clockRecord.clockInTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {state.clockRecord.totalBreakMinutes > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Coffee className="h-3 w-3" />
              <span>Break time: {state.clockRecord.totalBreakMinutes}m</span>
            </div>
          )}
        </div>
      )}
      
      {state.currentAssignment && (
        <div className="text-muted-foreground border-t pt-1 mt-1">
          <div className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            <span className="truncate max-w-[150px]">
              {state.currentAssignment.assignmentName}
            </span>
          </div>
          <div className="text-[10px] mt-0.5">
            {state.currentAssignment.startTime} - {state.currentAssignment.estimatedEndTime}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ClockInOutButton Component
// ============================================================================

interface ClockInOutButtonProps {
  userId: string
  shift: 1 | 2
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional class name */
  className?: string
}

export function ClockInOutButton({
  userId,
  shift,
  size = "md",
  className,
}: ClockInOutButtonProps) {
  const { getUserState, clockIn, clockOut, startBreak, endBreak } = useUserTimeTracking()
  const state = getUserState(userId)
  const isClocked = !!state.clockRecord && !state.clockRecord.clockOutTime
  const isOnBreak = state.status === "on-break"

  const sizeClasses = {
    sm: "h-7 text-xs px-2",
    md: "h-9 text-sm px-3",
    lg: "h-11 text-base px-4",
  }

  if (!isClocked) {
    return (
      <button
        onClick={() => clockIn(userId, shift)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md",
          "bg-emerald-600 text-white hover:bg-emerald-700",
          "transition-colors font-medium",
          sizeClasses[size],
          className
        )}
      >
        <Clock className="h-4 w-4" />
        Clock In
      </button>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Break toggle button */}
      <button
        onClick={() => (isOnBreak ? endBreak(userId) : startBreak(userId))}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md",
          "border transition-colors font-medium",
          isOnBreak
            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
            : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50",
          sizeClasses[size]
        )}
      >
        <Coffee className="h-4 w-4" />
        {isOnBreak ? "End Break" : "Start Break"}
      </button>
      
      {/* Clock out button */}
      <button
        onClick={() => clockOut(userId)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md",
          "bg-red-600 text-white hover:bg-red-700",
          "transition-colors font-medium",
          sizeClasses[size]
        )}
      >
        <XCircle className="h-4 w-4" />
        Clock Out
      </button>
    </div>
  )
}

// ============================================================================
// UserStatusDot - Minimal inline status indicator
// ============================================================================

interface UserStatusDotProps {
  status: UserAvailabilityStatus
  className?: string
}

export function UserStatusDot({ status, className }: UserStatusDotProps) {
  const config = STATUS_CONFIG[status]
  
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        config.dotColor,
        className
      )}
    />
  )
}

// Re-export status config for external use
export { STATUS_CONFIG }
