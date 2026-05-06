"use client";

/**
 * Hook for managing wire list location filtering.
 * Persists selected location to sessionStorage per project/sheet.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ALL_LOCATIONS_TAB,
  findLocationColumnKey,
  getUniqueLocations,
  getLocationSummaries,
  filterRowsByLocation,
  hasMultipleLocations,
  type LocationSummary,
} from "@/lib/workbook/get-unique-sheet-locations";
import type { ParsedSheetRow } from "@/lib/workbook/types";

// ============================================================================
// Types
// ============================================================================

interface UseWireListLocationFilterOptions {
  /** Unique key for this project */
  projectId: string;
  /** Unique key for this sheet */
  sheetSlug: string;
  /** Raw headers to find location column */
  headers: string[];
  /** All rows from the sheet */
  rows: ParsedSheetRow[];
}

interface UseWireListLocationFilterReturn {
  /** Key for the location column */
  locationColumnKey: string | undefined;
  /** Unique locations with counts */
  locations: LocationSummary[];
  /** Currently selected location (or ALL_LOCATIONS_TAB) */
  selectedLocation: string;
  /** Set selected location */
  setSelectedLocation: (location: string) => void;
  /** Filtered rows based on selected location */
  filteredRows: ParsedSheetRow[];
  /** Whether there are multiple locations */
  hasMultipleLocations: boolean;
  /** Total row count (unfiltered) */
  totalRowCount: number;
}

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY_PREFIX = "wire-list-location-filter";

function getStorageKey(projectId: string, sheetSlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}:${sheetSlug}`;
}

function loadLocationFromStorage(
  projectId: string,
  sheetSlug: string
): string | null {
  if (typeof window === "undefined") return null;
  
  try {
    const key = getStorageKey(projectId, sheetSlug);
    return sessionStorage.getItem(key);
  } catch (e) {
    console.error("Failed to load location from storage:", e);
  }
  
  return null;
}

function saveLocationToStorage(
  projectId: string,
  sheetSlug: string,
  location: string
): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = getStorageKey(projectId, sheetSlug);
    sessionStorage.setItem(key, location);
  } catch (e) {
    console.error("Failed to save location to storage:", e);
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useWireListLocationFilter({
  projectId,
  sheetSlug,
  headers,
  rows,
}: UseWireListLocationFilterOptions): UseWireListLocationFilterReturn {
  // Find the location column key
  const locationColumnKey = useMemo(
    () => findLocationColumnKey(headers),
    [headers]
  );

  // Get unique locations with counts
  const locationSummaries = useMemo(() => {
    if (!locationColumnKey) return [];
    return getLocationSummaries(rows, locationColumnKey);
  }, [rows, locationColumnKey]);

  // Check if multiple locations exist
  const multipleLocations = useMemo(() => {
    if (!locationColumnKey) return false;
    return hasMultipleLocations(rows, locationColumnKey);
  }, [rows, locationColumnKey]);

  // Initialize selected location from storage or default to "All"
  const [selectedLocation, setSelectedLocationState] = useState<string>(() => {
    const saved = loadLocationFromStorage(projectId, sheetSlug);
    // Validate saved location still exists
    if (saved && saved !== ALL_LOCATIONS_TAB) {
      const exists = locationSummaries.some((l) => l.value === saved);
      if (exists) return saved;
    }
    return ALL_LOCATIONS_TAB;
  });

  // Sync with storage when projectId or sheetSlug changes
  useEffect(() => {
    const saved = loadLocationFromStorage(projectId, sheetSlug);
    if (saved && saved !== ALL_LOCATIONS_TAB) {
      const exists = locationSummaries.some((l) => l.value === saved);
      if (exists) {
        setSelectedLocationState(saved);
        return;
      }
    }
    setSelectedLocationState(ALL_LOCATIONS_TAB);
  }, [projectId, sheetSlug, locationSummaries]);

  // Set location and persist
  const setSelectedLocation = useCallback(
    (location: string) => {
      setSelectedLocationState(location);
      saveLocationToStorage(projectId, sheetSlug, location);
    },
    [projectId, sheetSlug]
  );

  // Filter rows based on selected location
  const filteredRows = useMemo(() => {
    if (!locationColumnKey || selectedLocation === ALL_LOCATIONS_TAB) {
      return rows;
    }
    return filterRowsByLocation(rows, locationColumnKey, selectedLocation);
  }, [rows, locationColumnKey, selectedLocation]);

  return {
    locationColumnKey,
    locations: locationSummaries,
    selectedLocation,
    setSelectedLocation,
    filteredRows,
    hasMultipleLocations: multipleLocations,
    totalRowCount: rows.length,
  };
}
