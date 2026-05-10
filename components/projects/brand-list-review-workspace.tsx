"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FloatingLayoutReferenceWindow } from "@/components/layout-workspace/floating-layout-reference-window";
import type { SlimLayoutPage } from "@/components/layout-workspace/layout-types";
import { LoginModal } from "@/components/projects/login-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSheetImportReviewShell } from "@/components/wire-list/multi-sheet-import-review-shell";
import { MultiSheetPreparingShell } from "@/components/wire-list/multi-sheet-review-preparing-shell";
import { MultiSheetReviewCoverShell } from "@/components/wire-list/multi-sheet-review-cover-shell";
import { MultiSheetReviewHeaderBar } from "@/components/wire-list/multi-sheet-review-header-bar";
import { MultiSheetReviewSequenceDialog } from "@/components/wire-list/multi-sheet-review-sequence-dialog";
import { MultiSheetReviewWorkspaceShell } from "@/components/wire-list/multi-sheet-review-workspace-shell";
import { MultiSheetStateReviewDialog } from "@/components/wire-list/multi-sheet-state-review-dialog";
import { MultiSheetTutorialSheet } from "@/components/wire-list/multi-sheet-tutorial-sheet";
import { useMultiSheetBrandReviewController } from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import { useMultiSheetGuidance } from "@/components/wire-list/use-multi-sheet-guidance";
import { useMultiSheetImportFlow } from "@/components/wire-list/use-multi-sheet-import-flow";
import { useMultiSheetReviewActions } from "@/components/wire-list/use-multi-sheet-review-actions";
import { useMultiSheetReviewTabs } from "@/components/wire-list/use-multi-sheet-review-tabs";
import { useMultiSheetStatusChecks } from "@/components/wire-list/use-multi-sheet-status-checks";
import { useMultiSheetWorkspaceState } from "@/components/wire-list/use-multi-sheet-workspace-state";
import { useProjectContext } from "@/contexts/project-context";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/hooks/use-toast";
import type { LayoutPagesIndexDocument } from "@/lib/layout/layout-page-types";
import type { MultiSheetImportSheetDiff } from "@/lib/wire-brand-list/multi-sheet-review";
import type { MultiSheetModalSurface } from "@/components/wire-list/multi-sheet-review-types";

interface BrandListReviewWorkspaceProps {
  badgeNumber: string;
  projectId: string;
  initialSurface?: string;
  initialSheetSlug?: string;
  readOnly?: boolean;
  promptImport?: boolean;
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading sheet workspace...
    </div>
  );
}

function DetailedWorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex min-w-0 min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-2xl border bg-card/40 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="flex-1 min-h-0 rounded-2xl border bg-card/40 p-4">
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="rounded-xl border border-border/60">
            <div className="border-b p-4">
              <Skeleton className="h-6 w-56" />
            </div>
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandListReviewWorkspace({
  badgeNumber,
  projectId,
  initialSurface,
  initialSheetSlug,
  readOnly = false,
  promptImport = false,
}: BrandListReviewWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, loadProject } = useProjectContext();
  const { user } = useSession();
  const { toast } = useToast();

  // Modal-like state, but always "open" since this is a page
  const isOpen = true;
  const [layoutPages, setLayoutPages] = useState<SlimLayoutPage[]>([]);
  const [layoutIndex, setLayoutIndex] = useState<LayoutPagesIndexDocument | null>(null);
  const [layoutPdfUrl, setLayoutPdfUrl] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [stateReviewOpen, setStateReviewOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "preparing" | "generating" | "success" | "error"
  >("idle");
  const [generationMessage, setGenerationMessage] = useState(
    "Preparing brand list schemas...",
  );
  const [importSheetDiffs, setImportSheetDiffs] = useState<MultiSheetImportSheetDiff[]>([]);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [reviewSequenceOpen, setReviewSequenceOpen] = useState(false);
  const [isImportReviewHydrating, setIsImportReviewHydrating] = useState(false);
  const [standardViewMode, setStandardViewMode] = useState<"wire-list" | "layout">("wire-list");
  const [reviewSequencePhase, setReviewSequencePhase] = useState<
    "confirm" | "processing" | "complete"
  >("confirm");
  const [reviewSequenceMessage, setReviewSequenceMessage] = useState(
    "Preparing the next review step...",
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoStartedRef = useRef(false);
  const hasPromptedImportRef = useRef(false);

  const isAuthenticated = Boolean(user);
  const userLabel = user?.preferredName || user?.legalName || user?.badge || null;
  
  const fallbackReturnTo = `/${badgeNumber}/projects?openProjectId=${encodeURIComponent(projectId)}`;
  const returnTo = searchParams.get("returnTo") || fallbackReturnTo;

  const coverActivitiesApiUrl = useMemo(() => {
    if (!projectId) return null;
    return `/api/projects/${encodeURIComponent(projectId)}/activity?limit=200`;
  }, [projectId]);

  // Navigation back to project
  const goBack = useCallback(() => {
    router.push(returnTo);
  }, [returnTo, router]);

  // Load project if not already loaded
  useEffect(() => {
    if (!projectId || currentProject?.id === projectId) {
      return;
    }
    loadProject(projectId);
  }, [currentProject?.id, loadProject, projectId]);

  const tabs = useMultiSheetReviewTabs({
    currentProject,
    currentSheetSlug: initialSheetSlug,
    layoutPages,
  });

  const controller = useMultiSheetBrandReviewController({
    projectId,
    isOpen,
    tabs,
    preferredSheetSlug: initialSheetSlug,
    user,
    toast,
  });

  const {
    activeSlug,
    setActiveSlug,
    approvedSlugs,
    sheetReviews,
    isCombining,
    exportResult,
    selectedBrandRows,
    setSelectedBrandRows,
    savedBrandSchemaSlugs,
    editedAfterApprovalSlugs,
    pendingBrandSchemaSlugs,
    entryMode,
    setEntryMode,
    importSession,
    setImportSession,
    activeIndex,
    activeTab,
    activeResources,
    activeBrandSchema,
    activeBrandRowIds,
    reviewState,
    refreshSheetResources,
    refreshSavedBrandSchemas,
    markSheetsChangedAfterImport,
    renameBrandBundle,
    updateBrandSchemaRow,
    addBrandSchemaRow,
    removeBrandSchemaRow,
    updateBrandSchemaProjectInfo,
    toggleSelectedBrandRow,
    toggleSelectedBrandRowGroup,
    duplicateSelectedBrandRows,
    incrementSelectedBrandLengths,
    regenerateBrandSchemaForSheet,
    handleApproveSheet,
    handleUnapproveSheet,
    handleCombine,
  } = controller;

  const activeAssignment = useMemo(() => {
    return currentProject?.assignments?.find((a) => a.sheetSlug === activeSlug) ?? null;
  }, [activeSlug, currentProject?.assignments]);

  const {
    workspaceMode: activeWorkspaceMode,
    setWorkspaceMode: setActiveWorkspaceMode,
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
  } = useMultiSheetWorkspaceState({
    isOpen,
    defaultWorkspaceMode: "print",
    entryMode,
    importSession,
    generationStatus,
    exportPath: exportResult?.brandingWorkbook?.relativePath ?? null,
  });

  useMultiSheetGuidance({ isOpen, stateReviewOpen });

  const {
    hydrateImportReview,
    handleImportFileChange,
    setImportMode,
    updateImportDecision,
    approveImportSection,
    approveImportSheet,
    acceptAllLengthChanges,
    applyImportChanges,
  } = useMultiSheetImportFlow({
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
  });

  // Set initial surface based on URL param
  useEffect(() => {
    if (initialSurface && ["cover", "generating", "import-review", "review"].includes(initialSurface)) {
      setModalSurface(initialSurface as MultiSheetModalSurface);
    }
    if (readOnly) {
      setReviewReadOnly(true);
    }
  }, [initialSurface, readOnly, setModalSurface, setReviewReadOnly]);

  useEffect(() => {
    setStandardViewMode("wire-list");
  }, [activeSlug]);

  // Auto-hydrate import diffs when page loads with a pending import session
  useEffect(() => {
    if (modalSurface !== "import-review") {
      setIsImportReviewHydrating(false);
    }

    if (
      modalSurface === "import-review" &&
      importSession &&
      !importSession.appliedAt &&
      importSheetDiffs.length === 0
    ) {
      setIsImportReviewHydrating(true);
      void hydrateImportReview(importSession)
        .catch((error) => {
          console.error("[v0] Failed to re-hydrate import review:", error);
          setModalSurface("cover");
        })
        .finally(() => {
          setIsImportReviewHydrating(false);
        });
    }
  }, [modalSurface, importSession, importSheetDiffs.length, hydrateImportReview, setModalSurface]);

  const importReviewLocked = modalSurface === "import-review" && (isImportReviewHydrating || isApplyingImport);
  
  const isWireListMode = activeWorkspaceMode === "wire-list";

  // Load layout assets when needed
  useEffect(() => {
    if (!projectId) {
      return;
    }

    const shouldLoadLayoutAssets =
      layoutPreviewOpen || standardViewMode === "layout";
    if (!shouldLoadLayoutAssets) {
      return;
    }

    let cancelled = false;
    void fetch(
      `/api/projects/${encodeURIComponent(projectId)}/layout-pdf`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<{
          pages?: SlimLayoutPage[];
          layoutIndex?: LayoutPagesIndexDocument | null;
          pdf?: { url?: string | null } | null;
        }>;
      })
      .then((payload) => {
        if (!cancelled) {
          setLayoutPages(payload.pages ?? []);
          setLayoutIndex(payload.layoutIndex ?? null);
          setLayoutPdfUrl(payload.pdf?.url ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutPages([]);
          setLayoutIndex(null);
          setLayoutPdfUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layoutPreviewOpen, projectId, standardViewMode]);

  const {
    latestReviewLabel,
    latestReviewDescription,
    navigationItems,
    canViewCompletedReview,
    coverActionLabel,
    pendingImportCount,
    exportReadyHref,
    wireListSchemaHref,
  } = useMultiSheetStatusChecks({
    tabs,
    activeSlug,
    approvedSlugs,
    editedAfterApprovalSlugs,
    sheetReviews,
    reviewState,
    importSession,
    importSheetDiffs,
    exportResult,
    projectId,
  });

  const activeNavigationItem = useMemo(() => {
    return navigationItems.find((item) => item.slug === activeSlug) ?? null;
  }, [navigationItems, activeSlug]);

  const reviewWorkspaceLocked =
    modalSurface === "review"
    && (!activeSlug || !activeNavigationItem || (!isWireListMode && !activeBrandSchema));

  const {
    ensureBrandSchemasGenerated,
    beginReviewSurface,
    handleContinueFromCover,
    handleImportFromCover,
    handleOpenCurrentWireListPdf,
    handleDownloadAllWireLists,
  } = useMultiSheetReviewActions({
    projectId,
    activeSlug,
    isAuthenticated,
    hasSavedSchemas: savedBrandSchemaSlugs.length > 0,
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
    triggerImportPicker: () => fileInputRef.current?.click(),
  });

  // Auto-start review if coming from project details
  useEffect(() => {
    if (
      autoStartedRef.current ||
      modalSurface !== "cover" ||
      currentProject?.id !== projectId ||
      tabs.length === 0
    ) {
      return;
    }

    // If we have an initial surface other than cover, don't auto-start
    if (initialSurface && initialSurface !== "cover") {
      return;
    }

    // Auto-start review if there are saved schemas
    if (savedBrandSchemaSlugs.length > 0 && !promptImport) {
      autoStartedRef.current = true;
      void beginReviewSurface(readOnly);
    }
  }, [
    beginReviewSurface,
    currentProject?.id,
    initialSurface,
    modalSurface,
    projectId,
    promptImport,
    readOnly,
    savedBrandSchemaSlugs.length,
    tabs.length,
  ]);

  // Auto-prompt import if requested
  useEffect(() => {
    if (!promptImport || hasPromptedImportRef.current) {
      return;
    }
    hasPromptedImportRef.current = true;
    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
    return () => clearTimeout(timer);
  }, [promptImport]);

  // Activity logging
  const logBrandingWorkflowActivity = useCallback(async (
    workflow: string,
    milestone: string,
    action: string,
    automatedFollowUps?: unknown,
  ) => {
    // Activity logging implementation - simplified for page context
    // Full implementation would match modal's logBrandingWorkflowActivity
  }, []);

  const handleContinueFromCoverWithActivity = useCallback(async () => {
    await handleContinueFromCover();
  }, [handleContinueFromCover]);

  const handleImportFromCoverWithActivity = useCallback(async () => {
    await handleImportFromCover();
  }, [handleImportFromCover]);

  const handleOpenTutorialWithActivity = useCallback(() => {
    setTutorialOpen(true);
  }, []);

  const handleOpenLoginWithActivity = useCallback(() => {
    setLoginOpen(true);
  }, []);

  const handleConfirmApproveFlow = useCallback(async () => {
    if (!activeSlug) {
      return;
    }

    const isFinalSheet = approvedSlugs.includes(activeSlug)
      ? approvedSlugs.length >= tabs.length
      : approvedSlugs.length + 1 >= tabs.length;

    setReviewSequencePhase("processing");
    setReviewSequenceMessage(
      isFinalSheet
        ? "Finalizing the last sheet and building the combined workbook..."
        : "Saving approval and loading the next sheet...",
    );

    try {
      const approveResult = await handleApproveSheet();
      if (!approveResult) {
        setReviewSequenceOpen(false);
        return;
      }

      if (approveResult.isFinalSheet) {
        setReviewSequenceMessage("Combining approved sheets and preparing your workbook...");
        await handleCombine();
        setReviewSequencePhase("complete");
        return;
      }

      setModalSurface("generating");
      setGenerationStatus("success");
      setGenerationMessage(
        approveResult.nextSlug
          ? `Loading ${tabs.find((tab) => tab.slug === approveResult.nextSlug)?.name ?? "next sheet"}...`
          : "Loading next sheet...",
      );

      await new Promise((resolve) => window.setTimeout(resolve, 420));
      setReviewSequenceOpen(false);
      setModalSurface("review");
    } catch {
      setReviewSequenceOpen(false);
    }
  }, [
    activeSlug,
    approvedSlugs,
    handleApproveSheet,
    handleCombine,
    setModalSurface,
    tabs,
  ]);

  const handleApproveFlow = useCallback(() => {
    void handleConfirmApproveFlow();
  }, [handleConfirmApproveFlow]);

  const handleCombineFlow = useCallback(async () => {
    setReviewSequencePhase("processing");
    setReviewSequenceMessage("Combining approved sheets and preparing your workbook...");
    setReviewSequenceOpen(true);

    try {
      await handleCombine();
      setReviewSequencePhase("complete");
    } catch {
      setReviewSequenceOpen(false);
    }
  }, [handleCombine]);

  const handleUnapproveWithActivity = useCallback(async () => {
    await handleUnapproveSheet();
  }, [handleUnapproveSheet]);

  const headerTitle = modalSurface === "cover"
    ? "Brand List Approval Editor"
    : modalSurface === "import-review"
    ? "Import Review"
    : modalSurface === "generating"
    ? "Preparing..."
    : activeTab?.name ?? "Review";

  const headerDescription = modalSurface === "cover"
    ? "Review each sheet, approve it, then combine everything into a single export ready for handoff."
    : modalSurface === "import-review"
    ? "Compare imported workbook against saved schemas"
    : modalSurface === "generating"
    ? generationMessage
    : `Sheet ${activeIndex + 1} of ${tabs.length}`;

  const workspaceSkeleton = useMemo(() => {
    if (!activeSlug || !activeResources) {
      return <WorkspaceSkeleton />;
    }
    if (!isWireListMode && !activeBrandSchema) {
      return <DetailedWorkspaceSkeleton />;
    }
    return null;
  }, [activeBrandSchema, activeResources, activeSlug, isWireListMode]);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <MultiSheetReviewHeaderBar
        surface={modalSurface}
        workspaceMode={activeWorkspaceMode}
        standardViewMode={standardViewMode}
        title={headerTitle}
        description={headerDescription}
        approvedCount={approvedSlugs.length}
        totalCount={tabs.length}
        showStandardViewToggle={Boolean(activeWorkspaceMode === "wire-list" && activeTab?.pageNumber && layoutPdfUrl && layoutIndex)}
        onOpenStateReview={() => setStateReviewOpen(true)}
        onSetWorkspaceMode={setActiveWorkspaceMode}
        onSetStandardViewMode={setStandardViewMode}
        onBackToCover={() => setModalSurface("cover")}
        onOpenTutorial={() => setTutorialOpen(true)}
        onSaveAndContinueLater={goBack}
        onClose={goBack}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {modalSurface === "cover" ? (
          <MultiSheetReviewCoverShell
            canViewCompletedReview={canViewCompletedReview}
            coverActionLabel={coverActionLabel}
            importSession={importSession}
            pendingImportCount={pendingImportCount}
            reviewState={reviewState}
            latestReviewLabel={latestReviewLabel}
            latestReviewDescription={latestReviewDescription}
            isAuthenticated={isAuthenticated}
            userLabel={userLabel}
            currentBadge={user?.badge ?? undefined}
            projectId={projectId}
            projectCreatedAt={currentProject?.createdAt}
            currentShift={user?.currentShift}
            activitiesApiUrl={coverActivitiesApiUrl}
            brandingWorkbookHref={exportReadyHref}
            wireListSchemaHref={wireListSchemaHref}
            onDownloadAllWireLists={handleDownloadAllWireLists}
            onContinue={handleContinueFromCoverWithActivity}
            onSaveAndContinueLater={goBack}
            onImport={() => void handleImportFromCoverWithActivity()}
            onOpenTutorial={handleOpenTutorialWithActivity}
            onOpenLogin={handleOpenLoginWithActivity}
          />
        ) : modalSurface === "generating" ? (
          <MultiSheetPreparingShell
            generationStatus={generationStatus}
            generationMessage={generationMessage}
            reviewReadOnly={reviewReadOnly}
            onBack={() => setModalSurface("cover")}
            onRetry={() => void ensureBrandSchemasGenerated()}
            onOpenReview={() => void beginReviewSurface(reviewReadOnly)}
          />
        ) : modalSurface === "import-review" ? (
          <MultiSheetImportReviewShell
            sheetDiffs={importSheetDiffs}
            activeSheetSlug={importSession?.activeSheetSlug ?? activeSlug}
            importMode={importSession?.importMode ?? "length-only"}
            rowDecisions={importSession?.rowDecisions ?? {}}
            onImportModeChange={setImportMode}
            onActiveSheetChange={setActiveSlug}
            onUpdateImportSession={setImportSession}
            onDecisionChange={updateImportDecision}
            onApproveSection={approveImportSection}
            onApproveSheet={approveImportSheet}
            onAcceptAllLengthChanges={acceptAllLengthChanges}
            onReviewStructuralChanges={() => {
              setImportMode("full");
              const firstStructuralSheet = importSheetDiffs.find((sheet) =>
                sheet.diffs.some(
                  (diff) =>
                    diff.changeType === "imported-only"
                    || diff.changeType === "current-only",
                ),
              );
              if (firstStructuralSheet) {
                setActiveSlug(firstStructuralSheet.sheetSlug);
                setImportSession((prev) =>
                  prev
                    ? {
                        ...prev,
                        importMode: "full",
                        activeSheetSlug: firstStructuralSheet.sheetSlug,
                      }
                    : prev,
                );
              }
            }}
            onApply={() => void applyImportChanges()}
            onContinueToReview={() => void beginReviewSurface(false)}
            isApplying={isApplyingImport}
            disabled={importReviewLocked}
            busyMessage={
              isApplyingImport
                ? "Applying import changes..."
                : "Preparing imported workbook review..."
            }
          />
        ) : (
          <MultiSheetReviewWorkspaceShell
            items={navigationItems}
            activeSlug={activeSlug}
            activeIndex={activeIndex}
            activeTab={activeNavigationItem}
            activeResources={activeResources}
            activeBrandSchema={activeBrandSchema}
            activeBrandRowIds={activeBrandRowIds}
            activeSheetSwsType={
              typeof activeAssignment?.swsType === "string"
                ? activeAssignment.swsType
                : null
            }
            projectId={projectId}
            isAuthenticated={isAuthenticated}
            userLabel={userLabel}
            exportReadyHref={exportReadyHref}
            isWireListMode={isWireListMode}
            standardViewMode={standardViewMode}
            layoutPdfUrl={layoutPdfUrl}
            layoutIndex={layoutIndex}
            reviewReadOnly={reviewReadOnly}
            selectedBrandRows={selectedBrandRows}
            pendingBrandSchemaSlugs={pendingBrandSchemaSlugs}
            isCombining={isCombining}
            combineLabel="Combine Brand List"
            skeleton={workspaceSkeleton}
            onOpenLogin={() => setLoginOpen(true)}
            onSelectSheet={setActiveSlug}
            onOpenLayoutReference={() => setLayoutPreviewOpen(true)}
            onRegenerateBrandSchema={() =>
              void (activeSlug
                ? regenerateBrandSchemaForSheet(activeSlug)
                : Promise.resolve())
            }
            onUpdateProjectInfo={updateBrandSchemaProjectInfo}
            onToggleRow={(rowId) => toggleSelectedBrandRow(rowId, !selectedBrandRows.has(rowId))}
            onToggleSection={(rowIds) => {
              const shouldSelect = rowIds.some((rowId) => !selectedBrandRows.has(rowId));
              toggleSelectedBrandRowGroup(rowIds, shouldSelect);
            }}
            onRenameBundle={renameBrandBundle}
            onUpdateRow={updateBrandSchemaRow}
            onAddRow={addBrandSchemaRow}
            onRemoveRow={removeBrandSchemaRow}
            onPrevious={() => {
              const previous = tabs[activeIndex - 1];
              if (previous) {
                setActiveSlug(previous.slug);
              }
            }}
            onNext={() => {
              const next = tabs[activeIndex + 1];
              if (next) {
                setActiveSlug(next.slug);
              }
            }}
            onSelectAll={() => setSelectedBrandRows(new Set(activeBrandRowIds))}
            onIncrement={incrementSelectedBrandLengths}
            onDuplicate={duplicateSelectedBrandRows}
            onClearSelection={() => setSelectedBrandRows(new Set())}
            onOpenCurrentPdf={handleOpenCurrentWireListPdf}
            onDownloadAllWireLists={handleDownloadAllWireLists}
            onApprove={handleApproveFlow}
            onUnapprove={() => void handleUnapproveWithActivity()}
            onCombine={() => void handleCombineFlow()}
            disabled={reviewWorkspaceLocked}
            busyMessage="Preparing sheet workspace..."
          />
        )}
      </div>

      <FloatingLayoutReferenceWindow
        open={layoutPreviewOpen}
        minimized={layoutPreviewMinimized}
        position={layoutPreviewPosition}
        title={activeTab?.name ?? "Layout"}
        pageNumber={activeTab?.pageNumber}
        pdfUrl={layoutPdfUrl ?? undefined}
        layoutIndex={layoutIndex}
        onToggleMinimized={() => setLayoutPreviewMinimized((prev) => !prev)}
        onClose={() => setLayoutPreviewOpen(false)}
        onPositionChange={setLayoutPreviewPosition}
      />

      <MultiSheetReviewSequenceDialog
        open={reviewSequenceOpen}
        phase={reviewSequencePhase}
        items={navigationItems}
        approvedCount={approvedSlugs.length}
        activeSheetName={activeTab?.name ?? null}
        activeSheetRowCount={activeTab?.rowCount ?? 0}
        remainingCount={Math.max(tabs.length - approvedSlugs.length, 0)}
        isFinalSheet={
          Boolean(activeSlug) &&
          (activeSlug && approvedSlugs.includes(activeSlug)
            ? approvedSlugs.length >= tabs.length
            : approvedSlugs.length + 1 >= tabs.length)
        }
        processingMessage={reviewSequenceMessage}
        downloadHref={exportReadyHref}
        onOpenChange={setReviewSequenceOpen}
        onConfirm={() => void handleConfirmApproveFlow()}
        onExit={goBack}
        onReturnToCover={() => {
          setReviewSequenceOpen(false);
          setModalSurface("cover");
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => void handleImportFileChange(event)}
      />

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        showShiftSelection
        shiftSelectionOptional
        title="Sign in to continue"
      />

      <MultiSheetStateReviewDialog
        open={stateReviewOpen}
        onOpenChange={setStateReviewOpen}
        tabs={tabs}
        approvedSlugs={approvedSlugs}
        editedAfterApprovalSlugs={editedAfterApprovalSlugs}
        sheetReviews={sheetReviews}
        exportResult={exportResult}
        importSession={importSession}
        activeSlug={activeSlug}
        onSelectSheet={(slug) => {
          setActiveSlug(slug);
          setStateReviewOpen(false);
        }}
      />

      <MultiSheetTutorialSheet
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
      />
    </main>
  );
}
