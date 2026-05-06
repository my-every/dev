/**
 * Floor Layout Types
 *
 * Defines the physical workstation rows for each floor area.
 * Each station is a single swimlane row in the timeline view.
 */

// ============================================================================
// Station & Floor Types
// ============================================================================

export type FloorArea = "NEW_FLEX" | "ONSKID" | "OFFSKID" | "FLOAT" |  "NTB"

export type StationCategory = "BUILD_UP" | "WIRING" | "TEST" | "STATION"

export interface StationDefinition {
    /** Unique key for this station, e.g. "OFFSKID_buildUpTable1" */
    id: string
    /** Display label, e.g. "Build-Up Table #1" */
    label: string
    /** Short label for sidebar, e.g. "BU #1" */
    shortLabel: string
    /** Which floor area this station belongs to */
    floorArea: FloorArea
    /** Category of work done here */
    category: StationCategory
    /** Numeric index within its category (for ordering) */
    index: number
}

// ============================================================================
// Floor Area Metadata
// ============================================================================

export const FLOOR_AREAS: FloorArea[] = ["NEW_FLEX", "ONSKID", "OFFSKID", "FLOAT", "NTB"]

export const FLOOR_AREA_META: Record<FloorArea, { label: string; color: string }> = {
    NEW_FLEX: { label: "NEW / FLEX", color: "bg-green-500" },
    ONSKID: { label: "ON SKID", color: "bg-blue-500" },
    OFFSKID: { label: "OFF SKID", color: "bg-yellow-400" },
    FLOAT: { label: "FLOAT", color: "bg-purple-500" },
    NTB: { label: "NTB", color: "bg-red-500" },
}


// ============================================================================
// Station Category Colors (for row accents)
// ============================================================================

export const STATION_CATEGORY_COLORS: Record<StationCategory, string> = {
    BUILD_UP: "bg-orange-400",
    WIRING: "bg-cyan-500",
    TEST: "bg-sky-500",
    STATION: "bg-slate-400",
}

export const STATION_CATEGORY_TEXT: Record<StationCategory, string> = {
    BUILD_UP: "text-orange-600 dark:text-orange-400",
    WIRING: "text-cyan-600 dark:text-cyan-400",
    TEST: "text-sky-600 dark:text-sky-400",
    STATION: "text-slate-600 dark:text-slate-400",
}

// ============================================================================
// Helpers
// ============================================================================

function buildUp(floorArea: FloorArea, n: number): StationDefinition {
    return {
        id: `${floorArea}_buildUpTable${n}`,
        label: `Build-Up Table #${n}`,
        shortLabel: `BU #${n}`,
        floorArea,
        category: "BUILD_UP",
        index: n,
    }
}

function wiring(floorArea: FloorArea, n: number): StationDefinition {
    return {
        id: `${floorArea}_wiringTable${n}`,
        label: `Wiring Table #${n}`,
        shortLabel: `WT #${n}`,
        floorArea,
        category: "WIRING",
        index: n,
    }
}

function test(floorArea: FloorArea, n: number): StationDefinition {
    return {
        id: `${floorArea}_testStation${n}`,
        label: `Test Station #${n}`,
        shortLabel: `TS #${n}`,
        floorArea,
        category: "TEST",
        index: n,
    }
}

function station(floorArea: FloorArea, n: number): StationDefinition {
    return {
        id: `${floorArea}_station${n}`,
        label: `Station #${n}`,
        shortLabel: `ST #${n}`,
        floorArea,
        category: "STATION",
        index: n,
    }
}

// ============================================================================
// Off-Skid Floor Layout
// ============================================================================

