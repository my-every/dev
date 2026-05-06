"use client";

import { ChevronLeft, ChevronRight, Copy, Download, Loader2, Minus, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MultiSheetReviewFooterActionsProps {
  isWireListMode: boolean;
  activeIndex: number;
  totalCount: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  reviewReadOnly: boolean;
  selectedCount: number;
  canSelectAll: boolean;
  canEditSelected: boolean;
  canApproveCurrent: boolean;
  isCurrentApproved: boolean;
  isCombining: boolean;
  canCombine: boolean;
  combineLabel: string;
  canApproveAll?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelectAll: () => void;
  onIncrement: (delta: number) => void;
  onDuplicate: () => void;
  onClearSelection: () => void;
  onOpenCurrentPdf: () => void;
  onDownloadAllWireLists?: () => void;
  onApprove: () => void;
  onApproveAll?: () => void;
  onUnapprove: () => void;
  onCombine: () => void;
}

export function MultiSheetReviewFooterActions(props: MultiSheetReviewFooterActionsProps) {
  const {
    isWireListMode,
    activeIndex,
    totalCount,
    canGoPrevious,
    canGoNext,
    reviewReadOnly,
    selectedCount,
    canSelectAll,
    canEditSelected,
    canApproveCurrent,
    isCurrentApproved,
    isCombining,
    canCombine,
    combineLabel,
    canApproveAll = false,
    onPrevious,
    onNext,
    onSelectAll,
    onIncrement,
    onDuplicate,
    onClearSelection,
    onOpenCurrentPdf,
    onDownloadAllWireLists,
    onApprove,
    onApproveAll,
    onUnapprove,
    onCombine,
  } = props;

  return (
    <div className="relative border-t bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 z-40" data-tour="multi-sheet-footer-actions">
      {/* Left: step counter */}
      <div className="text-sm text-muted-foreground shrink-0">
        {isWireListMode ? "Viewing" : "Step"} {Math.max(activeIndex + 1, 1)} of {Math.max(totalCount, 1)}
      </div>

      {/* Centre: pill group (absolutely centred so it never shifts) */}
      {!isWireListMode ? (
        <div className="absolute left-1/2 -translate-x-1/2 flex max-w-full flex-wrap items-center gap-1 rounded-2xl border bg-card p-1 shadow-sm">
          <Badge variant={selectedCount > 0 ? "default" : "secondary"} className="h-8 rounded-xl">
            {selectedCount} selected
          </Badge>
          <Button type="button" variant="ghost" size="sm" className="h-8" disabled={!canSelectAll || reviewReadOnly} onClick={onSelectAll}>
            Select All
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" disabled={!canEditSelected || reviewReadOnly} onClick={() => onIncrement(10)}>
            <Plus className="h-3.5 w-3.5" />
            10
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" disabled={!canEditSelected || reviewReadOnly} onClick={() => onIncrement(-10)}>
            <Minus className="h-3.5 w-3.5" />
            10
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" disabled={!canEditSelected || reviewReadOnly} onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" disabled={!canEditSelected || reviewReadOnly} onClick={onClearSelection}>
            Clear
          </Button>
          {isCurrentApproved ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
              disabled={reviewReadOnly}
              onClick={onUnapprove}
            >
              <X className="h-3.5 w-3.5" />
              Unapprove
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-green-600 hover:text-white bg-green-500/10 hover:bg-green-500 disabled:opacity-40"
              disabled={!canApproveCurrent || reviewReadOnly}
              onClick={onApprove}
            >
              Approve
            </Button>
          )}
          {!isCurrentApproved && canApproveAll && onApproveAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-amber-600 hover:text-white bg-amber-500/10 hover:bg-amber-500 disabled:opacity-40"
              disabled={reviewReadOnly}
              onClick={onApproveAll}
            >
              Approve All
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Right: navigation + combine */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <Button variant="outline" onClick={onPrevious} disabled={!canGoPrevious}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {isWireListMode ? (
          <>
            <Button variant="secondary" onClick={onOpenCurrentPdf}>
              <Download className="mr-2 h-4 w-4" />
              Current Wire List PDF
            </Button>
            <Button variant="secondary" onClick={onDownloadAllWireLists}>
              <Download className="mr-2 h-4 w-4" />
              Download All Wirelists
            </Button>
          </>
        ) : null}
        <Button variant="outline" onClick={onNext} disabled={!canGoNext}>
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
        {!isWireListMode ? (
          <Button onClick={onCombine} disabled={!canCombine}>
            {isCombining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Combining...
              </>
            ) : (
              combineLabel
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
