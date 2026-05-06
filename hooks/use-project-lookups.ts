"use client";

/**
 * Project Lookup Hooks
 *
 * Provides dedicated hooks for accessing pre-computed lookup maps
 * from the project state. Part numbers are read from the pre-generated
 * device-part-numbers.json via API.  Blue labels and cable part numbers
 * are read from reference-sheet schemas.
 *
 * Available Hooks:
 * - useProjectPartNumbers: Device ID -> Part Number lookups
 * - useProjectBlueLabels: Device ID -> Blue Label locations
 * - useProjectLocations: Unique locations per sheet
 * - useProjectPrefixFilters: Device prefix combinations (AF, KA, XT)
 * - useProjectGaugeFilters: Available wire gauges and frequency
 * - useProjectLookups: Combined access to all lookups
 */

import { useEffect, useMemo, useState } from "react";
import { useProjectContext } from "@/contexts/project-context";
import { normalizeDeviceId } from "@/lib/part-number-list";
import { extractPrefixCombinations, extractUniquePrefixes, type PrefixCombination, type DevicePrefixSummary } from "@/lib/wiring-identification/prefix-filter";
import { extractGaugeSizes, type GaugeSizeOption } from "@/lib/wiring-identification/gauge-filter";
import type { CablePartNumberLookupResult, PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow, ParsedWorkbookSheet } from "@/lib/workbook/types";
import type { SheetSchema } from "@/types/sheet-schema";

// ============================================================================
// Types
// ============================================================================

export interface BlueLabelEntry {
  deviceId: string;
  sheetLocation: string;
}

export interface BlueLabelLookupResult {
  locations: string[];
}

export interface LocationSummary {
  location: string;
  count: number;
}

export interface SheetFilterData {
  locations: LocationSummary[];
  prefixCombinations: PrefixCombination[];
  prefixSummaries: DevicePrefixSummary[];
  gaugeSizes: GaugeSizeOption[];
}

// ============================================================================
// Part Number Hook
// ============================================================================

/**
 * Hook to access the pre-built Part Number lookup map.
 * Fetches from the pre-generated device-part-numbers.json via API.
 */
export function useProjectPartNumbers() {
  const { currentProject } = useProjectContext();
  const [partNumberMap, setPartNumberMap] = useState<Map<string, PartNumberLookupResult>>(new Map());

  useEffect(() => {
    if (!currentProject) {
      setPartNumberMap(new Map());
      return;
    }

    let cancelled = false;

    fetch(`/api/projects/${encodeURIComponent(currentProject.id)}/device-part-numbers`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : { devices: {} })
      .then((data: { devices?: Record<string, { partNumber: string; description?: string }> }) => {
        if (cancelled) return;
        const map = new Map<string, PartNumberLookupResult>();
        for (const [id, entry] of Object.entries(data.devices ?? {})) {
          map.set(id, { partNumber: entry.partNumber, description: entry.description ?? "", location: "" });
        }
        setPartNumberMap(map);
      })
      .catch(() => {
        if (!cancelled) setPartNumberMap(new Map());
      });

    return () => { cancelled = true; };
  }, [currentProject?.id, currentProject]);

  const getPartNumber = useMemo(() => {
    return (deviceId: string | null | undefined): PartNumberLookupResult | undefined => {
      if (!deviceId) return undefined;
      const normalized = normalizeDeviceId(deviceId);
      return partNumberMap.get(normalized);
    };
  }, [partNumberMap]);

  return {
    partNumberMap,
    getPartNumber,
    hasPartNumbers: partNumberMap.size > 0,
  };
}

export function useProjectCablePartNumbers() {
  // Cable part numbers are not yet pre-computed in the manifest architecture.
  // TODO: Add cable part number generation to writeFullProject and a read API.
  return {
    cablePartNumberMap: new Map<string, CablePartNumberLookupResult>(),
    getCablePartNumber: (_cableKey: string | null | undefined) => undefined as CablePartNumberLookupResult | undefined,
    hasCablePartNumbers: false,
  };
}

