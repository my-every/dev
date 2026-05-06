/**
 * Main hook for the Original Wire List Sidebar.
 * 
 * Manages:
 * - Nav item generation and comparison
 * - Section grouping
 * - Column visibility
 * - Search filtering
 * - Statistics
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import {
  buildOriginalWireListNavItems,
  buildOriginalWireListSections,
  calculateSidebarStatistics,
  filterNavItemsBySearch,
  filterNavItemsByMatchState,
  DEFAULT_SIDEBAR_COLUMN_VISIBILITY,
  type OriginalWireListNavItem,
  type OriginalWireListSection,
  type SidebarColumnVisibility,
  type SidebarStatistics,
  type OriginalRowMatchState,
} from "@/lib/original-wire-list-sidebar";

interface UseOriginalWireListSidebarOptions {
  /** Original extracted wire list rows */
  originalRows: SemanticWireListRow[];
  /** Enhanced/filtered wire list rows */
  enhancedRows: SemanticWireListRow[];
  /** IDs of rows currently visible after filtering */
  visibleEnhancedRowIds: Set<string>;
  /** Optional assignment context keyed by effective location string. */
  assignmentByLocation?: Record<string, {
    stage?: string;
    stageLabel?: string;
    sheetName?: string;
  } | null>;
  /** Project ID for persistence */
  projectId?: string;
  /** Sheet name for persistence */
  sheetName?: string;
}

interface UseOriginalWireListSidebarResult {
  /** All nav items with match state */
  navItems: OriginalWireListNavItem[];
  /** Nav items after search/filter applied */
  filteredNavItems: OriginalWireListNavItem[];
  /** Sections grouped by location */
  sections: OriginalWireListSection[];
  /** Statistics summary */
  statistics: SidebarStatistics;
  
  /** Search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Clear search */
  clearSearch: () => void;
  
  /** Match state filter toggles */
  matchStateFilters: Record<OriginalRowMatchState, boolean>;
  /** Toggle a match state filter */
  toggleMatchStateFilter: (state: OriginalRowMatchState) => void;
  /** Reset match state filters to show all */
  resetMatchStateFilters: () => void;
  
  /** Column visibility */
  columnVisibility: SidebarColumnVisibility;
  /** Toggle column visibility */
  toggleColumn: (key: keyof SidebarColumnVisibility) => void;
  /** Reset column visibility to defaults */
  resetColumnVisibility: () => void;
  
  /** Collapsed sections */
  collapsedSections: Set<string>;
  /** Toggle section collapsed state */
  toggleSectionCollapsed: (location: string) => void;
  /** Collapse all sections */
  collapseAllSections: () => void;
  /** Expand all sections */
  expandAllSections: () => void;
  
  /** Get nav item by row ID */
  getNavItemByRowId: (rowId: string) => OriginalWireListNavItem | undefined;
  /** Get nav item by enhanced row ID */
  getNavItemByEnhancedRowId: (rowId: string) => OriginalWireListNavItem | undefined;
}

export function useOriginalWireListSidebar({
  originalRows,
  enhancedRows,
  visibleEnhancedRowIds,
  assignmentByLocation,
  projectId,
  sheetName,
}: UseOriginalWireListSidebarOptions): UseOriginalWireListSidebarResult {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Match state filter toggles
  const [matchStateFilters, setMatchStateFilters] = useState<Record<OriginalRowMatchState, boolean>>({
    matched: true,
    hidden: true,
    missing: true,
    mismatch: true,
  });
  
  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<SidebarColumnVisibility>(
    DEFAULT_SIDEBAR_COLUMN_VISIBILITY
  );
  
  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Build nav items with comparison results
  const navItems = useMemo(() => {
    return buildOriginalWireListNavItems(
      originalRows,
      enhancedRows,
      visibleEnhancedRowIds,
      assignmentByLocation,
    );
  }, [originalRows, enhancedRows, visibleEnhancedRowIds, assignmentByLocation]);
  
  // Apply search filter
  const searchFilteredItems = useMemo(() => {
    return filterNavItemsBySearch(navItems, searchQuery);
  }, [navItems, searchQuery]);
  
  // Apply match state filter
  const filteredNavItems = useMemo(() => {
    return filterNavItemsByMatchState(
      searchFilteredItems,
      matchStateFilters.matched,
      matchStateFilters.hidden,
      matchStateFilters.missing,
      matchStateFilters.mismatch
    );
  }, [searchFilteredItems, matchStateFilters]);
  
  // Build sections from filtered items
  const sections = useMemo(() => {
    return buildOriginalWireListSections(filteredNavItems, collapsedSections);
  }, [filteredNavItems, collapsedSections]);
  
  // Calculate statistics from all nav items (before filtering)
  const statistics = useMemo(() => {
    return calculateSidebarStatistics(navItems);
  }, [navItems]);
  
  // Callbacks
  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);
  
  const toggleMatchStateFilter = useCallback((state: OriginalRowMatchState) => {
    setMatchStateFilters(prev => ({
      ...prev,
      [state]: !prev[state],
    }));
  }, []);
  
  const resetMatchStateFilters = useCallback(() => {
    setMatchStateFilters({
      matched: true,
      hidden: true,
      missing: true,
      mismatch: true,
    });
  }, []);
  
  const toggleColumn = useCallback((key: keyof SidebarColumnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);
  
  const resetColumnVisibility = useCallback(() => {
    setColumnVisibility(DEFAULT_SIDEBAR_COLUMN_VISIBILITY);
  }, []);
  
  const toggleSectionCollapsed = useCallback((location: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(location)) {
        next.delete(location);
      } else {
        next.add(location);
      }
      return next;
    });
  }, []);
  
  const collapseAllSections = useCallback(() => {
    setCollapsedSections(new Set(sections.map(s => s.location)));
  }, [sections]);
  
  const expandAllSections = useCallback(() => {
    setCollapsedSections(new Set());
  }, []);
  
  // Lookup helpers
  const getNavItemByRowId = useCallback((rowId: string) => {
    return navItems.find(item => item.originalRowId === rowId);
  }, [navItems]);
  
  const getNavItemByEnhancedRowId = useCallback((rowId: string) => {
    return navItems.find(item => item.matchedEnhancedRowId === rowId);
  }, [navItems]);
  
  return {
    navItems,
    filteredNavItems,
    sections,
    statistics,
    searchQuery,
    setSearchQuery,
    clearSearch,
    matchStateFilters,
    toggleMatchStateFilter,
    resetMatchStateFilters,
    columnVisibility,
    toggleColumn,
    resetColumnVisibility,
    collapsedSections,
    toggleSectionCollapsed,
    collapseAllSections,
    expandAllSections,
    getNavItemByRowId,
    getNavItemByEnhancedRowId,
  };
}
