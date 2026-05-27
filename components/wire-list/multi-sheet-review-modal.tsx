"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers3, Loader2 } from "lucide-react";

import { LoginPopup } from "@/components/dialog/login-popup";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingLayoutReferenceWindow } from "@/components/wire-list/floating-layout-reference-window";
import { MultiSheetImportReviewShell } from "@/components/wire-list/multi-sheet-import-review-shell";
import { MultiSheetReviewCoverShell } from "@/components/wire-list/multi-sheet-review-cover-shell";
import { MultiSheetReviewHeaderBar } from "@/components/wire-list/multi-sheet-review-header-bar";
import { MultiSheetReviewSequenceDialog } from "@/components/wire-list/multi-sheet-review-sequence-dialog";
import { MultiSheetPreparingShell } from "@/components/wire-list/multi-sheet-review-preparing-shell";
import { MultiSheetReviewTutorialDialog } from "@/components/wire-list/multi-sheet-review-tutorial-dialog";
import { MultiSheetReviewWorkspaceShell } from "@/components/wire-list/multi-sheet-review-workspace-shell";
import { useMultiSheetBrandReviewController } from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import { useMultiSheetGuidance } from "@/components/wire-list/use-multi-sheet-guidance";
import { useMultiSheetImportFlow } from "@/components/wire-list/use-multi-sheet-import-flow";
import { useMultiSheetReviewActions } from "@/components/wire-list/use-multi-sheet-review-actions";
import { useMultiSheetReviewTabs } from "@/components/wire-list/use-multi-sheet-review-tabs";
import { useMultiSheetStatusChecks } from "@/components/wire-list/use-multi-sheet-status-checks";
import { useMultiSheetWorkspaceState } from "@/components/wire-list/use-multi-sheet-workspace-state";
import { useProjectContext } from "@/contexts/project-context";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { activityService } from "@/lib/services/activity-service";
import type { LayoutPagesIndexDocument, SlimLayoutPage } from "@/lib/layout-matching";
import type { MultiSheetPrintExportResult } from "@/lib/project-exports/multi-sheet-print-exports";
import type { MultiSheetImportSheetDiff } from "@/lib/wire-brand-list/multi-sheet-review";

export interface MultiSheetReviewModalProps {
  projectId?: string;
  currentSheetSlug?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  title?: string;
  description?: string;
  combineLabel?: string;
  workspaceMode?: "print" | "wire-list";
  autoStartReview?: boolean;
  autoStartReadOnly?: boolean;
  activitiesApiUrl?: string | null;
  /** When true, opens the file picker immediately when modal opens */
  autoStartImport?: boolean;
  /** Callback to notify parent that import was triggered, allowing parent to clear the flag */
  onImportStarted?: () => void;
}

function buildWorkspaceSkeleton(isWireListMode: boolean) {
  if (!isWireListMode) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading sheet workspace...
      </div>
    );
  }

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

