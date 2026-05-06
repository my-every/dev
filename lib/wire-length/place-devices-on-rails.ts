/**
 * Device Placement on Rails
 * 
 * Places devices along rails using Blue Labels sequence as the authority.
 * Creates a coordinate system for wire length estimation.
 */

import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import type {
  DeviceCatalog,
  PlacedDevice,
  PlacedRail,
  PanelTopology,
  LayoutRail,
  PanductNode,
  DeviceFamily,
} from "./types";
import { getDeviceEntry, getBaseDeviceId, extractTerminal } from "./build-device-catalog";
import { getDeviceFamilyFromPrefix, mmToInches } from "./constants";
import { getDevicePrefix } from "@/lib/wiring-identification/device-parser";
import { normalizeSheetName } from "@/lib/wiring-identification/blue-label-sequence";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default spacing between devices on a rail (in inches).
 */
const DEFAULT_DEVICE_SPACING_IN = 0.25;

/**
 * Default rail starting position.
 */
const DEFAULT_RAIL_START_X = 2;
const DEFAULT_RAIL_START_Y = 2;

/**
 * Default rail length if not specified (inches).
 */
const DEFAULT_RAIL_LENGTH_IN = 36;

// ============================================================================
// Device Placement
// ============================================================================

/**
 * Place devices along a rail based on their sequence order.
 * 
 * @param sequenceDevices - Device IDs in sequence order (from Blue Labels)
 * @param catalog - Device catalog for dimensions
 * @param railId - Rail identifier
 * @param railX - Rail X position
 * @param railY - Rail Y position
 * @param railLength - Rail length
 * @param orientation - Rail orientation
 * @returns Placed rail with devices
 */
export function placeDevicesAlongRail(
  sequenceDevices: string[],
  catalog: DeviceCatalog,
  railId: string,
  railX: number = DEFAULT_RAIL_START_X,
  railY: number = DEFAULT_RAIL_START_Y,
  railLength: number = DEFAULT_RAIL_LENGTH_IN,
  orientation: "horizontal" | "vertical" = "horizontal"
): PlacedRail {
  const placedDevices: PlacedDevice[] = [];
  let currentPosition = 0;
  
  for (let i = 0; i < sequenceDevices.length; i++) {
    const deviceId = sequenceDevices[i];
    const entry = getDeviceEntry(catalog, deviceId);
    
    // Convert dimensions to inches
    const widthIn = mmToInches(entry.dimensions.widthMm);
    const heightIn = mmToInches(entry.dimensions.heightMm);
    
    // Calculate device position based on orientation
    let deviceX: number;
    let deviceY: number;
    
    if (orientation === "horizontal") {
      deviceX = railX + currentPosition;
      deviceY = railY;
      currentPosition += widthIn + DEFAULT_DEVICE_SPACING_IN;
    } else {
      deviceX = railX;
      deviceY = railY + currentPosition;
      currentPosition += heightIn + DEFAULT_DEVICE_SPACING_IN;
    }
    
    const placedDevice: PlacedDevice = {
      deviceId,
      prefix: entry.prefix,
      family: entry.family,
      railId,
      x: deviceX,
      y: deviceY,
      width: widthIn,
      height: heightIn,
      sequenceIndex: i,
      dimensions: entry.dimensions,
    };
    
    placedDevices.push(placedDevice);
  }
  
  // Adjust rail length if devices exceed it
  const actualRailLength = Math.max(railLength, currentPosition);
  
  return {
    id: railId,
    x: railX,
    y: railY,
    length: actualRailLength,
    orientation,
    devices: placedDevices,
  };
}

/**
 * Build panel topology from Blue Labels and device catalog.
 * 
 * @param blueLabels - Blue Label sequence map
 * @param catalog - Device catalog
 * @param currentSheetName - Current sheet name for filtering
 * @param layoutRails - Optional rail geometry from layout PDF
 * @param layoutPanducts - Optional panduct geometry from layout PDF
 * @returns Complete panel topology
 */
