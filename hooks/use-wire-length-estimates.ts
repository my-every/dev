"use client";

/**
 * Wire Length Estimates Hook
 * 
 * Provides wire length estimation for semantic wire list rows.
 * Computes estimates when Blue Labels and Part List data are available.
 */

import { useMemo } from "react";
import type { SemanticWireListRow, ParsedWorkbookSheet } from "@/lib/workbook/types";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import type {
  WireLengthEstimationResult,
  WireLengthEstimationSummary,
  RowEstimatedLength,
} from "@/lib/wire-length/types";
import {
  buildWireLengthEstimatesFromSheets,
  attachEstimatesToRows,
} from "@/lib/wire-length";

// ============================================================================
// Types
// ============================================================================

/**
 * Semantic row extended with estimated length.
 */
export type SemanticWireListRowWithLength = SemanticWireListRow & {
  estimatedLength?: RowEstimatedLength;
};

/**
 * Hook options.
 */
export interface UseWireLengthEstimatesOptions {
  /** Semantic wire list rows */
  rows: SemanticWireListRow[];
  /** Blue Labels sheet data */
  blueLabelsSheet?: ParsedWorkbookSheet | null;
  /** Part List sheet data */
  partListSheet?: ParsedWorkbookSheet | null;
  /** Current sheet name */
  sheetName: string;
  /** Whether estimation is enabled */
  enabled?: boolean;
}

/**
 * Hook return type.
 */
export interface UseWireLengthEstimatesReturn {
  /** Rows with estimated lengths attached */
  rowsWithLength: SemanticWireListRowWithLength[];
  /** Estimation summary statistics */
  summary: WireLengthEstimationSummary | null;
  /** Any warnings from estimation */
  warnings: string[];
  /** Whether estimation ran */
  isEstimated: boolean;
  /** Whether sufficient data is available for estimation */
  hasRequiredData: boolean;
  /** Get estimated length for a specific row */
  getRowLength: (rowId: string) => RowEstimatedLength | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for computing and accessing wire length estimates.
 * 
 * @example
 * ```tsx
 * const {
 *   rowsWithLength,
 *   summary,
 *   isEstimated,
 *   getRowLength,
 * } = useWireLengthEstimates({
 *   rows: semanticRows,
 *   blueLabelsSheet,
 *   partListSheet,
 *   sheetName: currentSheet.name,
 * });
 * ```
 */
export function useWireLengthEstimates({
  rows,
  blueLabelsSheet = null,
  partListSheet = null,
  sheetName,
  enabled = true,
}: UseWireLengthEstimatesOptions): UseWireLengthEstimatesReturn {
  // Check if we have required data for estimation
  const hasRequiredData = useMemo(() => {
    // At minimum, we need rows and Blue Labels for sequence
    return rows.length > 0 && blueLabelsSheet !== null;
  }, [rows.length, blueLabelsSheet]);

  // Compute estimates
  const estimationResult = useMemo<WireLengthEstimationResult | null>(() => {
    if (!enabled || !hasRequiredData || rows.length === 0) {
      return null;
    }

    return buildWireLengthEstimatesFromSheets(
      rows,
      blueLabelsSheet,
      partListSheet,
      sheetName
    );
  }, [enabled, hasRequiredData, rows, blueLabelsSheet, partListSheet, sheetName]);

  // Attach estimates to rows
  const rowsWithLength = useMemo<SemanticWireListRowWithLength[]>(() => {
    if (!estimationResult) {
      return rows;
    }

    return attachEstimatesToRows(rows, estimationResult);
  }, [rows, estimationResult]);

  // Create lookup function
  const getRowLength = useMemo(() => {
    if (!estimationResult) {
      return () => null;
    }

    const estimateMap = new Map<string, RowEstimatedLength | null>();
    
    for (const [rowId, estimate] of estimationResult.estimates) {
      if (estimate.roundedCutLengthIn > 0) {
        estimateMap.set(rowId, {
          rawInches: estimate.estimatedCutLengthIn,
          roundedInches: estimate.roundedCutLengthIn,
          display: `${estimate.roundedCutLengthIn.toFixed(1)} in`,
          confidence: estimate.confidence,
          notes: estimate.notes.length > 0 ? estimate.notes : undefined,
        });
      } else {
        estimateMap.set(rowId, null);
      }
    }

    return (rowId: string): RowEstimatedLength | null => {
      return estimateMap.get(rowId) ?? null;
    };
  }, [estimationResult]);

  return {
    rowsWithLength,
    summary: estimationResult?.summary ?? null,
    warnings: estimationResult?.warnings ?? [],
    isEstimated: estimationResult !== null,
    hasRequiredData,
    getRowLength,
  };
}

/**
 * Hook for accessing wire length estimate for a single row.
 * Useful for cell renderers that need just one row's estimate.
 */
export function useRowWireLength(
  rowId: string,
  estimates: WireLengthEstimationResult | null
): RowEstimatedLength | null {
  return useMemo(() => {
    if (!estimates) return null;

    const estimate = estimates.estimates.get(rowId);
    if (!estimate || estimate.roundedCutLengthIn <= 0) {
      return null;
    }

    return {
      rawInches: estimate.estimatedCutLengthIn,
      roundedInches: estimate.roundedCutLengthIn,
      display: `${estimate.roundedCutLengthIn.toFixed(1)} in`,
      confidence: estimate.confidence,
      notes: estimate.notes.length > 0 ? estimate.notes : undefined,
    };
  }, [rowId, estimates]);
}
