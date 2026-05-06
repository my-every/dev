/**
 * Utilities for extracting and working with location data from wire list sheets.
 */

import type { ParsedSheetRow } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Location summary with counts.
 */
export interface LocationSummary {
  /** Location value */
  value: string;
  /** Number of rows with this location */
  count: number;
  /** Percentage of total rows */
  percentage: number;
}

/**
 * All locations tab constant.
 */
export const ALL_LOCATIONS_TAB = "__all__";

// ============================================================================
// Functions
// ============================================================================

/**
 * Find the location column key in the headers.
 * The location column may have different header names.
 * 
 * @param headers - Array of header strings
 * @returns The location column key or undefined
 */
export function findLocationColumnKey(headers: string[]): string | undefined {
  const locationPatterns = [
    /^location$/i,
    /^to\s*location$/i,
    /^dest(ination)?\s*location$/i,
  ];
  
  for (const header of headers) {
    const trimmed = (header ?? "").trim();
    for (const pattern of locationPatterns) {
      if (pattern.test(trimmed)) {
        return header;
      }
    }
  }
  
  return undefined;
}

/**
 * Extract unique location values from sheet rows.
 * 
 * @param rows - The parsed sheet rows
 * @param locationKey - The key for the location column
 * @returns Array of unique location values, sorted alphabetically
 */
export function getUniqueLocations(
  rows: ParsedSheetRow[],
  locationKey: string
): string[] {
  const locations = new Set<string>();
  
  for (const row of rows) {
    const value = row[locationKey];
    if (value !== null && value !== undefined && value !== "") {
      locations.add(String(value).trim());
    }
  }
  
  return Array.from(locations).sort((a, b) => a.localeCompare(b));
}

/**
 * Get location summaries with counts.
 * 
 * @param rows - The parsed sheet rows
 * @param locationKey - The key for the location column
 * @returns Array of location summaries sorted by count (descending)
 */
export function getLocationSummaries(
  rows: ParsedSheetRow[],
  locationKey: string
): LocationSummary[] {
  const counts = new Map<string, number>();
  
  for (const row of rows) {
    const value = row[locationKey];
    if (value !== null && value !== undefined && value !== "") {
      const location = String(value).trim();
      counts.set(location, (counts.get(location) || 0) + 1);
    }
  }
  
  const total = rows.length;
  const summaries: LocationSummary[] = [];
  
  for (const [value, count] of counts.entries()) {
    summaries.push({
      value,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    });
  }
  
  // Sort by count descending
  summaries.sort((a, b) => b.count - a.count);
  
  return summaries;
}

/**
 * Filter rows by location.
 * 
 * @param rows - The parsed sheet rows
 * @param locationKey - The key for the location column
 * @param selectedLocation - The location to filter by (or ALL_LOCATIONS_TAB for all)
 * @returns Filtered rows
 */
export function filterRowsByLocation(
  rows: ParsedSheetRow[],
  locationKey: string,
  selectedLocation: string
): ParsedSheetRow[] {
  if (selectedLocation === ALL_LOCATIONS_TAB) {
    return rows;
  }
  
  return rows.filter(row => {
    const value = row[locationKey];
    if (value === null || value === undefined || value === "") {
      return false;
    }
    return String(value).trim() === selectedLocation;
  });
}

/**
 * Check if a sheet has multiple locations.
 * 
 * @param rows - The parsed sheet rows
 * @param locationKey - The key for the location column
 * @returns Whether there are multiple unique locations
 */
export function hasMultipleLocations(
  rows: ParsedSheetRow[],
  locationKey: string
): boolean {
  const locations = getUniqueLocations(rows, locationKey);
  return locations.length > 1;
}

/**
 * Get the primary (most common) location in a sheet.
 * 
 * @param rows - The parsed sheet rows
 * @param locationKey - The key for the location column
 * @returns The most common location or undefined
 */
export function getPrimaryLocation(
  rows: ParsedSheetRow[],
  locationKey: string
): string | undefined {
  const summaries = getLocationSummaries(rows, locationKey);
  return summaries[0]?.value;
}
