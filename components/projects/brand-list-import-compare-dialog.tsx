"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Upload, X } from "lucide-react";

import { MultiSheetImportReviewPanel } from "@/components/wire-list/multi-sheet-import-review-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { parseImportedBrandWorkbook } from "@/lib/wire-brand-list/import-workbook";
import {
  getPendingDiffCount,
  type MultiSheetImportDecision,
  type MultiSheetImportMode,
  type MultiSheetImportSession,
  type MultiSheetImportSheetDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";
import { validateWorkbookFile } from "@/lib/workbook/parse-workbook";

interface BrandListImportCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onApplied?: () => Promise<void> | void;
}

export function BrandListImportCompareDialog({
  open,
  onOpenChange,
  projectId,
  onApplied,
}: BrandListImportCompareDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importSession, setImportSession] =
    useState<MultiSheetImportSession | null>(null);
  const [sheetDiffs, setSheetDiffs] = useState<MultiSheetImportSheetDiff[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const activeSheetSlug = importSession?.activeSheetSlug ?? sheetDiffs[0]?.sheetSlug ?? null;
  const importMode = importSession?.importMode ?? "length-only";
  const rowDecisions = importSession?.rowDecisions ?? {};

  const resetState = useCallback(() => {
    setImportSession(null);
    setSheetDiffs([]);
    setIsApplying(false);
  }, []);

  const closeDialog = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  const updateCompletedSheets = useCallback((
    nextDiffs: MultiSheetImportSheetDiff[],
    nextDecisions: Record<string, MultiSheetImportDecision>,
  ) => {
    return nextDiffs
      .filter((sheetDiff) => getPendingDiffCount(sheetDiff, nextDecisions) === 0)
      .map((sheetDiff) => sheetDiff.sheetSlug);
  }, []);

  const handleImportFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !projectId) {
      return;
    }

    const validation = validateWorkbookFile(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid workbook",
        description: validation.error,
        duration: 3500,
      });
      return;
    }

    try {
      const importedSheets = await parseImportedBrandWorkbook(file);
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            workbookFileName: file.name,
            importedSheets,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to prepare import comparison.");
      }

      const payload = (await response.json()) as {
        importSession: MultiSheetImportSession;
        sheetDiffs: MultiSheetImportSheetDiff[];
      };

      setImportSession(payload.importSession);
      setSheetDiffs(payload.sheetDiffs);

      if (payload.importSession.unmatchedSheetNames.length > 0) {
        toast({
          title: "Some sheets were not matched",
          description: payload.importSession.unmatchedSheetNames.join(", "),
          duration: 4000,
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to prepare imported workbook for comparison.",
        duration: 4000,
      });
    }
  }, [projectId, toast]);

  const setImportMode = useCallback((mode: MultiSheetImportMode) => {
    setImportSession((prev) => (prev ? { ...prev, importMode: mode } : prev));
  }, []);

  const setActiveSheet = useCallback((sheetSlug: string) => {
    setImportSession((prev) =>
      prev ? { ...prev, activeSheetSlug: sheetSlug } : prev,
    );
  }, []);

  const updateImportDecision = useCallback((
    diffId: string,
    decision: MultiSheetImportDecision,
    sheetSlug: string,
  ) => {
    setImportSession((prev) => {
      if (!prev) {
        return prev;
      }
      const nextRowDecisions = {
        ...prev.rowDecisions,
        [diffId]: decision,
      };
      return {
        ...prev,
        activeSheetSlug: sheetSlug,
        rowDecisions: nextRowDecisions,
        completedSheetSlugs: updateCompletedSheets(sheetDiffs, nextRowDecisions),
      };
    });
  }, [sheetDiffs, updateCompletedSheets]);

  const approveImportSection = useCallback((sheetSlug: string, sectionKey: string) => {
    const sheet = sheetDiffs.find((entry) => entry.sheetSlug === sheetSlug);
    if (!sheet) {
      return;
    }

    const mode = importSession?.importMode ?? "length-only";
    for (const diff of sheet.diffs) {
      const isStructural =
        diff.changeType === "imported-only" || diff.changeType === "current-only";
      if (
        diff.sectionKey === sectionKey
        && diff.changeType !== "unchanged"
        && !(mode === "length-only" && isStructural)
      ) {
        updateImportDecision(diff.diffId, "accept", sheetSlug);
      }
    }
  }, [importSession?.importMode, sheetDiffs, updateImportDecision]);

  const approveImportSheet = useCallback((sheetSlug: string) => {
    const sheet = sheetDiffs.find((entry) => entry.sheetSlug === sheetSlug);
    if (!sheet) {
      return;
    }

    const mode = importSession?.importMode ?? "length-only";
    for (const diff of sheet.diffs) {
      const isStructural =
        diff.changeType === "imported-only" || diff.changeType === "current-only";
      if (diff.changeType !== "unchanged" && !(mode === "length-only" && isStructural)) {
        updateImportDecision(diff.diffId, "accept", sheetSlug);
      }
    }
  }, [importSession?.importMode, sheetDiffs, updateImportDecision]);

  const acceptAllLengthChanges = useCallback(() => {
    for (const sheet of sheetDiffs) {
      for (const diff of sheet.diffs) {
        if (diff.changeType === "length-changed") {
          updateImportDecision(diff.diffId, "accept", sheet.sheetSlug);
        }
      }
    }
  }, [sheetDiffs, updateImportDecision]);

  const reviewStructuralChanges = useCallback(() => {
    setImportMode("full");
    const firstStructuralSheet = sheetDiffs.find((sheet) =>
      sheet.diffs.some(
        (diff) =>
          diff.changeType === "imported-only"
          || diff.changeType === "current-only",
      ),
    );
    if (firstStructuralSheet) {
      setActiveSheet(firstStructuralSheet.sheetSlug);
    }
  }, [setImportMode, setActiveSheet, sheetDiffs]);

  const applyImportChanges = useCallback(async () => {
    if (!projectId || !importSession) {
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply",
            importSession,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to apply import decisions.");
      }

      const payload = (await response.json()) as {
        appliedSheetSlugs: string[];
        importSession: MultiSheetImportSession;
      };

      setImportSession(payload.importSession);
      await onApplied?.();
      toast({
        title: "Import merge applied",
        description: `${payload.appliedSheetSlugs.length} sheet${payload.appliedSheetSlugs.length === 1 ? "" : "s"} updated.`,
        duration: 3000,
      });
      closeDialog();
    } catch (error) {
      toast({
        title: "Apply failed",
        description: error instanceof Error ? error.message : "Unable to apply imported decisions.",
        duration: 4000,
      });
    } finally {
      setIsApplying(false);
    }
  }, [closeDialog, importSession, onApplied, projectId, toast]);

  const hasDiffs = useMemo(() => sheetDiffs.length > 0, [sheetDiffs]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : closeDialog())}>
      <DialogContent className="h-[92vh] max-w-[96vw] overflow-hidden p-0 sm:max-w-[96vw]">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle>Brand List Import Comparison</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload workbook, review match-key row differences, then apply accepted changes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                onChange={(event) => void handleImportFileChange(event)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Import Workbook
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={closeDialog}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[calc(92vh-82px)] min-h-0">
          {hasDiffs ? (
            <MultiSheetImportReviewPanel
              sheetDiffs={sheetDiffs}
              activeSheetSlug={activeSheetSlug}
              importMode={importMode}
              rowDecisions={rowDecisions}
              onImportModeChange={setImportMode}
              onActiveSheetChange={setActiveSheet}
              onDecisionChange={updateImportDecision}
              onApproveSection={approveImportSection}
              onApproveSheet={approveImportSheet}
              onAcceptAllLengthChanges={acceptAllLengthChanges}
              onReviewStructuralChanges={reviewStructuralChanges}
              onApply={() => void applyImportChanges()}
              onContinueToReview={closeDialog}
              isApplying={isApplying}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <div className="text-sm font-medium">No import loaded</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Click Import Workbook to begin row-by-row comparison.
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
