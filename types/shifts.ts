// Shift identification
export type ShiftId = "1st" | "2nd"

// Time window within a shift (e.g., overtime before, standard hours, overtime after)
export interface ShiftWindow {
  id: string
  label: string
  startTime: string // "HH:mm" format
  endTime: string   // "HH:mm" format
  type: "overtime" | "standard"
}

// Complete shift schedule definition
export interface ShiftSchedule {
  id: ShiftId
  label: string
  windows: ShiftWindow[]
  // Convenience getters derived from windows
  earliestStart: string
  latestEnd: string
  standardStart: string
  standardEnd: string
}

// Pre-configured shift schedules
export const SHIFT_SCHEDULES: Record<ShiftId, ShiftSchedule> = {
  "1st": {
    id: "1st",
    label: "1st Shift",
    windows: [
      {
        id: "1st-overtime-before",
        label: "Early Overtime",
        startTime: "04:00",
        endTime: "06:00",
        type: "overtime",
      },
      {
        id: "1st-standard",
        label: "Standard Hours",
        startTime: "06:00",
        endTime: "14:30",
        type: "standard",
      },
    ],
    earliestStart: "04:00",
    latestEnd: "14:30",
    standardStart: "06:00",
    standardEnd: "14:30",
  },
  "2nd": {
    id: "2nd",
    label: "2nd Shift",
    windows: [
      {
        id: "2nd-standard",
        label: "Standard Hours",
        startTime: "15:00",
        endTime: "23:00",
        type: "standard",
      },
      {
        id: "2nd-overtime-after",
        label: "Late Overtime",
        startTime: "23:00",
        endTime: "01:00",
        type: "overtime",
      },
    ],
    earliestStart: "15:00",
    latestEnd: "01:00",
    standardStart: "15:00",
    standardEnd: "23:00",
  },
}

// Helper to get all shift IDs
export const ALL_SHIFT_IDS: ShiftId[] = ["1st", "2nd"]

// Get total standard minutes for a shift
export function getShiftStandardMinutes(shiftId: ShiftId): number {
  const schedule = SHIFT_SCHEDULES[shiftId]
  const standardWindow = schedule.windows.find((w) => w.type === "standard")
  if (!standardWindow) return 0

  const [startH, startM] = standardWindow.startTime.split(":").map(Number)
  const [endH, endM] = standardWindow.endTime.split(":").map(Number)

  return endH * 60 + endM - (startH * 60 + startM)
}

// Get total overtime minutes available for a shift
export function getShiftOvertimeMinutes(shiftId: ShiftId): number {
  const schedule = SHIFT_SCHEDULES[shiftId]
  return schedule.windows
    .filter((w) => w.type === "overtime")
    .reduce((total, window) => {
      const [startH, startM] = window.startTime.split(":").map(Number)
      let [endH, endM] = window.endTime.split(":").map(Number)

      // Handle overnight overtime (e.g., 23:00 to 01:00)
      if (endH < startH) {
        endH += 24
      }

      return total + (endH * 60 + endM - (startH * 60 + startM))
    }, 0)
}
