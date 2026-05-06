"use client";

import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MultiSheetPreparingShellProps {
  generationStatus: "idle" | "preparing" | "generating" | "success" | "error";
  generationMessage: string;
  reviewReadOnly: boolean;
  onBack: () => void;
  onRetry: () => void;
  onOpenReview: () => void;
}

export function MultiSheetPreparingShell({
  generationStatus,
  generationMessage,
  reviewReadOnly,
  onBack,
  onRetry,
  onOpenReview,
}: MultiSheetPreparingShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_32%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] px-4 py-6 sm:px-6 sm:py-8">
      <div className="w-full max-w-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
            generationStatus === "error"
              ? "bg-red-100 text-red-600"
              : generationStatus === "success"
                ? "bg-emerald-100 text-emerald-600"
                : "bg-primary/10 text-primary",
          )}
        >
          {generationStatus === "success" ? (
            <CheckCircle2 className="h-7 w-7" />
          ) : (
            <Loader2 className={cn("h-7 w-7", generationStatus === "error" ? "" : "animate-spin")} />
          )}
        </div>
        <h3 className="mt-5 text-2xl font-semibold">
          {generationStatus === "error"
            ? "Brand schema generation failed"
            : generationStatus === "success"
              ? "Brand review workspace ready"
              : "Preparing the brand review workspace"}
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">{generationMessage}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {generationStatus === "error" ? (
            <>
              <Button type="button" variant="outline" onClick={onBack}>
                Back
              </Button>
              <Button type="button" onClick={onRetry}>
                Retry
              </Button>
            </>
          ) : generationStatus === "success" ? (
            <Button type="button" onClick={() => onOpenReview()}>
              Open Review
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
