"use client";

import { useMemo } from "react";
import { CheckCircle2, Download, Minus, Plus, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  MultiSheetImportDecision,
  MultiSheetImportMode,
  MultiSheetImportSheetDiff,
  MultiSheetImportRowDiff,
} from "@/lib/wire-brand-list/multi-sheet-review";
import { cn } from "@/lib/utils";

interface MultiSheetImportReviewPanelProps {
  sheetDiffs: MultiSheetImportSheetDiff[];
  activeSheetSlug: string | null;
  importMode: MultiSheetImportMode;
  rowDecisions: Record<string, MultiSheetImportDecision>;
  onImportModeChange: (mode: MultiSheetImportMode) => void;
  onActiveSheetChange: (sheetSlug: string) => void;
  onDecisionChange: (diffId: string, decision: MultiSheetImportDecision, sheetSlug: string) => void;
  onApproveSection: (sheetSlug: string, sectionKey: string) => void;
  onApproveSheet: (sheetSlug: string) => void;
  onAcceptAllLengthChanges: () => void;
  onReviewStructuralChanges: () => void;
  onApply: () => void;
  onContinueToReview: () => void;
  isApplying: boolean;
}

export function MultiSheetImportReviewPanel({
  sheetDiffs,
  activeSheetSlug,
  importMode,
  rowDecisions,
  onImportModeChange,
  onActiveSheetChange,
  onDecisionChange,
  onApproveSection,
  onApproveSheet,
  onAcceptAllLengthChanges,
  onReviewStructuralChanges,
  onApply,
  onContinueToReview,
  isApplying,
}: MultiSheetImportReviewPanelProps) {
  const activeSheetDiff = sheetDiffs.find((sheet) => sheet.sheetSlug === activeSheetSlug) ?? sheetDiffs[0] ?? null;
  const sectionSummaries = useMemo(() => {
    if (!activeSheetDiff) {
      return [];
    }

    const grouped = new Map<string, { label: string; pending: number; actionable: number }>();
    for (const diff of activeSheetDiff.diffs) {
      if (!grouped.has(diff.sectionKey)) {
        grouped.set(diff.sectionKey, { label: diff.sectionLabel, pending: 0, actionable: 0 });
      }
      const entry = grouped.get(diff.sectionKey)!;
      if (diff.changeType !== "unchanged") {
        entry.actionable += 1;
        if ((rowDecisions[diff.diffId] ?? "pending") === "pending") {
          entry.pending += 1;
        }
      }
    }
    return Array.from(grouped.entries()).map(([sectionKey, value]) => ({ sectionKey, ...value }));
  }, [activeSheetDiff, rowDecisions]);

  const activeCounts = useMemo(() => {
    if (!activeSheetDiff) {
      return { lengthChanges: 0, structuralChanges: 0 };
    }
    let lengthChanges = 0;
    let structuralChanges = 0;
    for (const diff of activeSheetDiff.diffs) {
      if (diff.changeType === "length-changed") {
        lengthChanges += 1;
      } else if (diff.changeType === "imported-only" || diff.changeType === "current-only") {
        structuralChanges += 1;
      }
    }
    return { lengthChanges, structuralChanges };
  }, [activeSheetDiff]);

  const importSummary = useMemo(() => {
    let lengthChanges = 0;
    let acceptedLengthChanges = 0;
    let pendingLengthChanges = 0;
    let structuralAdditions = 0;
    let structuralRemovals = 0;

    for (const sheetDiff of sheetDiffs) {
      for (const diff of sheetDiff.diffs) {
        if (diff.changeType === "length-changed") {
          lengthChanges += 1;
          const decision = rowDecisions[diff.diffId] ?? "pending";
          if (decision === "accept") {
            acceptedLengthChanges += 1;
          } else if (decision === "pending") {
            pendingLengthChanges += 1;
          }
        } else if (diff.changeType === "imported-only") {
          structuralAdditions += 1;
        } else if (diff.changeType === "current-only") {
          structuralRemovals += 1;
        }
      }
    }

    return {
      lengthChanges,
      acceptedLengthChanges,
      pendingLengthChanges,
      structuralAdditions,
      structuralRemovals,
    };
  }, [rowDecisions, sheetDiffs]);

  return (
    <div className="flex h-full min-h-0 flex-col xl:flex-row">
      <aside className="w-full border-b bg-muted/10 xl:w-[320px] xl:border-b-0 xl:border-r">
        <div className="border-b bg-background/90 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Imported Sheets</div>
          <div className="mt-1 text-sm font-semibold">{sheetDiffs.length} matched sheets ready for review</div>
        </div>
        <div className="space-y-2 p-3">
          {sheetDiffs.map((sheet) => {
            const pending = sheet.diffs.filter((diff) => diff.changeType !== "unchanged" && (rowDecisions[diff.diffId] ?? "pending") === "pending").length;
            return (
              <button
                key={sheet.sheetSlug}
                type="button"
                onClick={() => onActiveSheetChange(sheet.sheetSlug)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                  sheet.sheetSlug === activeSheetSlug ? "border-primary/40 bg-primary/10" : "bg-background hover:bg-muted/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{sheet.sheetName}</span>
                  <Badge variant={pending === 0 ? "solid" : "dot"}>{pending === 0 ? "Ready" : `${pending} pending`}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Import source: {sheet.sourceSheetName}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeSheetDiff ? (
          <>
            <div className="border-b bg-background/95 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Import Review</div>
                  <div className="mt-1 text-lg font-semibold">{activeSheetDiff.sheetName}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={importMode === "length-only" ? "solid" : "dot"}>Length-only import</Badge>
                    <span className="text-muted-foreground">
                      {activeCounts.lengthChanges} length changes
                      {activeCounts.structuralChanges > 0 ? ` • ${activeCounts.structuralChanges} structural changes` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-full border bg-background p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={importMode === "length-only" ? "primary" : "ghost"}
                      className="rounded-full"
                      onClick={() => onImportModeChange("length-only")}
                    >
                      Length Only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={importMode === "full" ? "primary" : "ghost"}
                      className="rounded-full"
                      onClick={() => onImportModeChange("full")}
                    >
                      Full Merge
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => onApproveSheet(activeSheetDiff.sheetSlug)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {importMode === "length-only" ? "Approve Length Changes" : "Approve All Diffs"}
                  </Button>
                  <Button type="button" size="sm" onClick={onApply} disabled={isApplying}>
                    {isApplying ? "Applying..." : "Apply Accepted Changes"}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={onContinueToReview}>
                    Continue To Review
                  </Button>
                </div>
              </div>

           

            
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="min-w-[980px] divide-y">
                <div className="grid grid-cols-[180px_1fr_1fr_180px] gap-3 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <div>Status</div>
                  <div>Current Brand Schema</div>
                  <div>Imported Workbook</div>
                  <div>Decision</div>
                </div>
                {activeSheetDiff.diffs.map((diff) => (
                  <DiffRow
                    key={diff.diffId}
                    diff={diff}
                    importMode={importMode}
                    decision={rowDecisions[diff.diffId] ?? (diff.changeType === "unchanged" ? "accept" : "pending")}
                    onDecisionChange={(decision) => onDecisionChange(diff.diffId, decision, activeSheetDiff.sheetSlug)}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No matched imported sheets available.</div>
        )}
      </div>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail?: string;
  tone: "amber" | "green" | "red";
}) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    red: "border-red-200 bg-red-50 text-red-950",
  } satisfies Record<typeof tone, string>;

  return (
    <div className={cn("rounded-2xl border px-4 py-3", toneClasses[tone])}>
      <div className="text-xs uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {detail ? <div className="mt-1 text-xs opacity-80">{detail}</div> : null}
    </div>
  );
}

function DiffRow({
  diff,
  importMode,
  decision,
  onDecisionChange,
}: {
  diff: MultiSheetImportRowDiff;
  importMode: MultiSheetImportMode;
  decision: MultiSheetImportDecision;
  onDecisionChange: (decision: MultiSheetImportDecision) => void;
}) {
  const tones = {
    unchanged: "bg-muted/10",
    "length-changed": "bg-amber-50",
    "imported-only": "bg-emerald-50",
    "current-only": "bg-red-50",
  } satisfies Record<MultiSheetImportRowDiff["changeType"], string>;

  const isStructural = diff.changeType === "imported-only" || diff.changeType === "current-only";
  const isLockedByMode = importMode === "length-only" && isStructural;
  const currentRow = diff.currentRow ? {
    fromDeviceId: diff.currentRow.fromDeviceId,
    wireNo: diff.currentRow.wireNo,
    wireId: diff.currentRow.wireId,
    gaugeSize: diff.currentRow.gaugeSize,
    length: diff.currentRow.length,
    toDeviceId: diff.currentRow.toDeviceId,
    toLocation: diff.currentRow.toLocation,
  } : null;
  const importedRow = diff.importedRow ? {
    fromDeviceId: diff.importedRow.fromDeviceId,
    wireNo: diff.importedRow.wireNo,
    wireId: diff.importedRow.wireId,
    gaugeSize: diff.importedRow.gaugeSize,
    length: diff.importedRow.length,
    toDeviceId: diff.importedRow.toDeviceId,
    toLocation: diff.importedRow.toLocation,
  } : null;

  return (
    <div className={cn("grid grid-cols-[210px_1fr_1fr_190px] gap-3 px-4 py-3", tones[diff.changeType])}>
      <div className="space-y-1">
        <Badge variant="dot" className="text-[10px] uppercase tracking-[0.08em]">{diff.changeType.replace("-", " ")}</Badge>
        <div className="text-xs text-muted-foreground">{diff.sectionLabel}</div>
        <div className="rounded-xl border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Match Key</span>
          <div className="mt-0.5 truncate font-mono">{diff.matchKey}</div>
        </div>
        {isLockedByMode ? (
          <div className="text-[11px] font-medium text-amber-700">
            Structural change skipped in length-only mode
          </div>
        ) : null}
      </div>

      <RowCard
        title="Current"
        tone={diff.changeType === "current-only" ? "red" : "muted"}
        row={currentRow}
        otherRow={importedRow}
      />
      <RowCard
        title="Imported"
        tone={diff.changeType === "imported-only" || diff.changeType === "length-changed" ? "green" : "muted"}
        row={importedRow}
        otherRow={currentRow}
      />

      <div className="flex flex-col gap-2">
        {diff.changeType === "unchanged" ? (
          <Badge>Already matched</Badge>
        ) : (
          <>
            <Button type="button" size="sm" onClick={() => onDecisionChange("accept")} variant={decision === "accept" ? "primary" : "outline"} disabled={isLockedByMode}>
              <Plus className="mr-2 h-4 w-4" />
              Accept
            </Button>
            <Button type="button" size="sm" onClick={() => onDecisionChange("reject")} variant={decision === "reject" ? "secondary" : "outline"} disabled={isLockedByMode}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button type="button" size="sm" onClick={() => onDecisionChange("pending")} variant={decision === "pending" ? "secondary" : "ghost"} disabled={isLockedByMode}>
              <Minus className="mr-2 h-4 w-4" />
              Pending
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function RowCard({
  title,
  tone,
  row,
  otherRow,
}: {
  title: string;
  tone: "green" | "red" | "muted";
  row: {
    fromDeviceId: string;
    wireNo: string;
    wireId: string;
    gaugeSize: string;
    length: number | null;
    toDeviceId: string;
    toLocation: string;
  } | null;
  otherRow: {
    fromDeviceId: string;
    wireNo: string;
    wireId: string;
    gaugeSize: string;
    length: number | null;
    toDeviceId: string;
    toLocation: string;
  } | null;
}) {
  const toneClasses = {
    green: "border-emerald-200 bg-emerald-50/80",
    red: "border-red-200 bg-red-50/80",
    muted: "border-border bg-background/70",
  } satisfies Record<typeof tone, string>;

  return (
    <div className={cn("rounded-2xl border p-3 text-sm", toneClasses[tone])}>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        {title === "Imported" ? <Download className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {title}
      </div>
      {row ? (
        <div className="space-y-1.5 text-xs">
          <CompareField label="From Device" value={row.fromDeviceId} changed={isChanged(row.fromDeviceId, otherRow?.fromDeviceId)} />
          <CompareField label="To Device" value={row.toDeviceId} changed={isChanged(row.toDeviceId, otherRow?.toDeviceId)} />
          <CompareField label="Wire No" value={row.wireNo} changed={isChanged(row.wireNo, otherRow?.wireNo)} />
          <CompareField label="Wire ID" value={row.wireId} changed={isChanged(row.wireId, otherRow?.wireId)} />
          <CompareField label="Gauge" value={row.gaugeSize} changed={isChanged(row.gaugeSize, otherRow?.gaugeSize)} />
          <CompareField
            label="Length"
            value={typeof row.length === "number" ? String(row.length) : "-"}
            changed={isChanged(
              typeof row.length === "number" ? String(row.length) : null,
              typeof otherRow?.length === "number" ? String(otherRow.length) : null,
            )}
          />
          <CompareField label="Location" value={row.toLocation} changed={isChanged(row.toLocation, otherRow?.toLocation)} />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No row</div>
      )}
    </div>
  );
}

function CompareField({ label, value, changed }: { label: string; value: string; changed: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 rounded-md border px-2 py-1",
        changed ? "border-amber-300 bg-amber-100/60" : "border-border/60 bg-background/40",
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-[11px] text-right", changed && "font-semibold text-foreground")}>
        {value || "-"}
      </span>
    </div>
  );
}

function isChanged(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim().toUpperCase() !== (right ?? "").trim().toUpperCase();
}
