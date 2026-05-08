"use client";

import { useCallback } from "react";

import type { MultiSheetImportSession } from "@/lib/wire-brand-list/multi-sheet-review";

interface ReviewToast {
  title: string;
  description?: string;
  duration?: number;
}

export function useMultiSheetReviewActions(options: {
  projectId?: string;
  activeSlug: string | null;
  isAuthenticated: boolean;
  hasSavedSchemas: boolean;
  importSession: MultiSheetImportSession | null;
  canViewCompletedReview: boolean;
  reviewState: {
    totalSheets: number;
    savedSchemas: number;
  };
  refreshSavedBrandSchemas: () => Promise<void>;
  hydrateImportReview: (session: MultiSheetImportSession) => Promise<void>;
  setLoginOpen: (open: boolean) => void;
  setEntryMode: (mode: "cover" | "import-review" | "review") => void;
  setModalSurface: (
    surface: "cover" | "generating" | "import-review" | "review",
  ) => void;
  setGenerationStatus: (
    value: "idle" | "preparing" | "generating" | "success" | "error",
  ) => void;
  setGenerationMessage: (message: string) => void;
  openReviewSurface: (readOnly: boolean) => void;
  toast: (payload: ReviewToast) => void;
  triggerImportPicker: () => void;
}) {
  const {
    projectId,
    activeSlug,
    isAuthenticated,
    hasSavedSchemas,
    importSession,
    canViewCompletedReview,
    reviewState,
    refreshSavedBrandSchemas,
    hydrateImportReview,
    setLoginOpen,
    setEntryMode,
    setModalSurface,
    setGenerationStatus,
    setGenerationMessage,
    openReviewSurface,
    toast,
    triggerImportPicker,
  } = options;

  const ensureBrandSchemasGenerated = useCallback(async () => {
    if (!projectId || reviewState.totalSheets === 0) {
      return true;
    }

    // Fast path: avoid generating all sheet schemas up front.
    // Schemas are loaded/generated lazily per sheet in the review workspace.
    await refreshSavedBrandSchemas().catch(() => null);
    return true;
  }, [projectId, refreshSavedBrandSchemas, reviewState.totalSheets]);

  const beginReviewSurface = useCallback(
    async (nextReadOnly: boolean) => {
      if (reviewState.totalSheets === 0) {
        toast({
          title: "Workspace still preparing",
          description:
            "No operational sheets are available yet. Wait for the legal workspace to finish loading, then try again.",
          duration: 3500,
        });
        return;
      }

      const ready = await ensureBrandSchemasGenerated();
      if (!ready) {
        return;
      }

      setGenerationStatus("idle");
      setGenerationMessage("Review workspace ready.");
      setEntryMode("review");
      openReviewSurface(nextReadOnly);
    },
    [
      ensureBrandSchemasGenerated,
      openReviewSurface,
      reviewState.totalSheets,
      setEntryMode,
      setGenerationMessage,
      setGenerationStatus,
      toast,
    ],
  );

  const handleContinueFromCover = useCallback(async () => {
    if (!isAuthenticated && !hasSavedSchemas && !importSession) {
      setLoginOpen(true);
      return;
    }

    if (canViewCompletedReview) {
      await beginReviewSurface(true);
      return;
    }

    if (importSession && !importSession.appliedAt) {
      try {
        await hydrateImportReview(importSession);
        setEntryMode("import-review");
        setModalSurface("import-review");
        return;
      } catch (error) {
        toast({
          title: "Import review unavailable",
          description:
            error instanceof Error
              ? error.message
              : "Failed to restore the saved import review.",
          duration: 3500,
        });
      }
    }

    await beginReviewSurface(false);
  }, [
    beginReviewSurface,
    canViewCompletedReview,
    hasSavedSchemas,
    hydrateImportReview,
    importSession,
    isAuthenticated,
    setEntryMode,
    setLoginOpen,
    setModalSurface,
    toast,
  ]);

  const handleImportFromCover = useCallback(async () => {
    const ready = await ensureBrandSchemasGenerated();
    if (!ready) {
      return;
    }

    setModalSurface("cover");
    triggerImportPicker();
  }, [ensureBrandSchemasGenerated, setModalSurface, triggerImportPicker]);

  const buildPrintPreviewHref = useCallback(
    (sheetSlug: string) => {
      if (!projectId) {
        return "#";
      }

      return `/print/project-context/${encodeURIComponent(projectId)}/wire-list/${encodeURIComponent(sheetSlug)}`;
    },
    [projectId],
  );

  const handleOpenCurrentWireListPdf = useCallback(() => {
    if (!activeSlug) {
      return;
    }

    window.open(
      buildPrintPreviewHref(activeSlug),
      "_blank",
      "noopener,noreferrer",
    );
  }, [activeSlug, buildPrintPreviewHref]);

  const handleDownloadAllWireLists = useCallback(() => {
    if (!projectId) {
      return;
    }

    window.open(
      `/api/projects/${encodeURIComponent(projectId)}/wire-list-pdf/download-all`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [projectId]);

  return {
    ensureBrandSchemasGenerated,
    beginReviewSurface,
    handleContinueFromCover,
    handleImportFromCover,
    handleOpenCurrentWireListPdf,
    handleDownloadAllWireLists,
  };
}
