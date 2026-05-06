"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectModel, ProjectSheetSummary } from "@/lib/workbook/types";
import type {
  BrandingExclusionConfig,
  BrandingFilterStats,
  BrandingRow,
  BrandingSelection,
} from "@/lib/branding-list/types";
import { DEFAULT_BRANDING_EXCLUSIONS, createEmptySelection } from "@/lib/branding-list/types";
import { getBrandingFilterStats } from "@/lib/branding-list/filter";
import {
  buildBaseBrandingLengths,
  buildBrandingRowsForSheet,
  isExternalBrandingRow,
} from "@/lib/branding-list/build-sheet-branding";
import { findSheetBySlug } from "@/lib/workbook/build-project-model";
import {
  loadBrandingEdits,
  saveBrandingEdits,
  type SheetBrandingEdits,
} from "@/lib/persistence/project-storage";

/**
 * Parse gauge size to a numeric value for sorting.
 * AWG gauge: smaller number = thicker wire, so we invert for "smallest first" sorting.
 * Returns a number where smaller gauges (thicker wires) have higher values.
 */
function parseGaugeForSorting(gauge: string | undefined | null): number {
  if (!gauge) return 999; // Unknown gauges go last
  
  const cleanGauge = gauge.toString().toUpperCase().trim();
  
  // Handle AWG gauges (e.g., "18", "20", "22", "14")
  const awgMatch = cleanGauge.match(/^(\d+)$/);
  if (awgMatch) {
    return parseInt(awgMatch[1], 10);
  }
  
  // Handle gauges with AWG suffix (e.g., "18 AWG", "20AWG")
  const awgSuffixMatch = cleanGauge.match(/^(\d+)\s*AWG$/);
  if (awgSuffixMatch) {
    return parseInt(awgSuffixMatch[1], 10);
  }
  
  // Handle fractional gauges (e.g., "1/0", "2/0", "4/0" - these are larger than single digits)
  const fractionMatch = cleanGauge.match(/^(\d+)\/0$/);
  if (fractionMatch) {
    return -parseInt(fractionMatch[1], 10); // Negative to sort before positive AWG numbers
  }
  
  return 998; // Unknown format goes near end
}


export interface UseBrandingSheetOptions {
  project: ProjectModel | null;
  sheetSlug: string;
  exclusionConfig?: BrandingExclusionConfig;
  locationFilter?: string | null;
  searchQuery?: string;
}

export interface UseBrandingSheetReturn {
  sheetSummary: ProjectSheetSummary | null;
  rows: BrandingRow[];
  allRows: BrandingRow[];
  stats: BrandingFilterStats;
  locations: string[];
  selection: BrandingSelection;
  toggleSelection: (rowId: string, shiftKey?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  updateRowLength: (rowId: string, length: number) => void;
  updateSelectedLength: (delta: number) => void;
  resetRowLength: (rowId: string) => void;
  exclusionConfig: BrandingExclusionConfig;
  setExclusionConfig: (config: BrandingExclusionConfig) => void;
  isLoading: boolean;
  found: boolean;
}

export function useBrandingSheet({
  project,
  sheetSlug,
  exclusionConfig: initialExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS,
  locationFilter = null,
  searchQuery = "",
}: UseBrandingSheetOptions): UseBrandingSheetReturn {
  const [exclusionConfig, setExclusionConfig] = useState(initialExclusionConfig);
  const [selection, setSelection] = useState<BrandingSelection>(createEmptySelection);
  const [brandingEdits, setBrandingEdits] = useState<SheetBrandingEdits>({});
  const [hasLoadedEdits, setHasLoadedEdits] = useState(false);

  const sheetResult = useMemo(() => {
    if (!project) return null;
    return findSheetBySlug(project, sheetSlug);
  }, [project, sheetSlug]);

  const sheetSummary = sheetResult?.summary ?? null;
  const sourceRows = sheetResult?.data.semanticRows ?? [];

  useEffect(() => {
    let cancelled = false;

    if (!project || !sheetSummary) {
      setBrandingEdits({});
      setHasLoadedEdits(false);
      return () => {
        cancelled = true;
      };
    }

    setHasLoadedEdits(false);
    void loadBrandingEdits(project.id, sheetSummary.slug).then((edits) => {
      if (cancelled) return;
      setBrandingEdits(edits);
      setHasLoadedEdits(true);
    });

    return () => {
      cancelled = true;
    };
  }, [project, sheetSummary]);

  useEffect(() => {
    if (!project || !sheetSummary || !hasLoadedEdits) return;
    void saveBrandingEdits(project.id, sheetSummary.slug, brandingEdits);
  }, [brandingEdits, project, sheetSummary, hasLoadedEdits]);

  const computedBaseLengths = useMemo(() => {
    if (!sheetSummary) {
      return new Map<string, number>();
    }

    return buildBaseBrandingLengths(sourceRows, sheetSummary.name);
  }, [sourceRows, sheetSummary]);

  const allRows = useMemo(() => {
    if (!sheetSummary) return [];

    return buildBrandingRowsForSheet({
      sheetSlug: sheetSummary.slug,
      sheetName: sheetSummary.name,
      rows: sourceRows,
      exclusionConfig,
      edits: brandingEdits,
    });
  }, [sheetSummary, sourceRows, exclusionConfig, brandingEdits]);

  const finalLengths = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of allRows) {
      if (typeof row.brandingLength !== "number") continue;

      map.set(row.__rowId, row.brandingLength);

      if (row.__originalRowId) {
        map.set(row.__originalRowId, row.brandingLength);
      }
    }

