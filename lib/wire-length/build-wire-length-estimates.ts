/**
 * Wire Length Estimates Builder
 * 
 * Orchestrates wire length estimation for all rows in a wire list.
 * Provides summary statistics and batch processing.
 */

import type { SemanticWireListRow, ParsedWorkbookSheet } from "@/lib/workbook/types";
import type {
  WireLengthEstimate,
  WireLengthEstimationResult,
  WireLengthEstimationSummary,
  PanelTopology,
  DeviceCatalog,
  RowEstimatedLength,
  AllowanceRules,
} from "./types";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import { estimateWireLengthForRow } from "./estimate-wire-length-for-row";
import { buildDeviceCatalog } from "./build-device-catalog";
import { buildPanelTopology } from "./place-devices-on-rails";
import { parseBlueLabelSheet } from "./build-blue-label-sequence-map";
import { DEFAULT_ALLOWANCE_RULES, formatLengthDisplay, INTERNAL_WIRE_MINIMUM_LENGTH_IN, EXTERNAL_WIRE_MINIMUM_LENGTH_IN } from "./constants";
import { getBaseDeviceId } from "./build-device-catalog";
import { buildTopologyFromPdf, getDeviceSummary, type ParsedLayoutPdf } from "./parse-layout-pdf";

// ============================================================================
// Batch Estimation
// ============================================================================

/**
 * Build wire length estimates for all rows in a sheet.
 * 
 * @param rows - Semantic wire list rows
 * @param blueLabels - Blue Label sequence map
 * @param catalog - Device catalog
 * @param sheetName - Current sheet name
 * @param rules - Allowance rules
 * @param layoutPdf - Optional parsed layout PDF for accurate positioning
 * @returns Complete estimation result
 */
export function buildWireLengthEstimates(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  catalog: DeviceCatalog,
  sheetName: string,
  rules: AllowanceRules = DEFAULT_ALLOWANCE_RULES,
  layoutPdf?: ParsedLayoutPdf | null
): WireLengthEstimationResult {
  const estimates = new Map<string, WireLengthEstimate>();
  const warnings: string[] = [];

  // Build topology - prefer PDF layout if available, else use Blue Labels
  let topology: PanelTopology;
  if (layoutPdf && getDeviceSummary(layoutPdf).totalDevices > 0) {
    topology = buildTopologyFromPdf(layoutPdf, sheetName);
    if (topology.deviceIndex.size > 0) {
      warnings.push(`Using layout PDF data: ${topology.deviceIndex.size} devices positioned`);
    }
  } else {
    topology = buildPanelTopology(blueLabels, catalog, sheetName);
  }

  // Check if we have enough data
  if (!blueLabels?.isValid) {
    warnings.push("Blue Labels data not available - estimates will have low confidence");
  }

  if (topology.deviceIndex.size === 0) {
    warnings.push("No devices placed - using fallback estimates");
  }

  // Estimate each row
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let skippedCount = 0;
  let totalLength = 0;
  let minLength = Infinity;
  let maxLength = 0;
  let estimatedCount = 0;

  for (const row of rows) {
    // Pass sheetName as currentLocation for cross-location allowance calculation
    const estimate = estimateWireLengthForRow(row, topology, catalog, blueLabels, rules, sheetName);

    // Apply minimum length floors, excluding same-device jumpers
    if (
      estimate.roundedCutLengthIn > 0 &&
      getBaseDeviceId(row.fromDeviceId) !== getBaseDeviceId(row.toDeviceId)
    ) {
      const isExternal = estimate.crossLocationAllowanceIn > 0;
      const minimumLength = isExternal ? EXTERNAL_WIRE_MINIMUM_LENGTH_IN : INTERNAL_WIRE_MINIMUM_LENGTH_IN;

      if (estimate.roundedCutLengthIn < minimumLength) {
        estimate.roundedCutLengthIn = minimumLength;
        estimate.estimatedCutLengthIn = Math.max(estimate.estimatedCutLengthIn, minimumLength);
        estimate.notes.push(`${isExternal ? "External" : "Internal"} wire minimum applied: ${minimumLength}"`);
      }
    }

    estimates.set(row.__rowId, estimate);

    // Skip rows with no valid estimate
    if (estimate.roundedCutLengthIn <= 0) {
      skippedCount++;
      continue;
    }

    estimatedCount++;
    totalLength += estimate.roundedCutLengthIn;
    minLength = Math.min(minLength, estimate.roundedCutLengthIn);
    maxLength = Math.max(maxLength, estimate.roundedCutLengthIn);

    switch (estimate.confidence) {
      case "high":
        highCount++;
        break;
      case "medium":
        mediumCount++;
        break;
      case "low":
        lowCount++;
        break;
    }
  }

  // Build summary
  const summary: WireLengthEstimationSummary = {
    totalRows: rows.length,
    estimatedRows: estimatedCount,
    highConfidenceCount: highCount,
    mediumConfidenceCount: mediumCount,
    lowConfidenceCount: lowCount,
    skippedRows: skippedCount,
    averageLengthIn: estimatedCount > 0 ? totalLength / estimatedCount : 0,
    minLengthIn: minLength === Infinity ? 0 : minLength,
    maxLengthIn: maxLength,
  };

  return {
    estimates,
    summary,
    warnings,
  };
}

/**
 * Build wire length estimates from project sheets.
 * Convenience function that handles sheet lookup and parsing.
 * 
 * @param semanticRows - Semantic wire list rows
 * @param blueLabelsSheet - Blue Labels sheet (or null)
 * @param partListSheet - Part List sheet (or null)
 * @param sheetName - Current sheet name
 * @param layoutPdf - Optional parsed layout PDF for accurate positioning
 * @returns Estimation result
 */
export function buildWireLengthEstimatesFromSheets(
  semanticRows: SemanticWireListRow[],
  blueLabelsSheet: ParsedWorkbookSheet | null,
  partListSheet: ParsedWorkbookSheet | null,
  sheetName: string,
  layoutPdf?: ParsedLayoutPdf | null
): WireLengthEstimationResult {
  // Parse Blue Labels
  const blueLabels = parseBlueLabelSheet(blueLabelsSheet);

  // Build device catalog
  const catalog = buildDeviceCatalog(partListSheet);

  // Run estimation
  return buildWireLengthEstimates(
    semanticRows,
    blueLabels,
    catalog,
    sheetName,
    DEFAULT_ALLOWANCE_RULES,
    layoutPdf
  );
}

/**
 * Convert a wire length estimate to row attachment format.
 */
export function estimateToRowLength(estimate: WireLengthEstimate): RowEstimatedLength | null {
  if (estimate.roundedCutLengthIn <= 0) {
    return null;
  }

  return {
    rawInches: estimate.estimatedCutLengthIn,
    roundedInches: estimate.roundedCutLengthIn,
    display: formatLengthDisplay(estimate.roundedCutLengthIn),
    confidence: estimate.confidence,
    notes: estimate.notes.length > 0 ? estimate.notes : undefined,
  };
}

/**
 * Attach estimated lengths to semantic rows.
 * Returns a new array with estimatedLength field populated.
 */
export function attachEstimatesToRows(
  rows: SemanticWireListRow[],
  result: WireLengthEstimationResult
): (SemanticWireListRow & { estimatedLength?: RowEstimatedLength })[] {
  return rows.map(row => {
    const estimate = result.estimates.get(row.__rowId);
    const estimatedLength = estimate ? estimateToRowLength(estimate) : null;

    return {
      ...row,
      estimatedLength: estimatedLength || undefined,
    };
  });
}
