"use client";

/**
 * Hook for managing layout PDF page rendering.
 * 
 * Handles:
 * - PDF page rendering to preview images
 * - Compatibility checking between workbook and PDF
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ProjectModel, SheetMetadataInfo } from "@/lib/workbook/types";
import type {
  LayoutPagePreview,
  CompatibilityResult,
  ProjectMetadata,
  RenderProgress,
} from "@/lib/layout-matching";
import {
  renderPdfPagesToImages,
  cleanupPreviewUrls,
  parseMetadataFromFilename,
  parseProjectMetadataFromPdf,
  parseProjectMetadataFromWorkbook,
  compareProjectCompatibility,
} from "@/lib/layout-matching";
import { useLayout } from "@/contexts/layout-context";

export interface UseLayoutPageMatchingOptions {
  project: ProjectModel | null;
  enabled?: boolean;
}

export interface UseLayoutPageMatchingResult {
  // State
  isRendering: boolean;
  renderProgress: RenderProgress | null;
  layoutPages: LayoutPagePreview[];
  compatibility: CompatibilityResult | null;
  error: string | null;

  // Actions
  processLayoutPdf: (file: File) => Promise<void>;
  clearLayoutData: () => void;
}

export function useLayoutPageMatching({
  project,
  enabled = true,
}: UseLayoutPageMatchingOptions): UseLayoutPageMatchingResult {
  const {
    layoutPages: contextPages,
    compatibility: contextCompatibility,
    setLayoutPages: setContextPages,
    setCompatibility: setContextCompatibility,
  } = useLayout();

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPagesRef = useRef<LayoutPagePreview[]>([]);

  const layoutPages = contextPages;
  const compatibility = contextCompatibility;

  const processLayoutPdf = useCallback(async (file: File) => {
    if (!enabled) return;

    setIsRendering(true);
    setError(null);
    setRenderProgress({ currentPage: 0, totalPages: 0, message: "Loading PDF..." });

    try {
      cleanupPreviewUrls(currentPagesRef.current);

      const pages = await renderPdfPagesToImages(file, {
        scale: 1.5,
        onProgress: setRenderProgress,
        extractFullText: true,
      });

      currentPagesRef.current = pages;
      setContextPages(pages);

      // Extract PDF metadata for compatibility check
      const pdfText = pages.map(p => p.title || "").join("\n");
      const pdfMetaFromFilename = parseMetadataFromFilename(file.name);
      const pdfMetaFromContent = parseProjectMetadataFromPdf(pdfText);
      const pdfMeta: ProjectMetadata = {
        projectNumber: pdfMetaFromContent.projectNumber || pdfMetaFromFilename.projectNumber,
        revision: pdfMetaFromContent.revision || pdfMetaFromFilename.revision,
        source: pdfMetaFromContent.projectNumber ? "content" : "filename",
      };

      if (project) {
        const firstSheet = project.sheets.find(s => s.kind === "operational");
        const sheetData = firstSheet ? project.sheetData[firstSheet.id] : null;
        const workbookMeta = parseProjectMetadataFromWorkbook(
          sheetData?.metadata as SheetMetadataInfo | undefined,
          project.filename
        );

        const sheets = project.sheets
          .filter(s => s.kind === "operational")
          .map(s => ({ name: s.name, slug: s.slug, kind: s.kind }));

        const compat = compareProjectCompatibility(
          workbookMeta,
          pdfMeta,
          0,
          sheets.length
        );
        setContextCompatibility(compat);
      }

      setRenderProgress({
        currentPage: pages.length,
        totalPages: pages.length,
        message: `Rendered ${pages.length} pages`,
      });
    } catch (err) {
      console.error("[d380] Layout PDF processing error:", err);
      setError(err instanceof Error ? err.message : "Failed to process layout PDF");
    } finally {
      setIsRendering(false);
    }
  }, [enabled, project, setContextPages, setContextCompatibility]);

  const clearLayoutData = useCallback(() => {
    cleanupPreviewUrls(currentPagesRef.current);
    currentPagesRef.current = [];
    setContextPages([]);
    setContextCompatibility(null);
    setError(null);
    setRenderProgress(null);
  }, [setContextPages, setContextCompatibility]);

  useEffect(() => {
    return () => {
      cleanupPreviewUrls(currentPagesRef.current);
    };
  }, []);

  return {
    isRendering,
    renderProgress,
    layoutPages,
    compatibility,
    error,
    processLayoutPdf,
    clearLayoutData,
  };
}
