/**
 * Catalog Module Index
 * 
 * Re-exports all catalog-related functions and types for easy importing.
 */

// Local Catalog Adapter
export {
  parsePartLibraryCSV,
  buildPartCatalog,
  normalizePartNumber,
  lookupByPartNumber,
  lookupByDevicePrefix,
  batchLookup,
  loadPartCatalog,
  clearCatalogCache,
  getCatalogStats,
} from './local-catalog-adapter'

// Reference Sheet Normalizer
export {
  detectReferenceSheetType,
  normalizeReferenceSheet,
  normalizePartNumberList,
  normalizeCablePartNumbers,
  normalizeLabelsSheet,
  normalizePanelErrors,
  buildProjectReferenceData,
  findReferencesForDevice,
  findReferencesForWire,
  getReferenceDataStats,
} from './reference-sheet-normalizer'

// Assignment Component Normalizer
export {
  extractDevicesFromWireList,
  normalizeComponent,
  buildAssignmentComponentSummary,
  batchNormalizeAssignments,
  getComponentStats,
  filterByConfidence,
  filterByCategory,
  filterWithCatalogMatch,
  filterNeedsReview,
} from './assignment-component-normalizer'

// Re-export types from catalog types file
export type {
  PartCategory,
  MountType,
  ImageViewType,
  CatalogImage,
  CatalogImageSet,
  CatalogInstructionNote,
  CatalogAssociatedPart,
  CatalogToolReference,
  PartCatalogRecord,
  MatchConfidence,
  CatalogLookupResult,
  CatalogBatchLookupResult,
  CatalogIndexEntry,
  PartCatalog,
  ReferenceSheetType,
  NormalizedReference,
  ProjectReferenceData,
  ComponentSource,
  NormalizedAssignmentComponent,
  AssignmentComponentSummary,
} from '@/types/d380-catalog'
