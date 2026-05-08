"use client";

import { useCallback, useState } from "react";
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  RefreshCw,
} from "lucide-react";

import {
  ManifestArrayEditor,
  ManifestColorField,
  ManifestDateField,
  ManifestNumberField,
  ManifestReadonlyField,
  ManifestRefreshButton,
  ManifestSelectField,
  ManifestTextField,
} from "@/components/manifest/manifest-fields";
import {
  FieldGrid,
  ManifestScrollspyEditor,
  ScrollspySection,
  SectionDivider,
} from "@/components/manifest/manifest-scrollspy-editor";
import type { ProjectManifest } from "@/types/project-manifest";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProjectManifestEditorProps {
  project: ProjectManifest;
  onProjectRefresh?: () => Promise<ProjectManifest | null>;
}

// ─── Patch helpers ─────────────────────────────────────────────────────────────

async function patchManifest(
  projectId: string,
  patch: Record<string, unknown>,
  badgeNumber?: string,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (badgeNumber) headers["x-badge-number"] = badgeNumber;

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/manifest`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to save");
  }
}

async function recalculate(projectId: string, badgeNumber?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (badgeNumber) headers["x-badge-number"] = badgeNumber;

  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/manifest/recalculate`,
    { method: "POST", headers, cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Recalculation failed");
  }
}

