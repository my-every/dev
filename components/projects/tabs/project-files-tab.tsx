"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { FileCard } from "@/components/projects/file-card";
import { RevisionScanWorkflow } from "@/components/revision/revision-scan-workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyTabState, StatItem } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";

interface FileRevisionRecord {
  filename: string;
  lastModified?: string;
  category?: "WIRE_LIST" | "LAYOUT";
}

interface RevisionHistoryResponse {
  folderName: string;
  currentWireList?: FileRevisionRecord | null;
  currentLayout?: FileRevisionRecord | null;
}

interface ExportRecord {
  fileName: string;
  relativePath: string;
  sheetName?: string;
}

interface ExportManifestResponse {
  generatedAt?: string;
  sheetExports?: ExportRecord[];
  combinedFileName?: string;
  combinedRelativePath?: string;
}

function buildExportHref(projectId: string, relativePath: string) {
  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const encodedSegments = normalizedRelativePath.split("/").map(encodeURIComponent).join("/");
  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}?download=1`;
}

function inferFileCardFormat(fileName: string): "pdf" | "xlsx" | "csv" | "json" | "doc" | "txt" {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "xlsx" || extension === "xls") return "xlsx";
  if (extension === "csv") return "csv";
  if (extension === "json") return "json";
  if (extension === "txt") return "txt";
  return "doc";
}

export function ProjectFilesTab({ project, onNavigateToTab }: ProjectTabProps) {
  const [history, setHistory] = useState<RevisionHistoryResponse | null>(null);
  const [brandingExports, setBrandingExports] = useState<ExportManifestResponse | null>(null);
  const [wireListExports, setWireListExports] = useState<ExportManifestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async (isCancelled?: () => boolean) => {
    setLoading(true);
    try {
      const [historyResponse, brandingResponse, wireListResponse] = await Promise.all([
        fetch(
          `/api/projects/revisions/${encodeURIComponent(project.id)}?pdNumber=${encodeURIComponent(project.pdNumber || "")}`,
          { cache: "no-store" },
        ),
        fetch(`/api/projects/${encodeURIComponent(project.id)}/exports?kind=branding`, { cache: "no-store" }).catch(() => null),
        fetch(`/api/projects/${encodeURIComponent(project.id)}/exports?kind=wire-lists`, { cache: "no-store" }).catch(() => null),
      ]);

      if (isCancelled?.()) {
        return;
      }

      setHistory(historyResponse.ok ? ((await historyResponse.json()) as RevisionHistoryResponse) : null);
      setBrandingExports(brandingResponse?.ok ? ((await brandingResponse.json()) as ExportManifestResponse) : null);
      setWireListExports(wireListResponse?.ok ? ((await wireListResponse.json()) as ExportManifestResponse) : null);
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
      }
    }
  }, [project.id, project.pdNumber]);

  useEffect(() => {
    let cancelled = false;
    void loadFiles(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadFiles]);

  const sourceFiles = useMemo(() => {
    if (!history?.folderName) return [];
    const items: Array<{ label: string; filename: string; icon: typeof FileSpreadsheet }> = [];
    if (history.currentWireList?.filename) {
      items.push({ label: "Current Wire List", filename: history.currentWireList.filename, icon: FileSpreadsheet });
    }
    if (history.currentLayout?.filename) {
      items.push({ label: "Current Layout", filename: history.currentLayout.filename, icon: FileText });
    }
    return items;
  }, [history]);

  const exportCount =
    (brandingExports?.sheetExports?.length ?? 0)
    + (wireListExports?.sheetExports?.length ?? 0)
    + (brandingExports?.combinedRelativePath ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading files...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <RevisionScanWorkflow />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatItem icon={FolderOpen} label="Source Files" value={String(sourceFiles.length)} />
        <StatItem icon={Download} label="Exports" value={String(exportCount)} color={project.color} />
      </div>

    
      {sourceFiles.length === 0 && exportCount === 0 ? (
        <EmptyTabState
          icon={FileText}
          title="No Files Available Yet"
          description="Upload the legal package first, then exports will appear here as the project moves through review and branding."
        />
      ) : null}

      {sourceFiles.length > 0 ? (
        <div className="rounded-lg border border-border/50 bg-card/60 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Legal Package</h4>
            {history?.folderName ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {history.folderName}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            {sourceFiles.map((file) => (
              <div key={file.filename} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-2.5">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="shrink-0">
                    <FileCard formatFile={inferFileCardFormat(file.filename)} size="compact" />
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <file.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{file.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.filename}</p>
                  </div>
                </div>
                {history?.folderName ? (
                  <a
                    href={`/api/projects/projects/files?project=${encodeURIComponent(history.folderName)}&file=${encodeURIComponent(file.filename)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-xs hover:bg-muted/50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(brandingExports || wireListExports) ? (
        <div className="rounded-lg border border-border/50 bg-card/60 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Generated Exports</h4>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void loadFiles()}
              aria-label="Refresh files"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            {brandingExports?.combinedRelativePath ? (
              <a
                href={buildExportHref(project.id, brandingExports.combinedRelativePath)}
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/20"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="shrink-0">
                    <FileCard formatFile={inferFileCardFormat(brandingExports.combinedFileName ?? "branding.xlsx")} size="compact" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Combined Brand List</p>
                    <p className="truncate text-xs text-emerald-600/80 dark:text-emerald-500/80">
                      {brandingExports.combinedFileName ?? brandingExports.combinedRelativePath}
                    </p>
                  </div>
                </div>
                <Download className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </a>
            ) : null}

            {[...(wireListExports?.sheetExports ?? []).slice(0, 3), ...(brandingExports?.sheetExports ?? []).slice(0, 3)].map((file) => (
              <a
                key={file.relativePath}
                href={buildExportHref(project.id, file.relativePath)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-2.5 hover:bg-muted/20"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="shrink-0">
                    <FileCard formatFile={inferFileCardFormat(file.fileName)} size="compact" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{file.sheetName ?? file.fileName}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.fileName}</p>
                  </div>
                </div>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("legals")}>
              Manage Legals
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("overview")}>
              Review Overview
            </Button>
            {brandingExports?.combinedRelativePath ? (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => onNavigateToTab?.("overview")}>
                <Sparkles className="h-3 w-3" />
                Branding Ready
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
