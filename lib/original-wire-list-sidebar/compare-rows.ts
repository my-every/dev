/**
 * Utilities for comparing original wire list rows to enhanced rows.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { OriginalRowMatchState, OriginalWireListNavItem } from "./types";

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a string value for comparison.
 * - Trims whitespace
 * - Converts to uppercase
 * - Removes special characters that may differ
 */
export function normalizeValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.toString().trim().toUpperCase().replace(/[\s\-_]+/g, "");
}

/**
 * Build a normalized match key for a row.
 * Uses: fromDeviceId | wireNo | gaugeSize | toDeviceId | location
 */
export function buildRowMatchKey(row: SemanticWireListRow): string {
  const parts = [
    normalizeValue(row.fromDeviceId),
    normalizeValue(row.wireNo),
    normalizeValue(row.gaugeSize),
    normalizeValue(row.toDeviceId),
    normalizeValue(row.location),
  ];
  return parts.join("|");
}

/**
 * Build a partial match key (without location) for fallback matching.
 */
export function buildPartialMatchKey(row: SemanticWireListRow): string {
  const parts = [
    normalizeValue(row.fromDeviceId),
    normalizeValue(row.wireNo),
    normalizeValue(row.gaugeSize),
    normalizeValue(row.toDeviceId),
  ];
  return parts.join("|");
}

/**
 * Build a minimal match key using only wire number and devices.
 */
export function buildMinimalMatchKey(row: SemanticWireListRow): string {
  const parts = [
    normalizeValue(row.fromDeviceId),
    normalizeValue(row.wireNo),
    normalizeValue(row.toDeviceId),
  ];
  return parts.join("|");
}

// ============================================================================
// Enhanced Row Index
// ============================================================================

/**
 * Index of enhanced rows for fast lookup.
 */
export interface EnhancedRowIndex {
  /** Full key -> row ID */
  byFullKey: Map<string, string>;
  /** Partial key -> row IDs (may have multiple) */
  byPartialKey: Map<string, string[]>;
  /** Minimal key -> row IDs */
  byMinimalKey: Map<string, string[]>;
  /** Row ID -> row */
  byId: Map<string, SemanticWireListRow>;
}

/**
 * Build an index of enhanced rows for fast comparison.
 */
export function buildEnhancedRowIndex(rows: SemanticWireListRow[]): EnhancedRowIndex {
  const byFullKey = new Map<string, string>();
  const byPartialKey = new Map<string, string[]>();
  const byMinimalKey = new Map<string, string[]>();
  const byId = new Map<string, SemanticWireListRow>();
  
  for (const row of rows) {
    const rowId = row.__rowId;
    byId.set(rowId, row);
    
    const fullKey = buildRowMatchKey(row);
    byFullKey.set(fullKey, rowId);
    
    const partialKey = buildPartialMatchKey(row);
    if (!byPartialKey.has(partialKey)) {
      byPartialKey.set(partialKey, []);
    }
    byPartialKey.get(partialKey)!.push(rowId);
    
    const minimalKey = buildMinimalMatchKey(row);
    if (!byMinimalKey.has(minimalKey)) {
      byMinimalKey.set(minimalKey, []);
    }
    byMinimalKey.get(minimalKey)!.push(rowId);
  }
  
  return { byFullKey, byPartialKey, byMinimalKey, byId };
}

// ============================================================================
// Comparison
// ============================================================================

/**
 * Result of comparing an original row to enhanced rows.
 */
export interface RowComparisonResult {
  matchState: OriginalRowMatchState;
  matchedRowId?: string;
  matchedRow?: SemanticWireListRow;
  mismatchFields?: string[];
}

/**
 * Fields to compare for mismatch detection.
 */
const COMPARISON_FIELDS: (keyof SemanticWireListRow)[] = [
  "fromDeviceId",
  "wireNo",
  "gaugeSize",
  "toDeviceId",
  "wireType",
  "wireId",
  "location",
];

/**
 * Compare an original row to enhanced rows and determine match state.
 */
