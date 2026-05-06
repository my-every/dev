/**
 * Column visibility configuration utilities.
 * 
 * Provides default column visibility settings and utilities for managing
 * which columns are shown/hidden in the wire list table.
 */

import type { NormalizedColumn } from "./wire-list-normalizer";
import type { ProjectSheetKind } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Column visibility state for TanStack Table.
 */
export type ColumnVisibilityState = Record<string, boolean>;

/**
 * Column display configuration.
 */
export interface ColumnDisplayConfig {
  /** Column key (original header) */
  key: string;
  /** Display label */
  label: string;
  /** Whether visible by default */
  defaultVisible: boolean;
  /** Priority for column ordering (lower = higher priority) */
  priority: number;
  /** Whether this column can be hidden by the user */
  canHide: boolean;
  /** Group this column belongs to */
  group?: "from" | "to" | "meta";
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Columns that should be hidden by default.
 */
const HIDDEN_BY_DEFAULT_PATTERNS: RegExp[] = [
  /page\/?zone/i,
  /cable.*conductor.*jumper/i,
  /^estimatedLength$/i,  // Wire length estimate column - hidden by default
  /^length$/i,           // Wire length column - hidden by default
];

/**
 * Columns that must always remain visible (cannot be hidden).
 */
const ALWAYS_VISIBLE_PATTERNS: RegExp[] = [
  /^device\s*id$/i,
];

/**
 * Column display priority (lower = more important, shown first).
 */
const COLUMN_PRIORITY_MAP: { pattern: RegExp; priority: number; group?: "from" | "to" }[] = [
  // From section
  { pattern: /^device\s*id$/i, priority: 1, group: "from" },
  { pattern: /cable.*conductor.*jumper/i, priority: 2, group: "from" },
  { pattern: /^wire\s*no\.?$/i, priority: 3, group: "from" },
  { pattern: /^wire\s*id$/i, priority: 4, group: "from" },
  { pattern: /^gauge\/?size$/i, priority: 5, group: "from" },
  { pattern: /^page\/?zone$/i, priority: 6, group: "from" },
  // To section
  { pattern: /^location$/i, priority: 8, group: "to" },
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Get default column visibility state for a sheet.
 * 
 * @param headers - The raw column headers
 * @param sheetKind - The type of sheet (optional, for future customization)
 * @returns Column visibility state object for TanStack Table
 */
export function getDefaultColumnVisibility(
  headers: string[],
  sheetKind?: ProjectSheetKind
): ColumnVisibilityState {
  const visibility: ColumnVisibilityState = {};
  
  for (const header of headers) {
    const trimmedHeader = (header ?? "").trim();
    if (!trimmedHeader) continue;
    
    // Check if this column should be hidden by default
    const shouldHide = HIDDEN_BY_DEFAULT_PATTERNS.some(pattern => 
      pattern.test(trimmedHeader)
    );
    
    visibility[header] = !shouldHide;
  }
  
  return visibility;
}

/**
 * Get the display label for a column header.
 * 
 * @param header - The raw column header
 * @returns Clean display label
 */
export function getDisplayColumnLabel(header: string): string {
  const trimmed = (header ?? "").trim();
  
  // Map known headers to clean display names
  const labelMap: { pattern: RegExp; label: string }[] = [
    { pattern: /^device\s*id$/i, label: "Device ID" },
    { pattern: /cable.*conductor.*jumper/i, label: "Cable (W) Conductor (SC) Jumper Clip (JC)" },
    { pattern: /^wire\s*no\.?$/i, label: "Wire No." },
    { pattern: /^wire\s*id$/i, label: "Wire ID" },
    { pattern: /^gauge\/?size$/i, label: "Gauge/Size" },
    { pattern: /^page\/?zone$/i, label: "Page/Zone" },
    { pattern: /^location$/i, label: "Location" },
  ];
  
  for (const { pattern, label } of labelMap) {
    if (pattern.test(trimmed)) {
      return label;
    }
  }
  
  // Default: return as-is with placeholder cleanup
  if (trimmed.startsWith("Column_")) {
    return `Col ${trimmed.replace("Column_", "")}`;
  }
  
  return trimmed;
}

/**
 * Get the priority (sort order) for a column.
 * Lower numbers = higher priority (shown first).
 * 
 * @param header - The raw column header
 * @returns Priority number
 */
export function getColumnPriority(header: string): number {
  const trimmed = (header ?? "").trim();
  
  for (const { pattern, priority } of COLUMN_PRIORITY_MAP) {
    if (pattern.test(trimmed)) {
      return priority;
    }
  }
  
  // Default priority for unknown columns
  return 100;
}

/**
 * Get the column group (from/to) for a header.
 * 
 * @param header - The raw column header
 * @returns Group name or undefined
 */
export function getColumnGroup(header: string): "from" | "to" | undefined {
  const trimmed = (header ?? "").trim();
  
  for (const { pattern, group } of COLUMN_PRIORITY_MAP) {
    if (pattern.test(trimmed)) {
      return group;
    }
  }
  
  return undefined;
}

/**
 * Check if a column can be hidden by the user.
 * 
 * @param header - The raw column header
 * @returns Whether the column can be hidden
 */
export function canHideColumn(header: string): boolean {
  const trimmed = (header ?? "").trim();
  
  // Check if this is a column that must always be visible
  return !ALWAYS_VISIBLE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Build column display configurations from normalized columns.
 * 
 * @param columns - Normalized column definitions
 * @returns Array of column display configs
 */
export function buildColumnDisplayConfigs(
  columns: NormalizedColumn[]
): ColumnDisplayConfig[] {
  return columns.map(col => ({
    key: col.originalKey,
    label: col.displayHeader,
    defaultVisible: !HIDDEN_BY_DEFAULT_PATTERNS.some(p => p.test(col.originalKey)),
    priority: getColumnPriority(col.originalKey),
    canHide: canHideColumn(col.originalKey),
    group: getColumnGroup(col.originalKey),
  }));
}

/**
 * Apply saved visibility state to default visibility.
 * Merges user preferences with defaults.
 * 
 * @param defaultVisibility - The default visibility state
 * @param savedVisibility - The user's saved visibility preferences
 * @returns Merged visibility state
 */
export function mergeVisibilityState(
  defaultVisibility: ColumnVisibilityState,
  savedVisibility: ColumnVisibilityState | null
): ColumnVisibilityState {
  if (!savedVisibility) {
    return defaultVisibility;
  }
  
  // Start with defaults, then apply saved preferences
  return {
    ...defaultVisibility,
    ...savedVisibility,
  };
}

/**
 * Get the count of visible columns.
 * 
 * @param visibility - The visibility state
 * @returns Number of visible columns
 */
export function getVisibleColumnCount(visibility: ColumnVisibilityState): number {
  return Object.values(visibility).filter(Boolean).length;
}

/**
 * Get the count of hidden columns.
 * 
 * @param visibility - The visibility state
 * @returns Number of hidden columns
 */
export function getHiddenColumnCount(visibility: ColumnVisibilityState): number {
  return Object.values(visibility).filter(v => !v).length;
}
