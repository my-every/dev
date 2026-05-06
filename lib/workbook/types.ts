/**
 * Core types for workbook parsing and project modeling.
 * These types form the foundation for the entire wire list application.
 */

// ============================================================================
// Sheet Classification
// ============================================================================

/**
 * Classification of sheet types within a workbook.
 * - operational: Primary working sheets (wire lists, panels, components)
 * - reference: Supporting data sheets (Blue Labels, Part Number List)
 * - unknown: Sheets that couldn't be classified
 */
export type ProjectSheetKind = "operational" | "reference" | "unknown";

// ============================================================================
// LWC (Labor Work Code) Classification
// ============================================================================

/**
 * LWC types for project classification.
 * These determine how the project is categorized and displayed.
 */
export type LwcType = "NEW_FLEX" | "ONSKID" | "OFFSKID" | "NTB" | "FLOAT";

/**
 * LWC type configuration with display properties
 */
export interface LwcTypeConfig {
  id: LwcType;
  label: string;
  shortLabel: string;
  color: string; // Tailwind color name
  dotColor: string; // Hex color for dot indicators
  description: string;
}

/**
 * Registry of all LWC types with their display properties
 */
export const LWC_TYPE_REGISTRY: Record<LwcType, LwcTypeConfig> = {
  NEW_FLEX: {
    id: "NEW_FLEX",
    label: "New / Flex",
    shortLabel: "NEW/FLEX",
    color: "emerald",
    dotColor: "#10B981", // Green
    description: "New or Flex projects",
  },
  ONSKID: {
    id: "ONSKID",
    label: "On Skid",
    shortLabel: "ONSKID",
    color: "blue",
    dotColor: "#3B82F6", // Blue
    description: "On-skid work packages",
  },
  OFFSKID: {
    id: "OFFSKID",
    label: "Off Skid",
    shortLabel: "OFFSKID",
    color: "amber",
    dotColor: "#F59E0B", // Yellow/Amber
    description: "Off-skid work packages",
  },
  NTB: {
    id: "NTB",
    label: "NTB",
    shortLabel: "NTB",
    color: "indigo",
    dotColor: "#4338CA", // Dark blue/indigo
    description: "Non-Traditional Build",
  },
  FLOAT: {
    id: "FLOAT",
    label: "Float",
    shortLabel: "FLOAT",
    color: "slate",
    dotColor: "#64748B", // Grey
    description: "Float / flexible scheduling",
  },
};

// ============================================================================
// Parsed Workbook Types
// ============================================================================

/**
 * A single row from a parsed sheet, represented as a record of column headers to values.
 * Values can be strings, numbers, booleans, dates, or null.
 */
export type ParsedSheetRow = Record<string, string | number | boolean | Date | null>;

/**
 * Metadata extracted from sheet preamble rows.
 */
export interface SheetMetadataInfo {
  projectNumber?: string;
  projectName?: string;
  revision?: string;
  controlsDE?: string;
  controlsME?: string;
  phone?: string;
  from?: string;
  beforeWorkbook?: string;
  afterWorkbook?: string;
  [key: string]: string | undefined;
}

/**
 * Detection info for header row finding.
 */
export interface HeaderDetectionInfo {
  method: "heuristic" | "fallback";
  confidence: "high" | "medium" | "low";
  message: string;
  headerRowIndex: number;
}

/**
 * Semantic wire list row with stable, named fields.
 */
export interface SemanticWireListRow {
  /** Row index in the original sheet (for debugging/tracing) */
  __rowIndex: number;
  /** Unique row ID for table rendering */
  __rowId: string;

  // From section
  fromDeviceId: string;
  wireType: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  fromLocation: string;
  fromPageZone: string;

  // To section
  toDeviceId: string;
  toLocation: string;
  toPageZone: string;

  /** Green Changes compare type from Compare workbook stamp column. */
  greenChangeType?: "added" | "deleted" | "changed";
  /** Raw compare stamp value (e.g., ADDED, DELETED, CHG). */
  greenChangeStamp?: string;
  /** Previous field values emitted by compare exports. */
  greenChangePreviousValues?: string;
  /** Updated marker emitted by compare exports. */
  greenChangeUpdated?: string;

  /** @deprecated Use fromLocation or toLocation instead */
  location?: string;
}

