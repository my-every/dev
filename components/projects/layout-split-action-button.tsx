"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Download,
  ExternalLink,
  FileDown,
  Layers,
  ListTree,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LayoutPagesIndexDocument } from "@/lib/layout-matching";
import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";
import { MultiSheetPrintModal } from "@/components/wire-list/multi-sheet-print-modal";
import { useToast } from "@/hooks/use-toast";
import { SheetDetailModal } from "@/components/projects/sheet-detail-modal";
import { MultiWireListPrintWorkspaceDialog } from "@/components/projects/multi-wire-list-print-workspace-dialog";

interface LayoutSplitActionButtonProps {
  endpoint: string | null;
  pdNumber?: string;
  revision?: string | null;
  canOpenLayout?: boolean;
  canDownloadLayout?: boolean;
  canOpenWireList?: boolean;
  canOpenWirePrint?: boolean;
  canOpenBrandList?: boolean;
  disabled?: boolean;
  label?: string;
}

interface ManifestSheetSummary {
  slug: string;
  name: string;
  rowCount?: number;
}

interface LayoutWorkspacePayload {
  pdf?: { url?: string | null } | null;
  layoutIndex?: LayoutPagesIndexDocument | null;
  manifest?: {
    id?: string;
    name?: string;
    operationalSheets?: ManifestSheetSummary[];
  } | null;
}

interface WorkspaceProjectPayload {
  projectId?: string;
  operationalSheets?: ManifestSheetSummary[];
  error?: string;
}

type MenuMode =
  | "root"
  | "layout-view"
  | "layout-download"
  | "wire-view"
  | "brand-view";

