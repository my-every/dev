"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, ChevronDown, FileSpreadsheet, FolderOpen, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { useAppRuntime } from "@/components/providers/app-runtime-provider";

interface IndexedFile {
  fullPath: string;
  relativePath: string;
  fileName: string;
  kind:
    | "ucp_wl_compare_spreadsheet"
    | "ucp_wire_list_spreadsheet"
    | "ucp_spreadsheet"
    | "lay_pdf";
  mtimeMs: number;
  sizeBytes: number;
  status: "new" | "updated" | "unchanged";
}

interface IndexedProject {
  projectFolderName: string;
  projectNumber: string;
  projectName: string;
  electricalPath: string;
  hasUpdates: boolean;
  files: IndexedFile[];
}

interface LegalDrawingsIndexPayload {
  sourceRoot: string;
  scannedAt: string;
  fromYear: number;
  fromDays?: number;
  projectCount: number;
  updatedProjectCount: number;
  projects: IndexedProject[];
  configured?: boolean;
  message?: string | null;
}

const REFRESH_WINDOWS = [
  { label: "30 days", days: 30 },
  { label: "3 mo", days: 90 },
  { label: "6 mo", days: 180 },
  { label: "12 mo", days: 365 },
] as const;

const fetcher = async (url: string): Promise<LegalDrawingsIndexPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Failed to fetch legal drawings source index.");
  }
  return response.json() as Promise<LegalDrawingsIndexPayload>;
};

function toKindLabel(kind: IndexedFile["kind"]): string {
  switch (kind) {
    case "ucp_wl_compare_spreadsheet":
      return "UCP WL Compare";
    case "ucp_wire_list_spreadsheet":
      return "UCP Wire List";
    case "ucp_spreadsheet":
      return "UCP";
    case "lay_pdf":
      return "LAY PDF";
    default:
      return kind;
  }
}

function toStatusVariant(status: IndexedFile["status"]): "default" | "secondary" | "outline" {
  if (status === "new") return "default";
  if (status === "updated") return "secondary";
  return "outline";
}

