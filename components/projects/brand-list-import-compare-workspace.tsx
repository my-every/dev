"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { MultiSheetImportReviewPanel } from "@/components/wire-list/multi-sheet-import-review-panel";
import { Button } from "@/components/ui/button";
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

interface BrandListImportCompareWorkspaceProps {
  badgeNumber: string;
  projectId: string;
}

export function BrandListImportCompareWorkspace({
  badgeNumber,
  projectId,
}: BrandListImportCompareWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoPromptedRef = useRef(false);
  const [importSession, setImportSession] = useState<MultiSheetImportSession | null>(null);
  const [sheetDiffs, setSheetDiffs] = useState<MultiSheetImportSheetDiff[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const fallbackReturnTo = `/${badgeNumber}/projects?openProjectId=${encodeURIComponent(projectId)}`;
  const returnTo = searchParams.get("returnTo") || fallbackReturnTo;
  const shouldPromptImport = searchParams.get("promptImport") === "1";

  const activeSheetSlug = importSession?.activeSheetSlug ?? sheetDiffs[0]?.sheetSlug ?? null;
  const importMode = importSession?.importMode ?? "length-only";
  const rowDecisions = importSession?.rowDecisions ?? {};

  const goBack = useCallback(() => {
    router.push(returnTo);
  }, [returnTo, router]);

  useEffect(() => {
    if (!shouldPromptImport || hasAutoPromptedRef.current) {
      return;
    }
    hasAutoPromptedRef.current = true;
    fileInputRef.current?.click();
  }, [shouldPromptImport]);

  const updateCompletedSheets = useCallback((
    nextDiffs: MultiSheetImportSheetDiff[],
    nextDecisions: Record<string, MultiSheetImportDecision>,
  ) => {
    return nextDiffs
      .filter((sheetDiff) => getPendingDiffCount(sheetDiff, nextDecisions) === 0)
      .map((sheetDiff) => sheetDiff.sheetSlug);
  }, []);

  const hydratePreparedSession = useCallback(async (session: MultiSheetImportSession) => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hydrate",
          workbookFileName: session.workbookFileName,
          importedSheets: session.importedSheets,
          rowDecisions: session.rowDecisions,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to load prepared import comparison.");
    }

    const payload = (await response.json()) as {
      importSession: MultiSheetImportSession;
      sheetDiffs: MultiSheetImportSheetDiff[];
    };

    setImportSession({
      ...payload.importSession,
      importMode: session.importMode,
      activeSheetSlug: session.activeSheetSlug ?? payload.importSession.activeSheetSlug,
      completedSheetSlugs: session.completedSheetSlugs,
      rowDecisions: session.rowDecisions,
      importedAt: session.importedAt,
      appliedAt: session.appliedAt,
    });
    setSheetDiffs(payload.sheetDiffs);
  }, [projectId]);

  useEffect(() => {
    if (shouldPromptImport || importSession) {
      return;
    }

    void (async () => {
      try {
        const sessionResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/session`,
          { cache: "no-store" },
        );
        if (!sessionResponse.ok) {
          return;
        }

        const sessionPayload = (await sessionResponse.json()) as {
          session?: { importSession?: MultiSheetImportSession | null };
        };
        const persistedSession = sessionPayload.session?.importSession;
        if (!persistedSession) {
          return;
        }

        await hydratePreparedSession(persistedSession);
      } catch (error) {
        toast({
          title: "Import session unavailable",
          description:
            error instanceof Error
              ? error.message
              : "Unable to restore the prepared import comparison.",
          duration: 4000,
        });
      }
    })();
  }, [hydratePreparedSession, importSession, projectId, shouldPromptImport, toast]);

  const handleImportFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
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

      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/session`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryMode: "import-review",
            importSession: payload.importSession,
          }),
        },
      );

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
    if (!importSession) {
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
      };

      toast({
        title: "Import merge applied",
        description: `${payload.appliedSheetSlugs.length} sheet${payload.appliedSheetSlugs.length === 1 ? "" : "s"} updated.`,
        duration: 3000,
      });
      goBack();
    } catch (error) {
      toast({
        title: "Apply failed",
        description: error instanceof Error ? error.message : "Unable to apply imported decisions.",
        duration: 4000,
      });
    } finally {
      setIsApplying(false);
    }
  }, [goBack, importSession, projectId, toast]);

  const hasDiffs = useMemo(() => sheetDiffs.length > 0, [sheetDiffs]);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex w-full max-w-375 items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Brand List Import Comparison</div>
            <div className="text-xs text-muted-foreground">
              Compare workbook rows by match key and apply accepted length/structure changes.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={goBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Project Collection
            </Button>
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
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import Workbook
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto h-[calc(100vh-74px)] w-full max-w-375 min-h-0 flex-1 overflow-hidden px-4 py-4">
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
            onContinueToReview={goBack}
            isApplying={isApplying}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card/30 px-6 text-center">
            <div>
              <div className="text-sm font-medium">No import loaded</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Click Import Workbook to begin row-by-row comparison.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
