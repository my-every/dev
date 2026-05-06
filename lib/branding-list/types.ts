/**
 * Branding List Types
 * 
 * The Branding List is a filtered, derived view of wire list data
 * optimized for wire branding operations. It excludes non-brandable
 * wire types (clips, jumpers, grounds, cables, VIO) and provides
 * editable length columns.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { DerivedRow } from "@/lib/row-patches";

// ============================================================================
// Exclusion Configuration
// ============================================================================

/**
 * Configuration for which wire types to exclude from branding list.
 */
export interface BrandingExclusionConfig {
  /** Exclude clip connections */
  excludeClips: boolean;

  /** Exclude FU jumpers */
  excludeFuJumpers: boolean;

  /** Exclude KT jumpers */
  excludeKtJumpers: boolean;

  /** Exclude AF identity jumpers */
  excludeAfIdentityJumpers: boolean;

  /** Exclude sequential terminal jumpers */
  excludeSequentialJumpers: boolean;

  /** Exclude cable connections */
  excludeCables: boolean;

  /** Exclude VIO (sky) wires */
  excludeVioWires: boolean;

  /** Exclude ground wires */
  excludeGrounds: boolean;

  /** Exclude shield wires */
  excludeShields: boolean;

  /** Exclude mechanical relay jumpers (KA device jumpers) */
  excludeMechanicalRelayJumpers: boolean;

  /** Exclude KA jumpers */
  excludeKaJumpers: boolean;

  /** Exclude resistor connections */
  excludeResistors: boolean;

  /** Exclude target-pair device jumpers (HL, SA, SB, SH same-device wires) */
  excludeTargetPairJumpers: boolean;

  /** Custom exclusion patterns (regex) */
  customExclusionPatterns: string[];
}

/**
 * Default exclusion configuration.
 */
export const DEFAULT_BRANDING_EXCLUSIONS: BrandingExclusionConfig = {
  excludeClips: true,
  excludeFuJumpers: true,
  excludeKtJumpers: true,
  excludeAfIdentityJumpers: true,
  excludeSequentialJumpers: true,
  excludeCables: true,
  excludeVioWires: true,
  excludeGrounds: true,
  excludeShields: true,
  excludeMechanicalRelayJumpers: true,
  excludeKaJumpers: true,
  excludeResistors: true,
  excludeTargetPairJumpers: true,
  customExclusionPatterns: [],
};

// ============================================================================
// Branding Row Types
// ============================================================================

/**
 * Exclusion reason for a wire row.
 */
export type ExclusionReason =
  | "clip"
  | "fu_jumper"
  | "kt_jumper"
  | "af_identity_jumper"
  | "sequential_jumper"
  | "cable"
  | "vio_wire"
  | "ground"
  | "shield"
  | "mechanical_relay_jumper"
  | "ka_jumper"
  | "resistor"
  | "target_pair_jumper"
  | "custom_pattern"
  | "none";

/**
 * A row in the branding list, derived from SemanticWireListRow.
 */
export interface BrandingRow extends DerivedRow {
  /** Original source sheet */
  __sourceSheet: string;

  /** Original source sheet name (display) */
  __sourceSheetName: string;

  /** Original row ID without sheet prefix (for length lookups) */
  __originalRowId?: string;

  /** Whether this row is included in branding list */
  __includedInBranding: boolean;

  /** Reason for exclusion (if excluded) */
  __exclusionReason: ExclusionReason;

  /** The effective location for this row */
  __effectiveLocation: string;

  /** Branding-specific length (may differ from wire list length) */
  brandingLength?: number;

  /** Final length used for display (after all adjustments) */
  finalLength?: number;

  /** Whether length has been manually set */
  brandingLengthManual: boolean;

  /** User notes for branding */
  brandingNotes?: string;
}

// ============================================================================
// Aggregation Types
// ============================================================================

/**
 * Statistics about branding list filtering.
 */
export interface BrandingFilterStats {
  /** Total rows before filtering */
  totalRows: number;

  /** Rows included in branding list */
  includedRows: number;

  /** Rows excluded */
  excludedRows: number;

  /** Breakdown by exclusion reason */
  exclusionBreakdown: Record<ExclusionReason, number>;

