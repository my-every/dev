/**
 * Wire Length Estimation Constants
 * 
 * Configuration constants for wire length estimation including:
 * - Device family defaults
 * - Terminal face mappings
 * - Allowance rules
 * - Service loop calculations
 * - Bend radius considerations
 */

import type {
  DeviceFamily,
  DeviceDimensions,
  TerminalFaceMap,
  AllowanceRules,
} from "./types";

// ============================================================================
// Cross-Location Allowance (Enhanced)
// ============================================================================

/**
 * Distance-based cross-location allowances instead of fixed 100".
 * More accurate based on panel-to-panel operationships.
 */
export const CROSS_LOCATION_DEFAULTS = {
  adjacentPanels: 20,      // Adjacent panels in same row
  sameRow: 40,             // Same cabinet row, non-adjacent
  acrossAisle: 60,         // Across an aisle
  differentCabinet: 80,    // Different cabinet entirely
  unknown: 40,             // Conservative default
};

/**
 * Legacy fixed cross-location allowance (deprecated, use CROSS_LOCATION_DEFAULTS)
 */
export const CROSS_LOCATION_ALLOWANCE_IN = 30; // Default extra length for external wires

/**
 * Minimum cut length for internal (same-location) wires in inches.
 * Same-device jumpers are excluded from this minimum.
 */
export const INTERNAL_WIRE_MINIMUM_LENGTH_IN = 60;

/**
 * Minimum cut length for external (cross-location) wires in inches.
 * Same-device jumpers are excluded from this minimum.
 */
export const EXTERNAL_WIRE_MINIMUM_LENGTH_IN = 120;

// ============================================================================
// Service Loop Allowance (New)
// ============================================================================

/**
 * Service loop allowance per end for maintenance access.
 * Industry standard is typically 4-6" of excess per end for rewiring.
 */
export const SERVICE_LOOP_ALLOWANCE = {
  control: 4,       // 4" for control wiring (18-22 AWG)
  power: 6,         // 6" for power wiring (10-14 AWG)
  feeder: 12,       // 12" for feeder cables (8 AWG and larger)
  default: 4,       // Default to control wiring
};

/**
 * Get service loop allowance based on gauge.
 */
export function getServiceLoopAllowance(gauge: string): number {
  const gaugeNum = parseInt(gauge, 10);
  if (isNaN(gaugeNum)) return SERVICE_LOOP_ALLOWANCE.default;

  if (gaugeNum >= 18) return SERVICE_LOOP_ALLOWANCE.control;
  if (gaugeNum >= 10) return SERVICE_LOOP_ALLOWANCE.power;
  return SERVICE_LOOP_ALLOWANCE.feeder;
}

// ============================================================================
// Bend Radius Considerations (New)
// ============================================================================

/**
 * Minimum bend radius in inches for different wire gauges.
 * Affects actual wire length through bends.
 */
export const MIN_BEND_RADIUS: Record<string, number> = {
  "22": 0.25,  // 1/4" radius
  "20": 0.25,
  "18": 0.375, // 3/8" radius
  "16": 0.5,   // 1/2" radius
  "14": 0.625,
  "12": 0.75,
  "10": 1.0,
  "8": 1.25,
};

/**
 * Calculate bend arc length for a given gauge and angle.
 * Wire goes through arc, not straight corner.
 */
export function getBendArcLength(gauge: string, angle: number = 90): number {
  const radius = MIN_BEND_RADIUS[gauge] || 0.5;
  const arcLength = (Math.PI * radius * angle) / 180;
  const cornerSavings = radius * 2; // Would be this if straight
  return arcLength - cornerSavings + radius; // Net addition
}

// ============================================================================
// Scrap/Waste Factor (New)
// ============================================================================

/**
 * Scrap factors for real-world wire cutting.
 * Typical waste factor is 3-5%.
 */
export const SCRAP_FACTORS = {
  precision: 1.02,    // 2% for CNC cut
  manual: 1.05,       // 5% for manual cutting
  conservative: 1.08, // 8% for rough estimates
  default: 1.03,      // 3% default
};

// ============================================================================
// Thermal Review Thresholds (New)
// ============================================================================

/**
 * Maximum run length before thermal review is recommended.
 * Long runs in enclosed panels may need oversizing.
 */
export const MAX_RUN_BEFORE_THERMAL_REVIEW: Record<string, number> = {
  "22": 100,
  "20": 125,
  "18": 150,
  "16": 200,
  "14": 250,
  "12": 300,
  "10": 400,
  "8": 500,
};

/**
 * Check if a run needs thermal review.
 */
export function needsThermalReview(
  lengthIn: number,
  gauge: string,
  enclosure: "open" | "enclosed" | "conduit" = "enclosed"
): boolean {
  const maxRun = MAX_RUN_BEFORE_THERMAL_REVIEW[gauge] || 200;
  // Conduit has worse thermal performance
  const adjustedMax = enclosure === "conduit" ? maxRun * 0.7 : enclosure === "open" ? maxRun * 1.5 : maxRun;
  return lengthIn > adjustedMax;
}

