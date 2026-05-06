/**
 * Original Wire List Sidebar library.
 * 
 * Provides utilities for comparing original wire list rows against
 * enhanced/filtered views to verify data integrity.
 */

// Types
export * from "./types";

// Comparison utilities
export {
  normalizeValue,
  buildRowMatchKey,
  buildPartialMatchKey,
  buildMinimalMatchKey,
  buildEnhancedRowIndex,
  compareOriginalRowToEnhanced,
  buildOriginalWireListNavItems,
  type EnhancedRowIndex,
  type RowComparisonResult,
} from "./compare-rows";

// Section building
export {
  buildOriginalWireListSections,
  calculateSidebarStatistics,
  filterNavItemsBySearch,
  filterNavItemsByMatchState,
} from "./build-sections";
