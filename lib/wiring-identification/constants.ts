/**
 * Wiring Identification Constants
 * 
 * Centralized configuration for pattern matching and identification rules.
 */

import type { IdentificationFilterKind } from "./types";

// ============================================================================
// Filter Metadata
// ============================================================================

/**
 * Metadata for each filter kind.
 */
export const FILTER_METADATA: Record<
  IdentificationFilterKind,
  {
    label: string;
    description: string;
    requiresBlueLabels: boolean;
    sortOrder: number;
  }
> = {
  default: {
    label: "Default",
    description: "Show all rows sorted by gauge (smallest to largest)",
    requiresBlueLabels: false,
    sortOrder: 0,
  },
  grounds: {
    label: "Grounds",
    description: "Ground wires (GRN, GRN/YEL, GRN/YLW colors)",
    requiresBlueLabels: false,
    sortOrder: 1,
  },
  jumpers: {
    label: "Jumpers",
    description: "All jumper types (AF/AU, XT, KA, KT, FU) - excludes clips",
    requiresBlueLabels: false,
    sortOrder: 20,
  },
  // Image order: Grounds(1), AF Jumpers(2), Clips(3), KA Relay Plugin(4),
  // KA Jumpers(5), KA Twin Ferrules(6), KT Jumpers(7), FU Jumpers(8)
  af_jumpers: {
    label: "AF/AU Jumpers",
    description: "AF and AU identity jumpers (COM, SH, V+) - sequential devices",
    requiresBlueLabels: false,
    sortOrder: 2,
  },
  clips: {
    label: "Clips",
    description: "All clip-based connections (CLIP wire ID, JC type)",
    requiresBlueLabels: false,
    sortOrder: 3,
  },
  cables: {
    label: "Cables",
    description: "Cable assemblies (WC#### type) - grouped by cable part number",
    requiresBlueLabels: false,
    sortOrder: 99, // Cables should be last
  },
  single_connections: {
    label: "Single Connections",
    description: "Individual connections not part of other groups - sorted by location",
    requiresBlueLabels: false,
    sortOrder: 98, // Before cables, after all other identity groups
  },
  ka_relay_plugin_jumpers: {
    label: "Relay Mechanical Jumpers",
    description: "KA relay mechanical jumper runs (A1/ESTOP, A2/0V) - must be in same location as current sheet",
    requiresBlueLabels: false,
    sortOrder: 4,
  },
  vio_jumpers: {
    label: "VIO Jumpers",
    description: "VIO identity jumpers (Wire ID = VIO)",
    requiresBlueLabels: false,
    sortOrder: 4.5, // After Relay Mechanical Jumpers
  },
  resistors: {
    label: "Resistors",
    description: "Resistor connections (Wire ID = LEAD, device prefix RR)",
    requiresBlueLabels: false,
    sortOrder: 4.6, // After VIO Jumpers
  },
  ka_jumpers: {
    label: "KA Jumpers",
    description: "KA wire jumpers - same terminal identity, sequential devices (excludes plugin bars)",
    requiresBlueLabels: false,
    sortOrder: 5,
  },
  ka_twin_ferrules: {
    label: "KA Twin Ferrules",
    description: "KA terminals with multiple wires (twin ferrule candidates)",
    requiresBlueLabels: false,
    sortOrder: 6,
  },
  kt_jumpers: {
    label: "KT Jumpers",
    description: "KT wire jumpers - same terminal identity, same side, sequential devices",
    requiresBlueLabels: false,
    sortOrder: 7,
  },
  fu_jumpers: {
    label: "FU Jumpers",
    description: "Fuse jumpers (FU:LI to FU:LI) - sequential devices",
    requiresBlueLabels: false,
    sortOrder: 8,
  },
  xt_jumpers: {
    label: "XT Jumpers",
    description: "XT jumpers: same base device, terminal +1, same location",
    requiresBlueLabels: false,
    sortOrder: 9,
  },
  xt_clips: {
    label: "XT Clips",
    description: "XT clip connections (CLIP wire ID)",
    requiresBlueLabels: false,
    sortOrder: 10,
  },
};

// ============================================================================
// Ground Detection
// ============================================================================

/**
 * Wire colors that indicate a ground wire.
 */
export const GROUND_COLORS = new Set([
  "GRN",
  "GRN/YEL",
  "GRN/YLW",
  "GREEN",
  "GREEN/YELLOW",
  "GREEN/YLW",
  "G",
  "G/Y",
]);

/**
 * Normalize a wire ID for ground detection.
 */
export function normalizeWireIdForGroundCheck(wireId: string): string {
  return wireId.toUpperCase().trim().replace(/\s+/g, "");
}

// ============================================================================
// Device Prefixes
// ============================================================================

/**
 * Known device prefixes and their meanings.
 */
export const DEVICE_PREFIX_MAP: Record<string, string> = {
  AF: "Analog Field Device",
  AT: "Analog Terminal",
  AU: "Analog Unit",
  BA: "Bus Adapter",
  EL: "Electronic Load",
  FU: "Fuse",
  GR: "Ground",
  HA: "Horn Annunciator",
  HL: "Indicator Light",
  IEG: "Intelligent Electronic Gateway",
  KA: "Relay",
  KT: "Timer Relay",
  PEG: "Power Electronic Gateway",
  SA: "Selector Switch",
  SB: "Push Button",
  SH: "Switch",
  UA: "Universal Analog",
  UAI: "Universal Analog Input",
  UJ: "Universal Junction",
  UV: "Under Voltage",
  WC: "Wire Cable",
  XT: "Terminal Block",
  XTFG: "Terminal Block Field Ground",
};

