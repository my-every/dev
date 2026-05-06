/**
 * Allowance Calculations
 * 
 * Calculates termination, slack, and bend allowances for wire length estimation.
 */

import type { PathSegment, DeviceFamily, TerminationType, AllowanceRules } from "./types";
import { DEFAULT_ALLOWANCE_RULES } from "./constants";
import { countPathTurns } from "./build-orthogonal-path";

// ============================================================================
// Termination Allowance
// ============================================================================

/**
 * Get termination allowance for a wire end.
 * 
 * @param prefix - Device prefix (e.g., "KA", "XT")
 * @param terminal - Terminal identifier
 * @param gauge - Wire gauge
 * @param terminationType - Termination type (ferrule, lug, etc.)
 * @param rules - Allowance rules configuration
 * @returns Termination allowance in inches
 */
export function getTerminationAllowance(
  prefix: string,
  terminal: string | null,
  gauge: string,
  terminationType: TerminationType = "unknown",
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES
): number {
  let baseAllowance = rules.terminationAllowance[terminationType] || rules.terminationAllowance.unknown;
  
  // Adjust based on device family
  const family = prefix.toUpperCase();
  
  switch (family) {
    case "XT":
      // Terminal blocks need extra length for push-in or screw terminals
      baseAllowance += 0.5;
      break;
    case "KA":
    case "KT":
      // Relay terminals are typically accessible
      break;
    case "FU":
      // Fuse holders may need extra for blade terminals
      baseAllowance += 0.25;
      break;
    case "AF":
    case "AU":
      // Modules often have front-loading terminals
      baseAllowance += 0.5;
      break;
  }
  
  // Adjust for gauge (larger gauge needs more length to work with)
  const gaugeNum = parseInt(gauge, 10);
  if (!isNaN(gaugeNum) && gaugeNum <= 14) {
    baseAllowance += 0.25; // Extra for larger gauges
  }
  
  return baseAllowance;
}

/**
 * Get total termination allowance for both ends of a wire.
 */
export function getTotalTerminationAllowance(
  fromPrefix: string,
  fromTerminal: string | null,
  toPrefix: string,
  toTerminal: string | null,
  gauge: string,
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES
): number {
  const fromAllowance = getTerminationAllowance(fromPrefix, fromTerminal, gauge, "unknown", rules);
  const toAllowance = getTerminationAllowance(toPrefix, toTerminal, gauge, "unknown", rules);
  
  return fromAllowance + toAllowance;
}

// ============================================================================
// Slack Allowance
// ============================================================================

/**
 * Route type for slack calculation.
 */
export type RouteType = "same-device" | "adjacent" | "same-rail" | "cross-rail" | "cross-panel" | "unknown";

/**
 * Get slack allowance based on route type and device families.
 * 
 * @param routeType - Type of route (same device, adjacent, etc.)
 * @param fromFamily - From device family
 * @param toFamily - To device family
 * @param rules - Allowance rules configuration
 * @returns Slack allowance in inches
 */
export function getSlackAllowance(
  routeType: RouteType,
  fromFamily: DeviceFamily,
  toFamily: DeviceFamily,
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES
): number {
  let baseSlack: number;
  
  switch (routeType) {
    case "same-device":
      baseSlack = rules.slackAllowance.sameDevice;
      break;
    case "adjacent":
      baseSlack = rules.slackAllowance.adjacentDevice;
      break;
    case "same-rail":
      baseSlack = rules.slackAllowance.sameRail;
      break;
    case "cross-rail":
      baseSlack = rules.slackAllowance.crossRail;
      break;
    case "cross-panel":
      baseSlack = rules.slackAllowance.crossPanel;
      break;
    default:
      // Unknown route type: use same-rail as conservative estimate
      baseSlack = rules.slackAllowance.sameRail;
  }
  
  return baseSlack;
}

// ============================================================================
// Bend Penalty
// ============================================================================

/**
 * Get bend penalty based on path turns and wire gauge.
 * 
 * @param path - The wire path segments
 * @param gauge - Wire gauge
 * @param rules - Allowance rules configuration
 * @returns Bend penalty in inches
 */
export function getBendPenalty(
  path: PathSegment[],
  gauge: string,
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES
): number {
  const turns = countPathTurns(path);
  
  if (turns === 0) return 0;
  
  // Get per-turn penalty based on gauge
  const penaltyPerTurn = rules.bendPenaltyPerTurn[gauge] || rules.defaultBendPenalty;
  
  return turns * penaltyPerTurn;
}

// ============================================================================
// Total Allowance
// ============================================================================

/**
 * Calculate all allowances for a wire.
 */
export interface AllowanceBreakdown {
  terminationAllowanceIn: number;
  slackAllowanceIn: number;
  bendPenaltyIn: number;
  totalAllowanceIn: number;
}

/**
 * Get complete allowance breakdown for a wire.
 * 
 * @param fromPrefix - From device prefix
 * @param fromTerminal - From terminal
 * @param toPrefix - To device prefix
 * @param toTerminal - To terminal
 * @param gauge - Wire gauge
 * @param routeType - Route type
 * @param path - Wire path segments
 * @param rules - Allowance rules
 * @returns Complete allowance breakdown
 */
export function getAllowanceBreakdown(
  fromPrefix: string,
  fromTerminal: string | null,
  toPrefix: string,
  toTerminal: string | null,
  gauge: string,
  routeType: RouteType,
  path: PathSegment[],
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES
): AllowanceBreakdown {
  const terminationAllowanceIn = getTotalTerminationAllowance(
    fromPrefix,
    fromTerminal,
    toPrefix,
    toTerminal,
    gauge,
    rules
  );
  
  const slackAllowanceIn = getSlackAllowance(
    routeType,
    "unknown", // Would need device families here
    "unknown",
    rules
  );
  
  const bendPenaltyIn = getBendPenalty(path, gauge, rules);
  
  return {
    terminationAllowanceIn,
    slackAllowanceIn,
    bendPenaltyIn,
    totalAllowanceIn: terminationAllowanceIn + slackAllowanceIn + bendPenaltyIn,
  };
}
