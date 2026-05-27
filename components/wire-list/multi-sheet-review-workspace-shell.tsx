"use client";

import { useEffect, useState } from "react";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";

import type { MultiSheetNavigationItem } from "@/components/wire-list/multi-sheet-review-types";
import { MultiSheetBrandWorkspaceShell } from "@/components/wire-list/multi-sheet-brand-workspace-shell";
import { MultiSheetReviewFooterActions } from "@/components/wire-list/multi-sheet-review-footer-actions";
import { MultiSheetReviewNavigatorRail } from "@/components/wire-list/multi-sheet-review-navigator-rail";
import { MultiSheetStandardWorkspaceShell } from "@/components/wire-list/multi-sheet-standard-workspace-shell";
import type {
  LoadedSheetResources,
} from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import type {
  BrandListExportSchema,
  BrandListSchemaRow,
} from "@/lib/wire-brand-list/schema";

interface MultiSheetReviewWorkspaceShellProps {
  items: MultiSheetNavigationItem[];
  activeSlug: string | null;
  activeIndex: number;
  activeTab: MultiSheetNavigationItem | null;
  activeResources: LoadedSheetResources | undefined;
  activeBrandSchema: BrandListExportSchema | null;
  activeBrandRowIds: string[];
  activeSheetSwsType?: string | null;
  projectId?: string;
  isAuthenticated: boolean;
  userLabel?: string | null;
  exportReadyHref?: string | null;
  isWireListMode: boolean;
  standardViewMode?: "wire-list" | "layout";
  layoutPdfUrl?: string | null;
  layoutIndex?: import("@/lib/layout-matching").LayoutPagesIndexDocument | null;
  reviewReadOnly: boolean;
  selectedBrandRows: Set<string>;
  pendingBrandSchemaSlugs: string[];
  isCombining: boolean;
  combineLabel: string;
  skeleton: React.ReactNode;
  onOpenLogin: () => void;
  onSelectSheet: (slug: string) => void;
  onOpenLayoutReference: () => void;
  onRegenerateBrandSchema: () => void;
  onUpdateProjectInfo: (
    patch: Partial<BrandListExportSchema["projectInfo"]>,
  ) => void;
  onToggleRow: (rowId: string) => void;
  onToggleSection: (rowIds: string[]) => void;
  onRenameBundle: (
    prefixIndex: number,
    bundleIndex: number,
    nextName: string,
  ) => void;
  onUpdateRow: (
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
    patch: Partial<BrandListSchemaRow>,
  ) => void;
  onAddRow: (prefixIndex: number, bundleIndex: number) => void;
  onRemoveRow: (
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
  ) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelectAll: () => void;
  onIncrement: (delta: number) => void;
  onDuplicate: () => void;
  onClearSelection: () => void;
  onOpenCurrentPdf: () => void;
  onDownloadAllWireLists?: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
  onCombine: () => void;
  disabled?: boolean;
  busyMessage?: string;
}

function getSwsAccentColor(swsType?: string | null) {
  const value = (swsType ?? "").toUpperCase();
  if (value.includes("PANEL")) return "#16a34a";
  if (value.includes("BOX")) return "#ea580c";
  if (value.includes("RAIL")) return "#2563eb";
  if (value.includes("BLANK")) return "#6b7280";
  return "#64748b";
}

