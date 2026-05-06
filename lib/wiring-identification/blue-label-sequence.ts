/**
 * Blue Label Sequence Utilities
 * 
 * The Blue Labels sheet provides the authoritative device sequence for each sheet/assignment.
 * This module parses Blue Labels data and provides utilities for checking device adjacency.
 * 
 * Blue Labels structure:
 * - Row 1: Column headers (sheet names like "(SHT 1) CONTROL,JB70")
 * - Rows 2+: Device IDs in sequence order (top to bottom = sequence order)
 */

import type { BlueLabelEntry, BlueLabelSequenceMap } from "./types";
import type { ParsedWorkbookSheet, ParsedSheetRow } from "@/lib/workbook/types";
import { getBaseDeviceId } from "./device-parser";

// ============================================================================
// Blue Labels Parsing
// ============================================================================

/**
 * Normalize a sheet name for matching.
 * Removes sheet number prefix and normalizes spacing.
 */
export function normalizeSheetName(sheetName: string): string {
  return sheetName
    .replace(/^\(SHT\s*\d+\)\s*/i, "")
    .toUpperCase()
    .trim()
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");
}

function toSheetLookupKey(sheetName: string): string {
  return normalizeSheetName(sheetName).replace(/[^A-Z0-9]/g, "");
}

function getResolvedSheetSequence(
  sheetName: string,
  blueLabels: BlueLabelSequenceMap,
): string[] {
  if (!blueLabels.isValid) return [];

  const normalized = normalizeSheetName(sheetName);
  const direct = blueLabels.sheetSequences.get(normalized);
  if (direct) {
    return direct;
  }

  const lookupKey = toSheetLookupKey(sheetName);
  for (const [candidateSheetName, sequence] of blueLabels.sheetSequences.entries()) {
    if (toSheetLookupKey(candidateSheetName) === lookupKey) {
      return sequence;
    }
  }

  return [];
}

/**
 * Parse Blue Labels sheet data into a sequence map.
 * 
 * @param blueLabelsSheet - The parsed Blue Labels sheet
 * @returns Blue Label sequence map
 */
export function parseBlueLabelSheet(
  blueLabelsSheet: ParsedWorkbookSheet | null
): BlueLabelSequenceMap {
  const warnings: string[] = [];
  const deviceMap: Map<string, BlueLabelEntry> = new Map();
  const sheetSequences: Map<string, string[]> = new Map();
  
  if (!blueLabelsSheet) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels sheet not found"],
    };
  }
  
  const { headers, rows } = blueLabelsSheet;
  
  if (headers.length === 0) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels sheet has no headers"],
    };
  }
  
  // Parse each column (each column is a sheet's device sequence)
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const rawSheetName = headers[colIndex] || `Column_${colIndex}`;
    const normalizedSheetName = normalizeSheetName(rawSheetName);
    const sequence: string[] = [];
    
    // Walk through rows to get devices in order
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const cell = row[rawSheetName] ?? row[headers[colIndex]];
      
      if (cell === null || cell === undefined || cell === "") {
        continue;
      }
      
      const deviceId = String(cell).trim();
      if (!deviceId) continue;
      
      // Get base device ID (without terminal)
      const baseDeviceId = getBaseDeviceId(deviceId);
      const entry: BlueLabelEntry = {
        deviceId: baseDeviceId,
        sheetName: normalizedSheetName,
        sequenceIndex: sequence.length,
      };
      
      // Add to maps
      deviceMap.set(baseDeviceId, entry);
      sequence.push(baseDeviceId);
    }
    
    if (sequence.length > 0) {
      sheetSequences.set(normalizedSheetName, sequence);
    }
  }
  
  const isValid = deviceMap.size > 0;
  
  if (!isValid) {
    warnings.push("No device sequences found in Blue Labels");
  }
  
  return {
    deviceMap,
    sheetSequences,
    isValid,
    warnings,
  };
}

/**
 * Parse Blue Labels from raw rows (when sheet is available as raw data).
 * 
 * @param rawHeaders - Column headers
 * @param rawRows - Raw row data
 * @returns Blue Label sequence map
 */
export function parseBlueLabelRawData(
  rawHeaders: string[],
  rawRows: ParsedSheetRow[]
): BlueLabelSequenceMap {
  const warnings: string[] = [];
  const deviceMap: Map<string, BlueLabelEntry> = new Map();
  const sheetSequences: Map<string, string[]> = new Map();
  
  if (rawHeaders.length === 0 || rawRows.length === 0) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels data is empty"],
    };
  }
  
  // Parse each column
  for (let colIndex = 0; colIndex < rawHeaders.length; colIndex++) {
    const rawSheetName = rawHeaders[colIndex];
    if (!rawSheetName) continue;
    
    const normalizedSheetName = normalizeSheetName(rawSheetName);
    const sequence: string[] = [];
    
    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const row = rawRows[rowIndex];
      const cell = row[rawSheetName];
      
      if (cell === null || cell === undefined || cell === "") {
        continue;
      }
      
      const deviceId = String(cell).trim();
      if (!deviceId) continue;
      
      const baseDeviceId = getBaseDeviceId(deviceId);
      const entry: BlueLabelEntry = {
        deviceId: baseDeviceId,
        sheetName: normalizedSheetName,
        sequenceIndex: sequence.length,
      };
      
      deviceMap.set(baseDeviceId, entry);
      sequence.push(baseDeviceId);
    }
    
    if (sequence.length > 0) {
      sheetSequences.set(normalizedSheetName, sequence);
    }
  }
  
  return {
    deviceMap,
    sheetSequences,
    isValid: deviceMap.size > 0,
    warnings,
  };
}