// ============================================================================
// Blue Labels Hook
// ============================================================================

/**
 * Hook to access the Blue Labels lookup map.
 * Blue labels reference data is not yet pre-computed in the manifest architecture.
 * TODO: Add blue labels generation to writeFullProject and a read API.
 */
export function useProjectBlueLabels() {
  const blueLabelsMap = useMemo<Map<string, BlueLabelLookupResult>>(() => new Map(), []);

  const hasBlueLabel = useMemo(() => {
    return (deviceId: string | null | undefined): boolean => {
      if (!deviceId) return false;
      const normalized = normalizeDeviceId(deviceId);
      return blueLabelsMap.has(normalized);
    };
  }, [blueLabelsMap]);

  const getBlueLabels = useMemo(() => {
    return (deviceId: string | null | undefined): BlueLabelLookupResult | undefined => {
      if (!deviceId) return undefined;
      const normalized = normalizeDeviceId(deviceId);
      return blueLabelsMap.get(normalized);
    };
  }, [blueLabelsMap]);

  return {
    blueLabelsMap,
    hasBlueLabel,
    getBlueLabels,
    hasBlueLabels: blueLabelsMap.size > 0,
  };
}

// ============================================================================
// Reference Sheet Hook (for wire length estimation)
// ============================================================================

/**
 * Hook to fetch a sheet schema as a ParsedWorkbookSheet-like object.
 * Used by wire length estimation and blue label parsing.
 */
