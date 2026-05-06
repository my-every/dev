/**
 * Row Patch Architecture
 * 
 * Row patches enable non-destructive modifications to canonical wire list rows.
 * The base SemanticWireListRow remains immutable; all user edits are stored as
 * patches that are merged at render time to produce derived rows.
 * 
 * Architecture:
 * 
 *   SemanticWireListRow (immutable, from workbook)
 *          ↓
 *   RowPatch (user modifications)
 *          ↓
 *   DerivedRow (merged result for display)
 * 
 * Benefits:
 * - Canonical data integrity preserved
 * - Easy undo/redo via patch history
 * - Clear separation of source data vs user edits
 * - Efficient persistence (only patches stored)
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";

// ============================================================================
// Core Patch Types
// ============================================================================

/**
 * A row patch contains user modifications to a single row.
 * All fields are optional - only modified values are stored.
 */
export interface RowPatch {
  /** The row ID this patch applies to */
  rowId: string;
  
  /** Wire length override (user-set value) */
  lengthOverride?: number | null;
  
  /** Length adjustment delta (added to computed length) */
  lengthAdjustment?: number;
  
  /** User comment */
  comment?: string;
  
  /** IPV (In Process Verification) checked state */
  ipvChecked?: boolean;
  
  /** From checkbox state */
  fromChecked?: boolean;
  
  /** To checkbox state */
  toChecked?: boolean;
  
  /** Custom wire gauge override */
  gaugeOverride?: string;
  
  /** Custom wire ID/color override */
  wireIdOverride?: string;
  
  /** Timestamp of last modification */
  updatedAt?: number;
  
  /** Source of the patch (manual, bulk, import) */
  source?: "manual" | "bulk" | "import";
}

/**
 * Collection of patches for a sheet, keyed by row ID.
 */
export type SheetPatches = Map<string, RowPatch>;

/**
 * Collection of patches for a project, keyed by sheet slug.
 */
export type ProjectPatches = Map<string, SheetPatches>;

// ============================================================================
// Derived Row Types
// ============================================================================

/**
 * Metadata about how a derived row was created.
 */
export interface DerivedRowMeta {
  /** Whether this row has any user modifications */
  hasPatches: boolean;
  
  /** Whether the length is overridden */
  isLengthOverridden: boolean;
  
  /** Whether the length is adjusted (but not fully overridden) */
  isLengthAdjusted: boolean;
  
  /** The original computed length (before patches) */
  originalLength?: number;
  
  /** Patch source if any */
  patchSource?: "manual" | "bulk" | "import";
  
  /** Timestamp of last patch */
  patchedAt?: number;
}

/**
 * A derived row combines the base row with applied patches.
 */
export interface DerivedRow extends SemanticWireListRow {
  /** Patch metadata */
  __patchMeta: DerivedRowMeta;
  
  /** Final computed length (after patches) */
  finalLength?: number;
  
  /** User comment from patch */
  patchComment?: string;
  
  /** IPV state from patch */
  patchIpvChecked?: boolean;
  
  /** From state from patch */
  patchFromChecked?: boolean;
  
  /** To state from patch */
  patchToChecked?: boolean;
}

// ============================================================================
// Patch History (for undo/redo)
// ============================================================================

/**
 * A patch operation for history tracking.
 */
export interface PatchOperation {
  /** Operation type */
  type: "set" | "update" | "delete" | "bulk";
  
  /** Affected row IDs */
  rowIds: string[];
  
  /** Sheet slug */
  sheetSlug: string;
  
  /** Previous patch state (for undo) */
  previousPatches: RowPatch[];
  
  /** New patch state (for redo) */
  newPatches: RowPatch[];
  
  /** Timestamp */
  timestamp: number;
  
  /** Description of the operation */
  description: string;
}

/**
 * Patch history for undo/redo.
 */
export interface PatchHistory {
  /** Past operations (for undo) */
  past: PatchOperation[];
  
  /** Future operations (for redo) */
  future: PatchOperation[];
  
  /** Maximum history size */
  maxSize: number;
}

// ============================================================================
// Patch Application Options
// ============================================================================

/**
 * Options for applying patches.
 */
export interface ApplyPatchOptions {
  /** Include computed length from wire-length estimation */
  includeComputedLength?: boolean;
  
  /** Computed length map (rowId -> length) */
  computedLengths?: Map<string, number>;
  
  /** Default length for rows without computed values */
  defaultLength?: number;
  
  /** Global length adjustment */
  globalAdjustment?: number;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk patch operation.
 */
export interface BulkPatchOperation {
  /** Type of bulk operation */
  type: "setLength" | "adjustLength" | "setComment" | "toggleIpv" | "clearPatches";
  
  /** Row IDs to affect */
  rowIds: string[];
  
  /** Value for the operation */
  value?: number | string | boolean;
  
  /** Description */
  description?: string;
}
