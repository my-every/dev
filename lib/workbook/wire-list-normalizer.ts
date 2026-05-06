/**
 * Wire list normalization utilities.
 * 
 * This module provides functions for:
 * - Detecting the actual wire-list header row in sheets with preamble data
 * - Normalizing column headers for cleaner display
 * - Extracting sheet metadata from preamble rows
 * - Formatting wire type values
 */

import type { ParsedSheetRow } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata extracted from sheet preamble rows.
 */
export interface SheetMetadata {
  projectNumber?: string;
  projectName?: string;
  revision?: string;
  controlsDE?: string;
  phone?: string;
  from?: string;
  [key: string]: string | undefined;
}

/**
 * Result of splitting a sheet into intro and table data.
 */
export interface SheetSplitResult {
  /** Rows before the header row (metadata/preamble) */
  introRows: (string | number | boolean | Date | null)[][];
  /** The detected header row */
  headerRow: (string | number | boolean | Date | null)[];
  /** Index of the header row in the original data */
  headerRowIndex: number;
  /** Data rows after the header */
  dataRows: (string | number | boolean | Date | null)[][];
  /** Extracted metadata from intro rows */
  metadata: SheetMetadata;
  /** Detection info for warnings/display */
  detectionInfo: {
    method: "heuristic" | "fallback";
    confidence: "high" | "medium" | "low";
    message: string;
  };
}

/**
 * Normalized column definition for display.
 */
export interface NormalizedColumn {
  /** Original header key (for data access) */
  originalKey: string;
  /** Display header text */
  displayHeader: string;
  /** Whether this column is visible by default */
  visibleByDefault: boolean;
  /** Sort order for default column layout */
  sortOrder: number;
  /** Column type hint for formatting */
  columnType?: "device" | "type" | "wireNo" | "wireId" | "gauge" | "location" | "pageZone" | "generic";
}

/**
 * Wire type mapping result.
 */
