/**
 * Device Order Profiles - Core Utilities
 * 
 * Parsing and sorting helpers for device family ordering.
 */

import type { ParsedDeviceId, ResolvedEndpoint, DeviceOrderingProfile } from "./types";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { DEVICE_ORDERING_PROFILES, FILTER_TO_PREFIX_MAP } from "./constants";

/**
 * Parse a device ID into its components.
 * 
 * Examples:
 * - "AF0081:V+" -> { prefix: "AF", baseDeviceId: "AF0081", terminal: "V+" }
 * - "KA0233:A1" -> { prefix: "KA", baseDeviceId: "KA0233", terminal: "A1" }
 * - "XT0085:3" -> { prefix: "XT", baseDeviceId: "XT0085", terminal: "3" }
 */
export function parseDeviceId(deviceId: string): ParsedDeviceId {
  if (!deviceId) {
    return {
      full: "",
      prefix: "",
      baseDeviceId: "",
      deviceNumber: "",
      terminal: null,
      numericTerminal: null,
    };
  }

  const normalized = deviceId.trim().toUpperCase();
  
  // Split on colon to separate base device from terminal
  const colonIndex = normalized.indexOf(":");
  const baseDeviceId = colonIndex > 0 ? normalized.substring(0, colonIndex) : normalized;
  const terminal = colonIndex > 0 ? normalized.substring(colonIndex + 1) : null;
  
  // Extract prefix (letters at start)
  const prefixMatch = baseDeviceId.match(/^([A-Z]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  
  // Extract device number (everything after prefix in base device)
  const deviceNumber = prefix ? baseDeviceId.substring(prefix.length) : "";
  
  // Parse numeric terminal if applicable
  let numericTerminal: number | null = null;
  if (terminal) {
    const numMatch = terminal.match(/^(\d+)$/);
    if (numMatch) {
      numericTerminal = parseInt(numMatch[1], 10);
    }
  }

  return {
    full: deviceId,
    prefix,
    baseDeviceId,
    deviceNumber,
    terminal,
    numericTerminal,
  };
}

/**
 * Get the base device ID from a full device ID.
 * 
 * Example: "AF0081:V+" -> "AF0081"
 */
export function getBaseDeviceId(deviceId: string): string {
  return parseDeviceId(deviceId).baseDeviceId;
}

/**
 * Parse just the terminal from a device ID.
 * 
 * Example: "AF0081:V+" -> "V+"
 */
export function parseTerminal(deviceId: string): string | null {
  return parseDeviceId(deviceId).terminal;
}

/**
 * Normalize a numeric terminal to a consistent format.
 * Preserves leading zeros for display but returns normalized string.
 * 
 * Example: "7" -> "07", "15" -> "15"
 */
export function normalizeNumericTerminal(terminal: string): string {
  const num = parseInt(terminal, 10);
  if (isNaN(num)) return terminal;
  return num.toString().padStart(2, "0");
}

/**
 * Get the terminal sort rank for AF devices.
 * 
 * AF terminal priority (bottom-to-top):
 * 1. V+ (rank 0)
 * 2. 32-47 (rank 1-16)
 * 3. COM (rank 17)
 * 4. 16-31 (rank 18-33)
 * 5. 00-15 (rank 34-49)
 * 6. Unknown (rank 1000+)
 */
export function getAfTerminalSortRank(terminal: string | null): number {
  if (!terminal) return 9999;
  
  const normalized = terminal.toUpperCase().trim();
  
  // V+ is highest priority
  if (normalized === "V+") return 0;
  
  // Check for numeric terminal
  const num = parseInt(normalized, 10);
  if (!isNaN(num)) {
    // 32-47 range (rank 1-16)
    if (num >= 32 && num <= 47) {
      return 1 + (num - 32);
    }
    // COM comes next (rank 17)
    // 16-31 range (rank 18-33)
    if (num >= 16 && num <= 31) {
      return 18 + (num - 16);
    }
    // 00-15 range (rank 34-49)
    if (num >= 0 && num <= 15) {
      return 34 + num;
    }
    // Other numeric terminals
    return 50 + num;
  }
  
  // COM terminal
  if (normalized === "COM") return 17;
  
  // Unknown terminals go to the end
  return 1000;
}

/**
 * Get the terminal sort rank for KA devices.
 * 
 * KA terminal sequence:
 * A1, A2, 12, 22, 14, 24, 11, 21
 */
export function getKaTerminalSortRank(terminal: string | null): number {
  if (!terminal) return 9999;
  
  const normalized = terminal.toUpperCase().trim();
  
  const kaOrder = ["A1", "A2", "12", "22", "14", "24", "11", "21"];
  const index = kaOrder.indexOf(normalized);
  
  if (index >= 0) return index;
  
  // Unknown terminals go to the end
  return 1000;
}

/**
 * Get the terminal sort rank for KT devices.
 * 
 * KT terminal sequence:
 * A1, A2, 15, 18, 16, 17, 25, 28, 26, 27
 */
export function getKtTerminalSortRank(terminal: string | null): number {
  if (!terminal) return 9999;
  
  const normalized = terminal.toUpperCase().trim();
  
  const ktOrder = ["A1", "A2", "15", "18", "16", "17", "25", "28", "26", "27"];
  const index = ktOrder.indexOf(normalized);
  
  if (index >= 0) return index;
  
  // Unknown terminals go to the end
  return 1000;
}

/**
 * Get the terminal sort rank for XT devices.
 * Uses simple numeric ordering.
 */
export function getXtTerminalSortRank(terminal: string | null): number {
  if (!terminal) return 9999;
  
  const num = parseInt(terminal, 10);
  if (!isNaN(num)) return num;
  
  // Non-numeric terminals sorted alphabetically
  return 1000 + terminal.charCodeAt(0);
}

/**
 * Get the appropriate terminal sort rank function for a prefix.
 */
export function getTerminalSortRankFn(prefix: string): (terminal: string | null) => number {
  const normalizedPrefix = prefix.toUpperCase();
  
  switch (normalizedPrefix) {
    case "AF":
      return getAfTerminalSortRank;
    case "KA":
      return getKaTerminalSortRank;
    case "KT":
      return getKtTerminalSortRank;
    case "XT":
      return getXtTerminalSortRank;
    default:
      // Default to numeric ordering
      return (terminal) => {
        if (!terminal) return 9999;
        const num = parseInt(terminal, 10);
        return isNaN(num) ? 1000 : num;
      };
  }
}

/**
 * Resolve which endpoint to use for ordering based on target prefix.
 * 
 * @param row - The wire list row
 * @param targetPrefix - The prefix we're ordering by (e.g., "AF", "KA")
 * @returns The resolved endpoint info or null if no match
 */
export function resolveOrderingEndpoint(
  row: SemanticWireListRow,
  targetPrefix: string
): ResolvedEndpoint | null {
  const normalizedTarget = targetPrefix.toUpperCase();
  
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);
  
  const fromMatches = fromParsed.prefix === normalizedTarget;
  const toMatches = toParsed.prefix === normalizedTarget;
  
  // If both match, prefer "from" side
  if (fromMatches && toMatches) {
    return {
      deviceId: row.fromDeviceId,
      side: "from",
      parsed: fromParsed,
    };
  }
  
  // If only one matches, use that
  if (fromMatches) {
    return {
      deviceId: row.fromDeviceId,
      side: "from",
      parsed: fromParsed,
    };
  }
  
  if (toMatches) {
    return {
      deviceId: row.toDeviceId,
      side: "to",
      parsed: toParsed,
    };
  }
  
  // No match
  return null;
}

/**
 * Determine the target prefix for ordering based on context.
 * 
 * @param context - The ordering context (filter, prefix selections)
 * @returns The target prefix or null if no specific ordering applies
 */
export function determineTargetPrefix(context: {
  identificationFilter?: string;
  fromPrefix?: string | null;
  toPrefix?: string | null;
}): string | null {
  // Check identification filter first
  if (context.identificationFilter && FILTER_TO_PREFIX_MAP[context.identificationFilter]) {
    return FILTER_TO_PREFIX_MAP[context.identificationFilter];
  }
  
  // Check device prefix filters
  if (context.fromPrefix) {
    const profile = DEVICE_ORDERING_PROFILES[context.fromPrefix.toUpperCase()];
    if (profile) return context.fromPrefix.toUpperCase();
  }
  
  if (context.toPrefix) {
    const profile = DEVICE_ORDERING_PROFILES[context.toPrefix.toUpperCase()];
    if (profile) return context.toPrefix.toUpperCase();
  }
  
  return null;
}





