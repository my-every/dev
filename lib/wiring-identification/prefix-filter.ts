/**
 * Device Prefix Filter Utilities
 * 
 * Provides utilities for filtering wire list rows by device prefix combinations.
 * Allows filtering by "From Prefix -> To Prefix" patterns, e.g., KA -> KA, KA -> XT.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import { parseDeviceId } from "./device-parser";

// ============================================================================
// Types
// ============================================================================

export interface DevicePrefixSummary {
  /** The device prefix (e.g., "KA", "XT", "AF") */
  prefix: string;
  /** Number of rows where this prefix appears in From device */
  fromCount: number;
  /** Number of rows where this prefix appears in To device */
  toCount: number;
}

export interface PrefixCombination {
  /** From device prefix */
  fromPrefix: string;
  /** To device prefix */
  toPrefix: string;
  /** Number of rows matching this combination */
  count: number;
  /** Display label (e.g., "KA -> XT (15)") */
  label: string;
}

export interface PrefixFilterState {
  /** Selected from prefix, or null for all */
  fromPrefix: string | null;
  /** Selected to prefix, or null for all */
  toPrefix: string | null;
}

// ============================================================================
// Prefix Extraction
// ============================================================================

/**
 * Extract all unique device prefixes from a list of rows.
 * 
 * @param rows - The semantic wire list rows
 * @returns Array of unique prefixes with counts
 */
export function extractUniquePrefixes(rows: SemanticWireListRow[]): DevicePrefixSummary[] {
  const prefixMap = new Map<string, { fromCount: number; toCount: number }>();
  
  for (const row of rows) {
    const fromParsed = parseDeviceId(row.fromDeviceId);
    const toParsed = parseDeviceId(row.toDeviceId);
    
    // Count from prefix
    if (fromParsed.prefix) {
      const existing = prefixMap.get(fromParsed.prefix) || { fromCount: 0, toCount: 0 };
      existing.fromCount++;
      prefixMap.set(fromParsed.prefix, existing);
    }
    
    // Count to prefix
    if (toParsed.prefix) {
      const existing = prefixMap.get(toParsed.prefix) || { fromCount: 0, toCount: 0 };
      existing.toCount++;
      prefixMap.set(toParsed.prefix, existing);
    }
  }
  
  // Convert to array and sort by total count (descending)
  return Array.from(prefixMap.entries())
    .map(([prefix, counts]) => ({
      prefix,
      fromCount: counts.fromCount,
      toCount: counts.toCount,
    }))
    .sort((a, b) => {
      const totalA = a.fromCount + a.toCount;
      const totalB = b.fromCount + b.toCount;
      return totalB - totalA;
    });
}

/**
 * Get unique prefixes appearing in "from" devices only.
 */
export function extractFromPrefixes(rows: SemanticWireListRow[]): string[] {
  const prefixes = new Set<string>();
  
  for (const row of rows) {
    const parsed = parseDeviceId(row.fromDeviceId);
    if (parsed.prefix) {
      prefixes.add(parsed.prefix);
    }
  }
  
  return Array.from(prefixes).sort();
}

/**
 * Get unique prefixes appearing in "to" devices only.
 */
export function extractToPrefixes(rows: SemanticWireListRow[]): string[] {
  const prefixes = new Set<string>();
  
  for (const row of rows) {
    const parsed = parseDeviceId(row.toDeviceId);
    if (parsed.prefix) {
      prefixes.add(parsed.prefix);
    }
  }
  
  return Array.from(prefixes).sort();
}

// ============================================================================
// Combination Detection
// ============================================================================

/**
 * Get all unique from->to prefix combinations in the data.
 * 
 * @param rows - The semantic wire list rows
 * @returns Array of combinations with counts, sorted by count descending
 */
export function extractPrefixCombinations(rows: SemanticWireListRow[]): PrefixCombination[] {
  const combinationMap = new Map<string, number>();
  
  for (const row of rows) {
    const fromParsed = parseDeviceId(row.fromDeviceId);
    const toParsed = parseDeviceId(row.toDeviceId);
    
    if (fromParsed.prefix && toParsed.prefix) {
      const key = `${fromParsed.prefix}->${toParsed.prefix}`;
      combinationMap.set(key, (combinationMap.get(key) || 0) + 1);
    }
  }
  
  // Convert to array
  const combinations: PrefixCombination[] = [];
  
  for (const [key, count] of combinationMap.entries()) {
    const [fromPrefix, toPrefix] = key.split("->");
    combinations.push({
      fromPrefix,
      toPrefix,
      count,
      label: `${fromPrefix} -> ${toPrefix} (${count})`,
    });
  }
  
  // Sort by count descending
  combinations.sort((a, b) => b.count - a.count);
  
  return combinations;
}

/**
 * Get available "to" prefixes for a given "from" prefix.
 * Returns prefixes that have at least one row with the given from prefix.
 */
export function getAvailableToPrefixes(
  rows: SemanticWireListRow[],
  fromPrefix: string | null
): { prefix: string; count: number }[] {
  if (!fromPrefix) {
    // All to prefixes with counts
    const prefixCounts = new Map<string, number>();
    for (const row of rows) {
      const toParsed = parseDeviceId(row.toDeviceId);
      if (toParsed.prefix) {
        prefixCounts.set(toParsed.prefix, (prefixCounts.get(toParsed.prefix) || 0) + 1);
      }
    }
    return Array.from(prefixCounts.entries())
      .map(([prefix, count]) => ({ prefix, count }))
      .sort((a, b) => b.count - a.count);
  }
  
  // Filter to rows matching fromPrefix
  const filteredRows = rows.filter(row => {
    const fromParsed = parseDeviceId(row.fromDeviceId);
    return fromParsed.prefix === fromPrefix;
  });
  
  // Get to prefixes from filtered rows
  const prefixCounts = new Map<string, number>();
  for (const row of filteredRows) {
    const toParsed = parseDeviceId(row.toDeviceId);
    if (toParsed.prefix) {
      prefixCounts.set(toParsed.prefix, (prefixCounts.get(toParsed.prefix) || 0) + 1);
    }
  }
  
  return Array.from(prefixCounts.entries())
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter rows by from and/or to prefix.
 * 
 * @param rows - The rows to filter
 * @param fromPrefix - The from prefix to match (null = all)
 * @param toPrefix - The to prefix to match (null = all)
 * @returns Filtered rows
 */
export function filterRowsByPrefix(
  rows: SemanticWireListRow[],
  fromPrefix: string | null,
  toPrefix: string | null
): SemanticWireListRow[] {
  if (!fromPrefix && !toPrefix) {
    return rows;
  }
  
  return rows.filter(row => {
    const fromParsed = parseDeviceId(row.fromDeviceId);
    const toParsed = parseDeviceId(row.toDeviceId);
    
    // Check from prefix if specified
    if (fromPrefix && fromParsed.prefix !== fromPrefix) {
      return false;
    }
    
    // Check to prefix if specified
    if (toPrefix && toParsed.prefix !== toPrefix) {
      return false;
    }
    
    return true;
  });
}

/**
 * Get row count for a specific prefix combination.
 */
export function countRowsWithPrefix(
  rows: SemanticWireListRow[],
  fromPrefix: string | null,
  toPrefix: string | null
): number {
  return filterRowsByPrefix(rows, fromPrefix, toPrefix).length;
}
