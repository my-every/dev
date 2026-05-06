"use client";

import { CheckCircle2, Download, Layers3, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MultiSheetNavigationItem } from "@/components/wire-list/multi-sheet-review-types";

type SequencePhase = "confirm" | "processing" | "complete";

interface MultiSheetReviewSequenceDialogProps {
  open: boolean;
  phase: SequencePhase;
  items: MultiSheetNavigationItem[];
  approvedCount: number;
  activeSheetName: string | null;
  activeSheetRowCount: number;
  remainingCount: number;
  isFinalSheet: boolean;
  processingMessage: string;
  downloadHref?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onExit: () => void;
  onReturnToCover: () => void;
}

export function MultiSheetReviewSequenceDialog({
  open,
  phase,
  items,
  approvedCount,
  activeSheetName,
  activeSheetRowCount,
  remainingCount,
  isFinalSheet,
  processingMessage,
  downloadHref,
  onOpenChange,
  onConfirm,
  onExit,
  onReturnToCover,
}: MultiSheetReviewSequenceDialogProps) {
  const title =
    phase === "complete"
      ? "Brand List Export Ready"
      : isFinalSheet
        ? "Finalize Brand List Review"
        : "Approve and Continue";

  const description =
    phase === "complete"
      ? "The combined brand list workbook is ready. You can download it now, return to the cover page, or exit the review."
      : phase === "processing"
        ? processingMessage
        : isFinalSheet
          ? "This is the final sheet in the review flow. Confirm to approve it and finalize the combined workbook."
          : "Confirm this sheet approval and continue to the next page in the guided review flow.";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (phase === "processing" && !nextOpen) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="flex max-h-[85dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-2xl"
        showCloseButton={phase !== "processing"}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {phase === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border bg-muted/20 px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div>
                <div className="text-lg font-semibold">{processingMessage}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  We are saving review state, moving through the workflow, and preparing the next surface.
                </div>
              </div>
            </div>
          ) : phase === "complete" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">All sheets reviewed and combined</div>
                  <div className="text-sm text-emerald-800/80">
                    {items.length} sheets are now part of the latest combined brand list workbook.
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Sheets" value={`${items.length}`} />
                <Metric label="Approved" value={`${approvedCount}/${items.length}`} />
                <Metric label="Remaining" value="0" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Sheets" value={`${items.length}`} />
                <Metric label="Approved" value={`${approvedCount}/${items.length}`} />
                <Metric label="Remaining" value={`${Math.max(remainingCount - 1, 0)}`} />
              </div>
              <div className="rounded-3xl border bg-muted/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Sheet</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="text-xl font-semibold">{activeSheetName ?? "Unknown sheet"}</div>
                  <Badge variant="secondary">{activeSheetRowCount} rows</Badge>
                </div>
              </div>
              <div className="rounded-3xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Layers3 className="h-4 w-4" />
                  Review Progress
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.slug} className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{item.name}</span>
                      <Badge variant={item.isApproved ? "default" : "secondary"}>
                        {item.isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === "complete" ? (
            <>
              <Button type="button" variant="outline" onClick={onExit}>
                Exit
              </Button>
              <Button type="button" variant="outline" onClick={onReturnToCover}>
                Return to Cover Page
              </Button>
              <Button
                type="button"
                disabled={!downloadHref}
                onClick={() => {
                  if (downloadHref) {
                    window.open(downloadHref, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </>
          ) : phase === "confirm" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={onConfirm}>
                {isFinalSheet ? "Approve and Finalize" : "Approve and Continue"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
