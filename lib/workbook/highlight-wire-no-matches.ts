/**
 * Wire No. Search and Highlight Utilities
 * 
 * Provides functions for searching and highlighting Wire No. values
 * in the wire list table.
 */

import type { SemanticWireListRow } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface WireNoMatchResult {
  /** Set of row IDs that have matching Wire No. values */
  matchedRowIds: Set<string>;
  /** Map of row ID to the matched ranges in the Wire No. cell */
  matchRanges: Map<string, { start: number; end: number }[]>;
  /** Total count of matches */
  matchCount: number;
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Find Wire No. values that contain the search query.
 * Case-insensitive partial matching.
 * 
 * @param rows - The semantic wire list rows
 * @param query - The search query (Wire No. substring to match)
 * @returns Match result with matched row IDs and character ranges
 */
export function findWireNoMatches(
  rows: SemanticWireListRow[],
  query: string
): WireNoMatchResult {
  const matchedRowIds = new Set<string>();
  const matchRanges = new Map<string, { start: number; end: number }[]>();
  let matchCount = 0;

  if (!query || query.trim().length === 0) {
    return { matchedRowIds, matchRanges, matchCount };
  }

  const normalizedQuery = query.toLowerCase().trim();

  for (const row of rows) {
    const wireNo = row.wireNo || "";
    const normalizedWireNo = wireNo.toLowerCase();
    
    // Find all occurrences of the query in this wire number
    const ranges: { start: number; end: number }[] = [];
    let searchIndex = 0;
    
    while (searchIndex < normalizedWireNo.length) {
      const foundIndex = normalizedWireNo.indexOf(normalizedQuery, searchIndex);
      
      if (foundIndex === -1) break;
      
      ranges.push({
        start: foundIndex,
        end: foundIndex + normalizedQuery.length,
      });
      
      searchIndex = foundIndex + 1;
    }
    
    if (ranges.length > 0) {
      matchedRowIds.add(row.__rowId);
      matchRanges.set(row.__rowId, ranges);
      matchCount += ranges.length;
    }
  }

  return { matchedRowIds, matchRanges, matchCount };
}

/**
 * Check if a row's Wire No. matches the search query.
 * 
 * @param wireNo - The Wire No. value to check
 * @param query - The search query
 * @returns True if the Wire No. contains the query
 */
export function wireNoMatchesQuery(wireNo: string, query: string): boolean {
  if (!query || query.trim().length === 0) return false;
  return wireNo.toLowerCase().includes(query.toLowerCase().trim());
}

// ============================================================================
// Highlight Rendering
// ============================================================================

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Split a Wire No. value into segments for highlighted rendering.
 * 
 * @param wireNo - The Wire No. value
 * @param query - The search query to highlight
 * @returns Array of segments with highlight flags
 */
export function getWireNoHighlightSegments(
  wireNo: string,
  query: string
): HighlightSegment[] {
  if (!query || query.trim().length === 0) {
    return [{ text: wireNo, highlighted: false }];
  }

  const segments: HighlightSegment[] = [];
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedWireNo = wireNo.toLowerCase();
  
  let lastIndex = 0;
  let searchIndex = 0;

  while (searchIndex < normalizedWireNo.length) {
    const foundIndex = normalizedWireNo.indexOf(normalizedQuery, searchIndex);
    
    if (foundIndex === -1) {
      // No more matches, add remaining text
      if (lastIndex < wireNo.length) {
        segments.push({
          text: wireNo.slice(lastIndex),
          highlighted: false,
        });
      }
      break;
    }
    
    // Add non-matching segment before this match
    if (foundIndex > lastIndex) {
      segments.push({
        text: wireNo.slice(lastIndex, foundIndex),
        highlighted: false,
      });
    }
    
    // Add the matching segment
    segments.push({
      text: wireNo.slice(foundIndex, foundIndex + normalizedQuery.length),
      highlighted: true,
    });
    
    lastIndex = foundIndex + normalizedQuery.length;
    searchIndex = foundIndex + 1;
  }

  // Handle case where no matches were found at all
  if (segments.length === 0) {
    segments.push({ text: wireNo, highlighted: false });
  }

  return segments;
}
