/**
 * LWC (Layout Workstation Configuration) Constants
 *
 * Default filter configurations for the project scheduler timeline.
 * These constants define the default views, filters, and display settings.
 */

import type { ShiftId } from "@/types/shifts"
import type { TimeDisplayMode, AssignmentStatus, AssignmentPriority } from "@/types/scheduling"
import { 
  FLOOR_AREAS, 
  type FloorArea, 
  type StationCategory,
  OFFSKID_STATIONS,
  ONSKID_STATIONS,
  NEW_FLEX_STATIONS,
  type StationDefinition 
} from "./floor-layout"

// ============================================================================
// Default Filter Configuration
// ============================================================================

export interface LWCFilterConfig {
  /** Default shift to display */
  defaultShift: ShiftId | "all"
  /** Default time display mode */
  defaultTimeDisplayMode: TimeDisplayMode
  /** Default floor areas to show */
  defaultFloorAreas: FloorArea[]
  /** Default station categories to show */
  defaultStationCategories: StationCategory[]
  /** Default assignment statuses to show */
  defaultStatuses: AssignmentStatus[]
  /** Default priorities to show */
  defaultPriorities: AssignmentPriority[]
  /** Whether to show overtime assignments by default */
  showOvertime: boolean
  /** Whether to show takeover assignments by default */
  showTakeovers: boolean
  /** Default zoom level (1 = 100%) */
  defaultZoom: number
  /** Minimum zoom level */
  minZoom: number
  /** Maximum zoom level */
  maxZoom: number
  /** Zoom step increment */
  zoomStep: number
}

export const LWC_DEFAULT_FILTERS: LWCFilterConfig = {
  defaultShift: "all",
  defaultTimeDisplayMode: "estimate",
  defaultFloorAreas: ["OFFSKID", "ONSKID", "NEW_FLEX"],
  defaultStationCategories: ["BUILD_UP", "WIRING", "TEST", "STATION"],
  defaultStatuses: ["scheduled", "in-progress", "completed", "blocked"],
  defaultPriorities: ["low", "medium", "high", "urgent"],
  showOvertime: true,
  showTakeovers: true,
  defaultZoom: 1,
  minZoom: 0.5,
  maxZoom: 2,
  zoomStep: 0.1,
}

// ============================================================================
// Timeline Display Configuration
// ============================================================================

export interface LWCTimelineConfig {
  /** Pixels per minute at 100% zoom */
  pixelsPerMinute: number
  /** Height of each station row in pixels */
  rowHeight: number
  /** Minimum slot duration in minutes */
  minSlotDurationMinutes: number
  /** Snap interval for dragging/resizing in minutes */
  snapIntervalMinutes: number
  /** Width of the station column in pixels */
  stationColumnWidth: number
  /** Whether to show the current time indicator */
  showCurrentTimeIndicator: boolean
  /** Update interval for current time indicator in ms */
  currentTimeUpdateInterval: number
}

export const LWC_TIMELINE_CONFIG: LWCTimelineConfig = {
  pixelsPerMinute: 2,
  rowHeight: 72,
  minSlotDurationMinutes: 15,
  snapIntervalMinutes: 15,
  stationColumnWidth: 192,
  showCurrentTimeIndicator: true,
  currentTimeUpdateInterval: 60000, // 1 minute
}

// ============================================================================
// Shift Boundary Configuration
// ============================================================================

export interface LWCShiftBoundary {
  /** Hour when 1st shift starts (24h format) */
  firstShiftStart: number
  /** Hour when 1st shift ends (24h format) */
  firstShiftEnd: number
  /** Hour when 2nd shift starts (24h format) */
  secondShiftStart: number
  /** Hour when 2nd shift ends (24h format) */
  secondShiftEnd: number
  /** Hour that serves as the boundary for shift indicator switching */
  shiftIndicatorBoundary: number
  /** Pixels to offset before switching shift indicator */
  shiftIndicatorOffset: number
}

export const LWC_SHIFT_BOUNDARIES: LWCShiftBoundary = {
  firstShiftStart: 4,    // 4:00 AM (including overtime)
  firstShiftEnd: 14.5,   // 2:30 PM
  secondShiftStart: 15,  // 3:00 PM
  secondShiftEnd: 24,    // Midnight (can extend to next day)
  shiftIndicatorBoundary: 15, // 3:00 PM
  shiftIndicatorOffset: 200,  // Pixels before boundary to switch
}

// ============================================================================
// Station Groups by Floor Area
// ============================================================================

export const STATIONS_BY_FLOOR: Record<FloorArea, StationDefinition[]> = {
  OFFSKID: OFFSKID_STATIONS,
  ONSKID: ONSKID_STATIONS,
  NEW_FLEX: NEW_FLEX_STATIONS,
  FLOAT: [], // No dedicated stations, float workers go where needed
  NTB: [],   // No dedicated stations for NTB area
}

/** Get all stations across all floor areas */
export function getAllStations(): StationDefinition[] {
  return FLOOR_AREAS.flatMap(area => STATIONS_BY_FLOOR[area])
}

/** Get stations filtered by floor areas */
export function getStationsByFloorAreas(floorAreas: FloorArea[]): StationDefinition[] {
  return floorAreas.flatMap(area => STATIONS_BY_FLOOR[area])
}

/** Get stations filtered by categories */
export function getStationsByCategories(
  stations: StationDefinition[], 
  categories: StationCategory[]
): StationDefinition[] {
  return stations.filter(station => categories.includes(station.category))
}

/** Get filtered stations based on LWC config */
export function getFilteredStations(
  floorAreas: FloorArea[] = LWC_DEFAULT_FILTERS.defaultFloorAreas,
  categories: StationCategory[] = LWC_DEFAULT_FILTERS.defaultStationCategories
): StationDefinition[] {
  const stationsByFloor = getStationsByFloorAreas(floorAreas)
  return getStationsByCategories(stationsByFloor, categories)
}

// ============================================================================
// Color Configuration
// ============================================================================

export const LWC_COLORS = {
  /** Time display mode backgrounds */
  timeDisplayModes: {
    estimate: "oklch(0.97 0 0 / 0.6)",
    current: "#ffffff",
    completion: "#dcfce7", // green-100
  },
  /** Completion comparison indicators */
  completionIndicators: {
    early: "#16a34a",   // green-600
    onTime: "#d97706",  // amber-600
    late: "#dc2626",    // red-600
  },
  /** Shift zone backgrounds */
  shiftZones: {
    firstShift: "bg-blue-50/30",
    secondShift: "bg-amber-50/30",
  },
  /** Shift boundary line */
  shiftBoundary: "border-primary",
} as const

// ============================================================================
// Export combined config
// ============================================================================

export const LWC_CONFIG = {
  filters: LWC_DEFAULT_FILTERS,
  timeline: LWC_TIMELINE_CONFIG,
  shifts: LWC_SHIFT_BOUNDARIES,
  colors: LWC_COLORS,
} as const

export type LWCConfig = typeof LWC_CONFIG