// ============================================================================
// Sequence Lookup Utilities
// ============================================================================

/**
 * Check if two devices are adjacent in the Blue Labels sequence.
 * Adjacent means they appear consecutively in the same sheet's sequence.
 * 
 * @param deviceA - First device ID
 * @param deviceB - Second device ID
 * @param blueLabels - Blue Label sequence map
 * @returns True if devices are adjacent in sequence
 */
export function areDevicesAdjacent(
  deviceA: string,
  deviceB: string,
  blueLabels: BlueLabelSequenceMap
): boolean {
  if (!blueLabels.isValid) return false;
  
  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  
  const entryA = blueLabels.deviceMap.get(baseA);
  const entryB = blueLabels.deviceMap.get(baseB);
  
  // Both devices must be in the map
  if (!entryA || !entryB) return false;
  
  // Must be on the same sheet
  if (entryA.sheetName !== entryB.sheetName) return false;
  
  // Check if they are adjacent (differ by 1 in sequence)
  const diff = Math.abs(entryA.sequenceIndex - entryB.sequenceIndex);
  return diff === 1;
}

export function areDevicesAdjacentInSheet(
  deviceA: string,
  deviceB: string,
  sheetName: string,
  blueLabels: BlueLabelSequenceMap,
): boolean {
  if (!blueLabels.isValid) return false;

  const sequence = getResolvedSheetSequence(sheetName, blueLabels);
  if (sequence.length === 0) return false;

  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  const indexA = sequence.indexOf(baseA);
  const indexB = sequence.indexOf(baseB);

  if (indexA === -1 || indexB === -1) return false;

  return Math.abs(indexA - indexB) === 1;
}

/**
 * Check if two devices are sequential (A comes before B).
 * 
 * @param deviceA - First device ID (should come before)
 * @param deviceB - Second device ID (should come after)
 * @param blueLabels - Blue Label sequence map
 * @returns True if A comes immediately before B in sequence
 */
export function areDevicesSequential(
  deviceA: string,
  deviceB: string,
  blueLabels: BlueLabelSequenceMap
): boolean {
  if (!blueLabels.isValid) return false;
  
  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  
  const entryA = blueLabels.deviceMap.get(baseA);
  const entryB = blueLabels.deviceMap.get(baseB);
  
  if (!entryA || !entryB) return false;
  if (entryA.sheetName !== entryB.sheetName) return false;
  
  // A should come immediately before B
  return entryB.sequenceIndex === entryA.sequenceIndex + 1;
}

/**
 * Get the sequence index of a device.
 * 
 * @param deviceId - The device ID
 * @param blueLabels - Blue Label sequence map
 * @returns Sequence index or null if not found
 */
export function getDeviceSequenceIndex(
  deviceId: string,
  blueLabels: BlueLabelSequenceMap
): number | null {
  if (!blueLabels.isValid) return null;
  
  const baseId = getBaseDeviceId(deviceId);
  const entry = blueLabels.deviceMap.get(baseId);
  
  return entry ? entry.sequenceIndex : null;
}

export function getDeviceSequenceIndexInSheet(
  deviceId: string,
  sheetName: string,
  blueLabels: BlueLabelSequenceMap,
): number | null {
  if (!blueLabels.isValid) return null;

  const sequence = getResolvedSheetSequence(sheetName, blueLabels);
  if (sequence.length === 0) return null;

  const baseId = getBaseDeviceId(deviceId);
  const index = sequence.indexOf(baseId);
  return index === -1 ? null : index;
}

/**
 * Get all devices in a sheet's sequence.
 * 
 * @param sheetName - The sheet name (will be normalized)
 * @param blueLabels - Blue Label sequence map
 * @returns Array of device IDs in sequence order
 */
export function getSheetDeviceSequence(
  sheetName: string,
  blueLabels: BlueLabelSequenceMap
): string[] {
  if (!blueLabels.isValid) return [];
  
  const normalized = normalizeSheetName(sheetName);
  return blueLabels.sheetSequences.get(normalized) || [];
}

/**
 * Check if Blue Labels data is available.
 * 
 * @param blueLabels - Blue Label sequence map or null/undefined
 * @returns True if Blue Labels is available and valid
 */
export function hasBlueLabelData(blueLabels: BlueLabelSequenceMap | null | undefined): boolean {
  return blueLabels != null && blueLabels.isValid;
}