export function LegalSourceIndexPanel({
  onCreated,
}: {
  onCreated?: (projectId: string) => void;
}) {
  const { isElectron, chooseDirectory, isSelectingWorkspace } = useAppRuntime();
  const [query, setQuery] = useState("");
  const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(new Set());
  const [refreshWindowDays, setRefreshWindowDays] = useState<number>(90);
  const [isRefreshingIndex, setIsRefreshingIndex] = useState(false);
  const [sourceRootDraft, setSourceRootDraft] = useState("");
  const [configuredSourceRoot, setConfiguredSourceRoot] = useState("");
  const [isSavingSourceRoot, setIsSavingSourceRoot] = useState(false);
  const [sourceRootSaveState, setSourceRootSaveState] = useState<"idle" | "saved">("idle");
  const [sourceFeedback, setSourceFeedback] = useState<string | null>(null);
  const [sourceFeedbackKind, setSourceFeedbackKind] = useState<"success" | "error" | "info">("info");
  const [isCreatingFromSelected, setIsCreatingFromSelected] = useState(false);
  const [createFromSelectedError, setCreateFromSelectedError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedPdNumber, setSeedPdNumber] = useState<string | null>(null);

  const indexUrl = useMemo(() => {
    const params = new URLSearchParams({ fromDays: String(refreshWindowDays) });
    const sourceRoot = configuredSourceRoot.trim();
    if (sourceRoot) {
      params.set("sourceRoot", sourceRoot);
    }
    return `/api/runtime/legal-drawings-index?${params.toString()}`;
  }, [configuredSourceRoot, refreshWindowDays]);

  const { data, error, isLoading, mutate } = useSWR(
    indexUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    },
  );

  useEffect(() => {
    if (typeof data?.sourceRoot === "string") {
      setSourceRootDraft(data.sourceRoot);
      if (data.sourceRoot.trim().length > 0) {
        setConfiguredSourceRoot(data.sourceRoot);
      }
    }
  }, [data?.sourceRoot]);

  useEffect(() => {
    let mounted = true;

    const loadConfiguredPath = async () => {
      try {
        const { response, payload } = await fetchJsonWithTimeout("/api/runtime/path-settings", {
          cache: "no-store",
        }, 12000);
        if (!mounted || !response.ok) {
          return;
        }

        const pathPayload = payload as { legalDrawingsPath?: string | null };
        const startupPath = String(pathPayload.legalDrawingsPath ?? "").trim();
        if (!startupPath) {
          return;
        }

        setConfiguredSourceRoot(startupPath);
        setSourceRootDraft(startupPath);
        setSourceFeedback("Loaded Legal Drawings source root from startup settings.");
        setSourceFeedbackKind("info");
      } catch {
        // Keep panel usable even if path-settings fetch fails.
      }
    };

    void loadConfiguredPath();

    return () => {
      mounted = false;
    };
  }, [fetchJsonWithTimeout]);

  const fetchJsonWithTimeout = useCallback(async (
    url: string,
    init?: RequestInit,
    timeoutMs = 20000,
  ) => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { response, payload };
    } finally {
      window.clearTimeout(timerId);
    }
  }, []);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data?.projects ?? [];

    return (data?.projects ?? []).filter((project) => {
      if (
        project.projectNumber.toLowerCase().includes(normalized)
        || project.projectFolderName.toLowerCase().includes(normalized)
        || project.projectName.toLowerCase().includes(normalized)
      ) {
        return true;
      }

      return project.files.some((file) => file.fileName.toLowerCase().includes(normalized));
    });
  }, [data?.projects, query]);

  const selectedUpdatedCount = useMemo(() => {
    let count = 0;
    for (const project of filteredProjects) {
      for (const file of project.files) {
        const key = `${project.projectFolderName}::${file.relativePath}`;
        if (selectedFileKeys.has(key) && (file.status === "new" || file.status === "updated")) {
          count += 1;
        }
      }
    }
    return count;
  }, [filteredProjects, selectedFileKeys]);

  const selectedProjectNumbers = useMemo(() => {
    const projectNumbers = new Set<string>();
    for (const project of filteredProjects) {
      const hasSelectedFile = project.files.some((file) => {
        const key = `${project.projectFolderName}::${file.relativePath}`;
        return selectedFileKeys.has(key);
      });
      if (hasSelectedFile) {
        projectNumbers.add(project.projectNumber);
      }
    }
    return Array.from(projectNumbers);
  }, [filteredProjects, selectedFileKeys]);

  const refreshWindowLabel = useMemo(
    () => REFRESH_WINDOWS.find((window) => window.days === refreshWindowDays)?.label ?? `${refreshWindowDays} days`,
    [refreshWindowDays],
  );

  const refreshIndex = useCallback(async () => {
    setIsRefreshingIndex(true);
    setSourceFeedback("Refreshing index...");
    setSourceFeedbackKind("info");
    console.info("[legal-source-index-panel] refresh:start", { fromDays: refreshWindowDays });
    try {
      const sourceRoot = configuredSourceRoot.trim();
      const { response, payload } = await fetchJsonWithTimeout("/api/runtime/legal-drawings-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDays: refreshWindowDays,
          ...(sourceRoot ? { sourceRoot } : {}),
        }),
      });
      const typedPayload = payload as { error?: string; message?: string | null };
      if (!response.ok) {
        throw new Error(typedPayload.error || "Failed to refresh legal drawings index.");
      }
      await mutate();
      setSourceFeedback(typedPayload.message || `Index refreshed for ${refreshWindowLabel}.`);
      setSourceFeedbackKind("success");
      console.info("[legal-source-index-panel] refresh:success", { fromDays: refreshWindowDays, sourceRoot: sourceRoot || null });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Failed to refresh legal drawings index.";
      setSourceFeedback(message);
      setSourceFeedbackKind("error");
      console.error("[legal-source-index-panel] refresh:failed", { message, fromDays: refreshWindowDays, sourceRoot: sourceRoot || null });
    } finally {
      setIsRefreshingIndex(false);
    }
  }, [configuredSourceRoot, fetchJsonWithTimeout, mutate, refreshWindowDays, refreshWindowLabel]);

  const pickAndSaveSourceRoot = useCallback(async () => {
    if (!isElectron) return;

    const selected = await chooseDirectory({
      title: "Select Legal Drawings Root (Drawings)",
      defaultPath: String.raw`S:\Legal Drawings\Drawings`,
      createDirectory: false,
    });

    if (!selected) {
      return;
    }

    setSourceRootDraft(selected);
    setSourceRootSaveState("idle");

    setIsSavingSourceRoot(true);
    setSourceFeedback("Saving source root...");
    setSourceFeedbackKind("info");
    console.info("[legal-source-index-panel] source-root:save:start", { sourceRoot: selected });
    try {
      const { response: settingsResponse, payload: settingsPayload } = await fetchJsonWithTimeout("/api/runtime/path-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalDrawingsPath: selected }),
      });
      if (!settingsResponse.ok) {
        const typedSettingsPayload = settingsPayload as { error?: string };
        throw new Error(typedSettingsPayload.error || "Failed to save legal drawings path.");
      }

      // Path save succeeded; persist local configured source immediately.
      setConfiguredSourceRoot(selected);
      setSourceRootSaveState("saved");
      setSourceFeedback("Source root saved. Refreshing index...");
      setSourceFeedbackKind("info");

      const { response: refreshResponse, payload: refreshPayload } = await fetchJsonWithTimeout("/api/runtime/legal-drawings-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRoot: selected, fromDays: refreshWindowDays }),
      });
      const typedRefreshPayload = refreshPayload as { error?: string; message?: string | null };
      if (!refreshResponse.ok) {
        setSourceFeedback(
          `Source root saved, but index refresh failed: ${typedRefreshPayload.error || "Failed to refresh legal drawings index."}`,
        );
        setSourceFeedbackKind("error");
        console.error("[legal-source-index-panel] source-root:refresh-after-save:failed", {
          sourceRoot: selected,
          error: typedRefreshPayload.error || "Failed to refresh legal drawings index.",
        });
        await mutate();
        return;
      }

      await mutate();
      setSourceFeedback(typedRefreshPayload.message || "Source root saved and index refreshed.");
      setSourceFeedbackKind("success");
      console.info("[legal-source-index-panel] source-root:save:success", { sourceRoot: selected });
    } catch (saveError) {
      const message = saveError instanceof Error
        ? saveError.name === "AbortError"
          ? "Saving source root timed out. Please retry."
          : saveError.message
        : "Failed to save source root.";
      setSourceRootSaveState("idle");
      setSourceFeedback(message);
      setSourceFeedbackKind("error");
      console.error("[legal-source-index-panel] source-root:save:failed", { message, sourceRoot: selected });
    } finally {
      setIsSavingSourceRoot(false);
    }
  }, [chooseDirectory, fetchJsonWithTimeout, isElectron, mutate, refreshWindowDays]);

  const toggleFile = useCallback((projectFolderName: string, relativePath: string, checked: boolean) => {
    const key = `${projectFolderName}::${relativePath}`;
    setSelectedFileKeys((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const openCreateDialogForProject = useCallback((pdNumber: string) => {
    setSeedPdNumber(pdNumber);
    setDialogOpen(true);
  }, []);

  const createFromSelected = useCallback(async () => {
    if (!data || selectedProjectNumbers.length !== 1) {
      return;
    }

    const targetProjectNumber = selectedProjectNumbers[0]!;
    const selectedFiles = data.projects
      .filter((project) => project.projectNumber === targetProjectNumber)
      .flatMap((project) =>
        project.files
          .filter((file) => selectedFileKeys.has(`${project.projectFolderName}::${file.relativePath}`))
          .map((file) => ({
            fullPath: file.fullPath,
            fileName: file.fileName,
            kind: file.kind,
            mtimeMs: file.mtimeMs,
          })),
      );

    if (selectedFiles.length === 0) {
      setCreateFromSelectedError("No selected files were found for the chosen project.");
      return;
    }

    setCreateFromSelectedError(null);
    setIsCreatingFromSelected(true);
    try {
      const response = await fetch("/api/runtime/legal-drawings-index/instantiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdNumber: targetProjectNumber,
          selectedFiles,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        manifest?: { id?: string };
      };

      if (!response.ok || !payload.manifest?.id) {
        throw new Error(payload.error || "Failed to create project from selected files.");
      }

      setSelectedFileKeys(new Set());
      onCreated?.(payload.manifest.id);
    } catch (error) {
      setCreateFromSelectedError(
        error instanceof Error ? error.message : "Failed to create project from selected files.",
      );
    } finally {
      setIsCreatingFromSelected(false);
    }
  }, [data, onCreated, selectedFileKeys, selectedProjectNumbers]);

  return (
    <Card className="mb-4 border-border/60 bg-card/70">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Legal Source Index</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refreshIndex()}
                disabled={isRefreshingIndex}
                className="rounded-r-none"
              >
                {isRefreshingIndex ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Refresh {refreshWindowLabel}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isRefreshingIndex}
                    className="rounded-l-none border-l-0 px-2"
                    aria-label="Select refresh duration"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {REFRESH_WINDOWS.map((window) => (
                    <DropdownMenuItem
                      key={window.days}
                      onClick={() => setRefreshWindowDays(window.days)}
                      className="text-xs"
                    >
                      {window.label}
                      {refreshWindowDays === window.days ? " (selected)" : ""}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isElectron ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void pickAndSaveSourceRoot()}
                disabled={isSelectingWorkspace || isSavingSourceRoot}
              >
                {isSavingSourceRoot ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : sourceRootSaveState === "saved" ? (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isSelectingWorkspace
                  ? "Picking..."
                  : isSavingSourceRoot
                    ? "Saving..."
                    : sourceRootSaveState === "saved"
                      ? "Saved"
                      : "Set Source Root"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Source: {data?.sourceRoot || "Not configured"}
          {data?.scannedAt ? ` | Last scan: ${new Date(data.scannedAt).toLocaleString()}` : ""}
          {data?.fromDays ? ` | Window: ${data.fromDays} days` : ""}
          {` | Refresh mode: manual`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={sourceRootDraft}
            readOnly
            placeholder="Set legal drawings source root"
            className="h-8 min-w-64 flex-1"
          />
        </div>

        {data?.configured === false && data?.message ? (
          <div className="rounded-md border border-amber-400/30 bg-amber-100/40 px-3 py-2 text-xs text-amber-800">
            {data.message}
          </div>
        ) : null}

        {sourceFeedback ? (
          <div
            className={
              sourceFeedbackKind === "error"
                ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                : sourceFeedbackKind === "success"
                  ? "rounded-md border border-emerald-400/30 bg-emerald-100/40 px-3 py-2 text-xs text-emerald-800"
                  : "rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
            }
          >
            {sourceFeedback}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Projects: {data?.projectCount ?? 0}</Badge>
          <Badge variant="secondary">Updated: {data?.updatedProjectCount ?? 0}</Badge>
          <Badge variant="default">Selected updated files: {selectedUpdatedCount}</Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={
              isCreatingFromSelected
              || selectedUpdatedCount === 0
              || selectedProjectNumbers.length !== 1
            }
            onClick={() => void createFromSelected()}
          >
            {isCreatingFromSelected ? "Creating..." : "Create from Selected"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by PD#, folder, project name, or file name..."
        />

        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading legal source index...</div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No indexed legal projects matched your filter.</div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <div key={project.projectFolderName} className="rounded-md border border-border/60 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {project.projectNumber}
                      {project.projectName ? ` - ${project.projectName}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{project.projectFolderName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.hasUpdates ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Updates
                      </Badge>
                    ) : (
                      <Badge variant="outline">No changes</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateDialogForProject(project.projectNumber)}
                    >
                      Create Instance
                    </Button>
                  </div>
                </div>

                {project.files.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No matching UCP/LAY files under Electrical.</div>
                ) : (
                  <div className="space-y-1">
                    {project.files.map((file) => {
                      const fileKey = `${project.projectFolderName}::${file.relativePath}`;
                      const checked = selectedFileKeys.has(fileKey);

                      return (
                        <label
                          key={fileKey}
                          className="flex cursor-pointer items-start gap-2 rounded border border-border/40 px-2 py-1.5 text-xs hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={(event) => toggleFile(project.projectFolderName, file.relativePath, event.target.checked)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <FileSpreadsheet className="h-3 w-3" />
                              <span className="truncate font-medium">{file.fileName}</span>
                              <Badge variant="outline">{toKindLabel(file.kind)}</Badge>
                              <Badge variant={toStatusVariant(file.status)}>{file.status}</Badge>
                            </div>
                            <div className="mt-0.5 truncate text-muted-foreground">{file.fullPath}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {createFromSelectedError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {createFromSelectedError}
          </div>
        ) : null}

        <CreateProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={null}
          initialValues={{
            sourceMode: "legal-library",
            name: "",
          }}
          initialLegalSource={seedPdNumber ? { pdNumber: seedPdNumber } : undefined}
          dialogTitle="Create Project Instance from Indexed Legal Source"
          dialogDescription="Use the indexed legal directory selection as the seed, then continue with standard project creation."
          onCreated={onCreated}
        />
      </CardContent>
    </Card>
  );
}
