/**
 * Shift Calendar & Working Hours Types
 *
 * Defines shift schedules, working-hour windows, and SLA time calculation
 * boundaries. Weekend overtime is treated as reserve capacity, not baseline
 * commit capacity.
 */

// ── Day and time primitives ───────────────────────────────────────────────

/** ISO weekday number: 0 = Sunday … 6 = Saturday */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** 24-hour HH:MM string, e.g. "06:00", "23:00" */
export type TimeString = `${string}:${string}`

// ── Shift identifiers ─────────────────────────────────────────────────────

export type ShiftId = '1st' | '2nd'

export type ShiftWindowKind =
    | 'standard'   // Regular scheduled hours — counts toward baseline commit capacity
    | 'overtime'   // Reserve hours — not counted toward baseline commit capacity

// ── Shift window definition ───────────────────────────────────────────────

export interface ShiftWindow {
    kind: ShiftWindowKind
    /** Weekdays this window applies to (0 = Sun, 6 = Sat). */
    weekdays: WeekdayIndex[]
    /** Inclusive start time in 24h format. */
    startTime: TimeString
    /** Inclusive end time in 24h format. */
    endTime: TimeString
}

// ── Shift schedule ────────────────────────────────────────────────────────

export interface ShiftSchedule {
    shiftId: ShiftId
    label: string
    /** Standard window is baseline capacity; overtime windows are reserve. */
    windows: ShiftWindow[]
}

/**
 * Canonical shift schedule definitions.
 *
 * 1st shift standard : Mon–Fri 06:00–14:30
 * 1st shift overtime : Mon–Fri 04:00–06:00, Sat–Sun 04:00–14:30
 *
 * 2nd shift standard : Mon–Fri 15:00–23:00
 * 2nd shift overtime : Sat–Sun 06:00–16:30
 */
export const SHIFT_SCHEDULES: Record<ShiftId, ShiftSchedule> = {
    '1st': {
        shiftId: '1st',
        label: '1st Shift',
        windows: [
            {
                kind: 'standard',
                weekdays: [1, 2, 3, 4, 5],
                startTime: '06:00',
                endTime: '14:30',
            },
            {
                kind: 'overtime',
                weekdays: [1, 2, 3, 4, 5],
                startTime: '04:00',
                endTime: '06:00',
            },
            {
                kind: 'overtime',
                weekdays: [0, 6],
                startTime: '04:00',
                endTime: '14:30',
            },
        ],
    },
    '2nd': {
        shiftId: '2nd',
        label: '2nd Shift',
        windows: [
            {
                kind: 'standard',
                weekdays: [1, 2, 3, 4, 5],
                startTime: '15:00',
                endTime: '23:00',
            },
            {
                kind: 'overtime',
                weekdays: [0, 6],
                startTime: '06:00',
                endTime: '16:30',
            },
        ],
    },
}

// ── Capacity model ────────────────────────────────────────────────────────

export interface ShiftCapacitySnapshot {
    shiftId: ShiftId
    /** ISO date YYYY-MM-DD */
    date: string
    /** Standard working minutes available that day (baseline commit capacity). */
    standardMinutes: number
    /** Reserve overtime minutes available that day (not counted toward baseline). */
    overtimeMinutes: number
    /** Total minutes available (standard + overtime). */
    totalMinutes: number
}

// ── Working-hours interval ────────────────────────────────────────────────

/**
 * Used by SLA calculators to express a measured duration in shift-working
 * hours rather than wall-clock minutes.
 */
export interface WorkingHoursInterval {
    shiftId: ShiftId
    fromIso: string
    toIso: string
    /** Working minutes elapsed (standard only, unless includeOvertime=true). */
    workingMinutes: number
    includesOvertime: boolean
}
