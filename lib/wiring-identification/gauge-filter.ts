/**
 * Gauge Size Filter Utilities
 * 
 * Provides utilities for filtering and sorting wire list rows by gauge size.
 * Gauge sizes follow AWG (American Wire Gauge) where larger numbers = smaller wire.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";

// ============================================================================
// Types
// ============================================================================

export type GaugeSortOrder = "default" | "smallest-first" | "largest-first";

export interface GaugeSizeOption {
  /** The gauge size value (e.g., "10", "12", "14", "16", "18", "20") */
  value: string;
  /** Display label */
  label: string;
  /** Count of rows with this gauge size */
  count: number;
  /** Numeric value for sorting (null if non-numeric) */
  numeric: number | null;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse gauge size to numeric value.
 * Handles formats like "14", "14 AWG", "14/2", etc.
 * Returns null for non-numeric values.
 */
export function parseGaugeNumeric(gaugeSize: string): number | null {
  if (!gaugeSize) return null;
  
  // Extract first number from the string
  const match = gaugeSize.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  
  return null;
}

/**
 * Extract unique gauge sizes from rows with counts.
 * Returns sorted by numeric value (smallest wire = largest number first).
 */
export function extractGaugeSizes(rows: SemanticWireListRow[]): GaugeSizeOption[] {
  const gaugeCounts = new Map<string, number>();
  
  for (const row of rows) {
    const gauge = (row.gaugeSize || "").trim();
    if (gauge) {
      gaugeCounts.set(gauge, (gaugeCounts.get(gauge) || 0) + 1);
    }
  }
  
  const options: GaugeSizeOption[] = [];
  
  for (const [value, count] of gaugeCounts) {
    const numeric = parseGaugeNumeric(value);
    options.push({
      value,
      label: value,
      count,
      numeric,
    });
  }
  
  // Sort by numeric value descending (larger number = smaller wire = first)
  // Non-numeric values go last
  options.sort((a, b) => {
    if (a.numeric !== null && b.numeric !== null) {
      return b.numeric - a.numeric;
    }
    if (a.numeric !== null) return -1;
    if (b.numeric !== null) return 1;
    return a.value.localeCompare(b.value);
  });
  
  return options;
}

/**
 * Filter rows by selected gauge size.
 * Returns all rows if selectedGauge is null.
 */
export function filterRowsByGauge(
  rows: SemanticWireListRow[],
  selectedGauge: string | null
): SemanticWireListRow[] {
  if (!selectedGauge) return rows;
  
  return rows.filter(row => {
    const gauge = (row.gaugeSize || "").trim();
    return gauge === selectedGauge;
  });
}

/**
 * Sort rows by gauge size.
 * - "smallest-first": Smaller wires first (larger AWG numbers first: 20, 18, 16, 14...)
 * - "largest-first": Larger wires first (smaller AWG numbers first: 10, 12, 14, 16...)
 * - "default": No gauge sorting applied
 */
export function sortRowsByGaugeSize(
  rows: SemanticWireListRow[],
  sortOrder: GaugeSortOrder
): SemanticWireListRow[] {
  if (sortOrder === "default") return rows;
  
  return [...rows].sort((a, b) => {
    const numA = parseGaugeNumeric(a.gaugeSize);
    const numB = parseGaugeNumeric(b.gaugeSize);
    
    // Both numeric
    if (numA !== null && numB !== null) {
      if (sortOrder === "smallest-first") {
        // Larger AWG number = smaller wire = first
        return numB - numA;
      } else {
        // Smaller AWG number = larger wire = first
        return numA - numB;
      }
    }
    
    // A numeric, B non-numeric: A comes first
    if (numA !== null && numB === null) return -1;
    
    // A non-numeric, B numeric: B comes first
    if (numA === null && numB !== null) return 1;
    
    // Both non-numeric: sort alphabetically
    return (a.gaugeSize || "").localeCompare(b.gaugeSize || "");
  });
}

/**
 * Get count of rows matching a specific gauge size.
 */
export function countRowsWithGauge(
  rows: SemanticWireListRow[],
  gauge: string | null
): number {
  if (!gauge) return rows.length;
  return rows.filter(row => (row.gaugeSize || "").trim() === gauge).length;
}