export const OFFSKID_STATIONS: StationDefinition[] = [
    buildUp("OFFSKID", 1),
    buildUp("OFFSKID", 2),
    buildUp("OFFSKID", 3),
    buildUp("OFFSKID", 4),
    buildUp("OFFSKID", 5),
    buildUp("OFFSKID", 6),
    wiring("OFFSKID", 1),
    wiring("OFFSKID", 2),
    wiring("OFFSKID", 3),
    wiring("OFFSKID", 4),
    station("OFFSKID", 1),
    station("OFFSKID", 2),
    station("OFFSKID", 3),
    station("OFFSKID", 4),
    station("OFFSKID", 5),
    station("OFFSKID", 6),
    station("OFFSKID", 7),
    station("OFFSKID", 8),
]

// ============================================================================
// On-Skid Floor Layout
// ============================================================================

export const ONSKID_STATIONS: StationDefinition[] = [
    buildUp("ONSKID", 1),
    buildUp("ONSKID", 2),
    buildUp("ONSKID", 3),
    buildUp("ONSKID", 4),
    buildUp("ONSKID", 5),
    buildUp("ONSKID", 6),
    wiring("ONSKID", 1),
    wiring("ONSKID", 2),
    wiring("ONSKID", 3),
    wiring("ONSKID", 4),
    wiring("ONSKID", 5),
    wiring("ONSKID", 6),
    wiring("ONSKID", 7),
    wiring("ONSKID", 8),
    test("ONSKID", 14),
    test("ONSKID", 15),
]

// ============================================================================
// New/Flex Floor Layout
// ============================================================================

export const NEW_FLEX_STATIONS: StationDefinition[] = [
    buildUp("NEW_FLEX", 1),
    buildUp("NEW_FLEX", 2),
    buildUp("NEW_FLEX", 3),
    buildUp("NEW_FLEX", 4),
    buildUp("NEW_FLEX", 5),
    buildUp("NEW_FLEX", 6),
    wiring("NEW_FLEX", 1),
    wiring("NEW_FLEX", 2),
    wiring("NEW_FLEX", 3),
    wiring("NEW_FLEX", 4),
    test("NEW_FLEX", 1),
    test("NEW_FLEX", 2),
    test("NEW_FLEX", 3),
    test("NEW_FLEX", 4),
    test("NEW_FLEX", 5),
    test("NEW_FLEX", 6),
    test("NEW_FLEX", 7),
    test("NEW_FLEX", 8),
    test("NEW_FLEX", 9),
    test("NEW_FLEX", 10),
    test("NEW_FLEX", 11),
    test("NEW_FLEX", 12),
    test("NEW_FLEX", 13),
]

// ============================================================================
// Aggregated lookup
// ============================================================================

export const FLOOR_STATIONS: Record<FloorArea, StationDefinition[]> = {
    OFFSKID: OFFSKID_STATIONS,
    ONSKID: ONSKID_STATIONS,
    NEW_FLEX: NEW_FLEX_STATIONS,
    FLOAT: [],
    NTB: [],
}

/** Get all stations across all areas (flattened) */
export function getAllStations(): StationDefinition[] {
    return [...NEW_FLEX_STATIONS, ...ONSKID_STATIONS, ...OFFSKID_STATIONS]
}

/** Map an LWC type string to a floor area */
export function lwcToFloorArea(lwc: string | undefined): FloorArea {
    switch (lwc) {
        case "NEW_FLEX": return "NEW_FLEX"
        case "ONSKID": return "ONSKID"
        case "OFFSKID": return "OFFSKID"
        default: return "NEW_FLEX"
    }
}
// ============================================================================
// Station → Compatible Assignment Stages
// ============================================================================

import type { AssignmentStageId } from "@/types/d380-assignment-stages"

/**
 * Which assignment stages can be performed at each station category.
 *
 * - BUILD_UP tables: Build Up and Wiring (pre-hang work)
 * - WIRING tables: Wiring only
 * - TEST stations: Box Build, Cross Wire, Test, Power Check, BIQ
 * - STATION (generic): all actionable stages
 */
