/**
 * Branding List Module
 * 
 * Provides functionality for generating and managing branding lists
 * from wire list data. Branding lists are filtered, derived views
 * optimized for wire branding operations.
 */

// Export types
export type {
  BrandingExclusionConfig,
  BrandingRow,
  BrandingFilterStats,
  ExclusionReason,
  BrandingSheet,
  AggregatedBrandingList,
  BrandingColumn,
  BrandingSelection,
} from "./types";

export {
  DEFAULT_BRANDING_EXCLUSIONS,
  BRANDING_COLUMNS,
  createEmptySelection,
} from "./types";

// Export filter functions
export {
  getExclusionReason,
  shouldIncludeInBranding,
  toBrandingRow,
  filterRowsForBranding,
  getBrandingFilterStats,
  aggregateBrandingRows,
  EXCLUSION_REASON_LABELS,
} from "./filter";
