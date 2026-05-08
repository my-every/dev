"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LayoutPdfWorkspace } from "@/components/projects/layout-pdf-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutPagesIndexDocument } from "@/lib/layout-matching";

interface LayoutPdfWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string | null;
  initialPageNumber?: number;
  quickBackLabel?: string;
  onQuickBack?: () => void;
}

interface LayoutWorkspacePayload {
  pdf?: { url?: string | null } | null;
  layoutIndex?: LayoutPagesIndexDocument | null;
}

export function LayoutPdfWorkspaceDialog({
  open,
  onOpenChange,
  endpoint,
  initialPageNumber,
  quickBackLabel,
  onQuickBack,
}: LayoutPdfWorkspaceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<LayoutWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !endpoint) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        // 404 means this project/revision has no layout workspace payload yet.
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<LayoutWorkspacePayload>;
      })
      .then((nextPayload) => {
        if (!cancelled) {
          setPayload(nextPayload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load layout workspace payload", error);
          setPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className="relative flex h-full w-full flex-col overflow-hidden bg-card"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.85 }}
          >
            <span className="sr-only">Project Layouts — view and inspect the layout PDF with page search and metadata.</span>
            {onQuickBack ? (
              <Button
                variant="outline"
                size="sm"
                className="absolute left-3 top-3 z-10 h-8 gap-1.5 rounded-full"
                onClick={onQuickBack}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {quickBackLabel || "Back"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {loading ? (
              <div className="grid h-full gap-4 p-4 xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
                <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-card/70">
                  <div className="space-y-3 border-b border-border/50 p-4">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-7 w-36" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="rounded-2xl border border-border/50 p-3">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="mt-2 h-5 w-40" />
                        <div className="mt-3 flex gap-2">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-card/70">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-7 w-64" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-10 w-72 rounded-xl" />
                      {Array.from({ length: 7 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-10 rounded-xl" />
                      ))}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 gap-4 p-4">
                    <div className="min-h-0 flex-1 rounded-2xl border border-border/50 bg-muted/20 p-4">
                      <Skeleton className="h-full w-full rounded-2xl" />
                    </div>
                  </div>
                </div>
                <div className="hidden min-h-0 rounded-2xl border border-border/50 bg-background/70 2xl:flex 2xl:flex-col">
                  <div className="border-b border-border/50 px-4 py-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-5 w-40" />
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="rounded-2xl border border-border/50 p-4">
                      <Skeleton className="h-3 w-20" />
                      <div className="mt-3 space-y-2">
                        {Array.from({ length: 7 }).map((_, index) => (
                          <Skeleton key={index} className="h-4 w-full" />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/50 p-4">
                      <Skeleton className="h-3 w-28" />
                      <div className="mt-3 space-y-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Skeleton key={index} className="h-12 w-full rounded-xl" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : payload?.pdf?.url && payload.layoutIndex ? (
              <LayoutPdfWorkspace
                pdfUrl={payload.pdf.url}
                layoutIndex={payload.layoutIndex}
                initialPageNumber={initialPageNumber}
                className="h-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Layout workspace unavailable for this revision.
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
