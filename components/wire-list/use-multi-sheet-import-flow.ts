"use client";

import type React from "react";
import { useCallback, type ChangeEvent } from "react";

import {
  getPendingDiffCount,
  type MultiSheetImportMode,
  type MultiSheetImportDecision,
  type MultiSheetImportSession,
  type MultiSheetImportSheetDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";
import { parseImportedBrandWorkbook } from "@/lib/wire-brand-list/import-workbook";
import { validateWorkbookFile } from "@/lib/workbook/parse-workbook";

interface ReviewToast {
  title: string;
  description?: string;
  duration?: number;
}

export function useMultiSheetImportFlow(options: {
  projectId?: string;
  importSession: MultiSheetImportSession | null;
  importSheetDiffs: MultiSheetImportSheetDiff[];
  setImportSession: (value: React.SetStateAction<MultiSheetImportSession | null>) => void;
  setImportSheetDiffs: (value: React.SetStateAction<MultiSheetImportSheetDiff[]>) => void;
  setEntryMode: (mode: "cover" | "import-review" | "review") => void;
  setModalSurface: (surface: "cover" | "generating" | "import-review" | "review") => void;
  setActiveSlug: (slug: string) => void;
  setReviewReadOnly: (value: boolean) => void;
  setIsApplyingImport: (value: boolean) => void;
  refreshSavedBrandSchemas: () => Promise<void>;
  refreshSheetResources: (sheetSlug: string, force?: boolean) => Promise<void>;
  markSheetsChangedAfterImport: (sheetSlugs: string[]) => void;
  toast: (payload: ReviewToast) => void;
}) {
  const {
    projectId,
    importSession,
    importSheetDiffs,
    setImportSession,
    setImportSheetDiffs,
    setEntryMode,
    setModalSurface,
    setActiveSlug,
    setReviewReadOnly,
    setIsApplyingImport,
    refreshSavedBrandSchemas,
    refreshSheetResources,
    markSheetsChangedAfterImport,
    toast,
  } = options;

  const hydrateImportReview = useCallback(async (session: MultiSheetImportSession) => {
    if (!projectId) {
      return;
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "hydrate",
        workbookFileName: session.workbookFileName,
        importedSheets: session.importedSheets,
        rowDecisions: session.rowDecisions,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      importSession: MultiSheetImportSession;
      sheetDiffs: MultiSheetImportSheetDiff[];
    };
    setImportSession({
      ...payload.importSession,
      importedAt: session.importedAt,
    });
    setImportSheetDiffs(payload.sheetDiffs);
    if (payload.importSession.activeSheetSlug) {
      setActiveSlug(payload.importSession.activeSheetSlug);
    }
  }, [projectId, setActiveSlug, setImportSession, setImportSheetDiffs]);

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

      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          workbookFileName: file.name,
          importedSheets,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        importSession: MultiSheetImportSession;
        sheetDiffs: MultiSheetImportSheetDiff[];
      };
      setImportSession(payload.importSession);
      setImportSheetDiffs(payload.sheetDiffs);
      setEntryMode("import-review");
      setModalSurface("import-review");
      if (payload.importSession.activeSheetSlug) {
        setActiveSlug(payload.importSession.activeSheetSlug);
      }

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
        description: error instanceof Error ? error.message : "Failed to prepare the imported workbook for review.",
        duration: 4000,
      });
    }
  }, [projectId, setActiveSlug, setEntryMode, setImportSession, setImportSheetDiffs, setModalSurface, toast]);

  const updateImportDecision = useCallback((diffId: string, decision: MultiSheetImportDecision, sheetSlug: string) => {
    setImportSession((prev) => {
      if (!prev) {
        return prev;
      }

      const rowDecisions = {
        ...prev.rowDecisions,
        [diffId]: decision,
      };
      const completedSheetSlugs = importSheetDiffs
        .filter((sheetDiff) => getPendingDiffCount(sheetDiff, rowDecisions) === 0)
        .map((sheetDiff) => sheetDiff.sheetSlug);

      return {
        ...prev,
        activeSheetSlug: sheetSlug,
        rowDecisions,
        completedSheetSlugs,
      };
    });
  }, [importSheetDiffs, setImportSession]);

  const setImportMode = useCallback((mode: MultiSheetImportMode) => {
    setImportSession((prev) => (prev ? { ...prev, importMode: mode } : prev));
  }, [setImportSession]);

  const approveImportSection = useCallback((sheetSlug: string, sectionKey: string) => {
    const sheetDiff = importSheetDiffs.find((entry) => entry.sheetSlug === sheetSlug);
    const mode = importSession?.importMode ?? "length-only";
    if (!sheetDiff) {
      return;
    }

    for (const diff of sheetDiff.diffs) {
      const isStructural = diff.changeType === "imported-only" || diff.changeType === "current-only";
      if (diff.sectionKey === sectionKey && diff.changeType !== "unchanged" && !(mode === "length-only" && isStructural)) {
        updateImportDecision(diff.diffId, "accept", sheetSlug);
      }
    }
  }, [importSession?.importMode, importSheetDiffs, updateImportDecision]);

  const approveImportSheet = useCallback((sheetSlug: string) => {
    const sheetDiff = importSheetDiffs.find((entry) => entry.sheetSlug === sheetSlug);
    const mode = importSession?.importMode ?? "length-only";
    if (!sheetDiff) {
      return;
    }

    for (const diff of sheetDiff.diffs) {
      const isStructural = diff.changeType === "imported-only" || diff.changeType === "current-only";
      if (diff.changeType !== "unchanged" && !(mode === "length-only" && isStructural)) {
        updateImportDecision(diff.diffId, "accept", sheetSlug);
      }
    }
  }, [importSession?.importMode, importSheetDiffs, updateImportDecision]);

  const acceptAllLengthChanges = useCallback(() => {
    for (const sheetDiff of importSheetDiffs) {
      for (const diff of sheetDiff.diffs) {
        if (diff.changeType === "length-changed") {
          updateImportDecision(diff.diffId, "accept", sheetDiff.sheetSlug);
        }
      }
    }
  }, [importSheetDiffs, updateImportDecision]);

  const applyImportChanges = useCallback(async () => {
    if (!projectId || !importSession) {
      return;
    }

    setIsApplyingImport(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          importSession,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        appliedSheetSlugs: string[];
      importSession: MultiSheetImportSession;
      };
      setImportSession(payload.importSession);
      markSheetsChangedAfterImport(payload.appliedSheetSlugs);
      await refreshSavedBrandSchemas();
      await Promise.all(payload.appliedSheetSlugs.map((sheetSlug) => refreshSheetResources(sheetSlug, true)));
      setEntryMode("review");
      setModalSurface("review");
      setReviewReadOnly(false);
      toast({
        title: "Imported changes applied",
        description: `${payload.appliedSheetSlugs.length} sheet${payload.appliedSheetSlugs.length === 1 ? "" : "s"} updated and returned to review.`,
        duration: 3500,
      });
    } catch (error) {
      toast({
        title: "Import apply failed",
        description: error instanceof Error ? error.message : "Unable to apply imported brand list decisions.",
        duration: 4000,
      });
    } finally {
      setIsApplyingImport(false);
    }
  }, [
    importSession,
    markSheetsChangedAfterImport,
    projectId,
    refreshSavedBrandSchemas,
    refreshSheetResources,
    setEntryMode,
    setImportSession,
    setIsApplyingImport,
    setModalSurface,
    setReviewReadOnly,
    toast,
  ]);

  return {
    hydrateImportReview,
    handleImportFileChange,
    setImportMode,
    updateImportDecision,
    approveImportSection,
    approveImportSheet,
    acceptAllLengthChanges,
    applyImportChanges,
  };
}
