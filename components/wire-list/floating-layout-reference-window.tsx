"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Minus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LayoutPdfWorkspace } from "@/components/projects/layout-pdf-workspace";
import type { LayoutPagesIndexDocument } from "@/lib/layout-matching";

interface FloatingLayoutReferenceWindowProps {
  open: boolean;
  minimized: boolean;
  position: { x: number; y: number };
  title: string;
  pageNumber?: number;
  pdfUrl?: string;
  layoutIndex?: LayoutPagesIndexDocument | null;
  onToggleMinimized: () => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

export function FloatingLayoutReferenceWindow({
  open,
  minimized,
  position,
  title,
  pageNumber,
  pdfUrl,
  layoutIndex,
  onToggleMinimized,
  onClose,
  onPositionChange,
}: FloatingLayoutReferenceWindowProps) {
  const canRenderWorkspace = Boolean(pdfUrl && layoutIndex);
  return (
    <AnimatePresence>
      {open && canRenderWorkspace ? (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            scale: 1,
            width: minimized ? 260 : 980,
            height: minimized ? 58 : 720,
          }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="fixed z-[61] overflow-hidden rounded-3xl border bg-background shadow-2xl"
          style={{
            left: position.x,
            top: position.y,
          }}
          onDragEnd={(_, info) => {
            onPositionChange({
              x: Math.max(12, position.x + info.offset.x),
              y: Math.max(12, position.y + info.offset.y),
            });
          }}
        >
          <div className="flex cursor-grab items-center justify-between border-b px-4 py-3 active:cursor-grabbing">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Layout Reference
              </div>
              <div className="truncate text-base font-semibold">
                {title}
                {pageNumber ? ` · Page ${pageNumber}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canRenderWorkspace ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => window.open(pdfUrl!, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onToggleMinimized}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!minimized ? (
            <div className="h-[calc(100%-61px)] overflow-auto bg-muted/30 p-3">
              <LayoutPdfWorkspace
                pdfUrl={pdfUrl!}
                layoutIndex={layoutIndex!}
                initialPageNumber={pageNumber}
                className="h-full"
              />
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