// ============================================================================
// Device Family Defaults
// ============================================================================

/**
 * Default dimensions for device families when exact part data is unavailable.
 * All dimensions in millimeters.
 */
export const DEVICE_FAMILY_DEFAULTS: Record<DeviceFamily, DeviceDimensions> = {
  KA: {
    widthMm: 45,
    heightMm: 80,
    depthMm: 70,
    terminalFaces: {
      // Coil side terminals
      A1: { face: "top", offsetX: 0.25, offsetY: 0 },
      A2: { face: "top", offsetX: 0.75, offsetY: 0 },
      // Contact side terminals - row 1
      "11": { face: "bottom", offsetX: 0.15, offsetY: 1 },
      "12": { face: "bottom", offsetX: 0.35, offsetY: 1 },
      "14": { face: "bottom", offsetX: 0.55, offsetY: 1 },
      // Contact side terminals - row 2
      "21": { face: "bottom", offsetX: 0.15, offsetY: 1 },
      "22": { face: "bottom", offsetX: 0.35, offsetY: 1 },
      "24": { face: "bottom", offsetX: 0.55, offsetY: 1 },
      // Contact side terminals - row 3
      "31": { face: "bottom", offsetX: 0.15, offsetY: 1 },
      "32": { face: "bottom", offsetX: 0.35, offsetY: 1 },
      "34": { face: "bottom", offsetX: 0.55, offsetY: 1 },
      // Contact side terminals - row 4
      "41": { face: "bottom", offsetX: 0.15, offsetY: 1 },
      "42": { face: "bottom", offsetX: 0.35, offsetY: 1 },
      "44": { face: "bottom", offsetX: 0.55, offsetY: 1 },
    },
  },
  KT: {
    widthMm: 45,
    heightMm: 85,
    depthMm: 70,
    terminalFaces: {
      A1: { face: "top", offsetX: 0.2, offsetY: 0 },
      A2: { face: "top", offsetX: 0.8, offsetY: 0 },
      "15": { face: "top", offsetX: 0.4, offsetY: 0 },
      "16": { face: "bottom", offsetX: 0.4, offsetY: 1 },
      "18": { face: "bottom", offsetX: 0.6, offsetY: 1 },
      B1: { face: "top", offsetX: 0.6, offsetY: 0 },
    },
  },
  AF: {
    widthMm: 22.5,
    heightMm: 100,
    depthMm: 120,
    terminalFaces: {
      // Generic front-facing terminals
    },
  },
  AU: {
    widthMm: 45,
    heightMm: 100,
    depthMm: 120,
    terminalFaces: {},
  },
  XT: {
    widthMm: 6,
    heightMm: 45,
    depthMm: 40,
    terminalFaces: {
      // Front terminal face
      "1": { face: "front", offsetX: 0.5, offsetY: 0.3 },
      "2": { face: "front", offsetX: 0.5, offsetY: 0.7 },
    },
  },
  FU: {
    widthMm: 18,
    heightMm: 60,
    depthMm: 50,
    terminalFaces: {
      LI: { face: "top", offsetX: 0.5, offsetY: 0 },
      LD: { face: "bottom", offsetX: 0.5, offsetY: 1 },
      L: { face: "top", offsetX: 0.5, offsetY: 0 },
      N: { face: "bottom", offsetX: 0.5, offsetY: 1 },
    },
  },
  ZS: {
    widthMm: 45,
    heightMm: 100,
    depthMm: 80,
    terminalFaces: {},
  },
  AT: {
    widthMm: 10,
    heightMm: 50,
    depthMm: 40,
    terminalFaces: {
      "1": { face: "front", offsetX: 0.5, offsetY: 0.5 },
    },
  },
  unknown: {
    widthMm: 22.5,
    heightMm: 60,
    depthMm: 50,
    terminalFaces: {},
  },
};

// ============================================================================
// Device Prefix to Family Mapping
// ============================================================================

/**
 * Map device prefixes to their family category.
 */
export const DEVICE_PREFIX_FAMILY_MAP: Record<string, DeviceFamily> = {
  KA: "KA",
  KT: "KT",
  AF: "AF",
  AU: "AU",
  XT: "XT",
  FU: "FU",
  ZS: "ZS",
  AT: "AT",
  // Add more as needed
};

/**
 * Get device family from prefix.
 */
export function getDeviceFamilyFromPrefix(prefix: string): DeviceFamily {
  const upperPrefix = prefix.toUpperCase();
  return DEVICE_PREFIX_FAMILY_MAP[upperPrefix] || "unknown";
}

/**
 * Alias for getDeviceFamilyFromPrefix.
 */
export const getDeviceFamily = getDeviceFamilyFromPrefix;

// ============================================================================
// Allowance Rules (Enhanced)
// ============================================================================

/**
 * Default allowance rules for wire length estimation.
 * Enhanced with service loop and bend radius considerations.
 */
