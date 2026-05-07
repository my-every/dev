"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, Filter, Loader2, RefreshCw, Settings2 } from "lucide-react";

import { RevisionFilesystemTreeTable } from "@/components/revision/revision-filesystem-tree-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { ProjectRevisionTreeRow, RevisionScanRequest, RevisionScanScope } from "@/lib/revision/types";

interface RevisionScanWorkflowProps {
  defaultLegalSourceRoot?: string | null;
  defaultBrandSourceRoot?: string | null;
}

interface RevisionScanApiResponse {
  scan: {
    generatedAt: string;
    projects: ProjectRevisionTreeRow[];
    fromTimeMs: number;
    toTimeMs: number;
    legalSourceRoot: string | null;
    brandSourceRoot: string | null;
  };
}

interface GenerateApiResponse {
  generated: Array<{
    projectKey: string;
    pdNumber: string;
    resolvedProjectId: string | null;
    outputs: string[];
    message: string;
  }>;
  manifestPath: string;
}

function toInputDateTimeLocal(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildRevisionRequest(input: {
  fromDateTime: string;
  toDateTime: string;
  scope: RevisionScanScope;
  legalSourceRoot: string;
  brandSourceRoot: string;
}): RevisionScanRequest {
  return {
    fromTimeMs: new Date(input.fromDateTime).getTime(),
    toTimeMs: new Date(input.toDateTime).getTime(),
    scope: input.scope,
    legalSourceRoot: input.legalSourceRoot,
    brandSourceRoot: input.scope === "legal" ? null : input.brandSourceRoot,
  };
}

function isMissingDependencies(project: ProjectRevisionTreeRow): boolean {
  return (
    project.validation.missingRequiredLegalAssets
    || project.validation.brandListRevisionsIncomplete
  );
}

export function RevisionScanWorkflow({
  defaultLegalSourceRoot,
  defaultBrandSourceRoot,
}: RevisionScanWorkflowProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<RevisionScanScope>("both");
  const [fromDateTime, setFromDateTime] = useState(() => toInputDateTimeLocal(new Date(new Date().getFullYear(), 0, 1)));
  const [toDateTime, setToDateTime] = useState(() => toInputDateTimeLocal(new Date()));
  const [legalSourceRoot, setLegalSourceRoot] = useState(defaultLegalSourceRoot ?? String.raw`S:\Legal Drawings`);
  const [brandSourceRoot, setBrandSourceRoot] = useState(defaultBrandSourceRoot ?? String.raw`S:\#Depts\380\6SIGMABRANDLIST\BRANDING\Projects Folder`);
  const [periodicEnabled, setPeriodicEnabled] = useState(false);
  const [periodicMinutes, setPeriodicMinutes] = useState("30");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scanGeneratedAt, setScanGeneratedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectRevisionTreeRow[]>([]);
  const [selectedProjectKeys, setSelectedProjectKeys] = useState<Set<string>>(new Set());
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<Set<string>>(new Set());
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "partial" | "blocked">("all");
  const [dependencyFilter, setDependencyFilter] = useState<"all" | "missing" | "changed">("all");
  const [lastGeneration, setLastGeneration] = useState<GenerateApiResponse | null>(null);

  const requestPayload = useMemo(
    () => buildRevisionRequest({ fromDateTime, toDateTime, scope, legalSourceRoot, brandSourceRoot }),
    [brandSourceRoot, fromDateTime, legalSourceRoot, scope, toDateTime],
  );

  const rangeStartMs = requestPayload.fromTimeMs ?? 0;
  const rangeEndMs = requestPayload.toTimeMs ?? Date.now();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (readinessFilter !== "all" && row.readiness !== readinessFilter) {
        return false;
      }

      if (dependencyFilter === "missing" && !isMissingDependencies(row)) {
        return false;
      }

      if (
        dependencyFilter === "changed"
        && !(row.latestModifiedTimeMs >= rangeStartMs && row.latestModifiedTimeMs <= rangeEndMs)
      ) {
        return false;
      }

      return true;
    });
  }, [dependencyFilter, rangeEndMs, rangeStartMs, readinessFilter, rows]);

  const selectedRows = useMemo(() => {
    const selected = selectedProjectKeys;
    return rows.filter((row) => selected.has(row.rootLabel));
  }, [rows, selectedProjectKeys]);

  const runScan = useCallback(async () => {
    setIsScanning(true);
    setLastGeneration(null);

    try {
      const response = await fetch("/api/projects/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json().catch(() => ({}))) as RevisionScanApiResponse & { error?: string };
      if (!response.ok || !payload.scan) {
        throw new Error(payload.error || "Failed to scan revision sources.");
      }

      setRows(payload.scan.projects);
      setScanGeneratedAt(payload.scan.generatedAt);
      setExpandedProjectKeys(new Set(payload.scan.projects.slice(0, 3).map((row) => row.rootLabel)));
      setSelectedProjectKeys(new Set());

      if (saveAsDefault) {
        localStorage.setItem(
          "revision-scan-defaults",
          JSON.stringify({
            scope,
            fromDateTime,
            toDateTime,
            legalSourceRoot,
            brandSourceRoot,
            periodicEnabled,
            periodicMinutes,
          }),
        );
      }

      toast({ title: "Revision scan complete", description: `${payload.scan.projects.length} project(s) discovered.` });
    } catch (error) {
      toast({
        title: "Revision scan failed",
        description: error instanceof Error ? error.message : "Failed to scan revisions.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  }, [
    brandSourceRoot,
    fromDateTime,
    legalSourceRoot,
    periodicEnabled,
    periodicMinutes,
    requestPayload,
    saveAsDefault,
    scope,
    toDateTime,
    toast,
  ]);

  useEffect(() => {
    if (!open || !periodicEnabled || isScanning) {
      return;
    }

    const minutes = Number(periodicMinutes);
    const intervalMinutes = Number.isFinite(minutes) && minutes >= 5 ? minutes : 30;
    const timer = window.setInterval(() => {
      void runScan();
    }, intervalMinutes * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open, periodicEnabled, periodicMinutes, isScanning, runScan]);

  const toggleProjectSelection = (projectKey: string, nextSelected: boolean) => {
    setSelectedProjectKeys((previous) => {
      const next = new Set(previous);
      if (nextSelected) next.add(projectKey);
      else next.delete(projectKey);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedProjectKeys.size === 0) {
      toast({ title: "No projects selected", description: "Select at least one project row before generating outputs." });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/projects/revisions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedProjectKeys: Array.from(selectedProjectKeys),
          scanRequest: requestPayload,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as GenerateApiResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate selected revision outputs.");
      }

      setLastGeneration(payload);
      toast({
        title: "Generation complete",
        description: `${payload.generated.length} project(s) generated from source references.`,
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate outputs.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpand = (projectKey: string) => {
    setExpandedProjectKeys((previous) => {
      const next = new Set(previous);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      return next;
    });
  };

  const handleSelectAll = (nextSelected: boolean) => {
    setSelectedProjectKeys(nextSelected ? new Set(filteredRows.map((row) => row.rootLabel)) : new Set());
  };

  const downloadByAbsolutePath = (absolutePath: string) => {
    const url = `/api/projects/revisions/file?path=${encodeURIComponent(absolutePath)}`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadLatestForType = (type: "wire-list" | "brand-list") => {
    for (const row of selectedRows) {
      const target = row.filesNewestFirst.find((file) => file.fileTypeIndicator === type);
      if (target) {
        downloadByAbsolutePath(target.absolutePath);
      }
    }
  };

  const downloadAllGeneratedOutputs = () => {
    for (const row of selectedRows) {
      for (const file of row.filesNewestFirst.slice(0, 6)) {
        downloadByAbsolutePath(file.absolutePath);
      }
    }
  };

  const exportSelectedProjectManifests = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      selectedProjects: selectedRows,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "selected-project-manifests.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openSourceFolders = () => {
    for (const row of selectedRows) {
      const firstPath = row.filesNewestFirst[0]?.absolutePath;
      if (!firstPath) continue;
      const folderPath = firstPath.split(/[/\\]/).slice(0, -1).join("/");
      window.open(`file://${folderPath}`, "_blank");
    }
  };

  const openAbsolutePaths = () => {
    for (const row of selectedRows) {
      const firstPath = row.filesNewestFirst[0]?.absolutePath;
      if (!firstPath) continue;
      window.open(`file://${firstPath}`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Check for Revisions
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden p-0 sm:max-w-[92vw]">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Filesystem Revision Scan Workflow</DialogTitle>
            <DialogDescription>
              Scan source paths directly, preview revision candidates, select projects, and generate schemas/manifests from latest valid file pairs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-auto px-6 py-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="revision-scan-from">From</Label>
                <Input
                  id="revision-scan-from"
                  type="datetime-local"
                  value={fromDateTime}
                  onChange={(event) => setFromDateTime(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revision-scan-to">To</Label>
                <Input
                  id="revision-scan-to"
                  type="datetime-local"
                  value={toDateTime}
                  onChange={(event) => setToDateTime(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={(value) => setScope(value as RevisionScanScope)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scan scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal">Legal Drawings</SelectItem>
                    <SelectItem value="brand">Brand Lists</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revision-scan-interval">Background Interval (minutes)</Label>
                <Input
                  id="revision-scan-interval"
                  type="number"
                  min={5}
                  value={periodicMinutes}
                  onChange={(event) => setPeriodicMinutes(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="revision-scan-legal-root">Legal Drawings Root</Label>
                <Input
                  id="revision-scan-legal-root"
                  value={legalSourceRoot}
                  onChange={(event) => setLegalSourceRoot(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revision-scan-brand-root">Brand Lists Root</Label>
                <Input
                  id="revision-scan-brand-root"
                  value={brandSourceRoot}
                  onChange={(event) => setBrandSourceRoot(event.target.value)}
                  disabled={scope === "legal"}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={periodicEnabled}
                  onCheckedChange={(checked) => setPeriodicEnabled(Boolean(checked))}
                />
                Enable periodic background revision checks
              </label>

              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={saveAsDefault}
                  onCheckedChange={(checked) => setSaveAsDefault(Boolean(checked))}
                />
                Save as default scan behavior
              </label>

              <Badge variant="outline" className="ml-auto">
                <CalendarClock className="mr-1 h-3.5 w-3.5" />
                {scanGeneratedAt ? `Scanned ${new Date(scanGeneratedAt).toLocaleString()}` : "No scan yet"}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={runScan} disabled={isScanning} className="gap-2">
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isScanning ? "Scanning..." : "Run Scan"}
              </Button>

              <Select value={readinessFilter} onValueChange={(value) => setReadinessFilter(value as typeof readinessFilter)}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder="Readiness filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All readiness</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dependencyFilter} onValueChange={(value) => setDependencyFilter(value as typeof dependencyFilter)}>
                <SelectTrigger className="w-55">
                  <SelectValue placeholder="Dependency filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dependencies</SelectItem>
                  <SelectItem value="missing">Missing dependencies</SelectItem>
                  <SelectItem value="changed">Changed files in range</SelectItem>
                </SelectContent>
              </Select>

              <Badge variant="secondary">
                <Filter className="mr-1 h-3.5 w-3.5" />
                {filteredRows.length} candidate projects
              </Badge>
            </div>

            <RevisionFilesystemTreeTable
              rows={filteredRows}
              expandedProjectKeys={expandedProjectKeys}
              selectedProjectKeys={selectedProjectKeys}
              onToggleExpand={toggleExpand}
              onToggleProjectSelection={toggleProjectSelection}
              onToggleSelectAll={handleSelectAll}
            />

            {lastGeneration ? (
              <div className="rounded-lg border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/20">
                <div className="mb-2 flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-4 w-4" />
                  Generated outputs for {lastGeneration.generated.length} project(s)
                </div>
                <ul className="space-y-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  {lastGeneration.generated.map((item) => (
                    <li key={item.projectKey}>
                      {item.projectKey}: {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <div className="mr-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Download / Open Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onClick={() => downloadLatestForType("brand-list")}>Download latest Brand List</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadLatestForType("wire-list")}>Download latest Wire List</DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadAllGeneratedOutputs}>Download all generated outputs</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSelectedProjectManifests}>Export selected project manifests</DropdownMenuItem>
                  <DropdownMenuItem onClick={openSourceFolders}>Open source folder actions</DropdownMenuItem>
                  <DropdownMenuItem onClick={openAbsolutePaths}>Open absolute file path actions</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Badge variant="outline">{selectedProjectKeys.size} selected</Badge>
            </div>

            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={isGenerating || selectedProjectKeys.size === 0}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Selected Outputs
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