export interface WireTypeInfo {
  code: string;
  label: string;
  badgeVariant: "default" | "secondary" | "outline";
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Expected wire-list header patterns for detection.
 * These are the column names that indicate a real wire-list header row.
 */
const WIRE_LIST_HEADER_PATTERNS: RegExp[] = [
  /^device\s*id$/i,
  /^cable.*conductor.*jumper$/i,
  /^wire\s*no\.?$/i,
  /^wire\s*id$/i,
  /^gauge\/?size$/i,
  /^page\/?zone$/i,
  /^location$/i,
  /^from$/i,
  /^to$/i,
  /^part\s*number$/i,
  /^description$/i,
];

/**
 * Minimum number of header pattern matches to consider a row as the header.
 */
const MIN_HEADER_MATCHES = 2;

/**
 * Minimum number of non-empty cells to consider a valid header row.
 */
const MIN_HEADER_COLUMNS = 3;

/**
 * Column header normalization map.
 * Maps raw header patterns to clean display names.
 * Sorted by sortOrder for proper column layout.
 */
const HEADER_NORMALIZATION_MAP: { pattern: RegExp; display: string; type: NormalizedColumn["columnType"]; sortOrder: number; visible: boolean; group?: "from" | "to" }[] = [
  // "From" section columns
  { pattern: /^device\s*id$/i, display: "Device ID", type: "device", sortOrder: 1, visible: true, group: "from" },
  { pattern: /cable.*conductor.*jumper/i, display: "Type", type: "type", sortOrder: 2, visible: true, group: "from" },
  { pattern: /^wire\s*no\.?$/i, display: "Wire No.", type: "wireNo", sortOrder: 3, visible: true, group: "from" },
  { pattern: /^wire\s*id$/i, display: "Wire ID", type: "wireId", sortOrder: 4, visible: true, group: "from" },
  { pattern: /^gauge\/?size$/i, display: "Gauge/Size", type: "gauge", sortOrder: 5, visible: true, group: "from" },
  { pattern: /^page\/?zone$/i, display: "Page/Zone", type: "pageZone", sortOrder: 6, visible: true, group: "from" },
  // "To" section columns
  { pattern: /^to\s*device\s*id$/i, display: "Device ID", type: "device", sortOrder: 7, visible: true, group: "to" },
  { pattern: /^location$/i, display: "Location", type: "location", sortOrder: 8, visible: true, group: "to" },
];

/**
 * Wire type code to label mapping.
 */
const WIRE_TYPE_MAP: Record<string, WireTypeInfo> = {
  "W": { code: "W", label: "Cable", badgeVariant: "default" },
  "SC": { code: "SC", label: "Conductor", badgeVariant: "secondary" },
  "JC": { code: "JC", label: "Jumper Clip", badgeVariant: "outline" },
};

/**
 * Metadata row patterns for extracting project info.
 */
const METADATA_PATTERNS: { pattern: RegExp; key: keyof SheetMetadata }[] = [
  { pattern: /^project\s*#?:?\s*$/i, key: "projectNumber" },
  { pattern: /^project\s*name:?\s*$/i, key: "projectName" },
  { pattern: /^revision:?\s*$/i, key: "revision" },
  { pattern: /^controls?\s*de:?\s*$/i, key: "controlsDE" },
  { pattern: /^phone:?\s*$/i, key: "phone" },
  { pattern: /^from:?\s*$/i, key: "from" },
];

// ============================================================================
// Header Row Detection
// ============================================================================

/**
 * Detect the actual wire-list header row in a sheet.
 * Returns the index of the header row, or 0 if no header is detected.
 * 
 * @param rawData - The raw 2D array of sheet data
 * @returns The index of the detected header row
 */
export function detectWireListHeaderRow(
  rawData: (string | number | boolean | Date | null)[][]
): { headerRowIndex: number; confidence: "high" | "medium" | "low"; matchCount: number } {
  // Scan through the first 20 rows looking for a valid header row
  for (let rowIndex = 0; rowIndex < Math.min(rawData.length, 20); rowIndex++) {
    const row = rawData[rowIndex];
    if (!row || row.length === 0) continue;

    // Count non-empty cells in this row
    const nonEmptyCells = row.filter(c => c !== null && c !== "").length;
    
    // Skip rows that don't have enough columns to be a proper header
    if (nonEmptyCells < MIN_HEADER_COLUMNS) continue;

    // Count how many header patterns match this row
    let matchCount = 0;
    for (const pattern of WIRE_LIST_HEADER_PATTERNS) {
      for (const cell of row) {
        if (cell !== null && pattern.test(String(cell).trim())) {
          matchCount++;
          break; // Only count once per pattern
        }
      }
    }

    // If we have enough matches, this is likely the header row
    if (matchCount >= MIN_HEADER_MATCHES) {
      const confidence = matchCount >= 4 ? "high" : matchCount >= 3 ? "medium" : "low";
      return { headerRowIndex: rowIndex, confidence, matchCount };
    }
  }

  // Fallback: find first row with at least MIN_HEADER_COLUMNS non-empty cells
  for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    const nonEmpty = row?.filter(c => c !== null && c !== "").length ?? 0;
    if (nonEmpty >= MIN_HEADER_COLUMNS) {
      return { headerRowIndex: rowIndex, confidence: "low", matchCount: 0 };
    }
  }

  // Last resort: use first non-empty row
  for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    const nonEmpty = row?.filter(c => c !== null && c !== "").length ?? 0;
    if (nonEmpty > 0) {
      return { headerRowIndex: rowIndex, confidence: "low", matchCount: 0 };
    }
  }

  return { headerRowIndex: 0, confidence: "low", matchCount: 0 };
}

// ============================================================================
// Sheet Splitting
// ============================================================================

/**
 * Split a sheet into intro rows (preamble), header row, and data rows.
 * Also extracts metadata from the preamble.
 * 
 * @param rawData - The raw 2D array of sheet data
 * @returns The split result with intro, header, and data rows
 */