  /** Rows with lengths */
  rowsWithLength: number;

  /** Rows without lengths */
  rowsWithoutLength: number;

  /** Total length of all included wires */
  totalLength: number;
}

/**
 * A sheet with its branding rows.
 */
export interface BrandingSheet {
  /** Sheet slug */
  slug: string;

  /** Sheet display name */
  name: string;

  /** Branding rows for this sheet */
  rows: BrandingRow[];

  /** Filter statistics */
  stats: BrandingFilterStats;
}

/**
 * Aggregated branding list across all sheets.
 */
export interface AggregatedBrandingList {
  /** All branding sheets */
  sheets: BrandingSheet[];

  /** All branding rows (flattened) */
  allRows: BrandingRow[];

  /** Overall statistics */
  overallStats: BrandingFilterStats;

  /** Unique locations across all sheets */
  locations: string[];

  /** Unique gauges across all sheets */
  gauges: string[];
}

// ============================================================================
// Column Configuration
// ============================================================================

/**
 * Branding list column definition.
 */
export interface BrandingColumn {
  /** Column key */
  key: string;

  /** Display header */
  header: string;

  /** Column group */
  group: "from" | "wire" | "length" | "to";

  /** Whether column is editable */
  editable: boolean;

  /** Default visibility */
  defaultVisible: boolean;

  /** Sort order within group */
  sortOrder: number;

  /** Column width */
  width?: number;
}

/**
 * Default branding list columns.
 */
export const BRANDING_COLUMNS: BrandingColumn[] = [
  // From group
  { key: "fromDeviceId", header: "From Device", group: "from", editable: false, defaultVisible: true, sortOrder: 1 },

  // Wire group
  { key: "wireNo", header: "Wire No.", group: "wire", editable: false, defaultVisible: true, sortOrder: 1 },
  { key: "gaugeSize", header: "Gauge", group: "wire", editable: false, defaultVisible: true, sortOrder: 2 },
  { key: "wireId", header: "Color", group: "wire", editable: false, defaultVisible: true, sortOrder: 3 },

  // Length group
  { key: "brandingLength", header: "Length", group: "length", editable: true, defaultVisible: true, sortOrder: 1 },

  // To group
  { key: "toDeviceId", header: "To Device", group: "to", editable: false, defaultVisible: true, sortOrder: 1 },

  // Notes
  { key: "brandingNotes", header: "Notes", group: "to", editable: true, defaultVisible: false, sortOrder: 2 },
];

// ============================================================================
// Selection Types
// ============================================================================

/**
 * Selection state for bulk operations.
 */
export interface BrandingSelection {
  /** Selected row IDs */
  selectedIds: Set<string>;

  /** Last selected row ID (for shift-select range) */
  lastSelectedId: string | null;

  /** Whether all rows are selected */
  allSelected: boolean;
}

/**
 * Create empty selection state.
 */
export function createEmptySelection(): BrandingSelection {
  return {
    selectedIds: new Set(),
    lastSelectedId: null,
    allSelected: false,
  };
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * CSV Export columns configuration
 */
export const CSV_EXPORT_COLUMNS = [
  { key: 'fromDeviceId', header: 'From Device' },
  { key: 'wireNo', header: 'Wire No' },
  { key: 'gaugeSize', header: 'Gauge' },
  { key: 'wireId', header: 'Color' },
  { key: 'brandingLength', header: 'Length (in)' },
  { key: 'toDeviceId', header: 'To Device' },
  { key: '__effectiveLocation', header: 'Location' },
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
 * Convert branding rows to CSV format
 */
export function brandingRowsToCSV(rows: BrandingRow[], sheetName?: string): string {
  const headers = CSV_EXPORT_COLUMNS.map(col => col.header).join(',');

  const dataRows = rows.map(row => {
    return CSV_EXPORT_COLUMNS.map(col => {
      const value = row[col.key as keyof BrandingRow];
      if (col.key === 'brandingLength' && typeof value === 'number') {
        return value.toFixed(1);
      }
      return escapeCSVValue(value as string | number | undefined);
    }).join(',');
  });

  return [headers, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
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
