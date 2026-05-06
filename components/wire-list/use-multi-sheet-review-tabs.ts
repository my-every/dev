"use client";

import { useMemo } from "react";

import type { MultiSheetTabItem } from "@/components/wire-list/use-multi-sheet-brand-review-controller";
import type { SlimLayoutPage } from "@/lib/layout-matching";
import { resolveLayoutPreviewPage } from "@/lib/layout-matching/resolve-layout-preview";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import type { ProjectManifest } from "@/types/project-manifest";

export function useMultiSheetReviewTabs(options: {
  currentProject?: ProjectManifest | null;
  currentSheetSlug?: string;
  layoutPages: SlimLayoutPage[];
}) {
  const { currentProject, currentSheetSlug, layoutPages } = options;

  return useMemo<MultiSheetTabItem[]>(() => {
    const assignments = currentProject?.assignments ?? {};
    const operationalSheets =
      currentProject?.sheets.filter((sheet) => sheet.kind === "operational") ??
      [];

    const items = operationalSheets.map((sheet) => {
      const assignment = assignments[sheet.slug] as
        | {
            layout?:
              | {
                  primaryPage?: {
                    pageNumber?: number;
                    title?: string;
                    confidence?: string;
                    matchMethod?: string;
                  };
                  pages?: Array<{
                    pageNumber?: number;
                    title?: string;
                    confidence?: string;
                    matchMethod?: string;
                  }>;
                }
              | string
              | null;
          }
        | undefined;
      const assignmentLayout =
        assignment?.layout && typeof assignment.layout === "object"
          ? assignment.layout
          : undefined;
      const candidatePage =
        assignmentLayout?.primaryPage ?? assignmentLayout?.pages?.[0];
      const primaryPage =
        candidatePage &&
        candidatePage.confidence !== "low" &&
        candidatePage.matchMethod !== "fallback"
          ? candidatePage
          : undefined;
      const resolvedPage = resolveLayoutPreviewPage({
        pages: layoutPages,
        matchedPageNumber: primaryPage?.pageNumber,
        matchedPageTitle: primaryPage?.title,
        sheetName: sheet.name,
        sheetSlug: sheet.slug,
      });

      return {
        slug: sheet.slug,
        name: normalizeDisplayTitle(sheet.name),
        rowCount: sheet.rowCount,
        pageNumber: resolvedPage?.pageNumber ?? primaryPage?.pageNumber,
        pageTitle: normalizeDisplayTitle(resolvedPage?.title ?? primaryPage?.title ?? sheet.name),
        imageUrl: resolvedPage?.imageUrl,
        resolvedPage,
      };
    });

    items.sort((a, b) => {
      if (a.slug === currentSheetSlug) return -1;
      if (b.slug === currentSheetSlug) return 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [currentProject?.assignments, currentProject?.sheets, currentSheetSlug, layoutPages]);
}