export function splitSheetIntroAndTable(
  rawData: (string | number | boolean | Date | null)[][]
): SheetSplitResult {
  const detection = detectWireListHeaderRow(rawData);
  const { headerRowIndex, confidence, matchCount } = detection;

  const introRows = rawData.slice(0, headerRowIndex);
  const headerRow = rawData[headerRowIndex] || [];
  const dataRows = rawData.slice(headerRowIndex + 1);

  // Extract metadata from intro rows
  const metadata = extractSheetMetadata(introRows);

  // Build detection info message
  let message: string;
  if (headerRowIndex === 0) {
    message = "Using first row as header";
  } else if (matchCount > 0) {
    message = `Detected wire-list header at row ${headerRowIndex + 1} (matched ${matchCount} expected columns)`;
  } else {
    message = `Using row ${headerRowIndex + 1} as header (fallback)`;
  }

  return {
    introRows,
    headerRow,
    headerRowIndex,
    dataRows,
    metadata,
    detectionInfo: {
      method: matchCount >= MIN_HEADER_MATCHES ? "heuristic" : "fallback",
      confidence,
      message,
    },
  };
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract project metadata from sheet preamble rows.
 * Looks for key-value patterns in the intro rows.
 * 
 * @param introRows - The preamble rows before the header
 * @returns Extracted metadata object
 */
export function extractSheetMetadata(
  introRows: (string | number | boolean | Date | null)[][]
): SheetMetadata {
  const metadata: SheetMetadata = {};

  for (const row of introRows) {
    if (!row || row.length < 2) continue;

    // Check if first cell matches a metadata pattern
    const firstCell = String(row[0] ?? "").trim();
    const secondCell = row[1];

    for (const { pattern, key } of METADATA_PATTERNS) {
      if (pattern.test(firstCell) && secondCell !== null && secondCell !== "") {
        metadata[key] = String(secondCell).trim();
        break;
      }
    }

    // Also try exact matches without colon
    const firstCellLower = firstCell.toLowerCase().replace(/[:#]?\s*$/, "");
    if (firstCellLower === "project" && secondCell) {
      metadata.projectNumber = String(secondCell).trim();
    } else if (firstCellLower === "project name" && secondCell) {
      metadata.projectName = String(secondCell).trim();
    } else if (firstCellLower === "revision" && secondCell) {
      metadata.revision = String(secondCell).trim();
    }
  }

  return metadata;
}

// ============================================================================
// Column Normalization
// ============================================================================

/**
 * Normalize raw column headers to clean display headers.
 * Returns an array of normalized column definitions.
 * 
 * @param headers - The raw header strings
 * @returns Array of normalized column definitions
 */
export function normalizeWireListColumns(headers: string[]): NormalizedColumn[] {
  const normalized: NormalizedColumn[] = [];
  let genericSortOrder = 50;

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const trimmedHeader = (header ?? "").trim();
    
    // Skip completely empty headers but keep placeholder columns
    if (!trimmedHeader) {
      continue;
    }

    // Check if header matches any normalization pattern
    let matched = false;
    for (const { pattern, display, type, sortOrder, visible } of HEADER_NORMALIZATION_MAP) {
      if (pattern.test(trimmedHeader)) {
        normalized.push({
          originalKey: header,
          displayHeader: display,
          visibleByDefault: visible,
          sortOrder,
          columnType: type,
        });
        matched = true;
        break;
      }
    }

    // If no pattern matched, add as generic column (keep all columns visible)
    if (!matched) {
      // Clean up placeholder column names for display
      const displayHeader = trimmedHeader.startsWith("Column_") 
        ? `Col ${trimmedHeader.replace("Column_", "")}`
        : trimmedHeader;
        
      normalized.push({
        originalKey: header,
        displayHeader,
        visibleByDefault: true,
        sortOrder: genericSortOrder++,
        columnType: "generic",
      });
    }
  }

  // Sort by sortOrder
  normalized.sort((a, b) => a.sortOrder - b.sortOrder);

  return normalized;
}

/**
 * Get default visible columns from normalized columns.
 */
export function getDefaultVisibleColumns(columns: NormalizedColumn[]): string[] {
  return columns.filter(c => c.visibleByDefault).map(c => c.originalKey);
}

// ============================================================================
// Wire Type Formatting
// ============================================================================

/**
 * Parse and format a wire type value.
 * Converts codes like "W", "SC", "JC" to readable labels.
 * 
 * @param value - The raw wire type value
 * @returns Formatted wire type info
 */
export function formatWireType(value: string | number | boolean | Date | null): WireTypeInfo {
  if (value === null || value === undefined || value === "") {
    return { code: "-", label: "-", badgeVariant: "outline" };
  }

  const strValue = String(value).trim().toUpperCase();

  // Check for exact match
  if (WIRE_TYPE_MAP[strValue]) {
    return WIRE_TYPE_MAP[strValue];
  }

  // Return raw value as label
  return { code: strValue, label: strValue, badgeVariant: "outline" };
}

// ============================================================================
// Wire Number Extraction & Formatting
// ============================================================================

/**
 * Patterns for extracting wire numbers from various formats.
 */
const WIRE_NUMBER_PATTERNS = [
  // Standard wire number format: FU0172, XT05002, etc.
  /^([A-Z]{1,3}\d{3,6})$/i,
  // Voltage reference: 0V, 24V, etc.
  /^(\d+V)$/i,
  // Ground references
  /^(GND|GROUND|0V)$/i,
];

/**
 * Extract and format a wire number value.
 * Handles various formats like FU0172, 0V, etc.
 * 
 * @param value - The raw wire number value
 * @returns Formatted wire number string
 */
export function formatWireNumber(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  
  const strValue = String(value).trim();
  
  // Return the value as-is - wire numbers are already in correct format
  return strValue;
}

/**
 * Format a gauge/size value.
 * Returns "---" for empty values, otherwise the numeric value.
 * 
 * @param value - The raw gauge value
 * @returns Formatted gauge string
 */
export function formatGaugeSize(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined || value === "") {
    return "---";
  }
  
  const strValue = String(value).trim();
  
  // If it's a number, just return it
  if (!isNaN(Number(strValue))) {
    return strValue;
  }
  
  return strValue;
}

/**
 * Format a page/zone value.
 * Formats as XX.YY where XX is page and YY is zone.
 * 
 * @param value - The raw page/zone value
 * @returns Formatted page/zone string
 */
export function formatPageZone(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  
  return String(value).trim();
}

/**
 * Format a device ID value.
 * Device IDs are in format like AT0190:GND, KA0461:11, etc.
 * 
 * @param value - The raw device ID value
 * @returns Formatted device ID string
 */
export function formatDeviceId(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  
  return String(value).trim();
}

/**
 * Format a wire ID value.
 * Wire IDs are color codes like CLIP, GRN, WHT, etc.
 * 
 * @param value - The raw wire ID value
 * @returns Formatted wire ID string
 */
export function formatWireId(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  
  return String(value).trim().toUpperCase();
}

// ============================================================================
// Display Row Building
// ============================================================================

/**
 * Build normalized display rows from raw data.
 * Applies column normalization and type formatting.
 * 
 * @param rows - Raw parsed rows
 * @param normalizedColumns - Column definitions
 * @returns Rows with display-ready values
 */
export function buildWireListDisplayRows(
  rows: ParsedSheetRow[],
  normalizedColumns: NormalizedColumn[]
): ParsedSheetRow[] {
  return rows.map((row, index) => {
    const displayRow: ParsedSheetRow = {
      __rowId: String(index),
    };

    for (const col of normalizedColumns) {
      const rawValue = row[col.originalKey];
      displayRow[col.originalKey] = rawValue;
    }

    return displayRow;
  });
}

/**
 * Check if metadata has any meaningful values.
 */
export function hasMetadata(metadata: SheetMetadata): boolean {
  return Object.values(metadata).some(v => v !== undefined && v !== "");
}
