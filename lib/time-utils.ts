/**
 * Shared time utilities for scheduling components
 */

/**
 * Convert "HH:mm" time string to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes from midnight to "HH:mm" format
 */
export function minutesToTime(totalMinutes: number): string {
  // Handle negative or overflow values
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

/**
 * Format time for display (12-hour or 24-hour format)
 */
export function formatDisplayTime(time: string, use12Hour = true): string {
  const [hours, minutes] = time.split(":").map(Number)

  if (!use12Hour) {
    return time
  }

  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12
  return minutes === 0
    ? `${displayHours}${period}`
    : `${displayHours}:${minutes.toString().padStart(2, "0")}${period}`
}

/**
 * Snap minutes to the nearest interval
 */
export function snapToInterval(minutes: number, interval: number): number {
  return Math.round(minutes / interval) * interval
}

/**
 * Clamp minutes to a min/max range
 */
export function clampMinutes(
  minutes: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, minutes))
}

/**
 * Calculate duration between two times in minutes
 */
export function getDurationMinutes(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  let endMinutes = timeToMinutes(endTime)

  // Handle overnight spans
  if (endMinutes <= startMinutes) {
    endMinutes += 1440 // Add 24 hours
  }

  return endMinutes - startMinutes
}

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)

  return s1 < e2 && s2 < e1
}

/**
 * Check if a time falls within a range
 */
export function isTimeInRange(
  time: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const t = timeToMinutes(time)
  const start = timeToMinutes(rangeStart)
  let end = timeToMinutes(rangeEnd)

  // Handle overnight ranges
  if (end <= start) {
    return t >= start || t < end
  }

  return t >= start && t < end
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd
  return minutesToTime(totalMinutes)
}

/**
 * Get array of time labels for a range at specified intervals
 */
export function getTimeLabels(
  startHour: number,
  endHour: number,
  intervalMinutes: number = 60
): string[] {
  const labels: string[] = []
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
    labels.push(minutesToTime(m))
  }

  return labels
}

/**
 * Calculate position percentage within a time range
 */
export function getPositionInRange(
  time: string,
  rangeStart: string,
  rangeEnd: string
): number {
  const t = timeToMinutes(time)
  const start = timeToMinutes(rangeStart)
  let end = timeToMinutes(rangeEnd)

  // Handle overnight ranges
  if (end <= start) {
    end += 1440
  }

  const position = ((t - start) / (end - start)) * 100
  return Math.max(0, Math.min(100, position))
}

/**
 * Get current time as "HH:mm" string
 */
export function getCurrentTime(): string {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
}

/**
 * Parse a Date object to "HH:mm" format
 */
export function dateToTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

/**
 * Format date as "YYYY-MM-DD"
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
