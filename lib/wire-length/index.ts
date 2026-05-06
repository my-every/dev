/**
 * Wire Length Estimation Module
 * 
 * Public API for wire length estimation.
 * 
 * Usage:
 * ```ts
 * import {
 *   buildWireLengthEstimatesFromSheets,
 *   attachEstimatesToRows,
 * } from "@/lib/wire-length";
 * 
 * const result = buildWireLengthEstimatesFromSheets(
 *   semanticRows,
 *   blueLabelsSheet,
 *   partListSheet,
 *   sheetName
 * );
 * 
 * const rowsWithLength = attachEstimatesToRows(semanticRows, result);
 * ```
 */

// Core types
export type {
  WireLengthEstimate,
  WireLengthEstimationResult,
  WireLengthEstimationSummary,
  RowEstimatedLength,
  PanelTopology,
  DeviceCatalog,
  DeviceCatalogEntry,
  DeviceFamily,
  DeviceDimensions,
  PlacedDevice,
  PlacedRail,
  Point,
  PathSegment,
  EstimateConfidence,
  AllowanceRules,
  LayoutTextNode,
  LayoutDeviceNode,
  LayoutRail,
  LayoutGroundPoint,
  PanductNode,
} from "./types";

// Main estimation functions
export {
  buildWireLengthEstimates,
  buildWireLengthEstimatesFromSheets,
  attachEstimatesToRows,
  estimateToRowLength,
} from "./build-wire-length-estimates";

// Single row estimation
export { estimateWireLengthForRow } from "./estimate-wire-length-for-row";

// Device catalog
export {
  buildDeviceCatalog,
  getDeviceEntry,
  resolveDeviceDimensions,
  getBaseDeviceId,
  extractTerminal,
} from "./build-device-catalog";

// Blue Labels
export {
  parseBlueLabelSheet,
  getBlueLabelsEntry,
  getRouteType,
  getSequenceGap,
  normalizeSheetName,
  hasBlueLabelData,
} from "./build-blue-label-sequence-map";

// Device placement
export {
  buildPanelTopology,
  placeDevicesAlongRail,
  findPlacedDevice,
  areDevicesOnSameRail,
  getRailDistanceBetweenDevices,
} from "./place-devices-on-rails";

// Terminal anchors
export {
  resolveTerminalAnchor,
  getTerminalFaceMap,
  getTerminalApproachDirection,
} from "./resolve-terminal-anchor";

// Routing
export {
  buildOrthogonalPath,
  buildPanductAssistedPath,
  calculatePathLength,
  countPathTurns,
} from "./build-orthogonal-path";

// Allowances
export {
  getTerminationAllowance,
  getTotalTerminationAllowance,
  getSlackAllowance,
  getBendPenalty,
  getAllowanceBreakdown,
  type RouteType,
} from "./get-allowances";

// Constants and utilities
export {
  DEVICE_FAMILY_DEFAULTS,
  DEFAULT_ALLOWANCE_RULES,
  INTERNAL_WIRE_MINIMUM_LENGTH_IN,
  EXTERNAL_WIRE_MINIMUM_LENGTH_IN,
  getDeviceFamilyFromPrefix,
  getDeviceFamily,
  formatLengthDisplay,
  roundToIncrement,
  mmToInches,
  inchesToMm,
} from "./constants";

// Layout PDF parsing
export {
  parseLayoutPdfText,
  buildTopologyFromPdf,
  calculateDeviceDistance,
  getRailSummary,
  getPanductSummary,
  getDeviceSummary,
  getLayoutAssetSummary,
  buildLayoutPartListCandidates,
  buildLayoutPartListRows,
  type ParsedLayoutPdf,
  type ParsedPdfPage,
  type ParsedRailGroup,
  type ParsedPdfLayout,
  type ExtractedRail,
  type ExtractedPanduct,
  type ExtractedDevice,
  type ExtractedMeasurement,
  type ExtractedPartReference,
  type LayoutPdfTextItem,
  type LayoutPdfTextSource,
  type LayoutAssetSummary,
  type LayoutPartListCandidate,
  type LayoutPartListRow,
} from "./parse-layout-pdf";

// PDF column extraction utilities
export {
  createProjectUnitKey,
  extractPdfColumnRows,
  buildProjectUnitColumnObject,
  buildProjectUnitColumnObjectFromPdf,
  type PdfColumnBoundary,
  type PdfColumnExtractionOptions,
  type ExtractedPdfColumnRow,
  type ProjectUnitKeyInput,
  type ProjectUnitColumnObject,
} from "./extract-pdf-columns";
