/**
 * Device Family Ordering Constants
 * 
 * Configuration for device-specific terminal ordering profiles.
 * These reflect physical panel reading order (typically bottom-to-top).
 */

import type { DeviceOrderingProfile } from "./types";

/**
 * Expand a numeric terminal range into an array of strings
 * with leading zeros preserved (2-digit format).
 */
export function expandNumericTerminalRange(start: number, end: number): string[] {
  const result: string[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i.toString().padStart(2, "0"));
  }
  return result;
}

/**
 * AF Device Ordering Profile
 * 
 * AF devices should be ordered bottom-to-top by terminal group priority:
 * 1. V+
 * 2. 32-47
 * 3. COM
 * 4. 16-31
 * 5. 00-15
 */
export const AF_ORDERING_PROFILE: DeviceOrderingProfile = {
  prefix: "AF",
  label: "AF Devices",
  orientation: "bottom_to_top",
  description: "AF I/O module terminals ordered by physical position (bottom-to-top)",
  terminalOrder: [
    "V+",
    ...expandNumericTerminalRange(32, 47),
    "COM",
    ...expandNumericTerminalRange(16, 31),
    ...expandNumericTerminalRange(0, 15),
  ],
  terminalBuckets: [
    { label: "Power", terminals: ["V+"] },
    { label: "Upper Bank (32-47)", terminals: expandNumericTerminalRange(32, 47) },
    { label: "Common", terminals: ["COM"] },
    { label: "Middle Bank (16-31)", terminals: expandNumericTerminalRange(16, 31) },
    { label: "Lower Bank (00-15)", terminals: expandNumericTerminalRange(0, 15) },
  ],
};

/**
 * KA Device Ordering Profile
 * 
 * KA relay devices should order by this exact terminal sequence:
 * A1, A2, 12, 22, 14, 24, 11, 21
 */
export const KA_ORDERING_PROFILE: DeviceOrderingProfile = {
  prefix: "KA",
  label: "KA Relays",
  orientation: "bottom_to_top",
  description: "KA relay terminals in standard contact sequence",
  terminalOrder: [
    "A1",
    "A2",
    "12",
    "22",
    "14",
    "24",
    "11",
    "21",
  ],
  terminalBuckets: [
    { label: "Coil", terminals: ["A1", "A2"] },
    { label: "Contacts", terminals: ["12", "22", "14", "24", "11", "21"] },
  ],
};

/**
 * KT Device Ordering Profile (Timer Relays)
 * Similar to KA but may have additional terminals
 */
export const KT_ORDERING_PROFILE: DeviceOrderingProfile = {
  prefix: "KT",
  label: "KT Timer Relays",
  orientation: "bottom_to_top",
  description: "KT timer relay terminals in standard sequence",
  terminalOrder: [
    "A1",
    "A2",
    "15",
    "18",
    "16",
    "17",
    "25",
    "28",
    "26",
    "27",
  ],
  terminalBuckets: [
    { label: "Coil", terminals: ["A1", "A2"] },
    { label: "Timer Contacts", terminals: ["15", "18", "16", "17", "25", "28", "26", "27"] },
  ],
};

/**
 * XT Device Ordering Profile (Terminal Blocks)
 * Order by terminal number
 */
export const XT_ORDERING_PROFILE: DeviceOrderingProfile = {
  prefix: "XT",
  label: "XT Terminal Blocks",
  orientation: "top_to_bottom",
  description: "XT terminal blocks ordered by terminal number",
  terminalOrder: [], // Uses numeric ordering
  terminalBuckets: [],
};

/**
 * Registry of all device ordering profiles
 */
export const DEVICE_ORDERING_PROFILES: Record<string, DeviceOrderingProfile> = {
  AF: AF_ORDERING_PROFILE,
  KA: KA_ORDERING_PROFILE,
  KT: KT_ORDERING_PROFILE,
  XT: XT_ORDERING_PROFILE,
};

/**
 * Map of identification filter kinds to their target prefix
 */
export const FILTER_TO_PREFIX_MAP: Record<string, string> = {
  af_jumpers: "AF",
  ka_jumpers: "KA",
  ka_twin_ferrules: "KA",
  kt_jumpers: "KT",
  xt_jumpers: "XT",
  xt_clips: "XT",
};

/**
 * Get the ordering profile for a given prefix
 */
export function getDeviceOrderingProfile(prefix: string): DeviceOrderingProfile | null {
  const normalizedPrefix = prefix.toUpperCase();
  return DEVICE_ORDERING_PROFILES[normalizedPrefix] || null;
}
