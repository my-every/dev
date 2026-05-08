"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Upload,
  AlertCircle,
  Wrench,
} from "lucide-react";

import { ProjectProvider } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseImportedBrandWorkbook } from "@/lib/wire-brand-list/import-workbook";
import type {
  MultiSheetImportDecision,
  MultiSheetImportSession,
  MultiSheetImportSheetDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";
import type { ProjectManifest } from "@/types/project-manifest";
import type { LwcType, ProjectModel } from "@/lib/workbook/types";
import { ProjectCollectionDetailsModal } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-collection-details-modal";

const BADGE_NUMBER_FOR_MODAL = "380";

const COLOR_PRESETS = [
  "#ffcc61",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#F97316",
] as const;

type BuildStatus =
  | "idle"
  | "creating"
  | "uploading"
  | "merging-brandlist"
  | "generating-exports"
  | "ready"
  | "error";

interface BuildCardState {
  status: BuildStatus;
  message: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface FormState {
  name: string;
  pdNumber: string;
  unitNumber: string;
  color: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  pdNumber: "",
  unitNumber: "",
  color: "#ffcc61",
};

export default function StandalonePage() {
  return (
    <ProjectProvider>
      <StandaloneBackgroundBuildPage />
    </ProjectProvider>
  );
}

function StandaloneBackgroundBuildPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [ucpWorkbook, setUcpWorkbook] = useState<File | null>(null);
  const [layoutPdf, setLayoutPdf] = useState<File | null>(null);
  const [brandMergeWorkbook, setBrandMergeWorkbook] = useState<File | null>(null);

  const [card, setCard] = useState<BuildCardState>({
    status: "idle",
    message: "Waiting for upload",
    progress: 0,
  });

  const [createdProject, setCreatedProject] = useState<ProjectManifest | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission === "granted"
      : false,
  );

  const isBusy =
    card.status === "creating" ||
    card.status === "uploading" ||
    card.status === "merging-brandlist" ||
    card.status === "generating-exports";

  const canStart =
    !isBusy &&
    form.name.trim().length > 0 &&
    form.pdNumber.trim().length > 0 &&
    form.unitNumber.trim().length > 0 &&
    Boolean(ucpWorkbook);

  const statusLabel = useMemo(() => {
    switch (card.status) {
      case "idle":
        return "Not started";
      case "creating":
        return "Creating project";
      case "uploading":
        return "Uploading UCP/PDF";
      case "merging-brandlist":
        return "Merging brandlist measurements";
      case "generating-exports":
        return "Generating wire/brand outputs";
      case "ready":
        return "Ready";
      case "error":
        return "Failed";
      default:
        return "Working";
    }
  }, [card.status]);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationGranted(result === "granted");
  }, []);

  const notifyReady = useCallback((projectName: string) => {
    if (!("Notification" in window)) {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    new Notification("Standalone project ready", {
      body: `${projectName} finished processing. Click the project card to open details.`,
    });
  }, []);

  const createManualProject = useCallback(async (): Promise<ProjectManifest> => {
    const now = new Date();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const model: ProjectModel = {
      id: projectId,
      filename: `${form.name.trim()}.xlsx`,
      name: form.name.trim(),
      pdNumber: form.pdNumber.trim() || undefined,
      unitNumber: form.unitNumber.trim() || undefined,
      revision: "UPLOADED",
      lwcType: undefined as LwcType | undefined,
      dueDate: undefined,
      planConlayDate: undefined,
      planConassyDate: undefined,
      shipDate: undefined,
      color: form.color,
      sheets: [],
      sheetData: {},
      createdAt: now,
      warnings: [],
      status: "legals_pending",
      lifecycleGates: [
        { gateId: "LEGALS_READY", status: "LOCKED" },
        { gateId: "BRANDLIST_COMPLETE", status: "LOCKED" },
        { gateId: "BRANDING_READY", status: "LOCKED" },
        { gateId: "KITTING_READY", status: "LOCKED" },
      ],
    };

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectModel: model }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to create project manifest.");
    }

    const payload = (await response.json()) as { manifest?: ProjectManifest };
    if (!payload.manifest) {
      throw new Error("Project created without manifest payload.");
    }

    return payload.manifest;
  }, [form.color, form.name, form.pdNumber, form.unitNumber]);

  const uploadLegals = useCallback(async (projectId: string) => {
    if (!ucpWorkbook) {
      throw new Error("UCP workbook is required.");
    }

    const formData = new FormData();
    formData.append("workbook", ucpWorkbook);
    formData.append("pdNumber", form.pdNumber.trim());
    formData.append("baseRevision", "UPLOADED");
    if (layoutPdf) {
      formData.append("layout", layoutPdf);
    }

    const response = await fetch(`/api/projects/revisions/${encodeURIComponent(projectId)}/files`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Upload failed.");
    }
  }, [form.pdNumber, layoutPdf, ucpWorkbook]);

  const mergeBrandlistMeasurements = useCallback(async (projectId: string) => {
    if (!brandMergeWorkbook) {
      return;
    }

    const importedSheets = await parseImportedBrandWorkbook(brandMergeWorkbook);

    const prepareResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "prepare",
        workbookFileName: brandMergeWorkbook.name,
        importedSheets,
      }),
    });

    if (!prepareResponse.ok) {
      const payload = (await prepareResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to prepare brandlist merge.");
    }

    const preparePayload = (await prepareResponse.json()) as {
      importSession: MultiSheetImportSession;
      sheetDiffs: MultiSheetImportSheetDiff[];
    };

    const rowDecisions: Record<string, MultiSheetImportDecision> = {
      ...(preparePayload.importSession.rowDecisions ?? {}),
    };

    // Auto-accept all detected length changes so imported brandlist lengths overwrite measurements.
    for (const sheetDiff of preparePayload.sheetDiffs) {
      for (const diff of sheetDiff.diffs) {
        if (diff.changeType === "length-changed") {
          rowDecisions[diff.diffId] = "accept";
        }
      }
    }

    const applyResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/multi-sheet-print/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply",
        importSession: {
          ...preparePayload.importSession,
          importMode: "length-only",
          rowDecisions,
        },
      }),
    });

    if (!applyResponse.ok) {
      const payload = (await applyResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Failed to apply brandlist overwrite.");
    }
  }, [brandMergeWorkbook]);

  const generateOutputs = useCallback(async (projectId: string) => {
    const [wireResponse, brandResponse] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=wire-lists`, {
        method: "POST",
      }),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/exports?kind=branding`, {
        method: "POST",
      }),
    ]);

    if (!wireResponse.ok || !brandResponse.ok) {
      const wirePayload = (await wireResponse.json().catch(() => ({}))) as { error?: string };
      const brandPayload = (await brandResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        wirePayload.error || brandPayload.error || "Failed to generate wire/brand outputs.",
      );
    }
  }, []);

  const refreshManifest = useCallback(async (projectId: string): Promise<ProjectManifest | null> => {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { manifest?: ProjectManifest };
    return payload.manifest ?? null;
  }, []);

  const startBackgroundBuild = useCallback(async () => {
    if (!canStart) {
      return;
    }

    try {
      setCard({
        status: "creating",
        message: "Creating project manifest…",
        progress: 10,
        startedAt: new Date().toISOString(),
      });

      const created = await createManualProject();
      setCreatedProject(created);

      setCard((prev) => ({
        ...prev,
        status: "uploading",
        message: "Uploading UCP workbook and optional layout PDF…",
        progress: 35,
      }));

      await uploadLegals(created.id);

      if (brandMergeWorkbook) {
        setCard((prev) => ({
          ...prev,
          status: "merging-brandlist",
          message: "Merging brandlist lengths to overwrite measurements…",
          progress: 62,
        }));
        await mergeBrandlistMeasurements(created.id);
      }

      setCard((prev) => ({
        ...prev,
        status: "generating-exports",
        message: "Generating wire lists and brand lists…",
        progress: 82,
      }));

      await generateOutputs(created.id);

      const refreshed = await refreshManifest(created.id);
      if (refreshed) {
        setCreatedProject(refreshed);
      }

      setCard((prev) => ({
        ...prev,
        status: "ready",
        message: "Project is ready. Click the card to open details.",
        progress: 100,
        completedAt: new Date().toISOString(),
      }));

      notifyReady(created.name);
    } catch (error) {
      setCard((prev) => ({
        ...prev,
        status: "error",
        message: "Build failed.",
        progress: prev.progress,
        error: error instanceof Error ? error.message : "Unexpected error",
      }));
    }
  }, [
    brandMergeWorkbook,
    canStart,
    createManualProject,
    generateOutputs,
    mergeBrandlistMeasurements,
    notifyReady,
    refreshManifest,
    uploadLegals,
  ]);

  const openProjectDetails = useCallback(() => {
    if (card.status !== "ready" || !createdProject) {
      return;
    }
    setDetailsModalOpen(true);
  }, [card.status, createdProject]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-6 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Standalone Project Build Tool</h1>
            <p className="text-xs text-muted-foreground">
              Upload UCP workbook, optional layout PDF, optional brandlist merge, process in background, then open project details.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={notificationGranted ? "secondary" : "outline"}
            className="gap-1.5"
            onClick={() => void requestNotificationPermission()}
          >
            {notificationGranted ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {notificationGranted ? "Notifications On" : "Enable Notifications"}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        <section className="rounded-xl border border-border bg-card/40 p-4">
          <h2 className="mb-4 text-sm font-semibold">Project Input</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs">Project Name</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. D11T-2203"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pd-number" className="text-xs">Unit PD</Label>
              <Input
                id="pd-number"
                value={form.pdNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, pdNumber: event.target.value }))}
                placeholder="e.g. 4N671"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit-number" className="text-xs">Unit Number</Label>
              <Input
                id="unit-number"
                value={form.unitNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, unitNumber: event.target.value }))}
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Project Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    form.color === color ? "scale-110 border-foreground" : "border-transparent opacity-70",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                />
              ))}
              <Input
                value={form.color}
                onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                className="h-8 w-32 font-mono text-xs"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FileInput
              id="ucp-workbook"
              label="UCP Workbook (required)"
              accept=".xlsx,.xls,.xlsm,.xlsb"
              file={ucpWorkbook}
              onChange={setUcpWorkbook}
            />
            <FileInput
              id="layout-pdf"
              label="Layout PDF (optional)"
              accept=".pdf"
              file={layoutPdf}
              onChange={setLayoutPdf}
            />
            <FileInput
              id="brand-merge"
              label="Brandlist Merge (optional)"
              accept=".xlsx,.xls,.xlsm,.xlsb"
              file={brandMergeWorkbook}
              onChange={setBrandMergeWorkbook}
            />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button
              type="button"
              disabled={!canStart}
              onClick={() => void startBackgroundBuild()}
              className="gap-1.5"
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Run In Background
            </Button>
            <p className="text-xs text-muted-foreground">
              Creates project, uploads UCP/PDF, optionally merges brandlist lengths, generates outputs, then marks ready.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-4">
          <h2 className="mb-3 text-sm font-semibold">Project Card</h2>

          <button
            type="button"
            disabled={card.status !== "ready"}
            onClick={openProjectDetails}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-colors",
              card.status === "ready"
                ? "border-green-400/40 bg-green-500/5 hover:bg-green-500/10"
                : "border-border bg-background/50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {card.status === "ready" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : card.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  )}
                  <p className="truncate text-sm font-semibold">
                    {createdProject?.name || form.name || "Standalone Project"}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {createdProject?.pdNumber || form.pdNumber || "PD pending"}
                </p>
              </div>
              <Badge variant={card.status === "ready" ? "secondary" : "outline"}>{statusLabel}</Badge>
            </div>

            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    card.status === "error" ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, card.progress))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{card.message}</p>
              {card.error ? <p className="mt-1 text-xs text-destructive">{card.error}</p> : null}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {card.startedAt ? `Started: ${new Date(card.startedAt).toLocaleTimeString()}` : "Not started"}
              </span>
              <span>
                {card.completedAt ? `Ready: ${new Date(card.completedAt).toLocaleTimeString()}` : ""}
              </span>
            </div>

            {card.status === "ready" ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs">
                <FolderOpen className="h-3 w-3" />
                Open Project Collection Details
              </div>
            ) : null}
          </button>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
          <p>
            Brandlist merge uses length-only import mode and auto-accepts all length changes. This overwrites schema measurements with the uploaded brandlist lengths.
          </p>
          <p className="mt-1">
            Layout PDF is optional but recommended when you want downstream measurement calculations to have layout data available.
          </p>
        </section>
      </main>

      <ProjectCollectionDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        badgeNumber={BADGE_NUMBER_FOR_MODAL}
        project={createdProject}
      />
    </div>
  );
}

function FileInput({
  id,
  label,
  accept,
  file,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-1.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-left"
        onClick={() => {
          if (inputRef.current) {
            // Reset value first so selecting the same file still fires change.
            inputRef.current.value = "";
            inputRef.current.click();
          }
        }}
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {file?.name || "Choose file..."}
        </span>
        {file ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange(null);
              if (inputRef.current) {
                inputRef.current.value = "";
              }
            }}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
