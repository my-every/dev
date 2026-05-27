"use client";

import { useMemo } from "react";

import type { MultiSheetNavigationItem } from "@/components/wire-list/multi-sheet-review-types";
import type {
  MultiSheetPrintExportResult,
  MultiSheetPrintSheetReview,
  MultiSheetTabItem,
  LoadedSheetResources,
} from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import type {
  MultiSheetImportSession,
  MultiSheetImportSheetDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";

function formatReviewTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildExportHref(projectId: string | undefined, relativePath?: string) {
  if (!projectId || !relativePath) {
    return null;
  }

  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const encodedSegments = normalizedRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}?download=1`;
}

/**
 * Check if a print schema has external locations by looking at the TOC page's locationGroups.
 * This matches the logic used in project-details-workspace.tsx for determining which sheets
 * have external locations and should appear in the Brand Lists section.
 */
function schemaHasExternalLocations(resources: LoadedSheetResources | undefined): boolean {
  const printSchema = resources?.printSchema;
  if (!printSchema?.pages) return false;
  const tocPage = printSchema.pages.find((p: { pageType: string }) => p.pageType === "toc");
  if (!tocPage) return false;
  const locationGroups = (tocPage as { locationGroups?: Array<{ location: string; isExternal: boolean }> }).locationGroups;
  if (!locationGroups) return false;
  return locationGroups.some((g) => g.isExternal === true);
}

export function useMultiSheetStatusChecks(options: {
  tabs: MultiSheetTabItem[];
  activeSlug: string | null;
  approvedSlugs: string[];
  editedAfterApprovalSlugs: string[];
  sheetReviews: Record<string, MultiSheetPrintSheetReview>;
  reviewState: {
    allApproved: boolean;
    brandingWorkbookReady: boolean;
  };
  importSession: MultiSheetImportSession | null;
  importSheetDiffs: MultiSheetImportSheetDiff[];
  exportResult: MultiSheetPrintExportResult | null;
  projectId?: string;
  /** Resource map with loaded brand schemas - used to determine which sheets have external locations */
  resourceMap?: Record<string, LoadedSheetResources>;
}) {
  const {
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
  } = options;

  const latestReview = useMemo(() => {
    const reviews = Object.values(sheetReviews).sort(
      (a, b) =>
        new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
    );
    return reviews[0] ?? null;
  }, [sheetReviews]);

  const latestReviewLabel =
    latestReview?.reviewedByName || latestReview?.reviewedByBadge || null;
  const latestReviewDescription = latestReview
    ? `Last approved at ${formatReviewTime(latestReview.reviewedAt) ?? "an unknown time"}.`
    : "Start with a clean review or import an existing workbook.";

  const navigationItems = useMemo<MultiSheetNavigationItem[]>(
    () =>
      tabs
        .filter((tab) => {
          // Check if the loaded print schema has external locations
          // This is the authoritative source (matches project details page behavior)
          const resources = resourceMap?.[tab.slug];
          if (resources?.printSchema) {
            return schemaHasExternalLocations(resources);
          }
          // Fall back to the manifest-based check if schema not yet loaded
          return tab.hasExternalLocations;
        })
        .map((tab) => {
          const review = sheetReviews[tab.slug];
          const reviewTime = formatReviewTime(review?.reviewedAt);
          return {
            ...tab,
            isActive: tab.slug === activeSlug,
            isApproved: approvedSlugs.includes(tab.slug),
            wasEditedAfterApproval: editedAfterApprovalSlugs.includes(tab.slug),
            reviewLabel: review
              ? `${review.reviewedByName || review.reviewedByBadge || "Reviewed"}${reviewTime ? ` · ${reviewTime}` : ""}`
              : null,
          };
        }),
    [activeSlug, approvedSlugs, editedAfterApprovalSlugs, resourceMap, sheetReviews, tabs],
  );

  const canViewCompletedReview =
    reviewState.allApproved && reviewState.brandingWorkbookReady;
  const coverActionLabel = canViewCompletedReview
    ? "View"
    : approvedSlugs.length > 0 || importSession
      ? "Continue"
      : "Start";

  const pendingImportCount = useMemo(
    () =>
      importSheetDiffs.reduce((sum, sheetDiff) => {
        const decisions = importSession?.rowDecisions ?? {};
        return (
          sum +
          sheetDiff.diffs.filter(
            (diff) =>
              diff.changeType !== "unchanged" &&
              (decisions[diff.diffId] ?? "pending") === "pending",
          ).length
        );
      }, 0),
    [importSession?.rowDecisions, importSheetDiffs],
  );

  const exportReadyHref = useMemo(
    () => buildExportHref(projectId, exportResult?.brandingWorkbook?.relativePath),
    [exportResult?.brandingWorkbook?.relativePath, projectId],
  );

  const wireListSchemaHref = useMemo(
    () => buildExportHref(projectId, exportResult?.wireListSchema?.relativePath),
    [exportResult?.wireListSchema?.relativePath, projectId],
  );

  return {
    latestReviewLabel,
    latestReviewDescription,
    navigationItems,
    canViewCompletedReview,
    coverActionLabel,
    pendingImportCount,
    exportReadyHref,
    wireListSchemaHref,
  };
}
