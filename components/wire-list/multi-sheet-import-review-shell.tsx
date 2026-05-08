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
  disabled?: boolean;
  busyMessage?: string;
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
  disabled = false,
  busyMessage = "Preparing imported workbook review...",
}: MultiSheetImportReviewShellProps) {
  return (
    <div className="relative h-full" aria-busy={disabled}>
      <div className={disabled ? "pointer-events-none select-none opacity-60" : ""}>
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
      </div>
      {disabled ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
            {busyMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
