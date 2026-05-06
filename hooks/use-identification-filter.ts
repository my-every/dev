"use client";

/**
 * Hook for managing identification filter state and applying filters.
 * 
 * This hook provides:
 * - Available filter options based on current data
 * - Filter application and result caching
 * - Integration with Blue Labels (when available)
 */

import { useMemo, useState, useCallback } from "react";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import type {
  IdentificationFilterKind,
  IdentificationFilterOption,
  IdentificationFilterResult,
  BlueLabelSequenceMap,
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

interface UseIdentificationFilterProps {
  /** All semantic rows in the current sheet */
  rows: SemanticWireListRow[];
  /** Blue Labels sequence map (if available) */
  blueLabels?: BlueLabelSequenceMap | null;
  /** Current sheet name (for internal/external detection) */
  currentSheetName: string;
  /** Device ID -> Part Number List lookup */
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
}

interface UseIdentificationFilterReturn {
  /** Currently selected filter kind */
  selectedFilter: IdentificationFilterKind;
  /** Set the selected filter */
  setSelectedFilter: (kind: IdentificationFilterKind) => void;
  /** Available filter options (with counts) */
  filterOptions: IdentificationFilterOption[];
  /** Current filter result (filtered rows + metadata) */
  filterResult: IdentificationFilterResult;
  /** Whether Blue Labels is available */
  hasBlueLabels: boolean;
  /** Reset to default filter */
  resetFilter: () => void;
  /** Get metadata for the current filter */
  currentFilterMeta: {
    label: string;
    description: string;
    requiresBlueLabels: boolean;
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing identification filter state.
 */
export function useIdentificationFilter({
  rows,
  blueLabels = null,
  currentSheetName,
  partNumberMap = null,
}: UseIdentificationFilterProps): UseIdentificationFilterReturn {
  // Selected filter state
  const [selectedFilter, setSelectedFilter] = useState<IdentificationFilterKind>("default");

  // Check Blue Labels availability
  const hasBlueLabels = useMemo(
    () => hasBlueLabelData(blueLabels),
    [blueLabels]
  );

  // Build available filter options
  const filterOptions = useMemo(
    () => buildIdentificationOptions(rows, blueLabels, currentSheetName, partNumberMap),
    [rows, blueLabels, currentSheetName, partNumberMap]
  );

  // Apply the selected filter
  const filterResult = useMemo(
    () => applyIdentificationFilter(rows, selectedFilter, blueLabels, currentSheetName, partNumberMap),
    [rows, selectedFilter, blueLabels, currentSheetName, partNumberMap]
  );

  // Reset to default
  const resetFilter = useCallback(() => {
    setSelectedFilter("default");
  }, []);

  // Get current filter metadata
  const currentFilterMeta = useMemo(
    () => ({
      label: FILTER_METADATA[selectedFilter].label,
      description: FILTER_METADATA[selectedFilter].description,
      requiresBlueLabels: FILTER_METADATA[selectedFilter].requiresBlueLabels,
    }),
    [selectedFilter]
  );

  return {
    selectedFilter,
    setSelectedFilter,
    filterOptions,
    filterResult,
    hasBlueLabels,
    resetFilter,
    currentFilterMeta,
  };
}

export default useIdentificationFilter;
