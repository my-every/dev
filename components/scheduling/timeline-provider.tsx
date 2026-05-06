"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react"
import type { TimelineConfig } from "@/types/scheduling"
import { timeToMinutes, minutesToTime, snapToInterval, clampMinutes } from "@/lib/time-utils"

// Default configuration
const DEFAULT_CONFIG: TimelineConfig = {
  startHour: 6,
  endHour: 18,
  snapIntervalMinutes: 15,
  pixelsPerMinute: 2,
  rowHeight: 56,
  minSlotDurationMinutes: 15,
}

// Timeline context value
interface TimelineContextValue {
  config: TimelineConfig
  containerRef: RefObject<HTMLDivElement | null>
  
  // Dimensions
  totalMinutes: number
  totalWidth: number
  
  // Position calculations
  minutesToPosition: (minutes: number) => number
  positionToMinutes: (position: number) => number
  timeToPosition: (time: string) => number
  positionToTime: (position: number) => string
  
  // Snap functions
  snapPosition: (position: number) => number
  snapTime: (time: string) => string
  
  // Drag state
  isDragging: boolean
  setIsDragging: (dragging: boolean) => void
  dragStartPosition: number | null
  setDragStartPosition: (position: number | null) => void
  
  // Zoom controls
  zoom: number
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  
  // Scroll position
  scrollToTime: (time: string) => void
  scrollToNow: () => void
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

// Provider props
interface TimelineProviderProps {
  children: ReactNode
  config?: Partial<TimelineConfig>
  initialZoom?: number
}

export function TimelineProvider({
  children,
  config: configOverrides,
  initialZoom = 1,
}: TimelineProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPosition, setDragStartPosition] = useState<number | null>(null)
  const [zoom, setZoomState] = useState(initialZoom)
  
  // Merge config with defaults
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    [configOverrides]
  )
  
  // Calculate total minutes and width
  const totalMinutes = useMemo(() => {
    let endHour = config.endHour
    // Handle overnight timelines
    if (endHour <= config.startHour) {
      endHour += 24
    }
    return (endHour - config.startHour) * 60
  }, [config.startHour, config.endHour])
  
  const totalWidth = useMemo(() => {
    return totalMinutes * config.pixelsPerMinute * zoom
  }, [totalMinutes, config.pixelsPerMinute, zoom])
  
  // Position conversion functions
  const minutesToPosition = useCallback(
    (minutes: number) => {
      const startMinutes = config.startHour * 60
      return (minutes - startMinutes) * config.pixelsPerMinute * zoom
    },
    [config.startHour, config.pixelsPerMinute, zoom]
  )
  
  const positionToMinutes = useCallback(
    (position: number) => {
      const startMinutes = config.startHour * 60
      return startMinutes + position / (config.pixelsPerMinute * zoom)
    },
    [config.startHour, config.pixelsPerMinute, zoom]
  )
  
  const timeToPosition = useCallback(
    (time: string) => {
      const minutes = timeToMinutes(time)
      return minutesToPosition(minutes)
    },
    [minutesToPosition]
  )
  
  const positionToTime = useCallback(
    (position: number) => {
      const minutes = positionToMinutes(position)
      const snapped = snapToInterval(minutes, config.snapIntervalMinutes)
      const clamped = clampMinutes(
        snapped,
        config.startHour * 60,
        config.endHour * 60
      )
      return minutesToTime(clamped)
    },
    [positionToMinutes, config.snapIntervalMinutes, config.startHour, config.endHour]
  )
  
  // Snap functions
  const snapPosition = useCallback(
    (position: number) => {
      const minutes = positionToMinutes(position)
      const snapped = snapToInterval(minutes, config.snapIntervalMinutes)
      return minutesToPosition(snapped)
    },
    [positionToMinutes, minutesToPosition, config.snapIntervalMinutes]
  )
  
  const snapTime = useCallback(
    (time: string) => {
      const minutes = timeToMinutes(time)
      const snapped = snapToInterval(minutes, config.snapIntervalMinutes)
      return minutesToTime(snapped)
    },
    [config.snapIntervalMinutes]
  )
  
  // Zoom controls
  const setZoom = useCallback((newZoom: number) => {
    setZoomState(Math.max(0.5, Math.min(3, newZoom)))
  }, [])
  
  const zoomIn = useCallback(() => {
    setZoom(zoom + 0.25)
  }, [zoom, setZoom])
  
  const zoomOut = useCallback(() => {
    setZoom(zoom - 0.25)
  }, [zoom, setZoom])
  
  // Scroll functions
  const scrollToTime = useCallback(
    (time: string) => {
      if (!containerRef.current) return
      const position = timeToPosition(time)
      containerRef.current.scrollLeft = Math.max(0, position - 100)
    },
    [timeToPosition]
  )
  
  const scrollToNow = useCallback(() => {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    scrollToTime(time)
  }, [scrollToTime])
  
  const value: TimelineContextValue = {
    config,
    containerRef,
    totalMinutes,
    totalWidth,
    minutesToPosition,
    positionToMinutes,
    timeToPosition,
    positionToTime,
    snapPosition,
    snapTime,
    isDragging,
    setIsDragging,
    dragStartPosition,
    setDragStartPosition,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    scrollToTime,
    scrollToNow,
  }
  
  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  )
}

// Hook to use timeline context
export function useTimeline() {
  const context = useContext(TimelineContext)
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider")
  }
  return context
}

// Export context for testing
export { TimelineContext }
