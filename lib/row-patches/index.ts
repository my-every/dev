/**
 * Row Patch Module
 * 
 * Provides functions for creating, applying, and managing row patches.
 * Row patches enable non-destructive editing of wire list rows.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type {
  RowPatch,
  SheetPatches,
  DerivedRow,
  DerivedRowMeta,
  ApplyPatchOptions,
  BulkPatchOperation,
  PatchOperation,
  PatchHistory,
} from "./types";

// ============================================================================
// Patch Creation
// ============================================================================

/**
 * Create a new empty patch for a row.
 */
export function createPatch(rowId: string): RowPatch {
  return {
    rowId,
    updatedAt: Date.now(),
    source: "manual",
  };
}

/**
 * Create a length override patch.
 */
export function createLengthOverridePatch(rowId: string, length: number): RowPatch {
  return {
    rowId,
    lengthOverride: length,
    updatedAt: Date.now(),
    source: "manual",
  };
}

/**
 * Create a length adjustment patch.
 */
export function createLengthAdjustmentPatch(rowId: string, adjustment: number): RowPatch {
  return {
    rowId,
    lengthAdjustment: adjustment,
    updatedAt: Date.now(),
    source: "manual",
  };
}

/**
 * Create a comment patch.
 */
export function createCommentPatch(rowId: string, comment: string): RowPatch {
  return {
    rowId,
    comment,
    updatedAt: Date.now(),
    source: "manual",
  };
}

// ============================================================================
// Patch Merging
// ============================================================================

/**
 * Merge two patches, with newer values taking precedence.
 */
export function mergePatches(existing: RowPatch | undefined, incoming: Partial<RowPatch>): RowPatch {
  const base = existing || { rowId: incoming.rowId || "" };
  
  return {
    ...base,
    ...incoming,
    updatedAt: Date.now(),
  };
}

/**
 * Merge a patch into a sheet patches collection.
 */
export function mergePatchIntoSheet(
  sheetPatches: SheetPatches,
  patch: RowPatch
): SheetPatches {
  const newPatches = new Map(sheetPatches);
  const existing = newPatches.get(patch.rowId);
  newPatches.set(patch.rowId, mergePatches(existing, patch));
  return newPatches;
}

// ============================================================================
// Patch Application
// ============================================================================

/**
 * Apply a patch to a row to produce a derived row.
 */
export function applyPatchToRow(
  row: SemanticWireListRow,
  patch: RowPatch | undefined,
  options: ApplyPatchOptions = {}
): DerivedRow {
  const {
    computedLengths,
    defaultLength,
    globalAdjustment = 0,
  } = options;
  
  // Get computed length if available
  const computedLength = computedLengths?.get(row.__rowId) ?? defaultLength;
  
  // If no patch, return row with computed length only
  if (!patch) {
    const meta: DerivedRowMeta = {
      hasPatches: false,
      isLengthOverridden: false,
      isLengthAdjusted: globalAdjustment !== 0,
      originalLength: computedLength,
    };
    
    const finalLength = computedLength !== undefined 
      ? computedLength + globalAdjustment 
      : undefined;
    
    return {
      ...row,
      __patchMeta: meta,
      finalLength,
    };
  }
  
  // Apply patch
  const isLengthOverridden = patch.lengthOverride !== undefined && patch.lengthOverride !== null;
  const isLengthAdjusted = (patch.lengthAdjustment !== undefined && patch.lengthAdjustment !== 0) || globalAdjustment !== 0;
  
  let finalLength: number | undefined;
  
  if (isLengthOverridden) {
    // Override takes precedence
    finalLength = patch.lengthOverride! + globalAdjustment;
  } else if (computedLength !== undefined) {
    // Apply adjustments to computed length
    finalLength = computedLength + (patch.lengthAdjustment || 0) + globalAdjustment;
  }
  
  const meta: DerivedRowMeta = {
    hasPatches: true,
    isLengthOverridden,
    isLengthAdjusted,
    originalLength: computedLength,
    patchSource: patch.source,
    patchedAt: patch.updatedAt,
  };
  
  return {
    ...row,
    __patchMeta: meta,
    finalLength,
    patchComment: patch.comment,
    patchIpvChecked: patch.ipvChecked,
    patchFromChecked: patch.fromChecked,
    patchToChecked: patch.toChecked,
    // Apply overrides to base fields
    gaugeSize: patch.gaugeOverride || row.gaugeSize,
    wireId: patch.wireIdOverride || row.wireId,
  };
}

/**
 * Apply patches to multiple rows.
 */
