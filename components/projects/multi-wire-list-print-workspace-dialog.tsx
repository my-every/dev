"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";
import { WireListExportModal } from "@/components/projects/wire-list-export-modal";

interface WireListPrintSheetSummary {
  slug: string;
  name: string;
  rowCount?: number;
}

interface MultiWireListPrintWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  sheets: WireListPrintSheetSummary[];
  initialSheetSlug?: string | null;
}

function normalizeSheetLabel(title?: string) {
  const normalized = normalizeDisplayTitle(title || "Sheet");
  return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized;
}

function buildWirePdfHref(projectId: string, sheetSlug: string, download: boolean) {
  return `/api/projects/${encodeURIComponent(projectId)}/wire-list-pdf/${encodeURIComponent(sheetSlug)}?download=${download ? "1" : "0"}`;
}

function buildWirePreviewHref(projectId: string, sheetSlug: string) {
  return `/print/project-context/${encodeURIComponent(projectId)}/wire-list/${encodeURIComponent(sheetSlug)}`;
}

export function MultiWireListPrintWorkspaceDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectColor,
  sheets,
  initialSheetSlug,
}: MultiWireListPrintWorkspaceDialogProps) {
  const [query, setQuery] = useState("");
  const [activeSheetSlug, setActiveSheetSlug] = useState<string | null>(initialSheetSlug ?? null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setFrameLoaded(false);
    setActiveSheetSlug((prev) => {
      if (initialSheetSlug && sheets.some((sheet) => sheet.slug === initialSheetSlug)) {
        return initialSheetSlug;
      }
      if (prev && sheets.some((sheet) => sheet.slug === prev)) {
        return prev;
      }
      return sheets[0]?.slug ?? null;
    });
  }, [initialSheetSlug, open, sheets]);

  const filteredSheets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sheets;
    }

    return sheets.filter((sheet) =>
      sheet.slug.toLowerCase().includes(normalized)
      || sheet.name.toLowerCase().includes(normalized),
    );
  }, [query, sheets]);

  useEffect(() => {
    if (!activeSheetSlug) {
      return;
    }

    if (!filteredSheets.some((sheet) => sheet.slug === activeSheetSlug)) {
      setActiveSheetSlug(filteredSheets[0]?.slug ?? null);
      setFrameLoaded(false);
    }
  }, [activeSheetSlug, filteredSheets]);

  const activeIndex = filteredSheets.findIndex((sheet) => sheet.slug === activeSheetSlug);
  const activeSheet = activeIndex >= 0 ? filteredSheets[activeIndex] : null;
  const activePreviewUrl = projectId && activeSheetSlug
    ? buildWirePreviewHref(projectId, activeSheetSlug)
    : null;

  useEffect(() => {
    setFrameLoaded(false);
  }, [activeSheetSlug]);

  const handleDownload = () => {
    if (!projectId || !activeSheetSlug) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = buildWirePdfHref(projectId, activeSheetSlug, true);
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleOpenNewTab = () => {
    if (!projectId || !activeSheetSlug) {
      return;
    }

    window.open(buildWirePreviewHref(projectId, activeSheetSlug), "_blank", "noopener,noreferrer");
  };

  const handlePrevious = () => {
    if (activeIndex <= 0) {
      return;
    }
    setActiveSheetSlug(filteredSheets[activeIndex - 1]?.slug ?? null);
  };

  const handleNext = () => {
    if (activeIndex < 0 || activeIndex >= filteredSheets.length - 1) {
      return;
    }
    setActiveSheetSlug(filteredSheets[activeIndex + 1]?.slug ?? null);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="wire-list-workspace-overlay"
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
            <span className="sr-only">
              Wire Lists — browse generated wire list print PDFs and download each sheet from a single workspace.
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
              <aside className="flex min-h-0 flex-col border-r border-border/50 bg-card/70">
                <div className="space-y-3 border-b border-border/50 p-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <ProjectIcon
                        name={projectName ?? projectId ?? "Project"}
                        color={projectColor ?? "#ffcc61"}
                        interactive={false}
                      />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wire Lists</p>
                        <h2 className="mt-1 uppercase text-2xl font-semibold">{projectId}</h2>
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search sheet name or slug..."
                      className="pl-9"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filteredSheets.length} of {sheets.length} operational sheets
                  </p>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2 p-3">
                    {filteredSheets.map((sheet, index) => (
                      <button
                        key={`${sheet.slug || sheet.name || "sheet"}-${index}`}
                        type="button"
                        onClick={() => setActiveSheetSlug(sheet.slug)}
                        className={cn(
                          "w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                          sheet.slug === activeSheetSlug && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <div className="flex items-center justify-start gap-3">
                          
                            <p className="text-[11px] border w-8 h-8 text-center rounded-full uppercase  text-muted-foreground">
                               {index + 1}
                            </p>
                            <p className="mt-1 text-sm font-medium">{normalizeSheetLabel(sheet.name)}</p>
                         
                        
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </aside>

              <main className="flex min-h-0 flex-col bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active Printout</p>
                    <h3 className="mt-1 truncate text-2xl font-semibold">
                      {activeSheet ? normalizeSheetLabel(activeSheet.name) : "Select a wire list sheet"}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevious} disabled={activeIndex <= 0}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      disabled={activeIndex < 0 || activeIndex >= filteredSheets.length - 1}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleOpenNewTab} disabled={!activeSheet || !projectId}>
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      Open Tab
                    </Button>
                    <Button size="sm" onClick={handleDownload} disabled={!activeSheet || !projectId}>
                      <Download className="mr-1.5 h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowExportModal(true)}
                      disabled={!projectId || sheets.length === 0}
                    >
                      <Archive className="mr-1.5 h-4 w-4" />
                      Export All
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden p-4">
                  {!activeSheet || !activePreviewUrl ? (
                    <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/30 text-sm text-muted-foreground">
                      Select a sheet to preview its generated wire list printout.
                    </div>
                  ) : (
                    <div className="relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-sm">
                      {!frameLoaded ? (
                        <div className="absolute inset-0 grid h-full gap-4 p-4 xl:grid-cols-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)]">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-6 w-56" />
                              <Skeleton className="h-9 w-32 rounded-xl" />
                            </div>
                            <Skeleton className="h-[calc(100%-2.5rem)] w-full rounded-2xl" />
                          </div>
                        </div>
                      ) : null}
                      <iframe
                        title={activeSheet.name}
                        src={activePreviewUrl}
                        className={cn("h-full w-full", !frameLoaded && "invisible")}
                        onLoad={() => setFrameLoaded(true)}
                      />
                    </div>
                  )}
                </div>
              </main>


            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {projectId && (
        <WireListExportModal
          key={`wire-list-export-${projectId}`}
          open={showExportModal}
          onOpenChange={setShowExportModal}
          projectId={projectId}
          projectName={projectName}
          sheetCount={sheets.length}
        />
      )}
    </AnimatePresence>
  );
}
