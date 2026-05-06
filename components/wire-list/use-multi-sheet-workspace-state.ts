"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MultiSheetImportSession } from "@/lib/wire-brand-list/multi-sheet-review";
import type { MultiSheetModalSurface, MultiSheetWorkspaceMode } from "@/components/wire-list/multi-sheet-review-types";

interface UseMultiSheetWorkspaceStateOptions {
  isOpen: boolean;
  defaultWorkspaceMode: MultiSheetWorkspaceMode;
  entryMode: "cover" | "import-review" | "review";
  importSession: MultiSheetImportSession | null;
  generationStatus: "idle" | "preparing" | "generating" | "success" | "error";
  exportPath: string | null;
}

export function useMultiSheetWorkspaceState({
  isOpen,
  defaultWorkspaceMode,
  entryMode,
  importSession,
  generationStatus,
  exportPath,
}: UseMultiSheetWorkspaceStateOptions) {
  const [workspaceMode, setWorkspaceMode] =
    useState<MultiSheetWorkspaceMode>(defaultWorkspaceMode);
  const [modalSurface, setModalSurface] =
    useState<MultiSheetModalSurface>("cover");
  const [reviewReadOnly, setReviewReadOnly] = useState(false);
  const [layoutPreviewOpen, setLayoutPreviewOpen] = useState(false);
  const [layoutPreviewMinimized, setLayoutPreviewMinimized] = useState(false);
  const [layoutPreviewPosition, setLayoutPreviewPosition] = useState({
    x: 72,
    y: 96,
  });
  const lastHandledExportRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setWorkspaceMode(defaultWorkspaceMode);
    setModalSurface("cover");
    setReviewReadOnly(false);
  }, [defaultWorkspaceMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (generationStatus === "generating") {
      return;
    }

    if (entryMode === "import-review" && importSession && !importSession.appliedAt) {
      setModalSurface("import-review");
      return;
    }

    if (entryMode === "review") {
      setModalSurface("review");
      return;
    }

    setModalSurface("cover");
  }, [entryMode, generationStatus, importSession, isOpen]);

  useEffect(() => {
    if (!isOpen || !exportPath) {
      return;
    }

    if (lastHandledExportRef.current === exportPath) {
      return;
    }

    lastHandledExportRef.current = exportPath;
    setModalSurface("cover");
    setReviewReadOnly(true);
  }, [exportPath, isOpen]);

  const openReviewSurface = useCallback((nextReadOnly: boolean) => {
    setReviewReadOnly(nextReadOnly);
    setModalSurface("review");
  }, []);

  return {
    workspaceMode,
    setWorkspaceMode,
    modalSurface,
    setModalSurface,
    reviewReadOnly,
    setReviewReadOnly,
    layoutPreviewOpen,
    setLayoutPreviewOpen,
    layoutPreviewMinimized,
    setLayoutPreviewMinimized,
    layoutPreviewPosition,
    setLayoutPreviewPosition,
    openReviewSurface,
  };
}