export const STATION_COMPATIBLE_STAGES: Record<StationCategory, AssignmentStageId[]> = {
    BUILD_UP: ["BUILD_UP", "WIRING"],
    WIRING: ["WIRING"],
    TEST: ["BOX_BUILD", "CROSS_WIRE", "TEST_1ST_PASS", "POWER_CHECK", "BIQ"],
    STATION: [ "CROSS_WIRE", "TEST_1ST_PASS", "POWER_CHECK", "BIQ"],
}

/**
 * Which assignment stages (including queue stages) make an assignment
 * eligible to be placed at a given station category.
 * Used by the assignment picker when clicking an empty station.
 */
export const STATION_ASSIGNABLE_STAGES: Record<StationCategory, AssignmentStageId[]> = {
    BUILD_UP: ["BUILD_UP", "WIRING"],
    WIRING: ["WIRING", "WIRING_IPV"],
    TEST: [
        "BOX_BUILD",
        "CROSS_WIRE", "CROSS_WIRE_IPV",
        "TEST_1ST_PASS", "POWER_CHECK",
        "BIQ",
    ],
    STATION: [
        "BOX_BUILD",
        "CROSS_WIRE", "CROSS_WIRE_IPV",
        "TEST_1ST_PASS", "POWER_CHECK",
        "BIQ",
    ],
}

/** Check whether a station can handle a given stage */
export function isStageCompatible(category: StationCategory, stage: AssignmentStageId): boolean {
    return STATION_COMPATIBLE_STAGES[category].includes(stage)
}

// ============================================================================
// Stage → Profile Skill Key Mapping
// ============================================================================

/**
 * Maps each actionable assignment stage to the profile.json skill key(s)
 * that determine a member's proficiency (1-4 scale).
 */
export const STAGE_SKILL_KEYS: Record<string, string[]> = {
    BUILD_UP: ["buildup"],
    WIRING: ["wiring"],
    WIRING_IPV: ["wiring_visual"],
    BOX_BUILD: ["box_build"],
    CROSS_WIRE: ["box_xwire", "box_xwire_visual"],
    CROSS_WIRE_IPV: ["box_xwire_visual"],
    TEST_1ST_PASS: ["final"],
    POWER_CHECK: ["final"],
    BIQ: ["biq"],
}

/** Get the best skill level a member has for a given stage (max across keys) */
export function getSkillLevel(skills: Record<string, number> | null | undefined, stage: string): number {
    if (!skills) return 0
    const keys = STAGE_SKILL_KEYS[stage]
    if (!keys || keys.length === 0) return 0
    return Math.max(...keys.map((k) => skills[k] ?? 0))
}

// ============================================================================
// Stage Estimated Durations (in minutes)
// ============================================================================

export interface StageEstimate {
    /** Default estimated minutes for this stage */
    estimatedMinutes: number
    /** Human-readable duration label */
    label: string
    /** Minimum people required for this stage */
    minPeople: number
}

export const STAGE_ESTIMATES: Record<string, StageEstimate> = {
    BUILD_UP: { estimatedMinutes: 480, label: "~6 hrs", minPeople: 1 },
    WIRING: { estimatedMinutes: 960, label: "~2 days", minPeople: 1 },
    WIRING_IPV: { estimatedMinutes: 240, label: "~4 hrs", minPeople: 1 },
    BOX_BUILD: { estimatedMinutes: 240, label: "~4 hrs", minPeople: 1 },
    CROSS_WIRE: { estimatedMinutes: 360, label: "~6 hrs", minPeople: 2 },
    CROSS_WIRE_IPV: { estimatedMinutes: 120, label: "~2 hrs", minPeople: 1 },
    TEST_1ST_PASS: { estimatedMinutes: 1440, label: "~2-3 days", minPeople: 1 },
    POWER_CHECK: { estimatedMinutes: 180, label: "~3 hrs", minPeople: 1 },
    BIQ: { estimatedMinutes: 240, label: "~4 hrs", minPeople: 1 },
}