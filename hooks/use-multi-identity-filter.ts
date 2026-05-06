"use client";

/**
 * Multi-Identity Filter Hook
 * 
 * Allows selecting multiple identification filters with reordering capabilities.
 * This enables creating a custom print order like:
 * Grounds → AF Jumpers → Clips → KA Jumpers → KT Jumpers → FU Jumpers
 * 
 * Used by both SemanticWireList and PrintModal to maintain consistent grouping.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import type {
  IdentificationFilterKind,
  IdentificationFilterOption,
  BlueLabelSequenceMap,
  PatternMatchMetadata,
} from "@/lib/wiring-identification/types";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import {
  buildIdentificationOptions,
  applyIdentificationFilter,
  FILTER_METADATA,
} from "@/lib/wiring-identification/filter-registry";
import { hasBlueLabelData } from "@/lib/wiring-identification/blue-label-sequence";

// ============================================================================
// Types
// ============================================================================

/** A filter entry with its order position */
export interface MultiFilterEntry {
  /** Filter kind identifier */
  kind: IdentificationFilterKind;
  /** Whether this filter is enabled */
  enabled: boolean;
  /** Display label */
  label: string;
  /** Match count */
  count: number;
  /** Whether filter is available (has matches) */
  available: boolean;
}

/** Grouped rows by filter */
export interface FilterGroup {
  /** Filter kind */
  kind: IdentificationFilterKind;
  /** Display label */
  label: string;
  /** Rows matching this filter */
  rows: SemanticWireListRow[];
  /** Match metadata for each row */
  matchMetadata: Record<string, PatternMatchMetadata>;
}

interface UseMultiIdentityFilterProps {
  /** All semantic rows */
  rows: SemanticWireListRow[];
  /** Blue Labels map (optional) */
  blueLabels?: BlueLabelSequenceMap | null;
  /** Current sheet name */
  currentSheetName: string;
  /** Device ID -> Part Number List lookup */
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  /** Initial filter order (optional) */
  initialFilterOrder?: IdentificationFilterKind[];
}

interface UseMultiIdentityFilterReturn {
  /** Ordered list of filter entries */
  filterEntries: MultiFilterEntry[];
  /** Set filter entries with new order */
  setFilterEntries: (entries: MultiFilterEntry[]) => void;
  /** Toggle a specific filter on/off */
  toggleFilter: (kind: IdentificationFilterKind) => void;
  /** Reorder a filter to a new position */
  reorderFilter: (kind: IdentificationFilterKind, newIndex: number) => void;
  /** Move filter up */
  moveFilterUp: (kind: IdentificationFilterKind) => void;
  /** Move filter down */
  moveFilterDown: (kind: IdentificationFilterKind) => void;
  /** Enable all available filters */
  enableAllFilters: () => void;
  /** Disable all filters */
  disableAllFilters: () => void;
  /** Reset to default order */
  resetToDefaultOrder: () => void;
  /** Get grouped rows based on enabled filters in order */
  getFilteredGroups: () => FilterGroup[];
  /** Get all rows combined from enabled filters (preserving order) */
  getAllFilteredRows: () => SemanticWireListRow[];
  /** Whether Blue Labels is available */
  hasBlueLabels: boolean;
  /** Get enabled filter count */
  enabledCount: number;
  /** Get available filter count */
  availableCount: number;
}

// Default order matching the print modal's expected output
// Order: Grounds → Clips → VIO Jumpers → Relay Mechanical Jumpers → KA Jumpers → 
//        KA Twin Ferrules → Resistors → FU Jumpers → AF Jumpers → KT Jumpers → 
//        AU Jumpers → Single Connections → Cables
const DEFAULT_FILTER_ORDER: IdentificationFilterKind[] = [
  "grounds",
  "clips",
  "vio_jumpers",
  "ka_relay_plugin_jumpers",
  "ka_jumpers",
  "ka_twin_ferrules",
  "resistors",
  "fu_jumpers",
  "af_jumpers",
  "kt_jumpers",
  "single_connections",
  "cables",
];