export function MultiSheetReviewModal({
  projectId,
  currentSheetSlug,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  title = "Multi-Brand List Review",
  description = "Review each sheet, approve it, then combine everything into a single export ready for handoff.",
  combineLabel = "Combine & Export",
  workspaceMode = "print",
  autoStartReview = false,
  autoStartReadOnly = false,
  activitiesApiUrl,
  autoStartImport = false,
  onImportStarted,
}: MultiSheetReviewModalProps) {
  const { currentProject, loadProject } = useProjectContext();
  const { user } = useSession();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
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
  const autoImportTriggeredRef = useRef(false);

  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const isAuthenticated = Boolean(user);
  const userLabel =
    user?.preferredName || user?.legalName || user?.badge || null;
  const coverActivitiesApiUrl = useMemo(() => {
    if (activitiesApiUrl !== undefined) {
      return activitiesApiUrl;
    }
    if (!projectId) return null;
    return `/api/projects/${encodeURIComponent(projectId)}/activity?limit=200`;
  }, [activitiesApiUrl, projectId]);
  const setIsOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (!isOpen || !projectId || currentProject?.id === projectId) {
      return;
    }

    loadProject(projectId);
  }, [currentProject?.id, isOpen, loadProject, projectId]);

  const tabs = useMultiSheetReviewTabs({
    currentProject,
    currentSheetSlug,
    layoutPages,
  });

  const controller = useMultiSheetBrandReviewController({
    projectId,
    isOpen,
    tabs,
    preferredSheetSlug: currentSheetSlug,
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
    isSavingBrandSchema,
    activeIndex,
    activeTab,
    activeResources,
    activeBrandSchema,
    activeBrandRowIds,
    resourceMap,
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

  // Build the flat list of all loaded schemas for cross-sheet search
  const allBrandSchemas = useMemo(
    () =>
      tabs
        .map((tab) => {
          const schema = resourceMap[tab.slug]?.brandSchema;
          if (!schema) return null;
          return { slug: tab.slug, name: tab.name, schema };
        })
        .filter((s): s is { slug: string; name: string; schema: NonNullable<typeof s>["schema"] } => s !== null),
    [resourceMap, tabs],
  );

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
    defaultWorkspaceMode: workspaceMode,
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

  useEffect(() => {
    if (!isOpen) {
      autoStartedRef.current = false;
      setStandardViewMode("wire-list");
      setIsImportReviewHydrating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setStandardViewMode("wire-list");
  }, [activeSlug]);

  // Auto-hydrate import diffs when modal re-opens with a pending import session
  // This handles the case where parent re-renders cause the local state to reset
  useEffect(() => {
    if (modalSurface !== "import-review") {
      setIsImportReviewHydrating(false);
    }

    if (
      isOpen &&
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
  }, [isOpen, modalSurface, importSession, importSheetDiffs.length, hydrateImportReview, setModalSurface]);

  const importReviewLocked = modalSurface === "import-review" && (isImportReviewHydrating || isApplyingImport);

  useEffect(() => {
    if (!isOpen || !projectId) {
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
  }, [isOpen, layoutPreviewOpen, projectId, standardViewMode]);

  const isWireListMode = activeWorkspaceMode === "wire-list";
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
    resourceMap,
  });

  // Derive activeNavigationItem and reviewWorkspaceLocked after navigationItems is available
  const activeNavigationItem = activeSlug
    ? navigationItems.find((item) => item.slug === activeSlug) ?? null
    : null;
  
  // Auto-select the first valid sheet if activeSlug doesn't exist in navigationItems
  // This can happen when a sheet has no external locations and gets filtered out
  useEffect(() => {
    if (
      modalSurface === "review" &&
      activeSlug &&
      !activeNavigationItem &&
      navigationItems.length > 0
    ) {
      // The current activeSlug points to a filtered-out sheet, select the first valid one
      setActiveSlug(navigationItems[0].slug);
    }
  }, [modalSurface, activeSlug, activeNavigationItem, navigationItems, setActiveSlug]);
  
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

  useEffect(() => {
    if (
      !isOpen ||
      !autoStartReview ||
      autoStartedRef.current ||
      modalSurface !== "cover" ||
      currentProject?.id !== projectId ||
      tabs.length === 0
    ) {
      return;
    }

    autoStartedRef.current = true;
    void beginReviewSurface(autoStartReadOnly);
  }, [
    autoStartReadOnly,
    autoStartReview,
    beginReviewSurface,
    currentProject?.id,
    isOpen,
    modalSurface,
    projectId,
    tabs.length,
  ]);

  // Auto-start import: trigger file picker immediately when modal opens with autoStartImport
  useEffect(() => {
    if (!isOpen) {
      autoImportTriggeredRef.current = false;
      return;
    }

    if (
      !autoStartImport ||
      autoImportTriggeredRef.current ||
      !fileInputRef.current
    ) {
      return;
    }

    // Use a small delay to ensure modal is fully mounted
    const timer = setTimeout(() => {
      autoImportTriggeredRef.current = true;
      onImportStarted?.();
      fileInputRef.current?.click();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, autoStartImport, onImportStarted]);

  const headerTitle =
    modalSurface === "cover"
      ? title
      : modalSurface === "import-review"
        ? "Imported Brand List Review"
        : isWireListMode
          ? "Standard Wire List Review"
          : title;

  const headerDescription =
    modalSurface === "cover"
      ? "Choose how to enter the multi-sheet review flow."
      : modalSurface === "import-review"
        ? "Compare the imported workbook against the saved schemas before applying changes."
        : isWireListMode
          ? "Browse each standard wire list sheet with its original-sidebar context and layout reference."
          : description;

  const activeAssignment =
    activeSlug && currentProject?.assignments
      ? currentProject.assignments[activeSlug]
      : undefined;

  const workspaceSkeleton = useMemo(
    () => buildWorkspaceSkeleton(isWireListMode),
    [isWireListMode],
  );

  const lastWorkflowLogSignatureRef = useRef<string | null>(null);

  const logBrandingWorkflowActivity = useCallback(async (
    workflow: "brandlist" | "branding",
    milestone: string,
    action: "STARTED" | "COMPLETED",
    exportResult?: MultiSheetPrintExportResult,
  ) => {
    if (!projectId || !user?.badge) {
      return;
    }

    const logSignature = `${projectId}:${workflow}:${milestone}:${action}`;
    if (lastWorkflowLogSignatureRef.current === logSignature) {
      return;
    }

    const shift = user.currentShift ?? "1st";

    const automatedFollowUps =
      action === "COMPLETED" && milestone === "complete"
        ? [
            exportResult?.brandingWorkbook
              ? {
                  kind: "combined-brand-list-workbook",
                  label: "Multi-sheet brand list workbook",
                  fileName: exportResult.brandingWorkbook.fileName,
                  relativePath: exportResult.brandingWorkbook.relativePath,
                }
              : null,
            exportResult?.wireListSchema
              ? {
                  kind: "combined-wire-list-export",
                  label: "Combined wire list export",
                  fileName: exportResult.wireListSchema.fileName,
                  relativePath: exportResult.wireListSchema.relativePath,
                }
              : null,
          ].filter(Boolean)
        : [];

    try {
      const latestForProject = await activityService.getActivity(user.badge, shift, {
        projectIds: [projectId],
        limit: 1,
      });
      const latest = latestForProject[0];
      const latestMetadata = (latest?.metadata ?? {}) as Record<string, unknown>;
      const latestWorkflow =
        typeof latestMetadata.workflow === "string" ? latestMetadata.workflow : "";
      const latestMilestone =
        typeof latestMetadata.milestone === "string" ? latestMetadata.milestone : "";

      if (
        latest &&
        latest.action === action &&
        latest.projectId === projectId &&
        latestWorkflow === workflow &&
        latestMilestone === milestone
      ) {
        lastWorkflowLogSignatureRef.current = logSignature;
        return;
      }
    } catch {
      // Continue and best-effort log on read failures.
    }

    try {
      await activityService.logAction(user.badge, shift, {
        action,
        projectId,
        performedBy: user.badge,
        result: "success",
        metadata: {
          projectId,
          projectName: currentProject?.name ?? "",
          pdNumber: currentProject?.pdNumber ?? "",
          projectColor: currentProject?.color ?? "",
          workflow,
          milestone,
          automatedFollowUps,
        },
      });
      lastWorkflowLogSignatureRef.current = logSignature;
    } catch {
      // Activity logging should never block review flow.
    }
  }, [currentProject?.name, currentProject?.pdNumber, projectId, user?.badge, user?.currentShift]);

  const handleContinueFromCoverWithActivity = useCallback(async () => {
    await logBrandingWorkflowActivity(
      "brandlist",
      coverActionLabel === "Start" ? "start" : "continue",
      "STARTED",
    );

    await handleContinueFromCover();
  }, [coverActionLabel, handleContinueFromCover, logBrandingWorkflowActivity]);

  const handleImportFromCoverWithActivity = useCallback(async () => {
    await logBrandingWorkflowActivity("brandlist", "import", "STARTED");
    await handleImportFromCover();
  }, [handleImportFromCover, logBrandingWorkflowActivity]);

  const handleOpenTutorialWithActivity = useCallback(() => {
    void logBrandingWorkflowActivity("brandlist", "tutorial", "STARTED");
    setTutorialOpen(true);
  }, [logBrandingWorkflowActivity]);

  const handleSaveAndContinueLater = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleCloseModalWithActivity = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleOpenLoginWithActivity = useCallback(() => {
    void logBrandingWorkflowActivity("brandlist", "login", "STARTED");
    setLoginOpen(true);
  }, [logBrandingWorkflowActivity]);

  const handleConfirmApproveFlow = useCallback(async () => {
    if (!activeSlug) {
      return;
    }

    const isFinalSheet = approvedSlugs.includes(activeSlug)
      ? approvedSlugs.length >= navigationItems.length
      : approvedSlugs.length + 1 >= navigationItems.length;

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
        const exportResult = await handleCombine();
        await logBrandingWorkflowActivity("brandlist", "complete", "COMPLETED", exportResult);
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
    setGenerationMessage,
    setGenerationStatus,
    setModalSurface,
    tabs,
  ]);

  const handleApproveFlow = useCallback(() => {
    // Skip modal confirmation and directly execute approval
    void handleConfirmApproveFlow();
  }, [handleConfirmApproveFlow]);

  const handleCombineFlow = useCallback(async () => {
    setReviewSequencePhase("processing");
    setReviewSequenceMessage("Combining approved sheets and preparing your workbook...");
    setReviewSequenceOpen(true);

    try {
      const exportResult = await handleCombine();
      await logBrandingWorkflowActivity("brandlist", "complete", "COMPLETED", exportResult);
      setReviewSequencePhase("complete");
    } catch {
      setReviewSequenceOpen(false);
    }
  }, [handleCombine, logBrandingWorkflowActivity]);

  const handleUnapproveWithActivity = useCallback(async () => {
    await handleUnapproveSheet();
  }, [handleUnapproveSheet]);

  return (
    <>
      {showTrigger ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!projectId}
          onClick={() => setIsOpen(true)}
          title={
            projectId
              ? "Review and approve multiple print sheets"
              : "Project context required"
          }
        >
          <Layers3 className="h-4 w-4" />
          <span className="hidden sm:inline">Multi-Sheet</span>
        </Button>
      ) : null}

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={handleSaveAndContinueLater}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-0 z-50 pointer-events-none"
            >
              <div className="pointer-events-auto flex h-screen w-screen flex-col overflow-hidden border-0 bg-background shadow-2xl">
                <MultiSheetReviewHeaderBar
                  surface={modalSurface}
                  workspaceMode={activeWorkspaceMode}
                  standardViewMode={standardViewMode}
                  title={headerTitle}
                  description={headerDescription}
                  approvedCount={approvedSlugs.length}
                  totalCount={navigationItems.length}
                  showStandardViewToggle={Boolean(activeWorkspaceMode === "wire-list" && activeTab?.pageNumber && layoutPdfUrl && layoutIndex)}
                  onOpenStateReview={() => setStateReviewOpen(true)}
                  onSetWorkspaceMode={setActiveWorkspaceMode}
                  onSetStandardViewMode={setStandardViewMode}
                  onBackToCover={() => setModalSurface("cover")}
                  onOpenTutorial={() => setTutorialOpen(true)}
                  onSaveAndContinueLater={handleSaveAndContinueLater}
                  onClose={handleSaveAndContinueLater}
                />

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
                    onSaveAndContinueLater={handleSaveAndContinueLater}
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
                    activeSheetSlug={
                      importSession?.activeSheetSlug ?? activeSlug
                    }
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
                    allBrandSchemas={allBrandSchemas}
                    activeBrandRowIds={activeBrandRowIds}
                    activeSheetSwsType={
                      typeof activeAssignment?.swsType === "string"
                        ? activeAssignment.swsType
                        : null
                    }
                    projectId={projectId}
                    projectName={currentProject?.name ?? null}
                    projectNumber={currentProject?.pdNumber ?? null}
                    projectRevision={currentProject?.revision ?? null}
                    projectColor={currentProject?.color ?? null}
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
                    combineLabel={combineLabel}
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
                    onSelectAll={() =>
                      setSelectedBrandRows(new Set(activeBrandRowIds))
                    }
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
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

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
        remainingCount={Math.max(navigationItems.length - approvedSlugs.length, 0)}
        isFinalSheet={
          Boolean(activeSlug) &&
          (activeSlug && approvedSlugs.includes(activeSlug)
            ? approvedSlugs.length >= navigationItems.length
            : approvedSlugs.length + 1 >= navigationItems.length)
        }
        processingMessage={reviewSequenceMessage}
        downloadHref={exportReadyHref}
        onOpenChange={setReviewSequenceOpen}
        onConfirm={() => void handleConfirmApproveFlow()}
        onExit={() => {
          setReviewSequenceOpen(false);
          handleCloseModalWithActivity();
        }}
        onReturnToCover={() => {
          setReviewSequenceOpen(false);
          setModalSurface("cover");
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.xlsb"
        className="hidden"
        onChange={(event) => void handleImportFileChange(event)}
      />

      <MultiSheetReviewTutorialDialog
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
      />
      <LoginPopup open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