function useReferenceSheet(slug: string): ParsedWorkbookSheet | null {
  const { currentProject } = useProjectContext();
  const [sheet, setSheet] = useState<ParsedWorkbookSheet | null>(null);

  useEffect(() => {
    if (!currentProject) {
      setSheet(null);
      return;
    }

    // Only fetch if the project has this reference sheet
    const hasSheet = currentProject.sheets.some(
      s => s.slug === slug && s.kind === "reference"
    );
    if (!hasSheet) {
      setSheet(null);
      return;
    }

    let cancelled = false;

    fetch(
      `/api/projects/${encodeURIComponent(currentProject.id)}/sheets/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
      .then(res => (res.ok ? res.json() : null))
      .then((data: { schema?: SheetSchema } | null) => {
        if (!cancelled) {
          const schema = data?.schema;
          if (!schema) {
            setSheet(null);
            return;
          }

          setSheet({
            originalName: schema.name,
            slug: schema.slug,
            headers: schema.headers,
            rows: schema.rawRows ?? [],
            semanticRows: schema.rows,
            rowCount: schema.rowCount,
            columnCount: schema.headers.length,
            sheetIndex: schema.sheetIndex,
            warnings: schema.warnings,
            metadata: schema.metadata,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSheet(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, currentProject, slug]);

  return sheet;
}

// ============================================================================
// Locations Hook
// ============================================================================

/**
 * Hook to extract unique locations from a set of wire list rows.
 * Locations are sorted alphabetically with counts.
 */
export function useProjectLocations(rows: SemanticWireListRow[]) {
  const locations = useMemo<LocationSummary[]>(() => {
    const locationCounts = new Map<string, number>();

    for (const row of rows) {
      // Check multiple location sources
      const location = row.toLocation || row.fromLocation || row.location || "";
      if (location) {
        locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
      }
    }

    return Array.from(locationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => a.location.localeCompare(b.location));
  }, [rows]);

  const getLocationCount = useMemo(() => {
    return (location: string): number => {
      return locations.find(l => l.location === location)?.count ?? 0;
    };
  }, [locations]);

  return {
    locations,
    getLocationCount,
    totalLocations: locations.length,
    hasLocations: locations.length > 0,
  };
}

// ============================================================================
// Prefix Filters Hook
// ============================================================================

/**
 * Hook to extract device prefix data from wire list rows.
 * Provides prefix combinations (AF->KA, KA->XT) and individual prefix summaries.
 */
export function useProjectPrefixFilters(rows: SemanticWireListRow[]) {
  const prefixCombinations = useMemo<PrefixCombination[]>(() => {
    return extractPrefixCombinations(rows);
  }, [rows]);

  const prefixSummaries = useMemo<DevicePrefixSummary[]>(() => {
    return extractUniquePrefixes(rows);
  }, [rows]);

  const fromPrefixes = useMemo<string[]>(() => {
    return [...new Set(prefixSummaries.filter(p => p.fromCount > 0).map(p => p.prefix))].sort();
  }, [prefixSummaries]);

  const toPrefixes = useMemo<string[]>(() => {
    return [...new Set(prefixSummaries.filter(p => p.toCount > 0).map(p => p.prefix))].sort();
  }, [prefixSummaries]);

  return {
    prefixCombinations,
    prefixSummaries,
    fromPrefixes,
    toPrefixes,
    hasPrefixes: prefixSummaries.length > 0,
  };
}

// ============================================================================
// Gauge Filters Hook
// ============================================================================

/**
 * Hook to extract gauge size data from wire list rows.
 * Provides available gauges with counts for filtering.
 */
export function useProjectGaugeFilters(rows: SemanticWireListRow[]) {
  const gaugeSizes = useMemo<GaugeSizeOption[]>(() => {
    return extractGaugeSizes(rows);
  }, [rows]);

  const getGaugeCount = useMemo(() => {
    return (gauge: string): number => {
      return gaugeSizes.find(g => g.value === gauge)?.count ?? 0;
    };
  }, [gaugeSizes]);

  return {
    gaugeSizes,
    getGaugeCount,
    totalGauges: gaugeSizes.length,
    hasGauges: gaugeSizes.length > 0,
  };
}

// ============================================================================
// Sheet Filter Data Hook (Combined)
// ============================================================================

/**
 * Hook to get all filter-related data for a sheet.
 * Combines locations, prefixes, and gauges into one call.
 */
export function useSheetFilterData(rows: SemanticWireListRow[]): SheetFilterData {
  const { locations } = useProjectLocations(rows);
  const { prefixCombinations, prefixSummaries } = useProjectPrefixFilters(rows);
  const { gaugeSizes } = useProjectGaugeFilters(rows);

  return {
    locations,
    prefixCombinations,
    prefixSummaries,
    gaugeSizes,
  };
}

// ============================================================================
// Combined Lookups Hook
// ============================================================================

/**
 * Combined hook for all project lookups.
 * Use this when you need access to multiple lookup types.
 */
export function useProjectLookups() {
  const partNumbers = useProjectPartNumbers();
  const cablePartNumbers = useProjectCablePartNumbers();
  const blueLabels = useProjectBlueLabels();

  // Load reference sheets for wire length estimation
  const blueLabelsSheet = useReferenceSheet("blue-labels");
  const partListSheet = useReferenceSheet("part-number-list");

  return {
    // Part Numbers
    partNumberMap: partNumbers.partNumberMap,
    getPartNumber: partNumbers.getPartNumber,
    hasPartNumbers: partNumbers.hasPartNumbers,

    // Cable Part Numbers
    cablePartNumberMap: cablePartNumbers.cablePartNumberMap,
    getCablePartNumber: cablePartNumbers.getCablePartNumber,
    hasCablePartNumbers: cablePartNumbers.hasCablePartNumbers,

    // Blue Labels
    blueLabelsMap: blueLabels.blueLabelsMap,
    hasBlueLabel: blueLabels.hasBlueLabel,
    getBlueLabels: blueLabels.getBlueLabels,
    hasBlueLabels: blueLabels.hasBlueLabels,

    // Reference sheets (for wire length estimation)
    blueLabelsSheet,
    partListSheet,
  };
}
