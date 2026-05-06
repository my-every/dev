/**
 * Terminal Anchor Resolution
 * 
 * Resolves terminal positions on devices to precise anchor points.
 * This enables accurate wire length estimation from terminal to terminal.
 */

import type { Point, PlacedDevice, TerminalFaceMap, DeviceFamily } from "./types";
import { DEVICE_FAMILY_DEFAULTS } from "./constants";

// ============================================================================
// Terminal Face Maps by Family
// ============================================================================

/**
 * Get the terminal face map for a device family.
 */
export function getTerminalFaceMap(family: DeviceFamily): TerminalFaceMap {
  return DEVICE_FAMILY_DEFAULTS[family]?.terminalFaces || {};
}

/**
 * KA relay terminal groups.
 */
export const KA_TERMINAL_GROUPS = {
  coilSide: ["A1", "A2"],
  contactRows: [
    ["11", "12", "14"],
    ["21", "22", "24"],
    ["31", "32", "34"],
    ["41", "42", "44"],
  ],
};

/**
 * KT timer relay terminal groups.
 */
export const KT_TERMINAL_GROUPS = {
  topSide: ["A1", "15", "B1"],
  bottomSide: ["A2", "16", "18"],
};

/**
 * FU fuse holder terminal groups.
 */
export const FU_TERMINAL_GROUPS = {
  lineSide: ["LI", "L", "LINE"],
  loadSide: ["LD", "N", "LOAD"],
};

// ============================================================================
// Anchor Resolution
// ============================================================================

/**
 * Resolve a terminal to an anchor point on a placed device.
 * 
 * @param device - The placed device
 * @param terminal - The terminal identifier (e.g., "A1", "11")
 * @returns The anchor point in panel coordinates, or device center if unknown
 */
export function resolveTerminalAnchor(
  device: PlacedDevice,
  terminal: string | null
): Point {
  const { x, y, width, height, family } = device;
  
  // Default to device center if no terminal specified
  if (!terminal) {
    return {
      x: x + width / 2,
      y: y + height / 2,
    };
  }
  
  // Get terminal face map for this family
  const faceMap = getTerminalFaceMap(family);
  const terminalInfo = faceMap[terminal.toUpperCase()];
  
  if (terminalInfo) {
    // Use the offset from the face map
    const offsetX = terminalInfo.offsetX ?? 0.5;
    const offsetY = terminalInfo.offsetY ?? 0.5;
    
    return {
      x: x + width * offsetX,
      y: y + height * offsetY,
    };
  }
  
  // Fallback: infer position based on family conventions
  return inferTerminalPosition(device, terminal);
}

/**
 * Infer terminal position based on family conventions when exact mapping is unavailable.
 */
function inferTerminalPosition(device: PlacedDevice, terminal: string): Point {
  const { x, y, width, height, family } = device;
  const terminalUpper = terminal.toUpperCase();
  
  switch (family) {
    case "KA":
      // KA relays: coil terminals (A1, A2) on top, contacts on bottom
      if (terminalUpper === "A1") {
        return { x: x + width * 0.25, y };
      }
      if (terminalUpper === "A2") {
        return { x: x + width * 0.75, y };
      }
      // Contact terminals numbered 11-44 are on the bottom
      const contactMatch = terminalUpper.match(/^([1-4])([1-4])$/);
      if (contactMatch) {
        const row = parseInt(contactMatch[1], 10);
        const col = parseInt(contactMatch[2], 10);
        // Map row to x position (1-4 rows spread across width)
        const xOffset = (row - 0.5) / 4;
        return { x: x + width * xOffset, y: y + height };
      }
      break;
      
    case "KT":
      // Timer relays: similar to KA but with different terminal naming
      if (["A1", "15", "B1"].includes(terminalUpper)) {
        const idx = ["A1", "15", "B1"].indexOf(terminalUpper);
        return { x: x + width * (0.2 + idx * 0.3), y };
      }
      if (["A2", "16", "18"].includes(terminalUpper)) {
        const idx = ["A2", "16", "18"].indexOf(terminalUpper);
        return { x: x + width * (0.2 + idx * 0.3), y: y + height };
      }
      break;
      
    case "XT":
      // Terminal blocks: typically front-facing terminals
      // Position 1 is top, position 2 is bottom (or single terminal)
      if (terminalUpper === "1" || terminalUpper === "T") {
        return { x: x + width / 2, y: y + height * 0.3 };
      }
      if (terminalUpper === "2" || terminalUpper === "B") {
        return { x: x + width / 2, y: y + height * 0.7 };
      }
      break;
      
    case "FU":
      // Fuse holders: line side on top, load side on bottom
      if (["LI", "L", "LINE"].includes(terminalUpper)) {
        return { x: x + width / 2, y };
      }
      if (["LD", "N", "LOAD"].includes(terminalUpper)) {
        return { x: x + width / 2, y: y + height };
      }
      break;
      
    case "AF":
    case "AU":
      // Modules: terminals typically on the front face
      // Use numeric terminal as position indicator
      const numMatch = terminalUpper.match(/^(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        // Spread terminals across the front
        const xOffset = ((num - 1) % 4 + 0.5) / 4;
        const yOffset = Math.floor((num - 1) / 4) * 0.25 + 0.25;
        return { x: x + width * xOffset, y: y + height * yOffset };
      }
      break;
  }
  
  // Ultimate fallback: device center
  return {
    x: x + width / 2,
    y: y + height / 2,
  };
}

/**
 * Get the termination face direction for routing purposes.
 * 
 * @param device - The placed device
 * @param terminal - The terminal identifier
 * @returns Direction to approach the terminal from
 */
export function getTerminalApproachDirection(
  device: PlacedDevice,
  terminal: string | null
): "top" | "bottom" | "left" | "right" {
  if (!terminal) return "top";
  
  const terminalUpper = terminal.toUpperCase();
  const { family } = device;
  
  switch (family) {
    case "KA":
      if (KA_TERMINAL_GROUPS.coilSide.includes(terminalUpper)) {
        return "top";
      }
      return "bottom";
      
    case "KT":
      if (KT_TERMINAL_GROUPS.topSide.includes(terminalUpper)) {
        return "top";
      }
      return "bottom";
      
    case "FU":
      if (FU_TERMINAL_GROUPS.lineSide.includes(terminalUpper)) {
        return "top";
      }
      return "bottom";
      
    default:
      return "top";
  }
}
