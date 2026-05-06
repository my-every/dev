/**
 * Layout matching module.
 * 
 * Provides utilities for matching layout PDF pages to wire-list sheets,
 * comparing project compatibility, and normalizing titles for matching.
 */

// Types
export type {
  ProjectMetadata,
  CompatibilityStatus,
  CompatibilityResult,
  LayoutPagePreview,
  LayoutPageDetail,
  LayoutPageIndexTextItem,
  LayoutPageIndexAnchor,
  LayoutPageIndexItem,
  LayoutPagesIndexDocument,
  SlimLayoutPage,
  SlimRail,
  PanductInfo,
  MatchConfidence,
  SheetLayoutMatch,
  SheetLayoutMapping,
  LayoutHighlightRegion,
  LayoutPreviewModalProps,
} from "./types";

// Metadata parsing
export {
  parseProjectNumberFromFilename,
  parseRevisionFromFilename,
  parseMetadataFromFilename,
  parseProjectMetadataFromPdf,
  parseProjectMetadataFromWorkbook,
  mergeMetadata,
} from "./parse-project-metadata";

// Title normalization (legacy - kept for backward compatibility)
export {
  normalizeSheetName,
  normalizeLayoutPageTitle,
  extractKeywords,
  areNamesEquivalent,
  calculateNameSimilarity,
  extractPanelLetter,
  getPanelTypeKeywords,
} from "./normalize-layout-title";

// Domain-aware layout name normalization
export {
  type AreaType,
  type SideType,
  type NormalizedLayoutName,
  normalizeLayoutName,
  extractJbId,
  extractSide,
  detectAreaTypes,
  hasAreaTypeConflict,
  hasSideConflict,
  TOKEN_ALIASES,
} from "./layout-name-rules";

// Structural scoring system
export {
  type MatchScore,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
  scoreLayoutSheetMatch,
  getConfidenceFromDetailedScore,
  shouldMatch,
  findBestStructuralMatch,
} from "./score-layout-sheet-match";

// Compatibility comparison
export {
  compareProjectCompatibility,
  getCompatibilityMessage,
  getCompatibilityBadgeVariant,
} from "./compare-project-compatibility";

// Sheet-to-page matching (title-based)
export {
  scoreSheetToPageMatch,
  getConfidenceFromScore,
  findBestMatchingPage,
  matchLayoutPagesToWireSheets,
  getMatchForSheet,
  buildSheetLayoutMapping,
  // Hybrid matching (label + title)
  matchLayoutPagesByLabels,
  type LayoutPageWithText,
} from "./match-layout-pages-to-sheets";

// Device label-based matching (PRIMARY strategy)
export {
  extractDeviceLabelsFromText,
  buildSheetLabelMap,
  matchPageByLabels,
  matchAllPagesByLabels,
  buildMappingFromLabelMatches,
  type SheetLabelMap,
  type LabelMatchResult,
} from "./match-by-device-labels";

// PDF page rendering
export {
  renderPdfPagesToImages,
  buildLayoutPagePreviewMap,
  cleanupPreviewUrls,
  renderPageThumbnail,
  type RenderProgress,
} from "./render-pdf-pages-to-images";

export {
  buildLayoutPageCollections,
  type LayoutPageCollectionsDocument,
} from "./layout-page-collections";

// Unified sheet → layout page resolver
export {
  resolveSheetLayoutPage,
  hasResolvedLayoutPage,
  type ResolveLayoutPageOptions,
} from "./resolve-sheet-layout-page";