function normalizePageLabel(title?: string, pageNumber?: number) {
  const normalized = title?.trim().replace(/\s+/g, " ") || `Page ${pageNumber ?? "?"}`;
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

function normalizeSheetLabel(title?: string) {
  const normalized = title?.trim().replace(/\s+/g, " ") || "Sheet";
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

async function ensureWorkspaceProject(pdNumber?: string, revision?: string | null) {
  if (!pdNumber || !revision) {
    throw new Error("Missing PD number or revision.");
  }

  const response = await fetch("/api/legal-drawings/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdNumber, revision }),
  });
  const payload = await response.json().catch(() => ({})) as WorkspaceProjectPayload;
  if (!response.ok || !payload.projectId) {
    throw new Error(payload.error || "Failed to prepare the legal workspace project.");
  }

  return payload;
}

export function LayoutSplitActionButton({
  endpoint,
  pdNumber,
  revision,
  canOpenLayout = false,
  canDownloadLayout = false,
  canOpenWireList = false,
  canOpenWirePrint = false,
  canOpenBrandList = false,
  disabled,
  label = "Open",
}: LayoutSplitActionButtonProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>("root");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<LayoutWorkspacePayload | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialPageNumber, setInitialPageNumber] = useState<number | undefined>(undefined);
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [workspaceSheetSlug, setWorkspaceSheetSlug] = useState<string | null>(null);
  const [wireListViewerOpen, setWireListViewerOpen] = useState(false);
  const [brandListViewerOpen, setBrandListViewerOpen] = useState(false);
  const [wirePrintWorkspaceOpen, setWirePrintWorkspaceOpen] = useState(false);
  const [workspaceSheets, setWorkspaceSheets] = useState<ManifestSheetSummary[]>([]);
  const [workspacePreparing, setWorkspacePreparing] = useState(false);

  useEffect(() => {
    setPayload(null);
  }, [endpoint]);

  useEffect(() => {
    if (!menuOpen || !endpoint || payload) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
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
          console.error("Failed to load legal open options", error);
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
  }, [endpoint, menuOpen, payload]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuMode("root");
    }
  }, [menuOpen]);

  const pages = useMemo(
    () => payload?.layoutIndex?.pages ?? [],
    [payload?.layoutIndex?.pages],
  );
  const operationalSheets = useMemo(
    () => payload?.manifest?.operationalSheets ?? [],
    [payload?.manifest?.operationalSheets],
  );

  const pdfUrl = payload?.pdf?.url ?? null;

  const openLayoutPage = (pageNumber?: number) => {
    setInitialPageNumber(pageNumber);
    setDialogOpen(true);
    setMenuOpen(false);
  };

  const downloadLayoutPage = (pageNumber?: number) => {
    if (!pdfUrl) {
      return;
    }

    const url = new URL(pdfUrl, window.location.origin);
    url.searchParams.set("raw", "1");
    url.searchParams.set("download", "1");
    if (pageNumber) {
      url.searchParams.set("page", String(pageNumber));
    }

    const anchor = document.createElement("a");
    anchor.href = url.toString();
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setMenuOpen(false);
  };

  const openWorkspace = async (sheetSlug?: string) => {
    setWorkspacePreparing(true);
    try {
      const workspace = await ensureWorkspaceProject(pdNumber, revision);
      setWorkspaceProjectId(workspace.projectId ?? null);
      setWorkspaceSheets(workspace.operationalSheets ?? operationalSheets);
      setWorkspaceSheetSlug(sheetSlug ?? null);
      setWireListViewerOpen(true);
      setMenuOpen(false);
    } catch (error) {
      toast({
        title: "Workspace unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Could not open the requested legal workspace.",
        duration: 4000,
      });
    } finally {
      setWorkspacePreparing(false);
    }
  };

  const openBrandWorkspace = async () => {
    setWorkspacePreparing(true);
    try {
      const workspace = await ensureWorkspaceProject(pdNumber, revision);
      setWorkspaceProjectId(workspace.projectId ?? null);
      setWorkspaceSheets(workspace.operationalSheets ?? operationalSheets);
      setWorkspaceSheetSlug(null);
      setBrandListViewerOpen(true);
      setMenuOpen(false);
    } catch (error) {
      toast({
        title: "Brand workspace unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Could not open the brand list workspace.",
        duration: 4000,
      });
    } finally {
      setWorkspacePreparing(false);
    }
  };

  const openPrintWorkspace = async (sheetSlug?: string) => {
    setWorkspacePreparing(true);
    try {
      const workspace = await ensureWorkspaceProject(pdNumber, revision);
      setWorkspaceProjectId(workspace.projectId ?? null);
      setWorkspaceSheets(workspace.operationalSheets ?? operationalSheets);
      setWorkspaceSheetSlug(sheetSlug ?? null);
      setWirePrintWorkspaceOpen(true);
      setMenuOpen(false);
    } catch (error) {
      toast({
        title: "Printout unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Could not open the wire list print workspace.",
        duration: 4000,
      });
    } finally {
      setWorkspacePreparing(false);
    }
  };

  const hasPages = pages.length > 0 && canOpenLayout;
  const hasSheets = operationalSheets.length > 0;
  const canOpenWireWorkspace = canOpenWireList && hasSheets;
  const canOpenWirePrintouts = canOpenWirePrint && hasSheets;
  const canOpenBrandWorkspaceAction = canOpenBrandList && hasSheets;
  const hasPrimaryAction =
    canOpenLayout
    || canOpenWireWorkspace
    || canOpenBrandWorkspaceAction;

  return (
    <>
      <div className="inline-flex items-center rounded-lg border border-border/60 bg-secondary text-secondary-foreground shadow-sm">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-r-none border-r border-border/50 px-3"
          disabled={disabled || !hasPrimaryAction}
          onClick={() => {
            if (canOpenLayout) {
              openLayoutPage(undefined);
              return;
            }
            if (canOpenWireWorkspace) {
              void openWorkspace(undefined);
              return;
            }
            if (canOpenBrandWorkspaceAction) {
              void openBrandWorkspace();
            }
          }}
        >
          <Layers className="mr-1.5 h-4 w-4" />
          {label}
        </Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-l-none px-2.5"
              disabled={disabled}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-88 overflow-hidden rounded-2xl border-border/60 p-0">
            <div className="border-b border-border/50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Open</p>
              <p className="mt-1 text-sm font-medium">
                {menuMode === "root"
                  ? "Choose an action"
                  : menuMode === "layout-view"
                    ? "Open a layout page"
                  : menuMode === "layout-download"
                      ? "Download a layout page"
                      : menuMode === "wire-view"
                        ? "Open a wire list sheet"
                        : "Open the brand list workspace"}
              </p>
            </div>

            {loading || workspacePreparing ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : menuMode === "root" ? (
              <div className="space-y-2 p-3">
                <ActionCard
                  title="Open layout workspace"
                  description="Open the layout workspace or jump directly to a page."
                  icon={<Layers className="h-4 w-4" />}
                  onClick={() => setMenuMode("layout-view")}
                  disabled={!hasPages}
                />
                <ActionCard
                  title="Open wire list viewer"
                  description="Open the multi-sheet wire list workspace for this legal package."
                  icon={<ListTree className="h-4 w-4" />}
                  onClick={() => setMenuMode("wire-view")}
                  disabled={!canOpenWireWorkspace}
                />
                <ActionCard
                  title="Open wire list printouts"
                  description="Browse and download generated wire list print PDFs for each operational sheet."
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => void openPrintWorkspace()}
                  disabled={!canOpenWirePrintouts}
                />
                <ActionCard
                  title="Open brand list workspace"
                  description="Open the prebuilt multi-sheet brand list review workspace for this legal package."
                  icon={<Layers className="h-4 w-4" />}
                  onClick={() => setMenuMode("brand-view")}
                  disabled={!canOpenBrandWorkspaceAction}
                />
                <ActionCard
                  title="Download layout"
                  description="Download the full layout or export a single page PDF."
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => setMenuMode("layout-download")}
                  disabled={!canDownloadLayout}
                />
              </div>
            ) : (
              <div className="flex min-h-88 flex-col">
                <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setMenuMode("root")}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {menuMode === "layout-view"
                      ? "Select a page to open"
                      : menuMode === "layout-download"
                        ? "Select a page to download"
                        : menuMode === "wire-view"
                          ? "Select a sheet to open"
                          : "Open the multi-sheet brand review workspace"}
                  </div>
                </div>
                {menuMode === "brand-view" ? (
                  <div className="space-y-3 p-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start rounded-lg"
                      onClick={() => void openBrandWorkspace()}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Open brand list workspace
                    </Button>
                    <div className="rounded-2xl border border-border/50 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                      Uses the prebuilt schemas already saved under this legal revision's
                      <span className="mx-1 font-mono text-foreground">wire-brand-list/</span>
                      directory.
                    </div>
                  </div>
                ) : (menuMode === "layout-view" || menuMode === "layout-download") ? (
                  <>
                    <div className="space-y-2 border-b border-border/50 p-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start rounded-lg"
                        onClick={() =>
                          menuMode === "layout-view"
                            ? openLayoutPage(undefined)
                            : downloadLayoutPage(undefined)
                        }
                      >
                        {menuMode === "layout-view" ? (
                          <Layers className="mr-2 h-4 w-4" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        {menuMode === "layout-view"
                          ? "Open full layout workspace"
                          : "Download full layout PDF"}
                      </Button>
                    </div>
                    <ScrollArea className="min-h-0 flex-1 max-h-60 overflow-y-auto">
                      <div className="space-y-2 p-3">
                        {pages.map((page) => (
                          <button
                            key={page.pageNumber}
                            type="button"
                            className="w-full rounded-xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                            onClick={() =>
                              menuMode === "layout-view"
                                ? openLayoutPage(page.pageNumber)
                                : downloadLayoutPage(page.pageNumber)
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  Page {page.pageNumber}
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                  {normalizePageLabel(page.normalizedTitle || page.title, page.pageNumber)}
                                </p>
                              </div>
                              {page.panelNumber ? (
                                <span className="min-w-max rounded-full bg-muted px-2 py-0.5 text-[9.5px] text-muted-foreground">
                                  {page.panelNumber}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <ScrollArea className="min-h-0 flex-1 max-h-72 overflow-y-auto">
                    <div className="space-y-2 p-3">
                      {operationalSheets.map((sheet) => (
                        <button
                          key={sheet.slug}
                          type="button"
                          className="w-full rounded-xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                            onClick={() =>
                              void openWorkspace(sheet.slug)
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Operational sheet
                              </p>
                              <p className="mt-1 text-sm font-medium">
                                {normalizeSheetLabel(sheet.name)}
                              </p>
                            </div>
                            <span className="min-w-max rounded-full bg-muted px-2 py-0.5 text-[9.5px] text-muted-foreground">
                              {sheet.rowCount ?? 0} rows
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <LayoutPdfWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        endpoint={endpoint}
        initialPageNumber={initialPageNumber}
      />

      <SheetDetailModal
        projectId={workspaceProjectId ?? ""}
        sheetName={workspaceSheetSlug ?? ""}
        open={wireListViewerOpen && Boolean(workspaceProjectId)}
        onOpenChange={(open) => {
          if (!open) {
            setWireListViewerOpen(false);
            setWorkspaceProjectId(null);
            setWorkspaceSheetSlug(null);
            setWorkspaceSheets([]);
          }
        }}
        showRevisionPanel
      />

      <MultiSheetPrintModal
        projectId={workspaceProjectId ?? undefined}
        open={brandListViewerOpen && Boolean(workspaceProjectId)}
        onOpenChange={(open) => {
          if (!open) {
            setBrandListViewerOpen(false);
            setWorkspaceProjectId(null);
            setWorkspaceSheetSlug(null);
            setWorkspaceSheets([]);
          }
        }}
        showTrigger={false}
        title="Brand List Workspace"
        description="Open the prebuilt multi-sheet brand list workspace for this legal package."
        combineLabel="Generate Multi-Sheet Brand List"
        workspaceMode="print"
        autoStartReadOnly={false}
      />

      <MultiWireListPrintWorkspaceDialog
        projectId={workspaceProjectId ?? undefined}
        sheets={workspaceSheets}
        initialSheetSlug={workspaceSheetSlug}
        open={wirePrintWorkspaceOpen && Boolean(workspaceProjectId)}
        onOpenChange={(open) => {
          if (!open) {
            setWirePrintWorkspaceOpen(false);
            setWorkspaceProjectId(null);
            setWorkspaceSheetSlug(null);
            setWorkspaceSheets([]);
          }
        }}
      />
    </>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border/50 p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}