export function applyPatchesToRows(
  rows: SemanticWireListRow[],
  patches: SheetPatches,
  options: ApplyPatchOptions = {}
): DerivedRow[] {
  return rows.map(row => applyPatchToRow(row, patches.get(row.__rowId), options));
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Apply a bulk operation to create patches.
 */
export function applyBulkOperation(
  currentPatches: SheetPatches,
  operation: BulkPatchOperation
): { patches: SheetPatches; affected: RowPatch[] } {
  const newPatches = new Map(currentPatches);
  const affected: RowPatch[] = [];
  
  for (const rowId of operation.rowIds) {
    const existing = newPatches.get(rowId);
    let patch: RowPatch;
    
    switch (operation.type) {
      case "setLength":
        patch = mergePatches(existing, {
          rowId,
          lengthOverride: operation.value as number,
          source: "bulk",
        });
        break;
        
      case "adjustLength":
        const currentAdjustment = existing?.lengthAdjustment || 0;
        patch = mergePatches(existing, {
          rowId,
          lengthAdjustment: currentAdjustment + (operation.value as number),
          source: "bulk",
        });
        break;
        
      case "setComment":
        patch = mergePatches(existing, {
          rowId,
          comment: operation.value as string,
          source: "bulk",
        });
        break;
        
      case "toggleIpv":
        const currentIpv = existing?.ipvChecked || false;
        patch = mergePatches(existing, {
          rowId,
          ipvChecked: operation.value !== undefined ? operation.value as boolean : !currentIpv,
          source: "bulk",
        });
        break;
        
      case "clearPatches":
        // Remove the patch entirely
        newPatches.delete(rowId);
        if (existing) affected.push(existing);
        continue;
        
      default:
        continue;
    }
    
    newPatches.set(rowId, patch);
    affected.push(patch);
  }
  
  return { patches: newPatches, affected };
}

// ============================================================================
// History Management
// ============================================================================

/**
 * Create an empty patch history.
 */
export function createPatchHistory(maxSize: number = 50): PatchHistory {
  return {
    past: [],
    future: [],
    maxSize,
  };
}

/**
 * Push an operation to history.
 */
export function pushToHistory(
  history: PatchHistory,
  operation: PatchOperation
): PatchHistory {
  const newPast = [...history.past, operation];
  
  // Trim if over max size
  if (newPast.length > history.maxSize) {
    newPast.shift();
  }
  
  return {
    ...history,
    past: newPast,
    future: [], // Clear future on new operation
  };
}

/**
 * Undo the last operation.
 */
export function undoOperation(
  history: PatchHistory
): { history: PatchHistory; operation: PatchOperation | null } {
  if (history.past.length === 0) {
    return { history, operation: null };
  }
  
  const newPast = [...history.past];
  const operation = newPast.pop()!;
  
  return {
    history: {
      ...history,
      past: newPast,
      future: [operation, ...history.future],
    },
    operation,
  };
}

/**
 * Redo the last undone operation.
 */
export function redoOperation(
  history: PatchHistory
): { history: PatchHistory; operation: PatchOperation | null } {
  if (history.future.length === 0) {
    return { history, operation: null };
  }
  
  const newFuture = [...history.future];
  const operation = newFuture.shift()!;
  
  return {
    history: {
      ...history,
      past: [...history.past, operation],
      future: newFuture,
    },
    operation,
  };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Convert SheetPatches to a serializable array.
 */
export function serializeSheetPatches(patches: SheetPatches): RowPatch[] {
  return Array.from(patches.values());
}

/**
 * Convert serialized patches back to SheetPatches.
 */
export function deserializeSheetPatches(patches: RowPatch[]): SheetPatches {
  const map = new Map<string, RowPatch>();
  for (const patch of patches) {
    map.set(patch.rowId, patch);
  }
  return map;
}

/**
 * Check if a patch has any meaningful modifications.
 */
export function isPatchEmpty(patch: RowPatch): boolean {
  return (
    patch.lengthOverride === undefined &&
    patch.lengthAdjustment === undefined &&
    patch.comment === undefined &&
    patch.ipvChecked === undefined &&
    patch.fromChecked === undefined &&
    patch.toChecked === undefined &&
    patch.gaugeOverride === undefined &&
    patch.wireIdOverride === undefined
  );
}

/**
 * Remove empty patches from a sheet.
 */
export function cleanEmptyPatches(patches: SheetPatches): SheetPatches {
  const cleaned = new Map<string, RowPatch>();
  for (const [rowId, patch] of patches) {
    if (!isPatchEmpty(patch)) {
      cleaned.set(rowId, patch);
    }
  }
  return cleaned;
}

// Re-export types
export type {
  RowPatch,
  SheetPatches,
  DerivedRow,
  DerivedRowMeta,
  ApplyPatchOptions,
  BulkPatchOperation,
  PatchOperation,
  PatchHistory,
} from "./types";
