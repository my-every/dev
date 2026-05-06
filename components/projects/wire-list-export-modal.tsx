"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, Check, Download, FileArchive, Layers, ListOrdered } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/theme/springs";

type GroupingMode = "default" | "device-prefix" | "device-prefix-part-number" | "blue-label-sequence";

interface GroupingOption {
  value: GroupingMode;
  label: string;
  description: string;
  icon: typeof Layers;
}

const GROUPING_OPTIONS: GroupingOption[] = [
  {
    value: "default",
    label: "Default",
    description: "Original discovery order",
    icon: ListOrdered,
  },
  {
    value: "device-prefix",
    label: "By Device Prefix",
    description: "KA, CT, XT — grouped by device family",
    icon: Layers,
  },
  {
    value: "blue-label-sequence",
    label: "By Blue Label Sequence",
    description: "Single connections follow each sheet's Blue Labels order",
    icon: ListOrdered,
  },
];

type ExportState = "idle" | "exporting" | "complete" | "error";

interface WireListExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  sheetCount: number;
}

export function WireListExportModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  sheetCount,
}: WireListExportModalProps) {
  const [selectedGrouping, setSelectedGrouping] = useState<GroupingMode>("default");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (exportState === "exporting") return;

    setExportState("exporting");
    setErrorMessage(null);

    try {
      const url = `/api/projects/${encodeURIComponent(projectId)}/wire-list-pdf/download-all?grouping=${selectedGrouping}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Export failed" }));
        throw new Error(errorData.error || "Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      anchor.download = filenameMatch?.[1] ?? "wirelists.zip";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      setExportState("complete");
      setTimeout(() => {
        onOpenChange(false);
        setExportState("idle");
      }, 1500);
    } catch (error) {
      setExportState("error");
      const message = error instanceof Error ? error.message : "Export failed";
      // Check for common infrastructure errors and provide helpful messages
      if (message.includes("Playwright") || message.includes("browser") || message.includes("Chromium")) {
        setErrorMessage("PDF generation requires a browser environment. Please download individual sheets using the preview.");
      } else if (message.includes("timeout")) {
        setErrorMessage("The export timed out. Try downloading fewer sheets at a time.");
      } else {
        setErrorMessage(message);
      }
    }
  }, [projectId, selectedGrouping, exportState, onOpenChange]);

  const handleClose = () => {
    if (exportState !== "exporting") {
      onOpenChange(false);
      setExportState("idle");
      setErrorMessage(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg" className="gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FileArchive className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">
                Export All Wire Lists
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm">
                {projectName ? `${sheetCount} sheets from ${projectName}` : `${sheetCount} sheets available`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="mb-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Group Ordering
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Choose how connection groups are organized in the exported PDFs.
            </p>
          </div>

          <div className="space-y-2">
            {GROUPING_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedGrouping === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedGrouping(option.value)}
                  disabled={exportState === "exporting"}
                  className={cn(
                    "relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200",
                    "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card hover:border-border",
                    exportState === "exporting" && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "font-medium text-sm",
                            isSelected ? "text-foreground" : "text-foreground/80"
                          )}
                        >
                          {option.label}
                        </span>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={springs.moderate}
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {exportState === "error" && errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3"
              >
                <p className="text-sm text-destructive">{errorMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/30">
          <Button variant="outline" onClick={handleClose} disabled={exportState === "exporting"}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportState === "exporting" || exportState === "complete"}
            className="min-w-[140px] relative"
          >
            <AnimatePresence mode="wait">
              {exportState === "idle" && (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download ZIP
                </motion.span>
              )}
              {exportState === "exporting" && (
                <motion.span
                  key="exporting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Archive className="h-4 w-4" />
                  </motion.div>
                  Generating...
                </motion.span>
              )}
              {exportState === "complete" && (
                <motion.span
                  key="complete"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                  Downloaded
                </motion.span>
              )}
              {exportState === "error" && (
                <motion.span
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Retry
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
