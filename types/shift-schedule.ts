/**
 * Shift Schedule Types
 *
 * Defines the shift structure for the 24-hour timeline view.
 * 1st shift / 2nd shift on weekdays, overtime on weekends.
 */

// ============================================================================
// Shift Types
// ============================================================================

export type ShiftSlotId = "1ST" | "2ND" | "OVERTIME"

export interface ShiftSlot {
    id: ShiftSlotId
    label: string
    startHour: number   // 0–23
    endHour: number     // 0–23 (can wrap past midnight)
    color: string       // Tailwind bg class
    textColor: string   // Tailwind text class
    borderColor: string // Tailwind border class
    /** If true, render diagonal hatch pattern overlay */
    hatched?: boolean
}

// ============================================================================
// Scheduled Assignment Slot
// ============================================================================

/** Represents an assignment's position on the timeline */
export interface ScheduledSlot {
    assignmentSlug: string
    /** Scheduled start time as "HH:mm" */
    scheduledStart: string
    /** Duration in minutes */
    scheduledDuration: number
    /** ISO date string (YYYY-MM-DD) */
    scheduledDate: string
    /** Badges of assigned members */
    assignedBadges: string[]
    /** Optional workstation/table label */
    workstation?: string
    /** Station ID from floor-layout (ties slot to a specific row) */
    stationId?: string
}

// ============================================================================
// Weekday Shifts (Mon–Fri)
// ============================================================================

export const WEEKDAY_SHIFTS: ShiftSlot[] = [
    {
        id: "1ST",
        label: "1ST SHIFT",
        startHour: 4,
        endHour: 14.5,
        color: "bg-cyan-400",
        textColor: "text-cyan-900",
        borderColor: "border-cyan-400",
    },
    {
        id: "2ND",
        label: "2ND SHIFT",
        startHour: 15,
        endHour: 23,
        color: "bg-yellow-400",
        textColor: "text-yellow-900",
        borderColor: "border-yellow-400",
    },
]

// ============================================================================
// Weekend Shift (Sat–Sun)
// ============================================================================

export const WEEKEND_SHIFTS: ShiftSlot[] = [
    {
        id: "OVERTIME",
        label: "OVERTIME",
        startHour: 6,
        endHour: 16,
        color: "bg-muted",
        textColor: "text-muted-foreground",
        borderColor: "border-muted",
        hatched: true,
    },
]

// ============================================================================
// Helpers
// ============================================================================

export function getShiftsForDate(date: Date): ShiftSlot[] {
    const day = date.getDay() // 0 = Sun, 6 = Sat
    return day === 0 || day === 6 ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS
}

export function getDayLabel(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
}

export function getDateLabel(date: Date): string {
    return date.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
    })
}

/** Check if a given hour falls within a shift slot */
export function isHourInShift(hour: number, shift: ShiftSlot): boolean {
    if (shift.startHour <= shift.endHour) {
        return hour >= shift.startHour && hour < shift.endHour
    }
    // Wrapping past midnight
    return hour >= shift.startHour || hour < shift.endHour
}

/** Convert "HH:mm" → total minutes from midnight */
export function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + (m || 0)
}

/** Convert total minutes from midnight → "HH:mm" */
export function minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/** ISO date from a Date (YYYY-MM-DD) */
export function toISODate(d: Date): string {
    return d.toISOString().slice(0, 10)
}
