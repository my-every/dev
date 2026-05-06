"use client";

/**
 * ProjectSheetSubheader
 *
 * Unified header for the sheet detail page. Combines:
 * - Breadcrumb navigation
 * - Sheet title + wire row / column counts
 * - Layout cover image (object-top so the drawing header is always visible)
 * - Project metadata (merged into the same visual card)
 *
 * Responsive: stacks vertically on small screens, side-by-side on md+.
 * Revision-aware: accepts layout page/match as props so it stays in sync
 * when the active revision changes in the sidebar.
 */

import { useState, type ReactNode } from "react";
import {
  FileImage,
  LayoutTemplate,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  ProjectModel,
  ProjectSheetSummary,
  SheetMetadataInfo,
} from "@/lib/workbook/types";
import type { ProjectManifest, ManifestSheetEntry } from "@/types/project-manifest";
import type { LayoutPagePreview, SheetLayoutMatch } from "@/lib/layout-matching";
import { LayoutPreviewModal } from "@/components/projects/layout-preview-modal";
import { resolveLayoutPreviewPage } from "@/lib/layout-matching/resolve-layout-preview";

// ============================================================================
// Props
// ============================================================================

interface ProjectSheetSubheaderProps {
  project: ProjectModel | ProjectManifest;
  sheet: ProjectSheetSummary | ManifestSheetEntry;
  /** Current revision-aware layout page */
  layoutPage?: LayoutPagePreview | null;
  /** Current revision-aware layout match */
  layoutMatch?: SheetLayoutMatch | null;
  /** All rendered layout pages (for the full-screen modal) */
  allPages?: LayoutPagePreview[];
  /** Extracted metadata from the sheet preamble */
  metadata?: SheetMetadataInfo;
  /** Optional SWS type badge info */
  swsType?: { label: string; shortLabel: string; color: string } | null;
  /** Active revision label (shown when viewing a non-current revision) */
  activeRevisionLabel?: string;
  /** Override row count when viewing a different revision */
  activeRowCount?: number;
  /** Optional action area rendered in the header */
  headerActions?: ReactNode;
}

// ============================================================================
// Metadata labels
// ============================================================================

const META_LABELS: Record<string, string> = {
  projectNumber: "Project #",
  projectName: "Project",
  revision: "Rev",
  controlsDE: "Controls DE",
  phone: "Phone",
  from: "From",
};

// ============================================================================
// Component
// ============================================================================

export function ProjectSheetSubheader({
  project,
  sheet,
  layoutPage,
  layoutMatch,
  allPages,
  metadata,
  swsType,
  activeRevisionLabel,
  activeRowCount,
  headerActions,
}: ProjectSheetSubheaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const layoutWorkspaceEndpoint = "id" in project
    ? `/api/projects/${encodeURIComponent(project.id)}/layout-pdf`
    : null;

  const resolvedLayoutPage = layoutPage ?? resolveLayoutPreviewPage({
    pages: allPages ?? [],
    matchedPageNumber: layoutMatch?.pageNumber,
    matchedPageTitle: layoutMatch?.pageTitle,
    sheetName: sheet.name,
    sheetSlug: "slug" in sheet ? sheet.slug : undefined,
  });

  const modalPages = (allPages && allPages.length > 0)
    ? allPages
    : resolvedLayoutPage
      ? [resolvedLayoutPage]
      : [];

  // Merge project-level + sheet-level metadata
  const metaEntries = metadata
    ? Object.entries(metadata).filter(
      ([key, value]) => !key.startsWith("_") && value !== undefined && value !== "",
    )
    : [];

  // Fall back to project model fields when sheet metadata is missing
  if (!metaEntries.find(([k]) => k === "projectName") && project.name) {
    metaEntries.unshift(["projectName", project.name]);
  }
  if (!metaEntries.find(([k]) => k === "revision") && project.revision) {
    metaEntries.unshift(["revision", project.revision]);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
    
        {/* Combined card: cover image + info */}
        <Card className="overflow-hidden my-2 p-0">
          <div className="flex flex-col md:flex-row">
            {/* Layout cover image — flex-start so top of drawing is visible */}
            {resolvedLayoutPage ? (
              <div
                className="relative w-full md:w-80 lg:w-96 flex-shrink-0 cursor-pointer group"
                onClick={() => setIsModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsModalOpen(true);
                  }
                }}
              >
                <div className="flex h-44 min-h-[11rem] flex-col justify-between bg-muted px-4 py-4 md:h-full">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Layout Workspace
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-foreground">
                      {resolvedLayoutPage.title || `Page ${resolvedLayoutPage.pageNumber}`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the PDF workspace for text search, highlights, and navigation.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                    >
                      Page {resolvedLayoutPage.pageNumber}
                    </Badge>
                    <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ) : (
              /* No layout placeholder */
              <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex items-center justify-center bg-muted/40 p-6 min-h-[8rem]">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileImage className="h-8 w-8 opacity-30" />
                  <span className="text-xs">No layout preview</span>
                </div>
              </div>
            )}

            {/* Right side: sheet info + project metadata */}
            <div className="flex flex-1 flex-col justify-between gap-4 p-4 md:p-5 min-w-0">
              {/* Top: sheet identity */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground leading-tight">
                      {sheet.name}
                    </h1>
                    {swsType && (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: swsType.color,
                          color: swsType.color,
                        }}
                      >
                        {swsType.shortLabel}
                      </Badge>
                    )}
                    {activeRevisionLabel && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        Rev {activeRevisionLabel}
                      </Badge>
                    )}
                  </div>
                  {headerActions ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {headerActions}
                    </div>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {(activeRowCount ?? sheet.rowCount).toLocaleString()} wire rows
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  {sheet.columnCount} columns
                </p>
              </div>

              {/* Bottom: merged project metadata */}
              {metaEntries.length > 0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 border-t border-border pt-3">
                  {metaEntries.map(([key, value]) => (
                    <div key={key} className="flex items-baseline gap-1.5 min-w-0">
                      <dt className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {META_LABELS[key] || key}:
                      </dt>
                      <dd className="text-sm font-medium text-foreground truncate">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Layout Preview Modal */}
      {modalPages.length > 0 && (
        <LayoutPreviewModal
          endpoint={layoutWorkspaceEndpoint}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
