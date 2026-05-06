import type { ShiftOptionConfig } from '@/types/d380-startup'

/**
 * Default shift options for the startup flow.
 */
const DEFAULT_SHIFT_OPTIONS: ShiftOptionConfig[] = [
  {
    id: '1st',
    label: '1st Shift',
    hours: '06:00 - 14:30',
    teamName: 'Day Operations',
    description: 'Primary production shift focused on startup intake and early execution.',
  },
  {
    id: '2nd',
    label: '2nd Shift',
    hours: '14:30 - 23:00',
    teamName: 'Evening Operations',
    description: 'Continuation shift focused on carryover, completion, and handoff prep.',
  },
]

/**
 * Get shift options for the startup flow.
 */
export function getShiftOptions(): ShiftOptionConfig[] {
  return DEFAULT_SHIFT_OPTIONS
}
