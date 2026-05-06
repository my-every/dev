"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileSpreadsheet, FileText, LayoutTemplate, RefreshCw, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectUploadFlow } from "@/components/projects/project-upload-flow";
import { hasUploadedLegals } from "@/lib/projects/dashboard-status";
import type { ProjectLifecycleGateStatus } from "@/types/d380-assignment-stages";
import { MetaRow } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectLegalsTabProps } from "@/components/projects/tabs/project-tab-types";
import { cn } from "@/lib/utils";
import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";
import type { LwcType } from "@/lib/workbook/types";

const LEGALS_GATE_COLORS: Record<ProjectLifecycleGateStatus, { text: string }> = {
  LOCKED: { text: "text-slate-500" },
  READY: { text: "text-amber-600" },
  COMPLETE: { text: "text-emerald-600" },
};

export function ProjectLegalsTab({ project, onProjectRefresh }: ProjectLegalsTabProps) {
  const model = project;
  const hasLegals = hasUploadedLegals(model);
  const [showUploadFlow, setShowUploadFlow] = useState(false);
  const [showLayoutWorkspace, setShowLayoutWorkspace] = useState(false);
  const [layoutPageCount, setLayoutPageCount] = useState<number | null>(null);
  const [layoutWorkspaceReady, setLayoutWorkspaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(project.id)}/layout-pdf`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          if (data?.pdf?.totalSheets) {
            setLayoutPageCount(data.pdf.totalSheets);
          }
          setLayoutWorkspaceReady(Boolean(data?.pdf?.url && data?.layoutIndex));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutWorkspaceReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const legalsGate = model.lifecycleGates?.find((gate) => gate.gateId === "LEGALS_READY");
  const legalsSlotDate = legalsGate?.targetDate;
  const legalsStatus: ProjectLifecycleGateStatus = legalsGate?.status ?? (hasLegals ? "READY" : "LOCKED");
  const currentRevisionDate = new Date(project.createdAt);
  const summaryMetrics = useMemo(
    () => [
      {
        label: "Status",
        value: hasLegals ? "Ready" : "Awaiting Upload",
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: "Revision",
        value: model.revision || "Untracked",
        icon: <RefreshCw className="h-4 w-4" />,
      },
      {
        label: "Wire Sheets",
        value: `${model.sheets.length}`,
        icon: <FileSpreadsheet className="h-4 w-4" />,
      },
      {
        label: "Layout Pages",
        value: layoutPageCount ? `${layoutPageCount}` : "None",
        icon: <LayoutTemplate className="h-4 w-4" />,
      },
    ],
    [hasLegals, layoutPageCount, model.revision, model.sheets.length],
  );

  const revisionPairs = useMemo(() => {
    if (!hasLegals) return [];

    const currentRev = model.revision || "A";
    const createdDate = new Date(project.createdAt).toLocaleDateString();

    return [
      {
        id: "rev-current",
        revision: currentRev,
        date: createdDate,
        isCurrent: true,
        wireListFile: model.filename,
        layoutFile:
          model.activeLayoutRevisionId || layoutPageCount
            ? `${model.pdNumber || project.name}_LAY_${currentRev}.pdf`
            : null,
        sheetCount: model.sheets.length,
      },
    ];
  }, [hasLegals, layoutPageCount, model, project.createdAt, project.name]);

  const formattedCurrentTimestamp = currentRevisionDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (showUploadFlow) {
    return (
      <div className="-mx-1 flex flex-col gap-3">
        <ProjectUploadFlow
          mode="revision"
          projectId={project.id}
          initialProjectName={project.name}
          initialPdNumber={model.pdNumber}
          initialUnitNumber={model.unitNumber}
          initialRevision={model.revision}
          initialLwcType={model.lwcType as LwcType | undefined}
          initialDueDate={typeof model.dueDate === "string" ? new Date(model.dueDate) : undefined}
          onCancel={() => setShowUploadFlow(false)}
          onClose={() => setShowUploadFlow(false)}
          onRevisionComplete={() => {
            void onProjectRefresh();
            setShowUploadFlow(false);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legals Control Center</p>
                  <h3 className="mt-1 text-2xl font-semibold">{project.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track the current legal package, jump into the layout workspace, or upload a fresh revision package.
                  </p>
                </div>
                <Badge variant="dot" size="sm" className={cn("h-5 px-2 text-[10px]", LEGALS_GATE_COLORS[legalsStatus].text)}>
                  {legalsStatus}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {metric.icon}
                      <span className="text-[11px] uppercase tracking-[0.16em]">{metric.label}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" className="gap-2" onClick={() => setShowUploadFlow(true)}>
                  <Upload className="h-4 w-4" />
                  {hasLegals ? "Upload New Revision" : "Upload Legals"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!layoutWorkspaceReady}
                  onClick={() => setShowLayoutWorkspace(true)}
                >
                  <LayoutTemplate className="h-4 w-4" />
                  Open Layout Workspace
                </Button>
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/20 p-5 lg:border-l lg:border-t-0">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Revision Snapshot
              </div>
              <div className="space-y-2.5">
                <MetaRow label="Slot Date">
                  {legalsSlotDate ? (
                    <span className="text-xs font-medium">{new Date(legalsSlotDate).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Not specified</span>
                  )}
                </MetaRow>
                {legalsGate?.completedAt ? (
                  <MetaRow label="Completed">
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {new Date(legalsGate.completedAt).toLocaleDateString()}
                    </span>
                  </MetaRow>
                ) : null}
                <MetaRow label="Current">
                  <span className="text-xs font-medium tabular-nums">{formattedCurrentTimestamp}</span>
                </MetaRow>
                <MetaRow label="PD#">
                  <span className="text-xs font-medium">{model.pdNumber || "Unassigned"}</span>
                </MetaRow>
                <MetaRow label="Unit">
                  <span className="text-xs font-medium">{model.unitNumber || "-"}</span>
                </MetaRow>
                <MetaRow label="Next Target">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {legalsSlotDate ? new Date(legalsSlotDate).toLocaleDateString() : "Awaiting slot"}
                  </span>
                </MetaRow>
              </div>
            </div>
          </div>
        </section>

        {!hasLegals ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-muted/60 p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold">No legal package uploaded yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload the UCP wire list workbook and layout PDF to unlock assignment mapping, layout search, and revision tracking.
                </p>
              </div>
              <Button className="gap-2" onClick={() => setShowUploadFlow(true)}>
                <Upload className="h-4 w-4" />
                Upload Legals
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest Revision</p>
                  <h4 className="mt-1 text-lg font-semibold">Revision History</h4>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {revisionPairs.length} package{revisionPairs.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {revisionPairs.map((rev) => (
                  <div
                    key={rev.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      rev.isCurrent ? "border-emerald-400/70 bg-emerald-500/5" : "border-border/50 bg-background/60",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="dot" size="sm" className="h-5 px-2 font-mono text-[10px]">
                          Rev {rev.revision}
                        </Badge>
                        {rev.isCurrent ? (
                          <Badge variant="solid" size="sm" className="h-5 px-2 text-[10px]">
                            Current
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{rev.date}</span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-card/50 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                          Workbook
                        </div>
                        <p className="mt-2 truncate text-sm text-foreground">{rev.wireListFile || "No workbook file"}</p>
                      </div>

                      <div className="rounded-xl border border-border/50 bg-card/50 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 text-sky-500" />
                          Layout PDF
                        </div>
                        <p className="mt-2 truncate text-sm text-foreground">{rev.layoutFile || "No layout PDF"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{rev.sheetCount} sheets</span>
                      <span>{layoutPageCount ? `${layoutPageCount} layout pages` : "No layout pages"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</p>
                <h4 className="mt-1 text-lg font-semibold">Revision Operations</h4>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowLayoutWorkspace(true)}
                  disabled={!layoutWorkspaceReady}
                  className="w-full rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-border/60 bg-card/70 p-2">
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Layout Workspace</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Search the uploaded PDF package and inspect extracted layout entities.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadFlow(true)}
                  className="w-full rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-border/60 bg-card/70 p-2">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Upload New Revision</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Replace or add the latest workbook and layout files while preserving project context.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-border/50 bg-background/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current Package</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Revision</span>
                    <span className="font-medium">{model.revision || "Untracked"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Uploaded</span>
                    <span className="font-medium">{formattedCurrentTimestamp}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Layout Ready</span>
                    <span className="font-medium">{layoutWorkspaceReady ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <LayoutPdfWorkspaceDialog
        open={showLayoutWorkspace}
        onOpenChange={setShowLayoutWorkspace}
        endpoint={`/api/projects/${encodeURIComponent(project.id)}/layout-pdf`}
      />

    </>
  );

}