// ─── Sections config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "identity", label: "Identity", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "scheduling", label: "Scheduling", icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "aggregates", label: "Aggregates", icon: <Layers className="h-3.5 w-3.5" /> },
  { id: "assignments", label: "Assignments", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: "files", label: "Files", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETE", label: "Complete" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProjectManifestEditor({
  project,
  onProjectRefresh,
}: ProjectManifestEditorProps) {
  const [liveProject, setLiveProject] = useState(project);
  const [recalculating, setRecalculating] = useState(false);

  const patch = useCallback(
    async (fields: Record<string, unknown>) => {
      await patchManifest(liveProject.id, fields);
      const refreshed = await onProjectRefresh?.();
      if (refreshed) setLiveProject(refreshed);
    },
    [liveProject.id, onProjectRefresh],
  );

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      await recalculate(liveProject.id);
      const refreshed = await onProjectRefresh?.();
      if (refreshed) setLiveProject(refreshed);
    } finally {
      setRecalculating(false);
    }
  }, [liveProject.id, onProjectRefresh]);

  const assignmentEntries = Object.values(liveProject.assignments ?? {}).filter(
    (a) => a.kind === "operational",
  );

  return (
    <ManifestScrollspyEditor sections={SECTIONS}>
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <ScrollspySection
        id="identity"
        title="Project Identity"
        description="Core identifiers and display metadata."
      >
        <FieldGrid cols={2}>
          <ManifestTextField
            label="Project Name"
            value={liveProject.name}
            onSave={(v) => patch({ name: v })}
            helperText="Displayed across project cards and dashboards."
            maxLength={200}
          />
          <ManifestReadonlyField
            label="PD Number"
            value={liveProject.pdNumber}
            locked
            lockedReason="The PD Number is set at project creation and cannot be changed."
            mono
          />
          <ManifestTextField
            label="Unit Number"
            value={liveProject.unitNumber}
            onSave={(v) => patch({ unitNumber: v })}
            maxLength={50}
          />
          <ManifestTextField
            label="Revision"
            value={liveProject.revision}
            onSave={(v) => patch({ revision: v })}
            helperText="Legal uploads may update this value automatically."
            maxLength={50}
          />
          <ManifestTextField
            label="LWC Type"
            value={liveProject.lwcType?.toString()}
            onSave={(v) => patch({ lwcType: v })}
            maxLength={50}
          />
          <ManifestSelectField
            label="Status"
            value={liveProject.status}
            options={STATUS_OPTIONS}
            onSave={(v) => patch({ status: v })}
          />
          <ManifestColorField
            label="Project Color"
            value={liveProject.color}
            onSave={(v) => patch({ color: v })}
            helperText="Used for project icon and card accent."
          />
          <ManifestReadonlyField
            label="Filename"
            value={liveProject.filename}
            locked
            lockedReason="Set from the source workbook filename."
            mono
            helperText="The workbook filename this project was seeded from."
          />
        </FieldGrid>
      </ScrollspySection>

      {/* ── Scheduling ───────────────────────────────────────────────────── */}
      <ScrollspySection
        id="scheduling"
        title="Scheduling"
        description="Due dates, ConLay/ConAssy milestones, and ship date."
      >
        <FieldGrid cols={2}>
          <ManifestDateField
            label="Due Date"
            value={liveProject.dueDate}
            onSave={(v) => patch({ dueDate: v })}
            helperText="Primary deadline used for priority scoring."
          />
          <ManifestDateField
            label="Ship Date"
            value={liveProject.shipDate ?? null}
            onSave={(v) => patch({ shipDate: v })}
          />
          <ManifestDateField
            label="ConLay Date"
            value={liveProject.planConlayDate}
            onSave={(v) => patch({ planConlayDate: v })}
          />
          <ManifestDateField
            label="ConAssy Date"
            value={liveProject.planConassyDate}
            onSave={(v) => patch({ planConassyDate: v })}
          />
          <ManifestDateField
            label="Dept Target Date"
            value={liveProject.deptTargetDate ?? null}
            onSave={(v) => patch({ deptTargetDate: v })}
          />
        </FieldGrid>

        {liveProject.daysLate != null ? (
          <>
            <SectionDivider label="Schedule health" />
            <FieldGrid cols={3}>
              <ManifestNumberField
                label="Days Late"
                value={liveProject.daysLate}
                generated
                lockedReason="Computed from due date vs. today."
              />
            </FieldGrid>
          </>
        ) : null}
      </ScrollspySection>

      {/* ── Aggregates ───────────────────────────────────────────────────── */}
      <ScrollspySection
        id="aggregates"
        title="Aggregates"
        description="Computed rollups — recalculated after manifest changes."
        action={
          <ManifestRefreshButton
            onClick={() => void handleRecalculate()}
            loading={recalculating}
            label="Recalculate"
          />
        }
      >
        <FieldGrid cols={3}>
          <ManifestNumberField
            label="Panducts"
            value={liveProject.panducts}
            generated
            lockedReason="Derived from assignment wire schemas."
          />
          <ManifestNumberField
            label="Rails"
            value={liveProject.rails}
            generated
            lockedReason="Derived from assignment wire schemas."
          />
          <ManifestNumberField
            label="Est. Total Hours"
            value={liveProject.estimatedTotalHours}
            generated
            lockedReason="Derived from SWS stage hours across all assignments."
            unit="h"
          />
          <ManifestNumberField
            label="Est. Panel Count"
            value={liveProject.estimatedPanelCount}
            generated
          />
          <ManifestNumberField
            label="Est. Sample Count"
            value={liveProject.estimatedSampleCount}
            generated
          />
        </FieldGrid>

        {liveProject.aggregates ? (
          <>
            <SectionDivider label="Priority" />
            <FieldGrid cols={3}>
              <ManifestReadonlyField
                label="Priority Score"
                value={liveProject.aggregates.priorityScore?.toFixed(1) ?? null}
                generated
              />
              <ManifestReadonlyField
                label="Priority Level"
                value={liveProject.aggregates.priorityLevel ?? null}
                generated
              />
            </FieldGrid>
          </>
        ) : null}

        <SectionDivider label="Unit types" />
        <ManifestArrayEditor
          label="Unit Types"
          values={liveProject.unitTypes ?? []}
          generated
          lockedReason="Derived from assignment unit type values."
          helperText="Automatically derived from assignment unit type values."
        />
      </ScrollspySection>

      {/* ── Assignments ──────────────────────────────────────────────────── */}
      <ScrollspySection
        id="assignments"
        title="Assignments"
        description={`${assignmentEntries.length} operational assignment${assignmentEntries.length !== 1 ? "s" : ""} in the manifest.`}
      >
        {assignmentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No operational assignments found.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sheet</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Stage</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit Type</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rows</th>
                </tr>
              </thead>
              <tbody>
                {assignmentEntries.map((a) => (
                  <tr key={a.sheetSlug} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium">{a.sheetName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.stage ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.status ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.unitType ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{a.rowCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ScrollspySection>

      {/* ── Files ────────────────────────────────────────────────────────── */}
      <ScrollspySection
        id="files"
        title="File References"
        description="Active revision IDs and generated artifact paths."
      >
        <FieldGrid cols={1}>
          <ManifestReadonlyField
            label="Active Workbook Revision ID"
            value={liveProject.activeWorkbookRevisionId ?? null}
            locked
            lockedReason="Set when a legal workbook is uploaded."
            mono
            helperText="Tracks the currently active legal workbook revision."
          />
          <ManifestReadonlyField
            label="Active Layout Revision ID"
            value={liveProject.activeLayoutRevisionId ?? null}
            locked
            lockedReason="Set when a layout PDF is uploaded."
            mono
            helperText="Tracks the currently active layout PDF revision."
          />
          <ManifestReadonlyField
            label="Created At"
            value={
              liveProject.createdAt
                ? new Date(liveProject.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : null
            }
            generated
          />
        </FieldGrid>
      </ScrollspySection>
    </ManifestScrollspyEditor>
  );
}
