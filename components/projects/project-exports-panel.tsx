"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, Eye, FileSpreadsheet, FileText, Loader2, RefreshCw, HardDrive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import FileCard from "@/components/projects/file-card";

interface BrandingCsvSheetExportRecord {
  sheetSlug: string;
  sheetName: string;
  rowCount: number;
  fileName: string;
  relativePath: string;
}

interface BrandingCsvExportResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sheetExports: BrandingCsvSheetExportRecord[];
  skippedSheets: Array<{ sheetSlug: string; sheetName: string; reason: string }>;
  combinedFileName?: string;
  combinedRelativePath?: string;
}

interface WireListPdfSheetExportRecord {
  sheetSlug: string;
  sheetName: string;
  rowCount: number;
  fileName: string;
  relativePath: string;
}

interface WireListPdfExportResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sheetExports: WireListPdfSheetExportRecord[];
  skippedSheets: Array<{ sheetSlug: string; sheetName: string; reason: string }>;
}

interface ProjectExportsPanelProps {
  projectId: string;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export function ProjectExportsPanel({ projectId, onError, onSuccess }: ProjectExportsPanelProps) {
  const [brandingManifest, setBrandingManifest] = useState<BrandingCsvExportResult | null>(null);
  const [wireListManifest, setWireListManifest] = useState<WireListPdfExportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingBranding, setIsRegeneratingBranding] = useState(false);
  const [isGeneratingPartNumbers, setIsGeneratingPartNumbers] = useState(false);
  const [isGeneratingBrandingSchemas, setIsGeneratingBrandingSchemas] = useState(false);
  const [isGeneratingBuildUpSwsSchemas, setIsGeneratingBuildUpSwsSchemas] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const buildExportHref = useCallback((relativePath: string, download: boolean = false) => {
    const normalizedRelativePath = relativePath.replace(/^exports\//, "");
    const encodedSegments = normalizedRelativePath.split("/").map(encodeURIComponent).join("/");
    const suffix = download ? "?download=1" : "";
    return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}${suffix}`;
  }, [projectId]);

  const buildPrintPreviewHref = useCallback((sheetSlug: string, mode?: "branding") => {
    const base = `/print/project-context/${encodeURIComponent(projectId)}/wire-list/${encodeURIComponent(sheetSlug)}`;
    return mode === "branding" ? `${base}?mode=branding` : base;
  }, [projectId]);

  const loadManifest = useCallback(async () => {
    setIsLoading(true);

    try {
      const [brandingResponse, wireListResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=branding`, { cache: "no-store" }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=wire-lists`, { cache: "no-store" }),
      ]);

      if (brandingResponse.ok) {
        setBrandingManifest(await brandingResponse.json() as BrandingCsvExportResult);
      } else if (brandingResponse.status === 404) {
        setBrandingManifest(null);
      } else {
        throw new Error("Failed to load branding exports");
      }

      if (wireListResponse.ok) {
        setWireListManifest(await wireListResponse.json() as WireListPdfExportResult);
      } else if (wireListResponse.status === 404) {
        setWireListManifest(null);
      } else {
        throw new Error("Failed to load wire list exports");
      }
    } catch (error) {
      onErrorRef.current?.(error instanceof Error ? error.message : "Failed to load project exports");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadManifest();
  }, [isOpen, loadManifest]);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);

    try {
      const [brandingResponse, wireListResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=branding`, { method: "POST" }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=wire-lists`, { method: "POST" }),
      ]);

      if (!brandingResponse.ok || !wireListResponse.ok) {
        const failedRes = !brandingResponse.ok ? brandingResponse : wireListResponse;
        const body = await failedRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to regenerate project exports");
      }

      const nextBrandingManifest = await brandingResponse.json() as BrandingCsvExportResult;
      const nextWireListManifest = await wireListResponse.json() as WireListPdfExportResult;
      setBrandingManifest(nextBrandingManifest);
      setWireListManifest(nextWireListManifest);
      onSuccess?.(`Generated ${nextBrandingManifest.sheetExports.length} branding exports and ${nextWireListManifest.sheetExports.length} wire list PDFs.`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to regenerate branding exports");
    } finally {
      setIsRegenerating(false);
    }
  }, [onError, onSuccess, projectId]);

  const handleRegenerateBranding = useCallback(async () => {
    setIsRegeneratingBranding(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/exports?kind=branding`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to regenerate branding exports");
      }

      const nextBrandingManifest = await response.json() as BrandingCsvExportResult;
      setBrandingManifest(nextBrandingManifest);
      onSuccess?.(`Generated ${nextBrandingManifest.sheetExports.length} branding exports.`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to regenerate branding exports");
    } finally {
      setIsRegeneratingBranding(false);
    }
  }, [onError, onSuccess, projectId]);

  const handleGeneratePartNumbers = useCallback(async () => {
    setIsGeneratingPartNumbers(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/device-part-numbers`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate device part numbers");
      }

      onSuccess?.("Device part numbers map generated successfully.");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to generate device part numbers");
    } finally {
      setIsGeneratingPartNumbers(false);
    }
  }, [onError, onSuccess, projectId]);

  const handleGenerateBrandingSchemas = useCallback(async () => {
    setIsGeneratingBrandingSchemas(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/wire-brand-list-schemas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "all" }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate branding list schemas");
      }

      const result = await response.json() as { generated?: unknown[]; skipped?: unknown[] };
      const generatedCount = Array.isArray(result.generated) ? result.generated.length : 0;
      const skippedCount = Array.isArray(result.skipped) ? result.skipped.length : 0;
      const skippedSuffix = skippedCount > 0 ? ` (${skippedCount} skipped)` : "";
      onSuccess?.(`Generated branding schemas for ${generatedCount} sheets${skippedSuffix}.`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to generate branding list schemas");
    } finally {
      setIsGeneratingBrandingSchemas(false);
    }
  }, [onError, onSuccess, projectId]);

  const handleGenerateBuildUpSwsSchemas = useCallback(async () => {
    setIsGeneratingBuildUpSwsSchemas(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/build-up-sws-schemas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "all" }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate Build Up SWS schemas");
      }

      const result = await response.json() as { generated?: unknown[]; skipped?: unknown[] };
      const generatedCount = Array.isArray(result.generated) ? result.generated.length : 0;
      const skippedCount = Array.isArray(result.skipped) ? result.skipped.length : 0;
      const skippedSuffix = skippedCount > 0 ? ` (${skippedCount} skipped)` : "";
      onSuccess?.(`Generated Build Up SWS schemas for ${generatedCount} sheets${skippedSuffix}.`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to generate Build Up SWS schemas");
    } finally {
      setIsGeneratingBuildUpSwsSchemas(false);
    }
  }, [onError, onSuccess, projectId]);

  const generatedLabel = useMemo(() => {
    const latestGeneratedAt = [brandingManifest?.generatedAt, wireListManifest?.generatedAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    if (!latestGeneratedAt) {
      return "Not generated yet";
    }

    return new Date(latestGeneratedAt).toLocaleString();
  }, [brandingManifest?.generatedAt, wireListManifest?.generatedAt]);

  const totalBrandingCount = brandingManifest?.sheetExports.length ?? 0;
  const totalWireListCount = wireListManifest?.sheetExports.length ?? 0;
  const skippedSheets = useMemo(
    () => [...(brandingManifest?.skippedSheets ?? []), ...(wireListManifest?.skippedSheets ?? [])],
    [brandingManifest?.skippedSheets, wireListManifest?.skippedSheets],
  );

  const triggerSummary = isLoading
    ? "Loading project exports"
    : `${totalBrandingCount} brand list exports, ${totalWireListCount} wire list PDFs`;

  const isBusy =
    isLoading ||
    isRegenerating ||
    isRegeneratingBranding ||
    isGeneratingPartNumbers ||
    isGeneratingBrandingSchemas ||
    isGeneratingBuildUpSwsSchemas;
  const hasExports = totalBrandingCount + totalWireListCount > 0;
  const exportStatus: "pending" | "ready" = !isBusy && hasExports ? "ready" : "pending";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="group cursor-pointer border-border/50 bg-card/60 transition-all hover:border-border hover:bg-card/80 hover:shadow-md active:scale-[0.99] max-w-md">
          <CardContent className="flex items-center gap-4 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Project Exports</span>
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{generatedLabel}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{triggerSummary}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <Badge variant="secondary" className="text-[10px]">{totalBrandingCount} Excel</Badge>
              <Badge variant="secondary" className="text-[10px]">{totalWireListCount} PDF</Badge>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] min-w-[90vw] overflow-hidden border-border/60 bg-background p-0 shadow-2xl sm:w-[calc(100vw-2rem)]" showCloseButton>
        <div className="flex h-full max-h-[90vh] flex-col">
          {/* Header */}
          <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-4 text-left sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl">Project Exports</DialogTitle>
                <DialogDescription className="mt-1 text-xs sm:text-sm">
                  Brand list Excel files and wire list PDFs rendered from the shared print-document pipeline.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="secondary">{totalBrandingCount} branding</Badge>
                <Badge variant="secondary">{totalWireListCount} PDFs</Badge>
                {skippedSheets.length > 0 && <Badge variant="outline">{skippedSheets.length} skipped</Badge>}
              </div>
            </div>

            {/* Action bar */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <DownloadCombinedExcelButton
                brandingManifest={brandingManifest}
                buildExportHref={buildExportHref}
              />
              <DownloadBrandingCsvZipButton
                brandingManifest={brandingManifest}
                buildExportHref={buildExportHref}
              />
              <DownloadWireListPdfZipButton
                wireListManifest={wireListManifest}
                buildExportHref={buildExportHref}
                projectName={brandingManifest?.projectName ?? wireListManifest?.projectName}
              />
              <DownloadAllButton
                brandingManifest={brandingManifest}
                wireListManifest={wireListManifest}
                buildExportHref={buildExportHref}
              />

              <div className="hidden h-4 w-px bg-border/60 sm:block" />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void handleRegenerateBranding()}
                disabled={isRegeneratingBranding || isRegenerating}
              >
                {isRegeneratingBranding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Regen Branding</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void handleGeneratePartNumbers()}
                disabled={isGeneratingPartNumbers}
              >
                {isGeneratingPartNumbers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Part Numbers</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void handleGenerateBrandingSchemas()}
                disabled={isGeneratingBrandingSchemas}
              >
                {isGeneratingBrandingSchemas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Brand Schemas</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void handleGenerateBuildUpSwsSchemas()}
                disabled={isGeneratingBuildUpSwsSchemas}
              >
                {isGeneratingBuildUpSwsSchemas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Build Up SWS</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => void handleRegenerate()}
                disabled={isRegenerating}
              >
                {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate All
              </Button>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading project exports&hellip;</span>
              </div>
            ) : brandingManifest || wireListManifest ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(0,0.7fr)]">
                {/* Branding column */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Brand List Excels
                    </h3>
                    {brandingManifest?.combinedRelativePath && (
                      <Button asChild variant="secondary" size="sm" className="h-7 gap-1.5 text-xs">
                        <a href={buildExportHref(brandingManifest.combinedRelativePath, true)}>
                          <Download className="h-3.5 w-3.5" />
                          Combined
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {brandingManifest?.sheetExports.length ? brandingManifest.sheetExports.map((sheetExport) => (
                      <div key={sheetExport.sheetSlug} className="group/card rounded-lg border border-border/40 bg-card/40 p-3 transition-colors hover:border-border/60 hover:bg-card/70">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="mt-0.5 shrink-0 scale-[0.85]">
                              <FileCard formatFile="xlsx" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{sheetExport.sheetName}</div>
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sheetExport.fileName}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{sheetExport.rowCount} rows</Badge>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <Button asChild variant="secondary" size="sm" className="h-7 gap-1.5 text-xs">
                            <a href={buildPrintPreviewHref(sheetExport.sheetSlug, "branding")} target="_blank" rel="noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                            <a href={buildExportHref(sheetExport.relativePath, true)}>
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No brand list exports generated yet.</p>
                    )}
                  </div>
                </section>

                {/* Wire list column */}
                <section className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Wire List PDFs
                  </h3>
                  <div className="space-y-2">
                    {wireListManifest?.sheetExports.length ? wireListManifest.sheetExports.map((sheetExport) => (
                      <div key={sheetExport.sheetSlug} className="group/card rounded-lg border border-border/40 bg-card/40 p-3 transition-colors hover:border-border/60 hover:bg-card/70">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="mt-0.5 shrink-0 scale-[0.85]">
                              <FileCard formatFile="pdf" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{sheetExport.sheetName}</div>
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sheetExport.fileName}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{sheetExport.rowCount} rows</Badge>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <Button asChild variant="secondary" size="sm" className="h-7 gap-1.5 text-xs">
                            <a href={buildPrintPreviewHref(sheetExport.sheetSlug)} target="_blank" rel="noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                            <a href={buildExportHref(sheetExport.relativePath)} target="_blank" rel="noreferrer">
                              <FileText className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                            <a href={buildExportHref(sheetExport.relativePath, true)}>
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No wire list PDFs generated yet.</p>
                    )}
                  </div>
                </section>

                {/* Skipped column */}
                <section className="flex flex-col gap-3 md:col-span-2 xl:col-span-1">
                  <h3 className="text-sm font-semibold text-foreground">Skipped Sheets</h3>
                  {skippedSheets.length > 0 ? (
                    <div className="space-y-1.5">
                      {skippedSheets.map((sheet, index) => (
                        <div key={`${sheet.sheetSlug}-${index}`} className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                          <div className="text-xs font-medium text-foreground">{sheet.sheetName}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{sheet.reason}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">All sheets produced exports successfully.</p>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="rounded-full bg-muted/60 p-4">
                  <Archive className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No exports generated yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Click &ldquo;Regenerate All&rdquo; to build brand list Excels and wire list PDFs.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Download All as ZIP
// ---------------------------------------------------------------------------

function DownloadAllButton({
  brandingManifest,
  wireListManifest,
  buildExportHref,
}: {
  brandingManifest: BrandingCsvExportResult | null;
  wireListManifest: WireListPdfExportResult | null;
  buildExportHref: (relativePath: string, download?: boolean) => string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const allFiles = useMemo(() => {
    const files: Array<{ name: string; relativePath: string }> = [];
    for (const item of brandingManifest?.sheetExports ?? []) {
      files.push({ name: item.fileName, relativePath: item.relativePath });
    }
    for (const item of wireListManifest?.sheetExports ?? []) {
      files.push({ name: item.fileName, relativePath: item.relativePath });
    }
    return files;
  }, [brandingManifest, wireListManifest]);

  const handleDownloadAll = useCallback(async () => {
    if (allFiles.length === 0) return;
    setIsDownloading(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      await Promise.all(
        allFiles.map(async (file) => {
          const response = await fetch(buildExportHref(file.relativePath, true));
          if (!response.ok) return;
          const blob = await response.blob();
          zip.file(file.name, blob);
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brandingManifest?.projectName ?? "project"}-exports.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — individual downloads still work
    } finally {
      setIsDownloading(false);
    }
  }, [allFiles, brandingManifest?.projectName, buildExportHref]);

  if (allFiles.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => void handleDownloadAll()}
      disabled={isDownloading}
    >
      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
      Download All (.zip)
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Combined Excel Workbook Download
// ---------------------------------------------------------------------------

function DownloadCombinedExcelButton({
  brandingManifest,
  buildExportHref,
}: {
  brandingManifest: BrandingCsvExportResult | null;
  buildExportHref: (relativePath: string, download?: boolean) => string;
}) {
  if (!brandingManifest?.combinedRelativePath) return null;

  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <a href={buildExportHref(brandingManifest.combinedRelativePath, true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Combined Excel
      </a>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Brand List Excel ZIP Download
// ---------------------------------------------------------------------------

function DownloadBrandingCsvZipButton({
  brandingManifest,
  buildExportHref,
}: {
  brandingManifest: BrandingCsvExportResult | null;
  buildExportHref: (relativePath: string, download?: boolean) => string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const files = brandingManifest?.sheetExports ?? [];

  const handleDownload = useCallback(async () => {
    if (files.length === 0) return;
    setIsDownloading(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      await Promise.all(
        files.map(async (file) => {
          const response = await fetch(buildExportHref(file.relativePath, true));
          if (!response.ok) return;
          const blob = await response.blob();
          zip.file(file.fileName, blob);
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brandingManifest?.projectName ?? "project"}-brand-list-excels.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  }, [files, brandingManifest?.projectName, buildExportHref]);

  if (files.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => void handleDownload()}
      disabled={isDownloading}
    >
      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Brand List Excels (.zip)
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Wire List PDF ZIP Download
// ---------------------------------------------------------------------------

function DownloadWireListPdfZipButton({
  wireListManifest,
  buildExportHref,
  projectName,
}: {
  wireListManifest: WireListPdfExportResult | null;
  buildExportHref: (relativePath: string, download?: boolean) => string;
  projectName?: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const files = wireListManifest?.sheetExports ?? [];

  const handleDownload = useCallback(async () => {
    if (files.length === 0) return;
    setIsDownloading(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      await Promise.all(
        files.map(async (file) => {
          const response = await fetch(buildExportHref(file.relativePath, true));
          if (!response.ok) return;
          const blob = await response.blob();
          zip.file(file.fileName, blob);
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName ?? "project"}-wire-list-pdfs.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  }, [files, projectName, buildExportHref]);

  if (files.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => void handleDownload()}
      disabled={isDownloading}
    >
      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Wire List PDFs (.zip)
    </Button>
  );
}
