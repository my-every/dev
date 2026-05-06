"use client";

import type {
  MultiSheetImportDecision,
  MultiSheetImportMode,
  MultiSheetImportSession,
  MultiSheetImportSheetDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";
import { MultiSheetImportReviewPanel } from "@/components/wire-list/multi-sheet-import-review-panel";

interface MultiSheetImportReviewShellProps {
  sheetDiffs: MultiSheetImportSheetDiff[];
  activeSheetSlug: string | null;
  importMode: MultiSheetImportMode;
  rowDecisions: Record<string, MultiSheetImportDecision>;
  onImportModeChange: (mode: MultiSheetImportMode) => void;
  isApplying: boolean;
  onActiveSheetChange: (sheetSlug: string) => void;
  onUpdateImportSession: (
    updater: (prev: MultiSheetImportSession | null) => MultiSheetImportSession | null,
  ) => void;
  onDecisionChange: (
    diffId: string,
    decision: MultiSheetImportDecision,
    sheetSlug: string,
  ) => void;
  onApproveSection: (sheetSlug: string, sectionKey: string) => void;
  onApproveSheet: (sheetSlug: string) => void;
  onAcceptAllLengthChanges: () => void;
  onReviewStructuralChanges: () => void;
  onApply: () => void;
  onContinueToReview: () => void;
}

export function MultiSheetImportReviewShell({
  sheetDiffs,
  activeSheetSlug,
  importMode,
  rowDecisions,
  onImportModeChange,
  isApplying,
  onActiveSheetChange,
  onUpdateImportSession,
  onDecisionChange,
  onApproveSection,
  onApproveSheet,
  onAcceptAllLengthChanges,
  onReviewStructuralChanges,
  onApply,
  onContinueToReview,
}: MultiSheetImportReviewShellProps) {
  return (
    <MultiSheetImportReviewPanel
      sheetDiffs={sheetDiffs}
      activeSheetSlug={activeSheetSlug}
      importMode={importMode}
      rowDecisions={rowDecisions}
      onImportModeChange={onImportModeChange}
      onActiveSheetChange={(sheetSlug) => {
        onActiveSheetChange(sheetSlug);
        onUpdateImportSession((prev) =>
          prev ? { ...prev, activeSheetSlug: sheetSlug } : prev,
        );
      }}
      onDecisionChange={onDecisionChange}
      onApproveSection={onApproveSection}
      onApproveSheet={onApproveSheet}
      onAcceptAllLengthChanges={onAcceptAllLengthChanges}
      onReviewStructuralChanges={onReviewStructuralChanges}
      onApply={onApply}
      onContinueToReview={onContinueToReview}
      isApplying={isApplying}
    />
  );
}