export function MultiSheetReviewWorkspaceShell({
  items,
  activeSlug,
  activeIndex,
  activeTab,
  activeResources,
  activeBrandSchema,
  activeBrandRowIds,
  activeSheetSwsType,
  projectId,
  isAuthenticated,
  userLabel,
  exportReadyHref,
  isWireListMode,
  standardViewMode = "wire-list",
  layoutPdfUrl,
  layoutIndex,
  reviewReadOnly,
  selectedBrandRows,
  pendingBrandSchemaSlugs,
  isCombining,
  combineLabel,
  skeleton,
  onOpenLogin,
  onSelectSheet,
  onOpenLayoutReference,
  onRegenerateBrandSchema,
  onUpdateProjectInfo,
  onToggleRow,
  onToggleSection,
  onRenameBundle,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onPrevious,
  onNext,
  onSelectAll,
  onIncrement,
  onDuplicate,
  onClearSelection,
  onOpenCurrentPdf,
  onDownloadAllWireLists,
  onApprove,
  onUnapprove,
  onCombine,
  disabled = false,
  busyMessage = "Preparing workspace...",
}: MultiSheetReviewWorkspaceShellProps) {
  const layoutWorkspaceEndpoint = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/layout-pdf`
    : null;

  const [isDesktopRailCollapsed, setIsDesktopRailCollapsed] = useState(
    isWireListMode,
  );

  useEffect(() => {
    if (isWireListMode) {
      setIsDesktopRailCollapsed(true);
    }
  }, [isWireListMode]);

  const isCurrentApproved = Boolean(
    activeSlug && items.find((item) => item.slug === activeSlug)?.isApproved,
  );
  const canCombine =
    !reviewReadOnly &&
    items.length > 0 &&
    items.every((item) => item.isApproved) &&
    !isCombining &&
    pendingBrandSchemaSlugs.length === 0;
  const canApproveCurrent =
    !reviewReadOnly &&
    Boolean(activeSlug) &&
    (activeSlug ? !pendingBrandSchemaSlugs.includes(activeSlug) : false);

  return (
    <div className="relative flex h-full flex-col" aria-busy={disabled}>
      <div className={`flex min-h-0 flex-1 flex-col${disabled ? " pointer-events-none select-none opacity-60" : ""}`}>
      <MultiSheetReviewNavigatorRail
        items={items}
        isAuthenticated={isAuthenticated}
        userLabel={userLabel}
        exportReadyHref={exportReadyHref}
        showDesktop={false}
        onSelect={onSelectSheet}
        onOpenLogin={onOpenLogin}
      />

      <div className="flex min-h-0 flex-1 xl:flex-row overflow-hidden">
        <MultiSheetReviewNavigatorRail
          items={items}
          isAuthenticated={isAuthenticated}
          userLabel={userLabel}
          exportReadyHref={exportReadyHref}
          showDesktop
          isCollapsed={isDesktopRailCollapsed}
          onSelect={onSelectSheet}
          onOpenLogin={onOpenLogin}
          onToggleCollapse={() => setIsDesktopRailCollapsed((current) => !current)}
        />

        <div className="relative min-h-0 flex-1 overflow-hidden">
        
          {isWireListMode ? (
            <MultiSheetStandardWorkspaceShell
              activeTab={activeTab}
              activeResources={activeResources}
              projectId={projectId}
              activeSlug={activeSlug}
              headerTitle={
                activeResources?.sheet
                  ? `Standard Wire List · ${activeResources.sheet.name}`
                  : "Standard Wire List"
              }
              layoutPdfUrl={layoutPdfUrl}
              layoutIndex={layoutIndex}
              viewMode={standardViewMode}
              highlightQuery={activeTab?.pageTitle || activeTab?.name || activeTab?.resolvedPage?.panelNumber || activeTab?.resolvedPage?.boxNumber || ""}
              swsType={
                activeSheetSwsType
                  ? {
                      id: activeSheetSwsType,
                      label: activeSheetSwsType,
                      shortLabel: activeSheetSwsType,
                      color: getSwsAccentColor(activeSheetSwsType),
                    }
                  : undefined
              }
              onOpenLayoutReference={onOpenLayoutReference}
              skeleton={skeleton}
            />
          ) : (
            <MultiSheetBrandWorkspaceShell
              activeSlug={activeSlug}
              activeSheetName={activeTab?.name}
              activeImageUrl={activeTab?.imageUrl ?? null}
              layoutWorkspaceEndpoint={layoutWorkspaceEndpoint}
              initialLayoutPageNumber={activeTab?.pageNumber}
              activeBrandSchema={activeBrandSchema}
              isSavingBrandSchema={pendingBrandSchemaSlugs.length > 0}
              reviewReadOnly={reviewReadOnly}
              selectedBrandRows={selectedBrandRows}
              onOpenLayoutReference={onOpenLayoutReference}
              onRegenerate={onRegenerateBrandSchema}
              onUpdateProjectInfo={onUpdateProjectInfo}
              onToggleRow={onToggleRow}
              onToggleSection={onToggleSection}
              onRenameBundle={onRenameBundle}
              onUpdateRow={onUpdateRow}
              onAddRow={onAddRow}
              onRemoveRow={onRemoveRow}
            />
          )}
        </div>
      </div>
      </div>

      <MultiSheetReviewFooterActions
        isWireListMode={isWireListMode}
        activeIndex={activeIndex}
        totalCount={items.length}
        canGoPrevious={activeIndex > 0}
        canGoNext={activeIndex >= 0 && activeIndex < items.length - 1}
        reviewReadOnly={reviewReadOnly}
        selectedCount={selectedBrandRows.size}
        canSelectAll={activeBrandRowIds.length > 0}
        canEditSelected={selectedBrandRows.size > 0}
        canApproveCurrent={canApproveCurrent}
        isCurrentApproved={isCurrentApproved}
        isCombining={isCombining}
        canCombine={canCombine}
        combineLabel={combineLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        onSelectAll={onSelectAll}
        onIncrement={onIncrement}
        onDuplicate={onDuplicate}
        onClearSelection={onClearSelection}
        onOpenCurrentPdf={onOpenCurrentPdf}
        onDownloadAllWireLists={onDownloadAllWireLists}
        onApprove={onApprove}
        onUnapprove={onUnapprove}
        onCombine={onCombine}
      />
      {disabled ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
            {busyMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
