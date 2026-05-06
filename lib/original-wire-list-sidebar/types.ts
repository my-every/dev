/**
 * Types for the Original Wire List Sidebar system.
 * 
 * The sidebar compares original extracted wire list rows against
 * enhanced/filtered rows to verify data integrity.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";

// ============================================================================
// Match States
// ============================================================================

/**
 * Match state between original and enhanced rows.
 * - matched: Row found and visible in current view
 * - hidden: Row exists but hidden by filters
 * - missing: Row not found in enhanced dataset
 * - mismatch: Row found but values differ
 */
export type OriginalRowMatchState = "matched" | "hidden" | "missing" | "mismatch";

// ============================================================================
// Nav Item Types
// ============================================================================

/**
 * A navigation item representing an original wire list row.
 */
export interface OriginalWireListNavItem {
  /** Unique ID from original row */
  originalRowId: string;
  /** Row index in original data */
  originalRowIndex: number;
  /** Location (for grouping) */
  location: string;
  
  // Key identifying fields
  fromDeviceId: string;
  wireNo: string;
  gaugeSize: string;
  toDeviceId: string;
  wireType: string;
  wireId: string;
  
  // Page zones (optional)
  fromPageZone?: string;
  toPageZone?: string;
  
  /** Reference to full original row */
  originalRow: SemanticWireListRow;
  
  /** Match state against enhanced rows */
  matchState: OriginalRowMatchState;
  
  /** ID of matched enhanced row (if found) */
  matchedEnhancedRowId?: string;
  
  /** Whether matched row is visible in current filtered view */
  visibleInCurrentView: boolean;
  
  /** Mismatch details (which fields differ) */
  mismatchFields?: string[];
  
  /** Normalized match key used for comparison */
  matchKey: string;

  /** Green Changes compare stamp classification. */
  greenChangeType?: "added" | "deleted" | "changed";
  /** Assignment stage context resolved from row location. */
  assignmentStageId?: string;
  assignmentStageLabel?: string;
  assignmentSheetName?: string;
}

/**
 * A section of nav items grouped by location.
 */
export interface OriginalWireListSection {
  /** Section location (group key) */
  location: string;
  /** Display label for section */
  label: string;
  /** Items in this section */
  items: OriginalWireListNavItem[];
  /** Count of matched items */
  matchedCount: number;
  /** Count of hidden items */
  hiddenCount: number;
  /** Count of missing items */
  missingCount: number;
  /** Count of mismatched items */
  mismatchCount: number;
  /** Whether section is collapsed */
  collapsed: boolean;
}

// ============================================================================
// Column Visibility
// ============================================================================

/**
 * Columns available in the sidebar nav items.
 */
export type SidebarColumnKey = 
  | "fromDeviceId"
  | "wireNo"
  | "gaugeSize"
  | "toDeviceId"
  | "wireType"
  | "wireId"
  | "location"
  | "fromPageZone"
  | "toPageZone"
  | "match";

/**
 * Column visibility configuration.
 */
export type SidebarColumnVisibility = {
  [K in SidebarColumnKey]: boolean;
};

/**
 * Default visible columns: Device ID, Size, Device ID (minimal view)
 */
export const DEFAULT_SIDEBAR_COLUMN_VISIBILITY: SidebarColumnVisibility = {
  fromDeviceId: true,
  wireNo: false,
  gaugeSize: true,
  toDeviceId: true,
  wireType: false,
  wireId: false,
  location: false,
  fromPageZone: false,
  toPageZone: false,
  match: false,
};

/**
 * Column display configuration.
 */
export interface SidebarColumnConfig {
  key: SidebarColumnKey;
  label: string;
  group: "from" | "to" | "meta" | "match";
  defaultVisible: boolean;
}

export const SIDEBAR_COLUMNS: SidebarColumnConfig[] = [
  { key: "fromDeviceId", label: "Device ID", group: "from", defaultVisible: true },
  { key: "wireNo", label: "Wire No.", group: "from", defaultVisible: true },
  { key: "gaugeSize", label: "Gauge/Size", group: "from", defaultVisible: true },
  { key: "wireType", label: "Type", group: "from", defaultVisible: false },
  { key: "wireId", label: "Wire ID", group: "from", defaultVisible: false },
  { key: "fromPageZone", label: "Page Zone", group: "from", defaultVisible: false },
  { key: "toDeviceId", label: "Device ID", group: "to", defaultVisible: true },
  { key: "toPageZone", label: "Page Zone", group: "to", defaultVisible: false },
  { key: "location", label: "Location", group: "meta", defaultVisible: false },
  { key: "match", label: "Match", group: "match", defaultVisible: true },
];

// ============================================================================
// Recent Navigation
// ============================================================================

/**
 * A recently navigated item.
 */
export interface RecentNavItem {
  rowId: string;
  wireNo: string;
  fromDeviceId: string;
  toDeviceId: string;
  timestamp: number;
}

// ============================================================================
// Sidebar Props
// ============================================================================

/**
 * Props for the OriginalWireListSidebar component.
 */
export interface OriginalWireListSidebarProps {
  /** Original extracted wire list rows */
  originalRows: SemanticWireListRow[];
  /** Enhanced/filtered wire list rows (current display) */
  enhancedRows: SemanticWireListRow[];
  /** IDs of rows currently visible in the view (after filtering) */
  visibleEnhancedRowIds: Set<string>;
  /** Project ID for persistence */
  projectId: string;
  /** Sheet name for persistence */
  sheetName: string;
  /** Callback to scroll to a row in the main table */
  onScrollToRow?: (rowId: string) => void;
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Summary statistics for sidebar display.
 */
export interface SidebarStatistics {
  totalOriginal: number;
  matched: number;
  hidden: number;
  missing: number;
  mismatch: number;
  matchPercentage: number;
}
