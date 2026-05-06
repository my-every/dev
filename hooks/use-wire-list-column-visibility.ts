"use client";

/**
 * Hook for managing wire list column visibility state.
 * Persists visibility preferences to Share-backed sheet state per project/sheet.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDefaultColumnVisibility,
  mergeVisibilityState,
  buildColumnDisplayConfigs,
  type ColumnVisibilityState,
  type ColumnDisplayConfig,
} from "@/lib/workbook/column-visibility-config";
import type { NormalizedColumn } from "@/lib/workbook/wire-list-normalizer";
import {
  loadColumnVisibility,
  saveColumnVisibility,
} from "@/lib/persistence/project-storage";

// ============================================================================
// Types
// ============================================================================

interface UseWireListColumnVisibilityOptions {
  /** Unique key for this project */
  projectId: string;
  /** Unique key for this sheet */
  sheetSlug: string;
  /** Normalized column definitions */
  columns: NormalizedColumn[];
  /** Raw headers for default visibility calculation */
  headers: string[];
}

interface UseWireListColumnVisibilityReturn {
  /** Current visibility state */
  visibility: ColumnVisibilityState;
  /** Set visibility state */
  setVisibility: (visibility: ColumnVisibilityState) => void;
  /** Default visibility state for reset */
  defaultVisibility: ColumnVisibilityState;
  /** Column display configurations */
  columnConfigs: ColumnDisplayConfig[];
  /** Reset to default visibility */
  resetToDefaults: () => void;
  /** Toggle a single column */
  toggleColumn: (columnKey: string) => void;
  /** Show all columns */
  showAllColumns: () => void;
  /** Hide optional columns */
  hideOptionalColumns: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useWireListColumnVisibility({
  projectId,
  sheetSlug,
  columns,
  headers,
}: UseWireListColumnVisibilityOptions): UseWireListColumnVisibilityReturn {
  // Calculate default visibility
  const defaultVisibility = useMemo(
    () => getDefaultColumnVisibility(headers),
    [headers]
  );

  // Build column display configs
  const columnConfigs = useMemo(
    () => buildColumnDisplayConfigs(columns),
    [columns]
  );
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);

  const [visibility, setVisibilityState] = useState<ColumnVisibilityState>(defaultVisibility);

  useEffect(() => {
    let cancelled = false;

    setHasLoadedPersistedState(false);
    void loadColumnVisibility(projectId, sheetSlug).then((saved) => {
      if (cancelled) return;
      setVisibilityState(mergeVisibilityState(defaultVisibility, saved));
      setHasLoadedPersistedState(true);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, sheetSlug, defaultVisibility]);

  const setVisibility = useCallback(
    (newVisibility: ColumnVisibilityState) => {
      setVisibilityState(newVisibility);
      if (hasLoadedPersistedState) {
        void saveColumnVisibility(projectId, sheetSlug, newVisibility);
      }
    },
    [hasLoadedPersistedState, projectId, sheetSlug]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setVisibility(defaultVisibility);
  }, [setVisibility, defaultVisibility]);

  // Toggle a single column
  const toggleColumn = useCallback(
    (columnKey: string) => {
      setVisibility({
        ...visibility,
        [columnKey]: !visibility[columnKey],
      });
    },
    [visibility, setVisibility]
  );

  // Show all columns
  const showAllColumns = useCallback(() => {
    const allVisible: ColumnVisibilityState = {};
    for (const col of columns) {
      allVisible[col.originalKey] = true;
    }
    setVisibility(allVisible);
  }, [columns, setVisibility]);

  // Hide optional columns (keep required visible)
  const hideOptionalColumns = useCallback(() => {
    const hiddenOptional: ColumnVisibilityState = {};
    for (const config of columnConfigs) {
      hiddenOptional[config.key] = !config.canHide || config.defaultVisible;
    }
    setVisibility(hiddenOptional);
  }, [columnConfigs, setVisibility]);

  return {
    visibility,
    setVisibility,
    defaultVisibility,
    columnConfigs,
    resetToDefaults,
    toggleColumn,
    showAllColumns,
    hideOptionalColumns,
  };
}