export function buildPanelTopology(
  blueLabels: BlueLabelSequenceMap | null,
  catalog: DeviceCatalog,
  currentSheetName: string,
  layoutRails?: LayoutRail[],
  layoutPanducts?: PanductNode[]
): PanelTopology {
  const rails: PlacedRail[] = [];
  const deviceIndex = new Map<string, PlacedDevice>();
  
  if (!blueLabels || !blueLabels.isValid) {
    return {
      rails: [],
      panducts: layoutPanducts || [],
      deviceIndex,
      sheetName: currentSheetName,
    };
  }
  
  const normalizedCurrentSheet = normalizeSheetName(currentSheetName);
  
  // Find the sequence for the current sheet
  let sheetSequence: string[] | null = null;
  
  // Try exact match first
  sheetSequence = blueLabels.sheetSequences.get(normalizedCurrentSheet) || null;
  
  // Try partial match if exact match failed
  if (!sheetSequence) {
    for (const [sheetName, sequence] of blueLabels.sheetSequences) {
      if (sheetName.includes(normalizedCurrentSheet) || 
          normalizedCurrentSheet.includes(sheetName)) {
        sheetSequence = sequence;
        break;
      }
    }
  }
  
  if (sheetSequence && sheetSequence.length > 0) {
    // Create a single rail for this sheet's devices
    const rail = placeDevicesAlongRail(
      sheetSequence,
      catalog,
      `rail-${normalizedCurrentSheet}`,
      DEFAULT_RAIL_START_X,
      DEFAULT_RAIL_START_Y,
      DEFAULT_RAIL_LENGTH_IN,
      "horizontal"
    );
    
    rails.push(rail);
    
    // Index all placed devices
    for (const device of rail.devices) {
      deviceIndex.set(device.deviceId, device);
    }
  }
  
  return {
    rails,
    panducts: layoutPanducts || generateDefaultPanducts(rails),
    deviceIndex,
    sheetName: currentSheetName,
  };
}

/**
 * Generate default panducts based on rail positions.
 * Creates a simple routing corridor above and below the rail.
 */
function generateDefaultPanducts(rails: PlacedRail[]): PanductNode[] {
  if (rails.length === 0) return [];
  
  const panducts: PanductNode[] = [];
  
  for (const rail of rails) {
    // Create a panduct above the rail
    panducts.push({
      id: `panduct-above-${rail.id}`,
      x: rail.x,
      y: rail.y - 2, // 2 inches above rail
      width: rail.length,
      height: 1.5,
      orientation: rail.orientation,
      label: "2x5",
    });
    
    // Create a panduct below the rail
    panducts.push({
      id: `panduct-below-${rail.id}`,
      x: rail.x,
      y: rail.y + 4, // Below the devices
      width: rail.length,
      height: 1.5,
      orientation: rail.orientation,
      label: "2x5",
    });
  }
  
  return panducts;
}

/**
 * Find a placed device by its ID.
 * 
 * @param topology - Panel topology
 * @param deviceId - Device ID (may include terminal)
 * @returns Placed device or null
 */
export function findPlacedDevice(
  topology: PanelTopology,
  deviceId: string
): PlacedDevice | null {
  const baseId = getBaseDeviceId(deviceId);
  return topology.deviceIndex.get(baseId) || null;
}

/**
 * Check if two devices are on the same rail.
 */
export function areDevicesOnSameRail(
  topology: PanelTopology,
  deviceA: string,
  deviceB: string
): boolean {
  const placedA = findPlacedDevice(topology, deviceA);
  const placedB = findPlacedDevice(topology, deviceB);
  
  if (!placedA || !placedB) return false;
  
  return placedA.railId === placedB.railId;
}

/**
 * Get the distance between two devices along the rail.
 */
export function getRailDistanceBetweenDevices(
  topology: PanelTopology,
  deviceA: string,
  deviceB: string
): number | null {
  const placedA = findPlacedDevice(topology, deviceA);
  const placedB = findPlacedDevice(topology, deviceB);
  
  if (!placedA || !placedB) return null;
  if (placedA.railId !== placedB.railId) return null;
  
  // Calculate center-to-center distance along rail
  const centerA = placedA.x + placedA.width / 2;
  const centerB = placedB.x + placedB.width / 2;
  
  return Math.abs(centerB - centerA);
}
