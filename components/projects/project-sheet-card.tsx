"use client";

/**
 * Individual sheet card component.
 * 
 * Displays summary information about a single sheet and
 * provides navigation to the sheet detail page.
 * Optionally shows a layout cover image when available.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LayoutTemplate } from "lucide-react";
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectSheetSummary } from "@/lib/workbook/types";
import { getSheetRoutePath } from "@/hooks/use-sheet-route";
import type { LayoutPagePreview, SheetLayoutMatch } from "@/lib/layout-matching";
import { LayoutPreviewModal } from "./layout-preview-modal";

interface ProjectSheetCardProps {
  sheet: ProjectSheetSummary;
  projectId: string;
  index: number;
  layoutPage?: LayoutPagePreview;
  layoutMatch?: SheetLayoutMatch;
}

// Check if name contains comma with JB# pattern (e.g., "DOOR,JB70" or "FIRE PNL,JB70")
function hasJBPattern(name: string): boolean {
  return /,\s*JB\d+/i.test(name);
}

export function ProjectSheetCard({
  sheet,
  projectId,
  index,
  layoutPage,
  layoutMatch,
}: ProjectSheetCardProps) {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const routePath = getSheetRoutePath(projectId, sheet.slug);
  const layoutWorkspaceEndpoint = `/api/projects/${encodeURIComponent(projectId)}/layout-pdf`;

  // Format title as uppercase
  const displayName = sheet.name.toUpperCase();
  const showJBBox = hasJBPattern(sheet.name);

  // Check if we have a layout preview available
  const hasLayoutPreview = layoutPage && layoutMatch && layoutMatch.confidence !== "unmatched";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="group relative pt-0 gap-0  overflow-hidden bg-card/50 border-border/50 transition-all">
        {/* Layout Cover Image (when available) */}
        {hasLayoutPreview && layoutPage && layoutMatch && (
          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex w-full items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Layout Workspace
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {layoutPage.title || `Page ${layoutPage.pageNumber}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Page {layoutPage.pageNumber}
              </Badge>
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        )}



        <h3 className="font-semibold p-4 leading-tight text-foreground line-clamp-2">
          {displayName}
        </h3>

        {/* No data indicator */}
        {!sheet.hasData && (
          <div className="mt-3 text-xs text-muted-foreground">
            This sheet contains no data rows.
          </div>
        )}

        <CardFooter className="px-4 ">
          <Link href={routePath} className="text-sm bg-secondary p-2 rounded-lg justify-between w-full font-medium text-foreground hover:underline inline-flex items-center gap-1">
            {sheet.kind === "reference" ? "Open List" : "Open Assignment"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </CardFooter>
      </Card>

      {/* Layout Preview Modal */}
      {hasLayoutPreview && layoutPage && (
        <LayoutPreviewModal
          endpoint={layoutWorkspaceEndpoint}
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
        />
      )}
    </motion.div>
  );
}
