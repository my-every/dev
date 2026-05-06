/**
 * Wire Length Estimation for Individual Rows
 * 
 * Estimates the wire length for a single semantic wire list row.
 * Combines device placement, terminal anchors, routing, and allowances.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type {
  WireLengthEstimate,
  PanelTopology,
  DeviceCatalog,
  Point,
  PathSegment,
  EstimateConfidence,
  AllowanceRules,
} from "./types";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import { parseDevicePrefix } from "@/lib/wiring-identification/device-parser";
import { getBaseDeviceId, extractTerminal } from "./build-device-catalog";
import { findPlacedDevice, areDevicesOnSameRail } from "./place-devices-on-rails";
import { resolveTerminalAnchor } from "./resolve-terminal-anchor";
import { buildOrthogonalPath, buildPanductAssistedPath, calculatePathLength } from "./build-orthogonal-path";
import { getAllowanceBreakdown, type RouteType } from "./get-allowances";
import { getRouteType } from "./build-blue-label-sequence-map";
import { DEFAULT_ALLOWANCE_RULES, roundToIncrement, CROSS_LOCATION_ALLOWANCE_IN } from "./constants";

// ============================================================================
// Estimation
// ============================================================================

/**
 * Estimate wire length for a single row.
 * 
 * @param row - The semantic wire list row
 * @param topology - Panel topology with placed devices
 * @param catalog - Device catalog
 * @param blueLabels - Blue Label sequence map
 * @param rules - Allowance rules
 * @param currentLocation - Current wire list location (for cross-location allowance)
 * @returns Wire length estimate
 */
export function estimateWireLengthForRow(
  row: SemanticWireListRow,
  topology: PanelTopology | null,
  catalog: DeviceCatalog,
  blueLabels: BlueLabelSequenceMap | null,
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES,
  currentLocation?: string | null
): WireLengthEstimate {
  const notes: string[] = [];
  
  // Extract device info
  const fromDeviceId = row.fromDeviceId;
  const toDeviceId = row.toDeviceId;
  const gauge = row.gaugeSize || "18";
  
  const fromBase = getBaseDeviceId(fromDeviceId);
  const toBase = getBaseDeviceId(toDeviceId);
  const fromTerminal = extractTerminal(fromDeviceId);
  const toTerminal = extractTerminal(toDeviceId);
  const fromPrefix = parseDevicePrefix(fromBase);
  const toPrefix = parseDevicePrefix(toBase);
  
  // Check if row location differs from current wire list location
  const rowLocation = (row.toLocation || row.fromLocation || row.location || "").trim().toUpperCase();
  const currentLoc = (currentLocation || "").trim().toUpperCase();
  const isCrossLocation = currentLoc && rowLocation && rowLocation !== currentLoc;
  
  // Initialize result
  const result: WireLengthEstimate = {
    rowId: row.__rowId,
    fromAnchor: null,
    toAnchor: null,
    path: [],
    basePathLengthIn: 0,
    terminationAllowanceIn: 0,
    slackAllowanceIn: 0,
    bendPenaltyIn: 0,
    crossLocationAllowanceIn: isCrossLocation ? CROSS_LOCATION_ALLOWANCE_IN : 0,
    estimatedCutLengthIn: 0,
    roundedCutLengthIn: 0,
    confidence: "low",
    notes,
  };
  
  // Add note if cross-location allowance applied
  if (isCrossLocation) {
    notes.push(`Cross-location allowance: +${CROSS_LOCATION_ALLOWANCE_IN}" (row location: ${rowLocation}, current: ${currentLoc})`);
  }
  
  // Skip if missing device IDs
  if (!fromDeviceId || !toDeviceId) {
    notes.push("Missing device ID");
    return result;
  }
  
  // Determine route type
  const routeType = getRouteType(fromDeviceId, toDeviceId, blueLabels);
  
  // Handle same-device case (internal jumper)
  if (fromBase === toBase) {
    return estimateSameDeviceWire(row, fromBase, fromTerminal, toTerminal, fromPrefix, gauge, rules);
  }
  
  // Try to find placed devices
  if (!topology) {
    notes.push("No topology available");
    return estimateFallbackLength(
      row,
      routeType,
      fromPrefix,
      toPrefix,
      fromTerminal,
      toTerminal,
      gauge,
      rules,
      result.crossLocationAllowanceIn,
      isCrossLocation ? notes : undefined,
    );
  }
  
  const fromPlaced = findPlacedDevice(topology, fromDeviceId);
  const toPlaced = findPlacedDevice(topology, toDeviceId);
  
  if (!fromPlaced || !toPlaced) {
    if (!fromPlaced) notes.push(`Device not placed: ${fromBase}`);
    if (!toPlaced) notes.push(`Device not placed: ${toBase}`);
    return estimateFallbackLength(
      row,
      routeType,
      fromPrefix,
      toPrefix,
      fromTerminal,
      toTerminal,
      gauge,
      rules,
      result.crossLocationAllowanceIn,
      isCrossLocation ? notes : undefined,
    );
  }
  
  // Resolve terminal anchors
  const fromAnchor = resolveTerminalAnchor(fromPlaced, fromTerminal);
  const toAnchor = resolveTerminalAnchor(toPlaced, toTerminal);
  
  result.fromAnchor = fromAnchor;
  result.toAnchor = toAnchor;
  
  // Build path
  let path: PathSegment[];
  
  if (topology.panducts.length > 0) {
    path = buildPanductAssistedPath(fromAnchor, toAnchor, topology.panducts);
    notes.push("Panduct-assisted routing");
  } else {
    path = buildOrthogonalPath(fromAnchor, toAnchor);
    notes.push("Orthogonal routing");
  }
  
  result.path = path;
  result.basePathLengthIn = calculatePathLength(path);
  
  // Calculate allowances
  const allowances = getAllowanceBreakdown(
    fromPrefix,
    fromTerminal,
    toPrefix,
    toTerminal,
    gauge,
    routeType as RouteType,
    path,
    rules
  );
  
  result.terminationAllowanceIn = allowances.terminationAllowanceIn;
  result.slackAllowanceIn = allowances.slackAllowanceIn;
  result.bendPenaltyIn = allowances.bendPenaltyIn;
  
  // Calculate total (including cross-location allowance if applicable)
  result.estimatedCutLengthIn = 
    result.basePathLengthIn +
    result.terminationAllowanceIn +
    result.slackAllowanceIn +
    result.bendPenaltyIn +
    result.crossLocationAllowanceIn;
  
  // Round to increment
  result.roundedCutLengthIn = roundToIncrement(result.estimatedCutLengthIn, rules.roundingIncrement);
  
  // Score confidence
  result.confidence = scoreConfidence(
    fromPlaced !== null,
    toPlaced !== null,
    areDevicesOnSameRail(topology, fromDeviceId, toDeviceId),
    blueLabels?.isValid ?? false,
    topology.panducts.length > 0
  );
  
  return result;
}