/**
 * Parser diagnostics for debugging.
 */
export interface WireListParserDiagnostics {
  groupingRowIndex: number | null;
  headerRowIndex: number;
  footerStartIndex: number | null;
  rawHeaders: string[];
  normalizedHeaders: string[];
  confidence: "high" | "medium" | "low";
  columnMap: Record<number, string>;
  warnings: string[];
}

/**
 * Represents a single parsed sheet from the workbook.
 */
export interface ParsedWorkbookSheet {
  /** Original name of the sheet as it appears in the workbook */
  originalName: string;
  /** URL-safe slug derived from the sheet name */
  slug: string;
  /** Column headers detected from the wire-list header row */
  headers: string[];
  /** All non-empty data rows from the sheet (after header) */
  rows: ParsedSheetRow[];
  /** Semantic wire list rows (with stable field names) */
  semanticRows?: SemanticWireListRow[];
  /** Number of data rows (excluding header and intro rows) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Original index/order of the sheet in the workbook */
  sheetIndex: number;
  /** Any warnings encountered during parsing this sheet */
  warnings: string[];
  /** Rows before the header row (preamble/metadata) */
  introRows?: ParsedSheetRow[];
  /** Footer rows after the wire list */
  footerRows?: ParsedSheetRow[];
  /** Extracted metadata from intro rows */
  metadata?: SheetMetadataInfo;
  /** Header detection info */
  headerDetection?: HeaderDetectionInfo;
  /** Parser diagnostics */
  parserDiagnostics?: WireListParserDiagnostics;
}

/**
 * Result of parsing an entire workbook.
 */
export interface ParsedWorkbook {
  /** Original filename of the uploaded workbook */
  filename: string;
  /** All parsed sheets in original order */
  sheets: ParsedWorkbookSheet[];
  /** Global warnings from the parsing process */
  warnings: string[];
  /** Timestamp when parsing completed */
  parsedAt: Date;
}

/**
 * Warning generated during workbook parsing.
 */
export interface ParseWarning {
  sheetName?: string;
  message: string;
  severity: "info" | "warning" | "error";
}

/**
 * Complete result of a workbook parse operation.
 */
export interface WorkbookParseResult {
  success: boolean;
  workbook: ParsedWorkbook | null;
  errors: string[];
  warnings: ParseWarning[];
}

// ============================================================================
// Project Model Types
// ============================================================================

/**
 * Summary information about a sheet within the project model.
 * This is a processed view of the parsed sheet data.
 */
export interface ProjectSheetSummary {
  /** Unique identifier for this sheet within the project */
  id: string;
  /** Display name for the sheet */
  name: string;
  /** URL-safe slug for routing */
  slug: string;
  /** Classification of the sheet type */
  kind: ProjectSheetKind;
  /** Number of data rows */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Column headers */
  headers: string[];
  /** Original sheet index for ordering */
  sheetIndex: number;
  /** Whether this sheet has any data */
  hasData: boolean;
  /** Any warnings specific to this sheet */
  warnings: string[];
}

// ============================================================================
// Project Status (derived from lifecycle gates + assignments)
// ============================================================================

/**
 * Derived project status computed from lifecycle gate completion,
 * assignment stage progress, and SLOTS milestone dates.
 */
export type ProjectStatus =
  | 'legals_pending'  // Awaiting UCP + layout upload
  | 'brandlist'       // LEGALS_READY → working on BrandList
  | 'branding'        // BRANDLIST_COMPLETE → physical branding in progress
  | 'kitting'         // BRANDING_READY → awaiting device kitting
  | 'active'          // KITTING_READY → assignments in progress
  | 'blocked'         // One or more assignments blocked (missing component, etc.)
  | 'completed'       // All assignments FINISHED_BIQ
  | 'shipped'         // Post-production shipment complete

/**
 * The complete project model derived from an uploaded workbook.
 * This is the primary data structure used throughout the application.
 */
export interface ProjectModel {
  /** Unique identifier for this project */
  id: string;
  /** Original filename of the uploaded workbook */
  filename: string;
  /** Human-readable project name derived from filename */
  name: string;
  /** PD# - Production Drawing number (5 uppercase characters) */
  pdNumber?: string;
  /** Unit number for the project */
  unitNumber?: string;
  /** Revision number (auto-extracted or manual) */
  revision?: string;
  /** LWC (Labor Work Code) type for project classification */
  lwcType?: LwcType;
  /** Project due date */
  dueDate?: Date;

