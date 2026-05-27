import type { BrandListSchemaRow } from "@/lib/wire-brand-list/schema";

// ─── Cell & Column ────────────────────────────────────────────────────────────

export type BrandListColumnKey =
  | "fromDeviceId"
  | "wireNo"
  | "wireId"
  | "gaugeSize"
  | "length"
  | "toDeviceId"
  | "toLocation"
  | "bundleDisplay";

export interface BrandListCellAddress {
  sheetSlug: string;
  prefixIndex: number;
  bundleIndex: number;
  rowIndex: number;
  column: BrandListColumnKey;
}

export interface BrandListCellValue {
  address: BrandListCellAddress;
  value: string | number | null;
}

// ─── Change & History ─────────────────────────────────────────────────────────

export type BrandListChangeSource =
  | "manual-edit"
  | "paste"
  | "replace"
  | "regenerate"
  | "approval"
  | "undo"
  | "redo"
  | "import"
  | "merge"
  | "revert";

export interface BrandListChangeEntry {
  id: string;
  timestamp: string;
  source: BrandListChangeSource;
  sheetSlug: string;
  sheetName: string;
  prefixIndex: number;
  bundleIndex: number;
  rowIndex: number;
  rowId: string;
  column: BrandListColumnKey;
  columnLabel: string;
  previousValue: string | number | null;
  nextValue: string | number | null;
}

export interface BrandListHistoryEntry extends BrandListChangeEntry {
  sessionLabel?: string;
  isReverted?: boolean;
  revertedBy?: string; // id of revert entry
}

// ─── Undo/Redo ────────────────────────────────────────────────────────────────

export interface BrandListUndoRedoTransaction {
  id: string;
  timestamp: string;
  source: BrandListChangeSource;
  label: string;
  changes: BrandListChangeEntry[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface BrandListSearchOptions {
  query: string;
  matchCase: boolean;
  matchWholeCell: boolean;
  scope: "current-sheet" | "all-sheets";
  visibleColumnsOnly: boolean;
}

export interface BrandListSearchMatch {
  id: string;
  sheetSlug: string;
  sheetName: string;
  prefixIndex: number;
  bundleIndex: number;
  rowIndex: number;
  rowId: string;
  column: BrandListColumnKey;
  columnLabel: string;
  cellValue: string;
  matchStart: number;
  matchEnd: number;
}

// ─── Find & Replace ───────────────────────────────────────────────────────────

export type BrandListReplacePreviewStatus = "safe" | "unchanged" | "blocked";

export interface BrandListReplacePreview {
  match: BrandListSearchMatch;
  previousValue: string;
  nextValue: string;
  status: BrandListReplacePreviewStatus;
}

export interface BrandListReplaceOptions extends BrandListSearchOptions {
  replaceWith: string;
}

// ─── Approval ────────────────────────────────────────────────────────────────

export interface BrandListApprovalState {
  sheetSlug: string;
  isApproved: boolean;
  approvedAt: string | null;
  approvedByLabel: string | null;
  approvedSchemaHash: string | null;
  wasEditedAfterApproval: boolean;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export interface BrandListPersistenceResult {
  ok: boolean;
  error?: string;
  writtenAt?: string;
  legalDrawingsPath?: string;
  projectMergePath?: string;
  mergeWarning?: string;
}

export interface BrandListProjectMergeResult {
  ok: boolean;
  error?: string;
  mergedAt?: string;
  sourcePath?: string;
  targetPath?: string;
}