export function compareOriginalRowToEnhanced(
  originalRow: SemanticWireListRow,
  enhancedIndex: EnhancedRowIndex,
  visibleRowIds: Set<string>
): RowComparisonResult {
  const fullKey = buildRowMatchKey(originalRow);
  
  // Try exact match first
  const exactMatchId = enhancedIndex.byFullKey.get(fullKey);
  if (exactMatchId) {
    const isVisible = visibleRowIds.has(exactMatchId);
    return {
      matchState: isVisible ? "matched" : "hidden",
      matchedRowId: exactMatchId,
      matchedRow: enhancedIndex.byId.get(exactMatchId),
    };
  }
  
  // Try partial match (without location)
  const partialKey = buildPartialMatchKey(originalRow);
  const partialMatches = enhancedIndex.byPartialKey.get(partialKey);
  if (partialMatches && partialMatches.length > 0) {
    // Take first match
    const matchedRowId = partialMatches[0];
    const matchedRow = enhancedIndex.byId.get(matchedRowId);
    const isVisible = visibleRowIds.has(matchedRowId);
    
    // Check for mismatches in other fields
    const mismatchFields = findMismatchFields(originalRow, matchedRow);
    if (mismatchFields.length > 0) {
      return {
        matchState: "mismatch",
        matchedRowId,
        matchedRow,
        mismatchFields,
      };
    }
    
    return {
      matchState: isVisible ? "matched" : "hidden",
      matchedRowId,
      matchedRow,
    };
  }
  
  // Try minimal match (device IDs + wire no only)
  const minimalKey = buildMinimalMatchKey(originalRow);
  const minimalMatches = enhancedIndex.byMinimalKey.get(minimalKey);
  if (minimalMatches && minimalMatches.length > 0) {
    const matchedRowId = minimalMatches[0];
    const matchedRow = enhancedIndex.byId.get(matchedRowId);
    const mismatchFields = findMismatchFields(originalRow, matchedRow);
    
    return {
      matchState: "mismatch",
      matchedRowId,
      matchedRow,
      mismatchFields,
    };
  }
  
  // No match found
  return { matchState: "missing" };
}

/**
 * Find which fields differ between two rows.
 */
function findMismatchFields(
  original: SemanticWireListRow,
  enhanced?: SemanticWireListRow
): string[] {
  if (!enhanced) return [];
  
  const mismatches: string[] = [];
  
  for (const field of COMPARISON_FIELDS) {
    const origValue = normalizeValue(original[field] as string);
    const enhValue = normalizeValue(enhanced[field] as string);
    
    if (origValue !== enhValue) {
      mismatches.push(field);
    }
  }
  
  return mismatches;
}

// ============================================================================
// Nav Item Builder
// ============================================================================

/**
 * Build nav items from original rows with match state.
 */
export function buildOriginalWireListNavItems(
  originalRows: SemanticWireListRow[],
  enhancedRows: SemanticWireListRow[],
  visibleRowIds: Set<string>,
  assignmentByLocation?: Record<string, {
    stage?: string;
    stageLabel?: string;
    sheetName?: string;
  } | null>
): OriginalWireListNavItem[] {
  const enhancedIndex = buildEnhancedRowIndex(enhancedRows);
  const navItems: OriginalWireListNavItem[] = [];
  
  for (const row of originalRows) {
    const comparison = compareOriginalRowToEnhanced(row, enhancedIndex, visibleRowIds);
    const matchKey = buildRowMatchKey(row);
    
    // Use toLocation as the primary location (matches physical wire list "Location" column)
    // Fall back to fromLocation, then deprecated location field
    const location = row.toLocation || row.fromLocation || row.location || "Unknown Location";
    const assignmentContext = assignmentByLocation?.[location] ?? null;
    
    navItems.push({
      originalRowId: row.__rowId,
      originalRowIndex: row.__rowIndex,
      location,
      
      fromDeviceId: row.fromDeviceId || "",
      wireNo: row.wireNo || "",
      gaugeSize: row.gaugeSize || "",
      toDeviceId: row.toDeviceId || "",
      wireType: row.wireType || "",
      wireId: row.wireId || "",
      fromPageZone: row.fromPageZone || "",
      toPageZone: row.toPageZone || "",
      
      originalRow: row,
      matchState: comparison.matchState,
      matchedEnhancedRowId: comparison.matchedRowId,
      visibleInCurrentView: comparison.matchState === "matched",
      mismatchFields: comparison.mismatchFields,
      matchKey,
      greenChangeType: row.greenChangeType,
      assignmentStageId: assignmentContext?.stage,
      assignmentStageLabel: assignmentContext?.stageLabel,
      assignmentSheetName: assignmentContext?.sheetName,
    });
  }
  
  return navItems;
}