  /** Planned CONLAY (Construction Layout) date */
  planConlayDate?: Date;
  /** Planned CONASSY (Construction Assembly) date */
  planConassyDate?: Date;
  /** Ship date */
  shipDate?: Date;
  /** Department 380 target date */
  deptTargetDate?: Date;

  /** Project color for visual identification (hex color) */
  color?: string;
  /** Summaries of all sheets in the project */
  sheets: ProjectSheetSummary[];
  /** Full parsed sheet data, keyed by sheet ID for quick lookup */
  sheetData: Record<string, ParsedWorkbookSheet>;
  /** Timestamp when the project was created */
  createdAt: Date;
  /** Any global warnings or notes about the project */
  warnings: string[];

  // ── Revision tracking ───────────────────────────────────────────────
  /** Active UCP workbook revision id */
  activeWorkbookRevisionId?: string;
  /** Active layout PDF revision id */
  activeLayoutRevisionId?: string;

  // ── Production lifecycle ────────────────────────────────────────────
  /**
   * Derived project status computed from lifecycle gates + assignment progress.
   * Not stored directly — computed by status derivation logic.
   */
  status?: ProjectStatus;
  /** Project-level lifecycle gate states */
  lifecycleGates?: import('@/types/d380-assignment-stages').ProjectLifecycleGateState[];
  /** Estimated total hours from SLOTS.json */
  estimatedTotalHours?: number;
  /** Estimated panel count from SLOTS.json */
  estimatedPanelCount?: number;
  /** Days late (negative = early) from SLOTS tracking */
  daysLate?: number;
}

// ============================================================================
// Wire List Types (for TanStack Table)
// ============================================================================

/**
 * Column definition for the wire list table.
 */
export interface WireListColumn {
  /** Unique identifier for the column (matches header key) */
  id: string;
  /** Display header text */
  header: string;
  /** Accessor key for row data */
  accessorKey: string;
  /** Optional width hint */
  width?: number;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether column is filterable */
  filterable?: boolean;
}

/**
 * A row in the wire list table.
 * Extends ParsedSheetRow with a guaranteed unique ID.
 */
export interface WireListRow extends ParsedSheetRow {
  /** Unique row identifier for table rendering */
  __rowId: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Parsing state for upload feedback.
 */
export type ParsingState = "idle" | "uploading" | "parsing" | "success" | "error";

/**
 * Upload progress information.
 */
export interface UploadProgress {
  state: ParsingState;
  message?: string;
  progress?: number;
}

// ============================================================================
// CSV Export Utilities
// ============================================================================

/**
 * CSV Export columns configuration for semantic wire list
 */
export const WIRE_LIST_CSV_COLUMNS = [
  { key: 'fromDeviceId', header: 'From Device' },
  { key: 'wireNo', header: 'Wire No' },
  { key: 'gaugeSize', header: 'Gauge' },
  { key: 'wireId', header: 'Color' },
  { key: 'toDeviceId', header: 'To Device' },
  { key: 'fromLocation', header: 'From Location' },
  { key: 'toLocation', header: 'To Location' },
  { key: 'fromPageZone', header: 'From Page/Zone' },
  { key: 'toPageZone', header: 'To Page/Zone' },
] as const;

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Convert semantic wire list rows to CSV format
 */
export function wireListRowsToCSV(
  rows: SemanticWireListRow[],
  sheetName?: string,
  includeLength?: boolean,
  getLengthForRow?: (rowId: string) => { display: string; roundedInches: number } | null
): string {
  // Build headers
  const headers = [...WIRE_LIST_CSV_COLUMNS.map(col => col.header)];
  if (includeLength) {
    headers.push('Length');
  }

  const dataRows = rows.map(row => {
    const values = WIRE_LIST_CSV_COLUMNS.map(col => {
      const value = row[col.key as keyof SemanticWireListRow];
      return escapeCSVValue(value as string | number | undefined);
    });

    // Add length if available
    if (includeLength && getLengthForRow) {
      const length = getLengthForRow(row.__rowId);
      values.push(length ? length.roundedInches.toString() : '');
    }

    return values.join(',');
  });

  return [headers.join(','), ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadWireListCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
