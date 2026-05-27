"use client";

import { FileSearch2 } from "lucide-react";
import { ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LayoutPdfWorkspace } from "@/components/projects/layout-pdf-workspace";
import type { LayoutPagesIndexDocument } from "@/lib/layout-matching";
import { SingleSheetPrintWorkspace } from "@/components/wire-list/print-modal";
import type { LoadedSheetResources } from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import type { MultiSheetNavigationItem } from "@/components/wire-list/multi-sheet-review-types";

interface MultiSheetStandardWorkspaceShellProps {
  activeTab: MultiSheetNavigationItem | null;
  activeResources: LoadedSheetResources | undefined;
  projectId?: string;
  activeSlug: string | null;
  headerTitle: string;
  layoutPdfUrl?: string | null;
  layoutIndex?: LayoutPagesIndexDocument | null;
  viewMode: "wire-list" | "layout";
  highlightQuery?: string;
  swsType?: { id?: string; label: string; shortLabel: string; color: string };
  onOpenLayoutReference: () => void;
  skeleton: React.ReactNode;
}

export function MultiSheetStandardWorkspaceShell({
  activeTab,
  activeResources,
  projectId,
  activeSlug,
  headerTitle,
  layoutPdfUrl,
  layoutIndex,
  viewMode,
  highlightQuery,
  swsType,
  onOpenLayoutReference,
  skeleton,
}: MultiSheetStandardWorkspaceShellProps) {
  const canRenderLayoutWorkspace = Boolean(layoutPdfUrl && layoutIndex && activeTab?.pageNumber);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 flex-wrap overflow-hidden">
        {viewMode === "layout" && canRenderLayoutWorkspace ? (
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background flex-1">
            <div className="flex items-center justify-between border-b bg-background/95 px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Matched Layout PDF</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
                  <FileSearch2 className="h-4 w-4 text-muted-foreground" />
                  <span>{activeTab?.pageTitle || activeTab?.name || `Page ${activeTab?.pageNumber}`}</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={onOpenLayoutReference}>
                <ImageIcon className="h-4 w-4" />
                Open Floating Reference
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <LayoutPdfWorkspace
                pdfUrl={layoutPdfUrl!}
                layoutIndex={layoutIndex!}
                initialPageNumber={activeTab?.pageNumber}
                initialHighlightQuery={highlightQuery}
                className="h-full"
              />
            </div>
          </div>
        ) : activeResources?.sheet ? (
          <SingleSheetPrintWorkspace
            rows={activeResources.sheet.rows}
            currentSheetName={activeResources.sheet.name}
            projectId={projectId}
            sheetSlug={activeResources.sheet.slug}
            sheetTitle={activeResources.sheet.name}
            metadata={activeResources.sheet.metadata}
            initialLoadedSchema={activeResources.printSchema}
            initialMode="standardize"
            swsType={swsType}
            workspaceActive
            hideCloseButton
            headerTitle={headerTitle}
          />
        ) : (
          skeleton
        )}
      </div>
      {activeTab?.imageUrl ? (
        <Button
          type="button"
          variant="secondary"
          className="absolute right-4 top-4 z-20 gap-2 rounded-full shadow-lg"
          data-tour="multi-sheet-layout-reference"
          onClick={onOpenLayoutReference}
        >
          <ImageIcon className="h-4 w-4" />
          Layout
        </Button>
      ) : null}
    </div>
  );
}
