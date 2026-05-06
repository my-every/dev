/**
 * Blue Label Sequence Map Builder
 * 
 * Utilities for working with Blue Labels data for wire length estimation.
 * Re-exports and extends the core Blue Label sequence utilities.
 */

import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import type { ParsedWorkbookSheet } from "@/lib/workbook/types";
import {
  parseBlueLabelSheet,
  normalizeSheetName,
  getDeviceSequenceIndex,
  areDevicesAdjacent,
  areDevicesSequential,
  getSheetDeviceSequence,
  hasBlueLabelData,
} from "@/lib/wiring-identification/blue-label-sequence";
import { getBaseDeviceId } from "./build-device-catalog";

// Re-export core utilities
export {
  parseBlueLabelSheet,
  normalizeSheetName,
  getDeviceSequenceIndex,
  areDevicesAdjacent,
  areDevicesSequential,
  getSheetDeviceSequence,
  hasBlueLabelData,
};

// ============================================================================
// Extended Utilities
// ============================================================================

/**
 * Get the Blue Label entry for a device.
 */
export function getBlueLabelsEntry(
  deviceId: string,
  blueLabels: BlueLabelSequenceMap | null
): { sheetName: string; sequenceIndex: number } | null {
  if (!blueLabels || !blueLabels.isValid) return null;
  
  const baseId = getBaseDeviceId(deviceId);
  const entry = blueLabels.deviceMap.get(baseId);
  
  if (!entry) return null;
  
  return {
    sheetName: entry.sheetName,
    sequenceIndex: entry.sequenceIndex,
  };
}

/**
 * Get the sequence gap between two devices.
 * Returns the number of devices between them in the sequence.
 * 
 * @returns Positive number if deviceB comes after deviceA, negative if before, 0 if same
 */
export function getSequenceGap(
  deviceA: string,
  deviceB: string,
  blueLabels: BlueLabelSequenceMap | null
): number | null {
  if (!blueLabels || !blueLabels.isValid) return null;
  
  const indexA = getDeviceSequenceIndex(deviceA, blueLabels);
  const indexB = getDeviceSequenceIndex(deviceB, blueLabels);
  
  if (indexA === null || indexB === null) return null;
  
  return indexB - indexA;
}

/**
 * Determine the route type based on device positions.
 */
export function getRouteType(
  fromDeviceId: string,
  toDeviceId: string,
  blueLabels: BlueLabelSequenceMap | null
): "same-device" | "adjacent" | "same-rail" | "cross-rail" | "unknown" {
  const fromBase = getBaseDeviceId(fromDeviceId);
  const toBase = getBaseDeviceId(toDeviceId);
  
  // Same device (jumper)
  if (fromBase === toBase) {
    return "same-device";
  }
  
  if (!blueLabels || !blueLabels.isValid) {
    return "unknown";
  }
  
  // Check if adjacent in sequence
  if (areDevicesAdjacent(fromDeviceId, toDeviceId, blueLabels)) {
    return "adjacent";
  }
  
  // Check if on same sheet (same rail)
  const fromEntry = getBlueLabelsEntry(fromDeviceId, blueLabels);
  const toEntry = getBlueLabelsEntry(toDeviceId, blueLabels);
  
  if (fromEntry && toEntry && fromEntry.sheetName === toEntry.sheetName) {
    return "same-rail";
  }
  
  // Different sheets or unknown
  if (fromEntry && toEntry && fromEntry.sheetName !== toEntry.sheetName) {
    return "cross-rail";
  }
  
  return "unknown";
}

/**
 * Group devices by their sheet/rail assignment.
 */
export function groupDevicesByRail(
  deviceIds: string[],
  blueLabels: BlueLabelSequenceMap | null
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  
  for (const deviceId of deviceIds) {
    const entry = getBlueLabelsEntry(deviceId, blueLabels);
    const sheetName = entry?.sheetName || "unknown";
    
    if (!groups.has(sheetName)) {
      groups.set(sheetName, []);
    }
    groups.get(sheetName)!.push(deviceId);
  }
  
  return groups;
}