export const DEFAULT_ALLOWANCE_RULES: AllowanceRules = {
  terminationAllowance: {
    ferrule: 1.5,    // inches for ferrule termination
    lug: 2.5,        // inches for lug termination
    bare: 1.0,       // inches for bare wire
    spade: 2.0,      // inches for spade connector
    unknown: 1.5,    // default
  },
  slackAllowance: {
    sameDevice: 0.5,       // jumper within same device
    adjacentDevice: 1.0,   // adjacent devices on rail
    sameRail: 2.0,         // same rail, non-adjacent
    crossRail: 4.0,        // crossing to different rail
    crossPanel: 8.0,       // crossing to different panel
  },
  bendPenaltyPerTurn: {
    "22": 0.25,   // small gauge
    "20": 0.25,
    "18": 0.3,
    "16": 0.4,
    "14": 0.5,
    "12": 0.6,
    "10": 0.75,
    "8": 1.0,     // large gauge
  },
  defaultBendPenalty: 0.4,
  roundingIncrement: 20,  // round up to nearest 20 inches (branding machine increment)
};

// ============================================================================
// Panduct Pattern Detection
// ============================================================================

/**
 * Regex patterns for detecting panduct labels in layout PDFs.
 * Common formats: 2x5x42.7, 3x5x21.3, etc. (height x width x length)
 */
export const PANDUCT_LABEL_PATTERN = /^(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/;

/**
 * Parse a panduct label like "2x5x42.7" into dimensions.
 */
export function parsePanductLabel(label: string): { height: number; width: number; length: number } | null {
  const match = label.match(PANDUCT_LABEL_PATTERN);
  if (!match) return null;

  return {
    height: parseFloat(match[1]),
    width: parseFloat(match[2]),
    length: parseFloat(match[3]),
  };
}

// ============================================================================
// Fallback Estimate Scaling (New)
// ============================================================================

/**
 * Estimate fallback length based on device count and route type.
 * More accurate than fixed values.
 */
export function estimateFallbackLength(
  routeType: "same-device" | "adjacent" | "same-rail" | "cross-rail" | "unknown",
  deviceCount: number = 10
): number {
  const estimatedPanelWidth = deviceCount * 2; // ~2" average per device

  switch (routeType) {
    case "same-device": return 3;
    case "adjacent": return Math.min(8, estimatedPanelWidth * 0.1);
    case "same-rail": return Math.min(24, estimatedPanelWidth * 0.3);
    case "cross-rail": return Math.min(48, estimatedPanelWidth * 0.6);
    default: return Math.min(18, estimatedPanelWidth * 0.25);
  }
}

// ============================================================================
// Unit Conversions
// ============================================================================

/**
 * Millimeters to inches conversion factor.
 */
export const MM_TO_INCHES = 0.0393701;

/**
 * Inches to millimeters conversion factor.
 */
export const INCHES_TO_MM = 25.4;

/**
 * Convert millimeters to inches.
 */
export function mmToInches(mm: number): number {
  return mm * MM_TO_INCHES;
}

/**
 * Convert inches to millimeters.
 */
export function inchesToMm(inches: number): number {
  return inches * INCHES_TO_MM;
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

/**
 * Thresholds for confidence scoring.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum requirements for high confidence */
  high: {
    bothDevicesFound: true,
    railPlacementKnown: true,
    blueLabelSequenceFound: true,
    terminalAnchorsResolved: true,
    panductRouteFound: true,
  },
  /** Minimum requirements for medium confidence */
  medium: {
    bothDevicesFound: true,
    sequenceKnown: true,
    orthogonalRouteUsed: true,
  },
};

// ============================================================================
// Length Display Formatting
// ============================================================================

/**
 * Format a length value for display.
 * 
 * @param lengthInches - Length in inches
 * @param precision - Decimal places (default 1)
 * @returns Formatted string like "18.5 in"
 */
export function formatLengthDisplay(lengthInches: number, precision: number = 1): string {
  if (lengthInches <= 0 || !isFinite(lengthInches)) {
    return "—";
  }

  const rounded = Number.isInteger(lengthInches)
    ? lengthInches.toFixed(0)
    : lengthInches.toFixed(precision);
  return `${rounded} in`;
}

/**
 * Round a length to the nearest increment.
 * 
 * @param length - Raw length value
 * @param increment - Rounding increment (default 0.5)
 * @returns Rounded length
 */
export function roundToIncrement(length: number, increment: number = 5): number {
  return Math.ceil(length / increment) * increment;
}

// ============================================================================
// Multi-Conductor Cable Detection (New)
// ============================================================================

/**
 * Detect if a wire ID represents a multi-conductor cable.
 */
export function isCableBundle(wireId: string): boolean {
  return /\d+C|\d+PR|CABLE|STP|UTP|CAT\d|SHIELDED/i.test(wireId);
}

/**
 * Get allowance for cable bundles.
 * Cable bundles need less individual termination allowance.
 */
export function getCableAllowance(wireId: string, conductorCount: number = 2): number {
  const baseAllowance = 3; // Common jacket strip
  const perConductor = 1.5; // Per conductor termination
  return baseAllowance + (conductorCount * perConductor);
}
