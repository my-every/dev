"use client";

/**
 * Wire No. Search Hook
 * 
 * Manages state for Wire No. focused search with highlighting.
 */

import { useState, useMemo, useCallback } from "react";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { findWireNoMatches, type WireNoMatchResult } from "@/lib/workbook/highlight-wire-no-matches";

// ============================================================================
// Types
// ============================================================================

export interface UseWireNoSearchOptions {
  /** The rows to search */
  rows: SemanticWireListRow[];
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number;
}

export interface UseWireNoSearchReturn {
  /** Current search query */
  wireNoSearchValue: string;
  /** Set the search query */
  setWireNoSearchValue: (value: string) => void;
  /** Clear the search query */
  clearWireNoSearch: () => void;
  /** Whether search is active (has value) */
  isSearchActive: boolean;
  /** Whether the input is currently focused */
  isInputFocused: boolean;
  /** Set input focus state */
  setIsInputFocused: (focused: boolean) => void;
  /** Whether highlighting should be shown (active AND focused) */
  shouldShowHighlighting: boolean;
  /** Set of row IDs that match */
  matchedRowIds: Set<string>;
  /** Match ranges for highlighting */
  matchRanges: Map<string, { start: number; end: number }[]>;
  /** Total match count */
  matchCount: number;
  /** Whether the search mode is enabled */
  searchModeEnabled: boolean;
  /** Toggle search mode on/off */
  toggleSearchMode: () => void;
  /** Enable search mode */
  enableSearchMode: () => void;
  /** Disable search mode */
  disableSearchMode: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useWireNoSearch({
  rows,
  debounceMs = 150,
}: UseWireNoSearchOptions): UseWireNoSearchReturn {
  const [wireNoSearchValue, setWireNoSearchValue] = useState("");
  const [searchModeEnabled, setSearchModeEnabled] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Compute matches whenever search value or rows change
  const matchResult = useMemo<WireNoMatchResult>(() => {
    if (!wireNoSearchValue.trim()) {
      return {
        matchedRowIds: new Set<string>(),
        matchRanges: new Map(),
        matchCount: 0,
      };
    }
    return findWireNoMatches(rows, wireNoSearchValue);
  }, [rows, wireNoSearchValue]);

  const clearWireNoSearch = useCallback(() => {
    setWireNoSearchValue("");
  }, []);

  const toggleSearchMode = useCallback(() => {
    setSearchModeEnabled(prev => !prev);
    if (searchModeEnabled) {
      // Clear search when disabling
      setWireNoSearchValue("");
    }
  }, [searchModeEnabled]);

  const enableSearchMode = useCallback(() => {
    setSearchModeEnabled(true);
  }, []);

  const disableSearchMode = useCallback(() => {
    setSearchModeEnabled(false);
    setWireNoSearchValue("");
    setIsInputFocused(false);
  }, []);

  // Only show highlighting when both active AND input is focused
  const isSearchActive = wireNoSearchValue.trim().length > 0;
  const shouldShowHighlighting = isSearchActive && isInputFocused;

  return {
    wireNoSearchValue,
    setWireNoSearchValue,
    clearWireNoSearch,
    isSearchActive,
    isInputFocused,
    setIsInputFocused,
    shouldShowHighlighting,
    matchedRowIds: matchResult.matchedRowIds,
    matchRanges: matchResult.matchRanges,
    matchCount: matchResult.matchCount,
    searchModeEnabled,
    toggleSearchMode,
    enableSearchMode,
    disableSearchMode,
  };
}
