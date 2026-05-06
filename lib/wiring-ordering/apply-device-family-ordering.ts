/**
 * Apply Device Family Ordering
 * 
 * Main entry point for applying device-family-specific ordering to wire list rows.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { 
  DeviceOrderingContext, 
  DeviceOrderingResult, 
  DeviceGroup,
  DeviceOrderingProfile 
} from "./types";
import { 
  parseDeviceId, 
  getBaseDeviceId, 
  resolveOrderingEndpoint, 
  determineTargetPrefix,
  getTerminalSortRankFn 
} from "./device-order-profiles";
import { DEVICE_ORDERING_PROFILES } from "./constants";

/**
 * Sort rows by their ordering profile.
 * 
 * @param rows - Rows to sort
 * @param profile - The ordering profile to apply
 * @param blueLabelsOrder - Optional Blue Labels sequence for device ordering
 * @returns Sorted rows
 */
export function sortRowsByOrderingProfile(
  rows: SemanticWireListRow[],
  profile: DeviceOrderingProfile,
  blueLabelsOrder?: Map<string, number>
): SemanticWireListRow[] {
  const targetPrefix = profile.prefix;
  const getTerminalRank = getTerminalSortRankFn(targetPrefix);
  
  return [...rows].sort((a, b) => {
    // Resolve the endpoint for each row
    const endpointA = resolveOrderingEndpoint(a, targetPrefix);
    const endpointB = resolveOrderingEndpoint(b, targetPrefix);
    
    // Rows without matching prefix go to the end
    if (!endpointA && !endpointB) return 0;
    if (!endpointA) return 1;
    if (!endpointB) return -1;
    
    const baseA = endpointA.parsed.baseDeviceId;
    const baseB = endpointB.parsed.baseDeviceId;
    
    // First, sort by base device ID
    if (baseA !== baseB) {
      // Use Blue Labels order if available
      if (blueLabelsOrder) {
        const orderA = blueLabelsOrder.get(baseA) ?? Infinity;
        const orderB = blueLabelsOrder.get(baseB) ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
      }
      
      // Fall back to numeric device ordering
      const numA = parseInt(endpointA.parsed.deviceNumber, 10) || 0;
      const numB = parseInt(endpointB.parsed.deviceNumber, 10) || 0;
      if (numA !== numB) return numA - numB;
      
      // Final fallback: alphabetical
      return baseA.localeCompare(baseB);
    }
    
    // Same base device - sort by terminal using profile order
    const terminalA = endpointA.parsed.terminal;
    const terminalB = endpointB.parsed.terminal;
    
    const rankA = getTerminalRank(terminalA);
    const rankB = getTerminalRank(terminalB);
    
    return rankA - rankB;
  });
}

/**
 * Extract device groups from ordered rows.
 * 
 * @param rows - Ordered rows
 * @param targetPrefix - The prefix to group by
 * @returns Array of device groups
 */
export function extractDeviceGroups(
  rows: SemanticWireListRow[],
  targetPrefix: string
): DeviceGroup[] {
  const groups: DeviceGroup[] = [];
  let currentBaseDevice: string | null = null;
  let currentGroupStart = 0;
  let currentGroupCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const endpoint = resolveOrderingEndpoint(row, targetPrefix);
    
    if (!endpoint) {
      // Row doesn't have target prefix - skip for grouping
      continue;
    }
    
    const baseDevice = endpoint.parsed.baseDeviceId;
    
    if (baseDevice !== currentBaseDevice) {
      // New group - save previous if exists
      if (currentBaseDevice !== null && currentGroupCount > 0) {
        groups.push({
          baseDeviceId: currentBaseDevice,
          startIndex: currentGroupStart,
          rowCount: currentGroupCount,
        });
      }
      
      // Start new group
      currentBaseDevice = baseDevice;
      currentGroupStart = i;
      currentGroupCount = 1;
    } else {
      currentGroupCount++;
    }
  }
  
  // Don't forget the last group
  if (currentBaseDevice !== null && currentGroupCount > 0) {
    groups.push({
      baseDeviceId: currentBaseDevice,
      startIndex: currentGroupStart,
      rowCount: currentGroupCount,
    });
  }
  
  return groups;
}

/**
 * Build Blue Labels order map from sequence data.
 * 
 * @param blueLabelsData - Blue Labels sequence map (device -> sequence number)
 * @returns Map of base device ID to order index
 */
export function buildBlueLabelsOrderMap(
  blueLabelsData?: Map<string, number> | Record<string, number> | null
): Map<string, number> {
  const orderMap = new Map<string, number>();
  
  if (!blueLabelsData) return orderMap;
  
  // Handle both Map and plain object
  const entries = blueLabelsData instanceof Map 
    ? Array.from(blueLabelsData.entries())
    : Object.entries(blueLabelsData);
  
  for (const [deviceId, sequence] of entries) {
    const baseDevice = getBaseDeviceId(deviceId);
    if (baseDevice && !orderMap.has(baseDevice)) {
      orderMap.set(baseDevice, sequence as number);
    }
  }
  
  return orderMap;
}

/**
 * Apply device family ordering to rows based on context.
 * 
 * @param rows - Wire list rows to order
 * @param context - Ordering context (filter, prefix selections, etc.)
 * @returns Ordering result with sorted rows and metadata
 */
export function applyDeviceFamilyOrdering(
  rows: SemanticWireListRow[],
  context: DeviceOrderingContext
): DeviceOrderingResult {
  // Determine if we should apply ordering
  const targetPrefix = determineTargetPrefix({
    identificationFilter: context.identificationFilter,
    fromPrefix: context.fromPrefix,
    toPrefix: context.toPrefix,
  });
  
  // No specific ordering needed
  if (!targetPrefix) {
    return {
      rows,
      appliedProfile: null,
      wasOrdered: false,
      deviceGroups: [],
    };
  }
  
  // Get the ordering profile
  const profile = DEVICE_ORDERING_PROFILES[targetPrefix];
  if (!profile) {
    return {
      rows,
      appliedProfile: null,
      wasOrdered: false,
      deviceGroups: [],
    };
  }
  
  // Build Blue Labels order map if available
  const blueLabelsOrder = buildBlueLabelsOrderMap(context.blueLabelsOrder);
  
  // Sort rows
  const sortedRows = sortRowsByOrderingProfile(rows, profile, blueLabelsOrder);
  
  // Extract device groups
  const deviceGroups = extractDeviceGroups(sortedRows, targetPrefix);
  
  return {
    rows: sortedRows,
    appliedProfile: profile,
    wasOrdered: true,
    deviceGroups,
  };
}

/**
 * Check if a row is the start of a new device group.
 * 
 * @param rows - All rows
 * @param index - Current row index
 * @param deviceGroups - Device groups from ordering
 * @returns True if this row starts a new group
 */
export function isDeviceGroupStart(
  rows: SemanticWireListRow[],
  index: number,
  deviceGroups: DeviceGroup[]
): boolean {
  return deviceGroups.some(group => group.startIndex === index);
}

/**
 * Get the device group label for a row index.
 * 
 * @param index - Row index
 * @param deviceGroups - Device groups from ordering
 * @returns The base device ID label or null
 */
export function getDeviceGroupLabel(
  index: number,
  deviceGroups: DeviceGroup[]
): string | null {
  const group = deviceGroups.find(g => g.startIndex === index);
  return group ? group.baseDeviceId : null;
}
