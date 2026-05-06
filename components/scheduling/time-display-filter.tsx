"use client"

import { useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Clock,
  Timer,
  CheckCircle2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"
import type { TimeDisplayMode } from "@/types/scheduling"

interface TimeDisplayFilterProps {
  value: TimeDisplayMode
  onChange: (mode: TimeDisplayMode) => void
  className?: string
  disabled?: boolean
}

interface ModeConfig {
  icon: LucideIcon
  label: string
  description: string
  shortLabel: string
}

const MODE_CONFIG: Record<TimeDisplayMode, ModeConfig> = {
  estimate: {
    icon: Clock,
    label: "Estimate Time",
    description: "Show scheduled duration with striped background",
    shortLabel: "Estimate",
  },
  current: {
    icon: Timer,
    label: "Current Time",
    description: "Show progress from start to now",
    shortLabel: "Current",
  },
  completion: {
    icon: CheckCircle2,
    label: "Completion Time",
    description: "Compare actual vs estimated duration",
    shortLabel: "Completion",
  },
}

const MODE_ORDER: TimeDisplayMode[] = ["estimate", "current", "completion"]

export function TimeDisplayFilter({
  value,
  onChange,
  className,
  disabled,
}: TimeDisplayFilterProps) {
  const currentMode = MODE_CONFIG[value]
  const Icon = currentMode.icon

  const handleSelect = useCallback(
    (mode: TimeDisplayMode) => {
      onChange(mode)
    },
    [onChange]
  )

  return (
    <div className={cn("inline-flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            className="gap-2"
            aria-label={`Time display: ${currentMode.label}`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentMode.shortLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Time Display Mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MODE_ORDER.map((mode) => {
            const config = MODE_CONFIG[mode]
            const ModeIcon = config.icon
            const isSelected = mode === value

            return (
              <DropdownMenuItem
                key={mode}
                onClick={() => handleSelect(mode)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 py-2",
                  isSelected && "bg-accent"
                )}
              >
                <ModeIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected && "text-primary"
                    )}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {config.description}
                  </span>
                </div>
                {isSelected && (
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Split button variant with quick toggle
interface TimeDisplaySplitButtonProps {
  value: TimeDisplayMode
  onChange: (mode: TimeDisplayMode) => void
  className?: string
  disabled?: boolean
}

export function TimeDisplaySplitButton({
  value,
  onChange,
  className,
  disabled,
}: TimeDisplaySplitButtonProps) {
  const currentMode = MODE_CONFIG[value]
  const Icon = currentMode.icon

  // Cycle through modes on main button click
  const handleCycle = useCallback(() => {
    const currentIndex = MODE_ORDER.indexOf(value)
    const nextIndex = (currentIndex + 1) % MODE_ORDER.length
    onChange(MODE_ORDER[nextIndex])
  }, [value, onChange])

  const handleSelect = useCallback(
    (mode: TimeDisplayMode) => {
      onChange(mode)
    },
    [onChange]
  )

  return (
    <div className={cn("inline-flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2"
            disabled={disabled}
            aria-label={`Time display: ${currentMode.label}`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentMode.shortLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Time Display Mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MODE_ORDER.map((mode) => {
            const config = MODE_CONFIG[mode]
            const ModeIcon = config.icon
            const isSelected = mode === value

            return (
              <DropdownMenuItem
                key={mode}
                onSelect={() => handleSelect(mode)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 py-2",
                  isSelected && "bg-accent"
                )}
              >
                <ModeIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected && "text-primary"
                    )}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {config.description}
                  </span>
                </div>
                {isSelected && (
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground">
              Click to select a time display mode. Each mode shows different
              aspects of assignment timing.
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Visual legend for time display modes
interface TimeDisplayLegendProps {
  className?: string
}

export function TimeDisplayLegend({ className }: TimeDisplayLegendProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4 text-xs", className)}>
      {/* Estimate */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded bg-gray-200 slot-estimate-pattern" />
        <span className="text-muted-foreground">Estimate</span>
      </div>

      {/* Current/In Progress */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded border-l-4 border-l-blue-500 bg-blue-100" />
        <span className="text-muted-foreground">In Progress</span>
      </div>

      {/* Completion - Early */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded border-l-4 border-l-green-500 bg-green-100" />
        <span className="text-muted-foreground">Early</span>
      </div>

      {/* Completion - On Time */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded border-l-4 border-l-emerald-500 bg-emerald-100" />
        <span className="text-muted-foreground">On Time</span>
      </div>

      {/* Completion - Late */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded border-l-4 border-l-red-500 bg-red-100" />
        <span className="text-muted-foreground">Late</span>
      </div>

      {/* Takeover */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-8 rounded bg-amber-100 ring-2 ring-amber-400 ring-offset-1" />
        <span className="text-muted-foreground">Takeover</span>
      </div>
    </div>
  )
}