// Filters that should not be included in multi-filter (they're not section-based)
const EXCLUDED_FILTERS: Set<IdentificationFilterKind> = new Set([
  "default",
  "jumpers", // Generic - we use specific jumper types
  "xt_jumpers",
  "xt_clips",
  // Note: single_connections and cables are included as they are valid print sections
]);

// ============================================================================
// Hook
// ============================================================================

export function useMultiIdentityFilter({
  rows,
  blueLabels = null,
  currentSheetName,
  partNumberMap = null,
  initialFilterOrder = DEFAULT_FILTER_ORDER,
}: UseMultiIdentityFilterProps): UseMultiIdentityFilterReturn {
  // Check Blue Labels availability
  const hasBlueLabels = useMemo(
    () => hasBlueLabelData(blueLabels),
    [blueLabels]
  );

  // Build filter options from the data
  const baseFilterOptions = useMemo(
    () => buildIdentificationOptions(rows, blueLabels, currentSheetName, partNumberMap),
    [rows, blueLabels, currentSheetName, partNumberMap]
  );

  // Create initial filter entries based on available options
  const createInitialEntries = useCallback((): MultiFilterEntry[] => {
    const optionsMap = new Map(baseFilterOptions.map(opt => [opt.kind, opt]));

    // Start with the initial order, then add any missing available filters
    const orderedKinds = [...initialFilterOrder];

    // Add any filters from baseFilterOptions that aren't in the order
    for (const opt of baseFilterOptions) {
      if (!orderedKinds.includes(opt.kind) && !EXCLUDED_FILTERS.has(opt.kind)) {
        orderedKinds.push(opt.kind);
      }
    }

    return orderedKinds
      .filter(kind => !EXCLUDED_FILTERS.has(kind))
      .map(kind => {
        const option = optionsMap.get(kind);
        const meta = FILTER_METADATA[kind];
        return {
          kind,
          enabled: option?.available ?? false,
          label: meta?.label ?? kind,
          count: option?.count ?? 0,
          available: option?.available ?? false,
        };
      });
  }, [baseFilterOptions, initialFilterOrder]);

  // Filter entries state
  const [filterEntries, setFilterEntries] = useState<MultiFilterEntry[]>(createInitialEntries);

  useEffect(() => {
    setFilterEntries((prev) => {
      const nextDefaults = createInitialEntries();
      const nextByKind = new Map(nextDefaults.map((entry) => [entry.kind, entry]));
      const seenKinds = new Set<IdentificationFilterKind>();

      const merged = prev
        .filter((entry) => nextByKind.has(entry.kind))
        .map((entry) => {
          const nextEntry = nextByKind.get(entry.kind)!;
          seenKinds.add(entry.kind);

          return {
            ...entry,
            label: nextEntry.label,
            count: nextEntry.count,
            available: nextEntry.available,
            enabled: nextEntry.available ? entry.enabled : false,
          };
        });

      for (const nextEntry of nextDefaults) {
        if (seenKinds.has(nextEntry.kind)) {
          continue;
        }

        merged.push(nextEntry);
      }

      const unchanged =
        merged.length === prev.length &&
        merged.every((entry, index) => {
          const previous = prev[index];
          return previous &&
            previous.kind === entry.kind &&
            previous.label === entry.label &&
            previous.count === entry.count &&
            previous.available === entry.available &&
            previous.enabled === entry.enabled;
        });

      return unchanged ? prev : merged;
    });
  }, [createInitialEntries]);

  // Toggle a filter on/off
  const toggleFilter = useCallback((kind: IdentificationFilterKind) => {
    setFilterEntries(prev =>
      prev.map(entry =>
        entry.kind === kind ? { ...entry, enabled: !entry.enabled } : entry
      )
    );
  }, []);

  // Reorder a filter to a new position
  const reorderFilter = useCallback((kind: IdentificationFilterKind, newIndex: number) => {
    setFilterEntries(prev => {
      const currentIndex = prev.findIndex(e => e.kind === kind);
      if (currentIndex === -1 || currentIndex === newIndex) return prev;

      const newEntries = [...prev];
      const [removed] = newEntries.splice(currentIndex, 1);
      newEntries.splice(newIndex, 0, removed);
      return newEntries;
    });
  }, []);

  // Move filter up one position
  const moveFilterUp = useCallback((kind: IdentificationFilterKind) => {
    setFilterEntries(prev => {
      const currentIndex = prev.findIndex(e => e.kind === kind);
      if (currentIndex <= 0) return prev;

      const newEntries = [...prev];
      [newEntries[currentIndex - 1], newEntries[currentIndex]] =
        [newEntries[currentIndex], newEntries[currentIndex - 1]];
      return newEntries;
    });
  }, []);

  // Move filter down one position
  const moveFilterDown = useCallback((kind: IdentificationFilterKind) => {
    setFilterEntries(prev => {
      const currentIndex = prev.findIndex(e => e.kind === kind);
      if (currentIndex === -1 || currentIndex >= prev.length - 1) return prev;

      const newEntries = [...prev];
      [newEntries[currentIndex], newEntries[currentIndex + 1]] =
        [newEntries[currentIndex + 1], newEntries[currentIndex]];
      return newEntries;
    });
  }, []);

  // Enable all available filters
  const enableAllFilters = useCallback(() => {
    setFilterEntries(prev =>
      prev.map(entry => ({ ...entry, enabled: entry.available }))
    );
  }, []);

  // Disable all filters
  const disableAllFilters = useCallback(() => {
    setFilterEntries(prev =>
      prev.map(entry => ({ ...entry, enabled: false }))
    );
  }, []);

  // Reset to default order
  const resetToDefaultOrder = useCallback(() => {
    setFilterEntries(createInitialEntries());
  }, [createInitialEntries]);

  // Get grouped rows based on enabled filters
  const getFilteredGroups = useCallback((): FilterGroup[] => {
    const groups: FilterGroup[] = [];
    const usedRowIds = new Set<string>();

    for (const entry of filterEntries) {
      if (!entry.enabled || !entry.available) continue;

      const result = applyIdentificationFilter(rows, entry.kind, blueLabels, currentSheetName, partNumberMap);

      // Filter out rows already used in previous groups (de-duplication)
      const uniqueRows = result.rows.filter(row => !usedRowIds.has(row.__rowId));

      // Mark these rows as used
      for (const row of uniqueRows) {
        usedRowIds.add(row.__rowId);
      }

      if (uniqueRows.length > 0) {
        groups.push({
          kind: entry.kind,
          label: entry.label,
          rows: uniqueRows,
          matchMetadata: result.matchMetadata,
        });
      }
    }

    return groups;
  }, [filterEntries, rows, blueLabels, currentSheetName, partNumberMap]);

  // Get all rows combined (preserving filter order)
  const getAllFilteredRows = useCallback((): SemanticWireListRow[] => {
    const groups = getFilteredGroups();
    return groups.flatMap(g => g.rows);
  }, [getFilteredGroups]);

  // Computed values
  const enabledCount = useMemo(
    () => filterEntries.filter(e => e.enabled).length,
    [filterEntries]
  );

  const availableCount = useMemo(
    () => filterEntries.filter(e => e.available).length,
    [filterEntries]
  );

  return {
    filterEntries,
    setFilterEntries,
    toggleFilter,
    reorderFilter,
    moveFilterUp,
    moveFilterDown,
    enableAllFilters,
    disableAllFilters,
    resetToDefaultOrder,
    getFilteredGroups,
    getAllFilteredRows,
    hasBlueLabels,
    enabledCount,
    availableCount,
  };
}

export default useMultiIdentityFilter;