    return map;
  }, [allRows]);

  const rows = useMemo(() => {
    let nextRows = allRows;

    if (locationFilter) {
      nextRows = nextRows.filter((row) => row.__effectiveLocation === locationFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      nextRows = nextRows.filter((row) =>
        row.wireNo?.toLowerCase().includes(query) ||
        row.fromDeviceId?.toLowerCase().includes(query) ||
        row.toDeviceId?.toLowerCase().includes(query) ||
        row.wireId?.toLowerCase().includes(query) ||
        row.brandingNotes?.toLowerCase().includes(query)
      );
    }

    // Sort by: 1) From Device (grouped), 2) Gauge (smallest to biggest)
    nextRows = [...nextRows].sort((a, b) => {
      // First: group by from device base
      const deviceA = getDeviceBase(a.fromDeviceId);
      const deviceB = getDeviceBase(b.fromDeviceId);
      const deviceCompare = deviceA.localeCompare(deviceB, undefined, { numeric: true });
      if (deviceCompare !== 0) return deviceCompare;
      
      // Second: sort by gauge (smallest gauge number first = thinnest wire first)
      const gaugeA = parseGaugeForSorting(a.gaugeSize);
      const gaugeB = parseGaugeForSorting(b.gaugeSize);
      if (gaugeA !== gaugeB) return gaugeA - gaugeB;
      
      // Third: sort by wire number for consistency
      return (a.wireNo || "").localeCompare(b.wireNo || "", undefined, { numeric: true });
    });

    return nextRows;
  }, [allRows, locationFilter, searchQuery]);

  const locations = useMemo(() => {
    const locationSet = new Set<string>();
    for (const row of allRows) {
      if (row.__effectiveLocation) {
        locationSet.add(row.__effectiveLocation);
      }
    }
    return Array.from(locationSet).sort();
  }, [allRows]);

  const stats = useMemo(() => {
    return getBrandingFilterStats(sourceRows, exclusionConfig, finalLengths);
  }, [sourceRows, exclusionConfig, finalLengths]);

  const toggleSelection = useCallback((rowId: string, shiftKey = false) => {
    setSelection((prev) => {
      const nextSelected = new Set(prev.selectedIds);

      if (shiftKey && prev.lastSelectedId) {
        const allIds = rows.map((row) => row.__rowId);
        const lastIndex = allIds.indexOf(prev.lastSelectedId);
        const currentIndex = allIds.indexOf(rowId);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          for (let index = start; index <= end; index++) {
            nextSelected.add(allIds[index]);
          }
        }
      } else if (nextSelected.has(rowId)) {
        nextSelected.delete(rowId);
      } else {
        nextSelected.add(rowId);
      }

      return {
        selectedIds: nextSelected,
        lastSelectedId: rowId,
        allSelected: nextSelected.size === rows.length,
      };
    });
  }, [rows]);

  const selectAll = useCallback(() => {
    setSelection({
      selectedIds: new Set(rows.map((row) => row.__rowId)),
      lastSelectedId: null,
      allSelected: rows.length > 0,
    });
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelection(createEmptySelection());
  }, []);

  const updateRowLength = useCallback((rowId: string, length: number) => {
    setBrandingEdits((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        wireNo: prev[rowId]?.wireNo ?? rows.find((row) => row.__rowId === rowId)?.wireNo ?? "",
        length,
        lengthAdjustment: undefined,
      },
    }));
  }, [rows]);

  const updateSelectedLength = useCallback((delta: number) => {
    setBrandingEdits((prev) => {
      const next = { ...prev };

      for (const rowId of selection.selectedIds) {
        const row = allRows.find((entry) => entry.__rowId === rowId);
        if (!row) continue;

        const existingEdit = next[rowId];

        if (typeof existingEdit?.length === "number") {
          next[rowId] = {
            ...existingEdit,
            wireNo: row.wireNo,
            length: Math.max(0, existingEdit.length + delta),
          };
          continue;
        }

        const baseLength = computedBaseLengths.get(row.__originalRowId ?? rowId) ?? 0;
        const currentAdjustment = existingEdit?.lengthAdjustment ?? 0;
        const nextAdjustment = Math.max(-baseLength, currentAdjustment + delta);

        next[rowId] = {
          ...existingEdit,
          wireNo: row.wireNo,
          length: undefined,
          lengthAdjustment: nextAdjustment,
        };
      }

      return next;
    });
  }, [selection.selectedIds, allRows, computedBaseLengths]);

  const resetRowLength = useCallback((rowId: string) => {
    setBrandingEdits((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  return {
    sheetSummary,
    rows,
    allRows,
    stats,
    locations,
    selection,
    toggleSelection,
    selectAll,
    clearSelection,
    updateRowLength,
    updateSelectedLength,
    resetRowLength,
    exclusionConfig,
    setExclusionConfig,
    isLoading: !hasLoadedEdits && Boolean(project && sheetSummary),
    found: Boolean(sheetSummary),
  };
}
