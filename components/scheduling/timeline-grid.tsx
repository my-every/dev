"use client"

import { useMemo, useEffect, useState, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useTimeline } from "./timeline-provider"
import { formatDisplayTime, getTimeLabels } from "@/lib/time-utils"

interface TimelineGridProps {
  children: ReactNode
  className?: string
  columnLabel?: string
  showCurrentTime?: boolean
}

export function TimelineGrid({
  children,
  className,
  columnLabel = "Resource",
  showCurrentTime = true,
}: TimelineGridProps) {
  const { config, totalWidth } = useTimeline()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)

  const timeLabels = useMemo(() => {
    return getTimeLabels(config.startHour, config.endHour, 60)
  }, [config.startHour, config.endHour])

  // Sync header scroll with content scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    const headerScroll = headerScrollRef.current
    
    if (!scrollContainer || !headerScroll) return

    const handleScroll = () => {
      headerScroll.scrollLeft = scrollContainer.scrollLeft
    }

    scrollContainer.addEventListener("scroll", handleScroll)
    return () => scrollContainer.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-card", className)}>
      {/* Header row with time labels */}
      <div className="sticky top-0 z-20 flex border-b bg-muted/50">
        {/* Column header */}
        <div className="sticky left-0 z-30 flex h-10 w-40 shrink-0 items-center border-r bg-muted px-3">
          <span className="text-xs font-medium text-muted-foreground">
            {columnLabel}
          </span>
        </div>
        
        {/* Time labels - synced with content scroll */}
        <div
          ref={headerScrollRef}
          className="flex overflow-hidden"
          style={{ width: `calc(100% - 160px)` }}
        >
          <div className="relative flex" style={{ width: totalWidth }}>
            {timeLabels.map((time, index) => (
              <TimeLabel key={time} time={time} isFirst={index === 0} />
            ))}
          </div>
        </div>
      </div>
      
      {/* Scrollable content container - scrolls all rows together */}
      <div
        ref={scrollContainerRef}
        className="scrollbar-hide relative overflow-auto"
        style={{ maxHeight: "calc(100vh - 300px)" }}
      >
        <div className="flex flex-col">
          {children}
        </div>
        
        {/* Current time indicator */}
        {showCurrentTime && <CurrentTimeIndicator />}
      </div>
    </div>
  )
}

// Time label component
interface TimeLabelProps {
  time: string
  isFirst: boolean
}

function TimeLabel({ time, isFirst }: TimeLabelProps) {
  const { config, zoom } = useTimeline()
  const width = 60 * config.pixelsPerMinute * zoom

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center border-r border-border",
        isFirst && "border-l-0"
      )}
      style={{ width }}
    >
      <span className="px-2 text-xs font-medium text-muted-foreground">
        {formatDisplayTime(time)}
      </span>
    </div>
  )
}

// Current time indicator - uses client-only rendering to avoid hydration mismatch
function CurrentTimeIndicator() {
  const { config, timeToPosition, zoom } = useTimeline()
  const [position, setPosition] = useState<number | null>(null)

  // Only calculate and render on client to avoid hydration mismatch
  useEffect(() => {
    const updatePosition = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      
      // Check if current time is within timeline range
      if (hours < config.startHour || hours >= config.endHour) {
        setPosition(null)
        return
      }
      
      const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
      setPosition(timeToPosition(timeStr))
    }
    
    updatePosition()
    const interval = setInterval(updatePosition, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [config.startHour, config.endHour, timeToPosition, zoom])

  // Don't render until we have a position calculated on the client
  if (position === null) return null

  return (
    <div
      className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-destructive"
      style={{ left: 160 + position }}
    >
      <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-destructive" />
    </div>
  )
}

// Timeline row component
interface TimelineRowProps {
  children: ReactNode
  className?: string
  label: string
  sublabel?: string
  avatar?: ReactNode
}

export function TimelineRow({
  children,
  className,
  label,
  sublabel,
  avatar,
}: TimelineRowProps) {
  const { config, totalWidth } = useTimeline()

  return (
    <div className={cn("flex border-b last:border-b-0", className)}>
      {/* Row label - sticky to left */}
      <div className="sticky left-0 z-10 flex w-40 shrink-0 items-center gap-2 border-r bg-background px-3" style={{ height: config.rowHeight }}>
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{label}</div>
          {sublabel && (
            <div className="truncate text-xs text-muted-foreground">
              {sublabel}
            </div>
          )}
        </div>
      </div>
      
      {/* Row content - no individual scroll */}
      <div
        className="relative"
        style={{ 
          width: totalWidth,
          height: config.rowHeight,
        }}
      >
        {/* Grid lines */}
        <GridLines />
        
        {/* Slot content */}
        {children}
      </div>
    </div>
  )
}

// Grid lines component
function GridLines() {
  const { config, totalWidth, zoom } = useTimeline()

  const lines = useMemo(() => {
    const result: number[] = []
    const hourWidth = 60 * config.pixelsPerMinute * zoom
    const hours = Math.ceil(totalWidth / hourWidth)
    
    for (let i = 0; i <= hours; i++) {
      result.push(i * hourWidth)
    }
    
    return result
  }, [config.pixelsPerMinute, totalWidth, zoom])

  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map((left, index) => (
        <div
          key={index}
          className="absolute top-0 h-full border-l border-border/60"
          style={{ left }}
        />
      ))}
    </div>
  )
}