/**
 * Estimate wire length for a same-device jumper.
 */
function estimateSameDeviceWire(
  row: SemanticWireListRow,
  deviceId: string,
  fromTerminal: string | null,
  toTerminal: string | null,
  prefix: string,
  gauge: string,
  rules: AllowanceRules
): WireLengthEstimate {
  // Same-device jumpers are typically short
  let baseLength = 3; // Default 3 inches for internal jumper
  
  // Adjust based on device family
  switch (prefix.toUpperCase()) {
    case "KA":
      // KA relays may have jumpers between contact sets
      baseLength = 4;
      break;
    case "KT":
      baseLength = 4;
      break;
    case "XT":
      // Terminal block jumpers are typically short
      baseLength = 2;
      break;
  }
  
  const allowances = getAllowanceBreakdown(
    prefix,
    fromTerminal,
    prefix,
    toTerminal,
    gauge,
    "same-device",
    [],
    rules
  );
  
  const total = baseLength + allowances.totalAllowanceIn;
  
  return {
    rowId: row.__rowId,
    fromAnchor: null,
    toAnchor: null,
    path: [],
    basePathLengthIn: baseLength,
    terminationAllowanceIn: allowances.terminationAllowanceIn,
    slackAllowanceIn: allowances.slackAllowanceIn,
    bendPenaltyIn: allowances.bendPenaltyIn,
    crossLocationAllowanceIn: 0, // Same-device never crosses locations
    estimatedCutLengthIn: total,
    roundedCutLengthIn: roundToIncrement(total, rules.roundingIncrement),
    confidence: "medium",
    notes: ["Same-device jumper"],
  };
}

/**
 * Estimate wire length using fallback heuristics when geometry is unavailable.
 */
function estimateFallbackLength(
  row: SemanticWireListRow,
  routeType: string,
  fromPrefix: string,
  toPrefix: string,
  fromTerminal: string | null,
  toTerminal: string | null,
  gauge: string,
  rules: AllowanceRules,
  crossLocationAllowanceIn = 0,
  inheritedNotes: string[] = [],
): WireLengthEstimate {
  // Estimate based on route type
  let baseLength: number;
  
  switch (routeType) {
    case "same-device":
      baseLength = 3;
      break;
    case "adjacent":
      baseLength = 6;
      break;
    case "same-rail":
      baseLength = 12;
      break;
    case "cross-rail":
      baseLength = 24;
      break;
    default:
      baseLength = 12; // Conservative estimate
  }
  
  const allowances = getAllowanceBreakdown(
    fromPrefix,
    fromTerminal,
    toPrefix,
    toTerminal,
    gauge,
    routeType as RouteType,
    [],
    rules
  );
  
  const total = baseLength + allowances.totalAllowanceIn + crossLocationAllowanceIn;
  
  return {
    rowId: row.__rowId,
    fromAnchor: null,
    toAnchor: null,
    path: [],
    basePathLengthIn: baseLength,
    terminationAllowanceIn: allowances.terminationAllowanceIn,
    slackAllowanceIn: allowances.slackAllowanceIn,
    bendPenaltyIn: allowances.bendPenaltyIn,
    crossLocationAllowanceIn,
    estimatedCutLengthIn: total,
    roundedCutLengthIn: roundToIncrement(total, rules.roundingIncrement),
    confidence: "low",
    notes: [...inheritedNotes, "Fallback estimate", `Route type: ${routeType}`],
  };
}

/**
 * Score confidence level based on available data.
 */
function scoreConfidence(
  fromDeviceFound: boolean,
  toDeviceFound: boolean,
  sameRail: boolean,
  hasBlueLabels: boolean,
  hasPanducts: boolean
): EstimateConfidence {
  if (fromDeviceFound && toDeviceFound && sameRail && hasBlueLabels && hasPanducts) {
    return "high";
  }
  
  if (fromDeviceFound && toDeviceFound && hasBlueLabels) {
    return "medium";
  }
  
  return "low";
}
