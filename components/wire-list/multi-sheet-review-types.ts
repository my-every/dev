"use client";

import type { MultiSheetReviewEntryMode } from "@/lib/wire-brand-list/multi-sheet-review";
import type { MultiSheetPrintExportResult, MultiSheetTabItem } from "@/components/wire-list/use-multi-sheet-brand-review-controller";

export type MultiSheetWorkspaceMode = "print" | "wire-list";

export type MultiSheetModalSurface =
  | "cover"
  | "generating"
  | "import-review"
  | "review";

export interface MultiSheetLayoutPreviewState {
  open: boolean;
  minimized: boolean;
  position: { x: number; y: number };
}

export interface MultiSheetStatusSummary {
  totalSheets: number;
  mappedSheets: number;
  savedSchemas: number;
  approvedSheets: number;
  editedSheets: number;
  allApproved: boolean;
  brandingWorkbookReady: boolean;
  wireListSchemaReady: boolean;
  mappingNeedsReview: boolean;
}

export interface MultiSheetNavigationItem extends MultiSheetTabItem {
  isActive: boolean;
  isApproved: boolean;
  wasEditedAfterApproval: boolean;
  reviewLabel?: string | null;
}

export interface MultiSheetReviewViewModel {
  surface: MultiSheetModalSurface;
  workspaceMode: MultiSheetWorkspaceMode;
  isWireListMode: boolean;
  readOnly: boolean;
  entryMode: MultiSheetReviewEntryMode;
  activeIndex: number;
  activeSlug: string | null;
  title: string;
  description: string;
  tabs: MultiSheetNavigationItem[];
  statusSummary: MultiSheetStatusSummary;
  exportResult: MultiSheetPrintExportResult | null;
}
