"use client";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MultiSheetStatusSummary } from "@/components/wire-list/multi-sheet-review-types";

interface MultiSheetReviewStateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewState: MultiSheetStatusSummary;
  onStartReview: () => void;
}

export function MultiSheetReviewStateDialog({
  open,
  onOpenChange,
  reviewState,
  onStartReview,
}: MultiSheetReviewStateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] rounded-3xl p-0 overflow-hidden" showCloseButton>
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Review Current Brand List State</DialogTitle>
          <DialogDescription>
            A quick checkpoint before approving or exporting. This catches missing schemas, weak layout references, and stale export files.
          </DialogDescription>
        </DialogHeader>

        <div className="gap-4 px-6 py-5 flex flex-wrap overflow-y-auto">
          <StatCard label="Sheets" value={`${reviewState.totalSheets}`} caption="Operational sheets in this review." />
          <StatCard label="Schemas" value={`${reviewState.savedSchemas}/${reviewState.totalSheets}`} caption="Saved editable brand-list schemas." />
          <StatCard label="Layout Maps" value={`${reviewState.mappedSheets}/${reviewState.totalSheets}`} caption="High-confidence layout references." />
          <StatCard label="Approved" value={`${reviewState.approvedSheets}/${reviewState.totalSheets}`} caption="Editing a sheet removes approval." />
        </div>

        {reviewState.editedSheets > 0 ? (
          <div className="mx-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {reviewState.editedSheets} sheet{reviewState.editedSheets === 1 ? "" : "s"} edited after approval and returned to review.
          </div>
        ) : null}

        <div className="space-y-3 border-t bg-muted/10 px-6 py-5">
          <ChecklistItem
            complete={reviewState.savedSchemas === reviewState.totalSheets}
            title="1. Generate and edit brand schemas"
            body="Brand mode is the source of truth. Length edits, duplicated rows, removed rows, bundle names, and header fields save to Share state."
          />
          <ChecklistItem
            complete={!reviewState.mappingNeedsReview}
            title="2. Confirm layout references"
            body="Layout previews prefer stored assignment mapping and ignore low-confidence fallback matches, so page 1 is no longer trusted by default."
            incompleteTone="text-amber-600"
          />
          <ChecklistItem
            complete={reviewState.allApproved}
            title="3. Approve after final edits"
            body="Any schema edit clears that sheet approval and clears the combined export so the next workbook can’t accidentally use stale review state."
          />
          <ChecklistItem
            complete={reviewState.brandingWorkbookReady}
            title="4. Combine and download"
            body="Combined export readiness is only shown when the workbook path exists in the exports directory."
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={onStartReview}>
            Start Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function ChecklistItem({
  complete,
  title,
  body,
  incompleteTone,
}: {
  complete: boolean;
  title: string;
  body: string;
  incompleteTone?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-background p-4">
      <CheckCircle2 className={cn("mt-0.5 h-5 w-5", complete ? "text-emerald-600" : incompleteTone || "text-muted-foreground")} />
      <div>
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
