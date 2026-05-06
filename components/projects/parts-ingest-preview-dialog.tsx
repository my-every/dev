"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface PartsIngestPreviewDialogProps {
  open: boolean;
  createdCount: number;
  uniqueCandidates: number;
  existingCount: number;
  previewParts: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PartsIngestPreviewDialog({
  open,
  createdCount,
  uniqueCandidates,
  existingCount,
  previewParts,
  onConfirm,
  onCancel,
}: PartsIngestPreviewDialogProps) {
  const remainingCount = Math.max(createdCount - previewParts.length, 0);

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent className="max-w-2xl border-border/60 bg-card p-0 shadow-2xl">
        <div className="overflow-hidden rounded-lg">
          <AlertDialogHeader className="border-b border-border/60 bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Project Upload</Badge>
              <Badge variant="outline">Organization Setup</Badge>
            </div>
            <AlertDialogTitle className="text-xl">Review New Library Parts</AlertDialogTitle>
            <AlertDialogDescription>
              The dry-run found new catalog entries that will be committed when this upload continues.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New Parts</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{createdCount}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Candidates Scanned</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{uniqueCandidates}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Already In Library</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{existingCount}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Preview</div>
                  <div className="text-sm text-muted-foreground">
                    First {previewParts.length} parts that will be created during commit.
                  </div>
                </div>
                {remainingCount > 0 ? (
                  <Badge variant="outline">+{remainingCount} more</Badge>
                ) : null}
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="flex flex-wrap gap-2">
                  {previewParts.map((part) => (
                    <Badge key={part} variant="secondary" className="font-mono text-xs">
                      {part}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
            <AlertDialogCancel onClick={onCancel}>Cancel Upload</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Continue Upload</AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
