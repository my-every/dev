"use client";

import { BookOpen, ChevronLeft, Info, Printer, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MultiSheetModalSurface, MultiSheetWorkspaceMode } from "@/components/wire-list/multi-sheet-review-types";

interface MultiSheetReviewHeaderBarProps {
  surface: MultiSheetModalSurface;
  workspaceMode: MultiSheetWorkspaceMode;
  standardViewMode?: "wire-list" | "layout";
  title: string;
  description: string;
  approvedCount: number;
  totalCount: number;
  showStandardViewToggle?: boolean;
  onOpenStateReview: () => void;
  onSetWorkspaceMode: (mode: MultiSheetWorkspaceMode) => void;
  onSetStandardViewMode?: (mode: "wire-list" | "layout") => void;
  onBackToCover?: () => void;
  onOpenTutorial: () => void;
  onClose: () => void;
}

export function MultiSheetReviewHeaderBar({
  surface,
  workspaceMode,
  standardViewMode = "wire-list",
  title,
  description,
  approvedCount,
  totalCount,
  showStandardViewToggle = false,
  onOpenStateReview,
  onSetWorkspaceMode,
  onSetStandardViewMode,
  onBackToCover,
  onOpenTutorial,
  onClose,
}: MultiSheetReviewHeaderBarProps) {
  const isReviewSurface = surface === "review";
  const isWireListMode = workspaceMode === "wire-list";

  return (
    <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-foreground/70" />
          <h2 className="text-lg font-semibold truncate">{title}</h2>
          {isReviewSurface && !isWireListMode ? (
            <Badge variant="secondary" className="text-xs">
              {approvedCount}/{totalCount} approved
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {surface !== "cover" && onBackToCover ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={onBackToCover}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Cover
          </Button>
        ) : null}
        {isReviewSurface ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              data-tour="multi-sheet-review-state"
              onClick={onOpenStateReview}
            >
              <Info className="h-4 w-4" />
              Review
            </Button>
            <div className="rounded-xl border bg-background p-1" data-tour="multi-sheet-mode-toggle">
              <Button
                type="button"
                size="md"
                variant={!isWireListMode ? "secondary" : "ghost"}
                className="h-8 px-3"
                onClick={() => onSetWorkspaceMode("print")}
              >
                Brand
              </Button>
              <Button
                type="button"
                size="md"
                variant={isWireListMode ? "secondary" : "ghost"}
                className="h-8 px-3"
                onClick={() => onSetWorkspaceMode("wire-list")}
              >
                Standard
              </Button>
            </div>
            {showStandardViewToggle ? (
              <div className="rounded-xl border bg-background p-1">
                <Button
                  type="button"
                  size="md"
                  variant={standardViewMode === "wire-list" ? "secondary" : "ghost"}
                  className="h-8 px-3"
                  onClick={() => onSetStandardViewMode?.("wire-list")}
                >
                  Wire List
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant={standardViewMode === "layout" ? "secondary" : "ghost"}
                  className="h-8 px-3"
                  onClick={() => onSetStandardViewMode?.("layout")}
                >
                  PDF
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