// ============================================================================
// KA Relay Terminal Allow List
// ============================================================================

/**
 * Valid KA relay terminals for jumper detection.
 * These are contact and coil terminals.
 */
export const KA_JUMPER_TERMINALS = new Set([
  "A1",
  "A2",
  "11",
  "12",
  "14",
  "21",
  "22",
  "24",
  "31",
  "32",
  "34",
  "41",
  "42",
  "44",
]);

/**
 * KA relay coil-side terminals.
 */
export const KA_COIL_SIDE_TERMINALS = new Set(["A1", "A2"]);

/**
 * KA relay contact-side terminals.
 */
export const KA_CONTACT_SIDE_TERMINALS = new Set([
  "11", "12", "14",
  "21", "22", "24",
  "31", "32", "34",
  "41", "42", "44",
]);

/**
 * Get the side of a KA terminal.
 */
export function getKaSide(terminal: string): "coil" | "contact" | null {
  const normalized = terminal.toUpperCase().trim();
  if (KA_COIL_SIDE_TERMINALS.has(normalized)) return "coil";
  if (KA_CONTACT_SIDE_TERMINALS.has(normalized)) return "contact";
  return null;
}

/**
 * Get the side of a KT terminal.
 */
export function getKtSide(terminal: string): "top" | "bottom" | null {
  const normalized = terminal.toUpperCase().trim();
  if (KT_TERMINALS_SIDE_A.has(normalized)) return "top";
  if (KT_TERMINALS_SIDE_B.has(normalized)) return "bottom";
  return null;
}

// ============================================================================
// KT Timer Relay Terminals
// ============================================================================

/**
 * KT timer relay terminals by side.
 */
export const KT_TERMINALS_SIDE_A = new Set(["A1", "15", "B1"]);
export const KT_TERMINALS_SIDE_B = new Set(["A2", "16", "18"]);

/**
 * All valid KT terminals.
 */
export const KT_ALL_TERMINALS = new Set([
  "A1",
  "A2",
  "15",
  "16",
  "18",
  "B1",
]);

// ============================================================================
// Clip Detection
// ============================================================================

/**
 * Wire IDs that indicate a clip connection.
 */
export const CLIP_WIRE_IDS = new Set(["CLIP", "CLP"]);

/**
 * Wire types that indicate a jumper clip.
 */
export const JUMPER_CLIP_TYPES = new Set(["JC", "JUMPER CLIP", "CLIP"]);

// ============================================================================
// Cable Detection
// ============================================================================

/**
 * Device prefixes that indicate a cable.
 */
export const CABLE_DEVICE_PREFIXES = new Set(["WC"]);

/**
 * Wire number patterns that indicate a cable.
 * Matches patterns like WC1242, WC8066, WC0014.
 */
export const CABLE_WIRE_NUMBER_PATTERN = /^WC\d+$/i;

/**
 * Gauge/size values that indicate a cable row.
 */
export const CABLE_GAUGE_VALUES = new Set(["CABLE", "ENET", "BUS"]);

/**
 * Check if a wire number looks like a cable identifier.
 */
export function isCableWireNumber(wireNo: string): boolean {
  const normalized = (wireNo || "").trim().toUpperCase();
  return CABLE_WIRE_NUMBER_PATTERN.test(normalized);
}

/**
 * Check if a gauge value indicates a cable.
 */
export function isCableGauge(gaugeSize: string): boolean {
  const normalized = (gaugeSize || "").trim().toUpperCase();
  return CABLE_GAUGE_VALUES.has(normalized);
}

/**
 * Check if a device ID prefix indicates a cable.
 */
export function isCableDevicePrefix(prefix: string): boolean {
  return CABLE_DEVICE_PREFIXES.has(prefix.toUpperCase());
}

// ============================================================================
// Filter-specific Column Visibility
// ============================================================================

/**
 * Columns to hide per identification filter.
 * Column keys match the semantic column definitions.
 */
export const FILTER_HIDDEN_COLUMNS: Partial<Record<IdentificationFilterKind, string[]>> = {
  // Clips: hide wire no, gauge/size
  clips: ["wireNo", "gaugeSize"],
  xt_clips: ["wireNo", "gaugeSize"],

  // Relay Mechanical Jumpers: hide wire id, wire no, type
  ka_relay_plugin_jumpers: ["wireId", "wireNo", "wireType"],

  // FU Jumpers: hide wire no, type, wire id, gauge/size
  fu_jumpers: ["wireNo", "wireType", "wireId", "gaugeSize"],

  // Cables: hide wire no (grouped by type instead)
  cables: ["wireNo"],

  // KA Twin Ferrules: typically don't need wire type
  ka_twin_ferrules: ["wireType"],
};

/**
 * Get the columns that should be hidden for a given filter.
 */
export function getHiddenColumnsForFilter(filterKind: IdentificationFilterKind): string[] {
  return FILTER_HIDDEN_COLUMNS[filterKind] ?? [];
}

// ============================================================================
// Sorting Configuration
// ============================================================================

/**
 * Special gauge values that sort after numeric values.
 */
export const NON_NUMERIC_GAUGE_VALUES = new Set([
  "---",
  "-",
  "CABLE",
  "N/A",
  "",
]);

/**
 * Sort order for non-numeric gauge values.
 */
export const NON_NUMERIC_GAUGE_SORT_ORDER = 9999;
