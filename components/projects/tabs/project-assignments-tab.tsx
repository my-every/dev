"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronRight,
  ClipboardList,
  GitMerge,
  Layers,
  Link2Off,
  Loader2,
} from "lucide-react";
import { ASSIGNMENT_STAGES, type AssignmentStageId } from "@/types/d380-assignment-stages";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { AssignmentDetailsModal } from "@/components/assignments/assignment-details-modal";
import { ProjectAssignmentManagerDialog } from "@/components/projects/project-assignment-manager-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnitTypeIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/unit-type-icon";
import { SwsWorksheetRenderer } from "@/components/d380/sws";
import { resolveSwsTemplateIdForAssignment } from "@/lib/sws/assignment-template-resolution";
import type { AssignmentSwsConfig } from "@/types/d380-assignment-sws";
import type { SwsTemplateId } from "@/types/d380-sws";
import {
  MemberAssignmentSelector,
  type AssignableMember,
} from "@/components/projects/member-assignment-selector";
import { EmptyTabState } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectAssignmentsTabProps } from "@/components/projects/tabs/project-tab-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BoardAssignmentView, BoardDataResponse } from "@/lib/board/types";
import { SWS_TYPE_REGISTRY } from "@/lib/assignment/sws-detection";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";

// ============================================================================
// Types
// ============================================================================

interface AssignmentEntry {
  id: string;
  boardAssignmentId: string;
  sheetName: string;
  swsType: string;
  rowCount: number;
  stage: AssignmentStageId | null;
  record: NonNullable<ProjectManifest["assignments"]>[string] | null;
}

interface AssignmentRowView {
  id: string;
  boardAssignmentId: string;
  assignmentName: string;
  unitType: string;
  normalizedName: string;
  swsType: string;
  templateId: string;
  stageLabel: string;
  stageValue: string;
  assigneeBadge: string;
  assigneeLabel: string;
  shiftLabel: string;
  workflowStatus: string;
  workflowStatusLabel: string;
  scheduledLabel: string;
  rowCount: number;
  progressPercent: number | null;
  assignment: AssignmentEntry;
  liveBoardAssignment: BoardAssignmentView | null;
}

type SortMode = "assignment" | "unit";
type QuickEditField = "swsType" | "stage" | "assignee" | "workflowStatus";

type QuickEditState = Partial<{
  swsType: string;
  stage: string;
  assignee: string;
  workflowStatus: string;
}>;

interface PersistedAssignmentsTableState {
  globalFilter?: string;
  columnFilters?: ColumnFiltersState;
  sorting?: SortingState;
  columnVisibility?: VisibilityState;
}

interface SavedAssignmentsPreset extends PersistedAssignmentsTableState {
  id: string;
  name: string;
}

interface NamedAssignmentsPreset extends PersistedAssignmentsTableState {
  id: string;
  name: string;
  description?: string;
}

/** Callbacks passed down to collapsible row / group components. */
interface RowCallbacks {
  onOpenManager: (assignmentId: string) => void;
  onOpenSws: (sheetSlug: string) => void;
  onPersistEdit: (
    assignment: AssignmentEntry,
    field: QuickEditField,
    value: string,
  ) => Promise<void>;
  assignableMembers: AssignableMember[];
  assignmentSwsOptions: string[];
  statusOptions: readonly string[];
}

// ============================================================================
// Constants
// ============================================================================

const ASSIGNMENT_NAME_COLUMN_ID = "normalizedName";
const LEGACY_ASSIGNMENT_NAME_COLUMN_ID = "assignmentName";

// ============================================================================
// Utility helpers
// ============================================================================

function parseUnitTypeFromName(name: string): { unitType: string; normalizedName: string } {
  const trimmed = name.trim();

  const jbMatch = trimmed.match(/^(JB\d+)\s*([A-Z]),?\s*(.+)$/i);
  if (jbMatch) {
    const jbNumber = jbMatch[1].toUpperCase();
    const suffix = jbMatch[2].toUpperCase();
    const restOfName = jbMatch[3].trim();
    return { unitType: jbNumber, normalizedName: `${suffix} - ${restOfName}` };
  }

  const bayMatch = trimmed.match(/^(\d+)\s*BAY\s+(ON|OFF)SKID\s*(.*)$/i);
  if (bayMatch) {
    const bayCount = bayMatch[1];
    const skidType = bayMatch[2].toUpperCase();
    const restOfName = bayMatch[3].trim();
    return {
      unitType: `${bayCount}BAY`,
      normalizedName: restOfName ? `${skidType}SKID - ${restOfName}` : `${skidType}SKID`,
    };
  }

  const skidMatch = trimmed.match(/^(ON|OFF)SKID\s*(.*)$/i);
  if (skidMatch) {
    const skidType = skidMatch[1].toUpperCase();
    const restOfName = skidMatch[2].trim();
    return {
      unitType: `${skidType}SKID`,
      normalizedName: restOfName || `${skidType}SKID Unit`,
    };
  }

  const parts = trimmed.split(/[\s,]+/);
  if (parts.length > 1) {
    return { unitType: parts[0], normalizedName: parts.slice(1).join(" ") };
  }

  return { unitType: "UNIT", normalizedName: trimmed };
}

function normalizeAssignmentsColumnId(columnId: string): string {
  return columnId === LEGACY_ASSIGNMENT_NAME_COLUMN_ID ? ASSIGNMENT_NAME_COLUMN_ID : columnId;
}

function sanitizeSortingState(sorting: SortingState | undefined): SortingState | undefined {
  if (!Array.isArray(sorting)) return undefined;
  return sorting
    .filter((item) => item && typeof item.id === "string" && item.id.trim().length > 0)
    .map((item) => ({ ...item, id: normalizeAssignmentsColumnId(item.id) }));
}

function sanitizeColumnFiltersState(
  filters: ColumnFiltersState | undefined,
): ColumnFiltersState | undefined {
  if (!Array.isArray(filters)) return undefined;
  return filters
    .filter((item) => item && typeof item.id === "string" && item.id.trim().length > 0)
    .map((item) => ({ ...item, id: normalizeAssignmentsColumnId(item.id) }));
}

function sanitizeColumnVisibilityState(
  visibility: VisibilityState | undefined,
): VisibilityState | undefined {
  if (!visibility || typeof visibility !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(visibility).map(([key, value]) => [
      normalizeAssignmentsColumnId(key),
      value,
    ]),
  );
}

function formatStageLabel(stage: string | null | undefined) {
  if (!stage) return "Stage pending";
  return stage.replace(/[_-]+/g, " ");
}

function formatWorkflowLabel(status: string) {
  return status.replace(/[-_]+/g, " ");
}

function resolveProgressPercent(assignment: AssignmentEntry, workflowStatus: string) {
  const explicitProgress = assignment.record?.progress;
  if (typeof explicitProgress === "number" && Number.isFinite(explicitProgress)) {
    return Math.max(0, Math.min(100, Math.round(explicitProgress)));
  }
  const actualMinutes = assignment.record?.actualMinutes;
  const estimatedMinutes = assignment.record?.totalEstimatedMinutes;
  if (
    typeof actualMinutes === "number" &&
    typeof estimatedMinutes === "number" &&
    estimatedMinutes > 0
  ) {
    return Math.max(0, Math.min(100, Math.round((actualMinutes / estimatedMinutes) * 100)));
  }
  if (workflowStatus === "completed") return 100;
  return null;
}

function buildDefaultAssignmentsPresets(stageLabel: string): NamedAssignmentsPreset[] {
  return [
    {
      id: "lead-routing",
      name: "Lead Routing",
      description: "Focus on pending and scheduled work for routing.",
      columnFilters: [{ id: "workflowStatus", value: "pending" }],
      sorting: [
        { id: "workflowStatus", desc: false },
        { id: ASSIGNMENT_NAME_COLUMN_ID, desc: false },
      ],
    },
    {
      id: "unassigned-only",
      name: "Unassigned Only",
      description: "Show assignments still waiting for an assignee.",
      columnFilters: [{ id: "assigneeLabel", value: "Unassigned" }],
      sorting: [{ id: ASSIGNMENT_NAME_COLUMN_ID, desc: false }],
    },
    {
      id: "ready-to-wire",
      name: "Ready To Wire",
      description: "Show assignments staged and ready to enter wiring.",
      columnFilters: [{ id: "checklist", value: stageLabel }],
      sorting: [{ id: ASSIGNMENT_NAME_COLUMN_ID, desc: false }],
    },
  ];
}

// ============================================================================
// Shared cell components
// ============================================================================

function WorkflowStatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const toneClass =
    normalized === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : normalized === "in-progress"
        ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
        : normalized === "scheduled"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-border bg-muted/60 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        toneClass,
      )}
    >
      {formatWorkflowLabel(value)}
    </span>
  );
}

function ProgressCell({ value }: { value: number | null }) {
  const colorClass =
    value === null
      ? "bg-muted"
      : value === 100
        ? "bg-emerald-500"
        : value >= 75
          ? "bg-blue-500"
          : value >= 50
            ? "bg-sky-500"
            : value >= 25
              ? "bg-amber-500"
              : "bg-slate-400";

  if (value === null) {
    return (
      <div className="min-w-[140px]">
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-dashed border-muted-foreground/30 bg-muted/30">
            <div
              className="h-full w-full opacity-50"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(148,163,184,0.25) 0 6px, transparent 6px 12px)",
              }}
            />
          </div>
          <span className="min-w-[40px] text-right text-sm font-medium text-muted-foreground">
            --
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn("h-full rounded-full transition-all duration-300", colorClass)}
            style={{ width: `${value}%` }}
          />
        </div>
        <span
          className={cn(
            "min-w-[40px] text-right text-sm font-semibold tabular-nums",
            value === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {value}%
        </span>
      </div>
    </div>
  );
}

function AssigneeSelectorCell({
  members,
  assigneeBadge,
  stage,
  onApply,
}: {
  members: AssignableMember[];
  assigneeBadge: string;
  stage: AssignmentStageId | null;
  onApply: (value: string) => Promise<void> | void;
}) {
  const selected = assigneeBadge !== "Unassigned" ? [assigneeBadge] : [];
  return (
    <MemberAssignmentSelector
      members={members}
      selected={selected}
      onChange={(nextSelected) => {
        const nextBadge = nextSelected[0] ?? "Unassigned";
        void onApply(nextBadge);
      }}
      max={1}
      maxVisible={1}
      requiredStage={stage ?? undefined}
    />
  );
}

function StageSelectorCell({
  currentStage,
  onSave,
}: {
  currentStage: string;
  onSave: (newStage: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState(currentStage);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isPending = !currentStage || currentStage === "STAGE_PENDING";
  const displayStage = isPending ? "Pending" : currentStage.replace(/[_-]+/g, " ");
  const stageOptions = ASSIGNMENT_STAGES.map((s) => s.id);
  const hasChanged = selectedStage !== currentStage;

  const handleSave = useCallback(async () => {
    if (!hasChanged) { setIsOpen(false); return; }
    if (!isPending && !showConfirmation) { setShowConfirmation(true); return; }
    setIsSaving(true);
    try {
      await onSave(selectedStage);
      setIsOpen(false);
      setShowConfirmation(false);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanged, isPending, onSave, selectedStage, showConfirmation]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) { setSelectedStage(currentStage); setShowConfirmation(false); }
    },
    [currentStage],
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:ring-2 hover:ring-primary/20",
            isPending
              ? "bg-muted/60 text-muted-foreground"
              : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
          )}
        >
          {displayStage}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[300] w-72 p-0" align="start" sideOffset={4}>
        <div className="border-b border-border px-3 py-2">
          <h4 className="text-sm font-semibold text-foreground">Change Stage</h4>
          <p className="text-xs text-muted-foreground">Select the current production stage</p>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2">
          {showConfirmation ? (
            <div className="space-y-3 p-2">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Confirm Stage Change
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This will overwrite from{" "}
                    <span className="font-semibold">{displayStage}</span> to{" "}
                    <span className="font-semibold">
                      {selectedStage.replace(/[_-]+/g, " ")}
                    </span>
                    .
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSaving}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  Confirm Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {stageOptions.map((stage) => {
                const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === stage);
                const isSelected = selectedStage === stage;
                const isCurrent = currentStage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setSelectedStage(stage)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">
                          {stageDef?.shortLabel ?? stage}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {stageDef?.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!showConfirmation && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!hasChanged || isSaving}
            >
              {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
              Save Stage
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ChecklistCell({
  swsType,
  templateId,
  onOpenSwsEditor,
}: {
  swsType: string;
  templateId: string;
  onOpenSwsEditor: () => void;
}) {
  const isUndecided = swsType === "UNDECIDED" || templateId === "Not resolved" || !templateId;
  const displayType = swsType.replace(/_/g, " ");
  const displayTemplate = templateId.replace(/[_-]+/g, " ");

  return (
    <button
      type="button"
      onClick={onOpenSwsEditor}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
        "border border-transparent hover:border-primary/30 hover:bg-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          isUndecided ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10 group-hover:bg-primary/20",
        )}
      >
        <ClipboardList
          className={cn(
            "h-4.5 w-4.5",
            isUndecided ? "text-amber-600 dark:text-amber-400" : "text-primary",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-semibold leading-tight",
            isUndecided ? "text-amber-600 dark:text-amber-400" : "text-foreground",
          )}
        >
          {isUndecided ? "Undecided" : displayType}
        </div>
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {isUndecided ? "Click to configure SWS" : displayTemplate}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function SwsTypePicker({
  swsType,
  options,
  onSelect,
}: {
  swsType: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
            swsType === "UNDECIDED"
              ? "border border-dashed border-amber-500/50 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          {swsType === "UNDECIDED" ? "Undecided" : swsType.replace(/_/g, " ")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[300] w-56 p-2" align="start">
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                swsType === option && "bg-primary/10 text-primary",
              )}
            >
              {option.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Assignment Mapping Modal
// ============================================================================

function AssignmentMappingModal({
  open,
  onOpenChange,
  assignments,
  unitMappings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: AssignmentRowView[];
  unitMappings: Record<string, string>;
  onSave: (mappings: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDraft({ ...unitMappings });
  }, [open, unitMappings]);

  const knownUnits = useMemo(() => {
    const units = new Set<string>();
    assignments.forEach((a) => {
      const eff = draft[a.id] ?? unitMappings[a.id] ?? a.unitType;
      if (eff !== "UNIT" && eff.trim()) units.add(eff);
    });
    return Array.from(units).sort();
  }, [assignments, draft, unitMappings]);

  const unmatchedCount = assignments.filter(
    (a) => (draft[a.id] ?? a.unitType) === "UNIT" || !(draft[a.id] ?? a.unitType).trim(),
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] w-[min(680px,96vw)] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <GitMerge className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Match Assignments to Units</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {unmatchedCount > 0
                  ? `${unmatchedCount} assignment${unmatchedCount !== 1 ? "s" : ""} still unmatched — type a unit name or pick from suggestions.`
                  : "All assignments are matched. Save to confirm."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4">
          <div className="space-y-2">
            {assignments.map((a) => {
              const current = draft[a.id] ?? a.unitType;
              const isUnmatched = current === "UNIT" || !current.trim();
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isUnmatched
                      ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                      : "border-border bg-card/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      isUnmatched
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-emerald-100 dark:bg-emerald-900/30",
                    )}
                  >
                    {isUnmatched ? (
                      <Link2Off className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {a.assignmentName}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.rowCount} rows</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="text"
                      list={`unit-suggestions-${a.id}`}
                      placeholder="Unit type…"
                      value={isUnmatched ? "" : current}
                      onChange={(e) => {
                        const val = e.target.value.trim().toUpperCase();
                        setDraft((prev) => ({ ...prev, [a.id]: val || "UNIT" }));
                      }}
                      className="h-8 w-32 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <datalist id={`unit-suggestions-${a.id}`}>
                      {knownUnits.map((unit) => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {assignments.length - unmatchedCount} / {assignments.length} matched
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Save Mappings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Collapsible assignment row (used in unit-grouped view)
// ============================================================================

function AssignmentCollapsibleRow({
  row,
  isExpanded,
  onToggle,
  callbacks,
}: {
  row: AssignmentRowView;
  isExpanded: boolean;
  onToggle: () => void;
  callbacks: RowCallbacks;
}) {
  return (
    <div className={cn("border-b border-border/40 last:border-0", isExpanded && "bg-muted/5")}>
      {/* ── Summary row ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          !isExpanded && "hover:bg-muted/20",
        )}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
          />
        </button>

        {/* Name + row count */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{row.normalizedName}</div>
          <div className="text-[11px] text-muted-foreground">{row.rowCount} rows</div>
        </div>

        {/* Stage */}
        <StageSelectorCell
          currentStage={row.stageValue}
          onSave={(newStage) => callbacks.onPersistEdit(row.assignment, "stage", newStage)}
        />

        {/* Assignee */}
        <AssigneeSelectorCell
          members={callbacks.assignableMembers}
          assigneeBadge={row.assigneeBadge}
          stage={row.assignment.stage}
          onApply={(value) => callbacks.onPersistEdit(row.assignment, "assignee", value)}
        />

        {/* Status */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="shrink-0 cursor-pointer transition-opacity hover:opacity-80">
              <WorkflowStatusBadge value={row.workflowStatus} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[300] w-44 p-2" align="start">
            <div className="space-y-1">
              {callbacks.statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    void callbacks.onPersistEdit(row.assignment, "workflowStatus", option)
                  }
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 hover:bg-muted",
                    row.workflowStatus === option && "bg-primary/10",
                  )}
                >
                  <WorkflowStatusBadge value={option} />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Actions */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-3 text-xs"
          onClick={() => callbacks.onOpenManager(row.assignment.id)}
        >
          {row.assigneeBadge !== "Unassigned" ? "Manage" : "Assign"}
        </Button>
      </div>

      {/* ── Expanded detail panel ────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-border/30 bg-background/80 px-4 py-4">
          <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-4">
            {/* Checklist */}
            <ChecklistCell
              swsType={row.swsType}
              templateId={row.templateId}
              onOpenSwsEditor={() => callbacks.onOpenSws(row.assignment.id)}
            />

            {/* Progress */}
            <ProgressCell value={row.progressPercent} />

            {/* Metadata + SWS picker */}
            <div className="space-y-2">
              <SwsTypePicker
                swsType={row.swsType}
                options={callbacks.assignmentSwsOptions}
                onSelect={(value) =>
                  void callbacks.onPersistEdit(row.assignment, "swsType", value)
                }
              />
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <div>Shift: {row.shiftLabel}</div>
                <div>Scheduled: {row.scheduledLabel}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Unit group section (collapsible group header + rows)
// ============================================================================

function UnitGroupSection({
  unitType,
  rows,
  isCollapsed,
  onToggleCollapse,
  expandedRowIds,
  onToggleRow,
  callbacks,
}: {
  unitType: string;
  rows: AssignmentRowView[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  expandedRowIds: Set<string>;
  onToggleRow: (id: string) => void;
  callbacks: RowCallbacks;
}) {
  const completedCount = rows.filter((r) => r.workflowStatus === "completed").length;
  const completionPercent =
    rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {/* Group header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
        onClick={onToggleCollapse}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90",
          )}
        />
        <UnitTypeIcon unitType={unitType} interactive={false} title={unitType} />
        <span className="text-sm font-semibold text-foreground">{unitType}</span>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {completedCount}/{rows.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                completionPercent === 100 ? "bg-emerald-500" : "bg-blue-500",
              )}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="min-w-[36px] text-right text-xs tabular-nums text-muted-foreground">
            {completionPercent}%
          </span>
        </div>
      </button>

      {/* Assignment rows */}
      {!isCollapsed && (
        <div className="bg-background/90">
          {rows.map((row) => (
            <AssignmentCollapsibleRow
              key={row.id}
              row={row}
              isExpanded={expandedRowIds.has(row.id)}
              onToggle={() => onToggleRow(row.id)}
              callbacks={callbacks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main tab component
// ============================================================================

export function ProjectAssignmentsTab({
  project,
  hasLegals,
  onProjectRefresh,
}: ProjectAssignmentsTabProps) {
  const model = project;

  // ── Derive assignments ──────────────────────────────────────────────────────
  const assignments = useMemo<AssignmentEntry[]>(() => {
    const manifestAssignments = Object.values(model.assignments ?? {})
      .filter((assignment) => assignment.kind === "operational")
      .map((assignment) => ({
        id: assignment.sheetSlug,
        boardAssignmentId:
          assignment.boardAssignment?.assignmentId ?? `${model.id}:${assignment.sheetSlug}`,
        sheetName: assignment.sheetName,
        swsType: assignment.swsType,
        rowCount: assignment.rowCount,
        stage: assignment.stage,
        record: assignment,
      }));

    if (manifestAssignments.length > 0) return manifestAssignments;

    return model.sheets
      .filter((sheet) => sheet.kind === "operational")
      .map((sheet) => ({
        id: sheet.slug,
        boardAssignmentId: `${model.id}:${sheet.slug}`,
        sheetName: sheet.name,
        swsType: "UNDECIDED",
        rowCount: sheet.rowCount,
        stage: null,
        record: null,
      }));
  }, [model.assignments, model.id, model.sheets]);

  // ── Core UI state ───────────────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState<SortMode>("assignment");
  const [unitMappings, setUnitMappings] = useState<Record<string, string>>({});
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  const [quickEdits, setQuickEdits] = useState<Record<string, QuickEditState>>({});
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [managerAssignmentId, setManagerAssignmentId] = useState<string | null>(null);
  const [swsEditorSheetSlug, setSwsEditorSheetSlug] = useState<string | null>(null);
  const [swsConfig, setSwsConfig] = useState<AssignmentSwsConfig | null>(null);
  const [swsLoading, setSwsLoading] = useState(false);

  // TanStack table state
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: ASSIGNMENT_NAME_COLUMN_ID, desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [savedPresets, setSavedPresets] = useState<SavedAssignmentsPreset[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState("Unassigned");
  const [bulkStage, setBulkStage] = useState("STAGE_PENDING");
  const [bulkWorkflowStatus, setBulkWorkflowStatus] = useState("pending");
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [boardState, setBoardState] = useState<{
    isLoading: boolean;
    data: BoardDataResponse | null;
    error: string | null;
  }>({ isLoading: true, data: null, error: null });

  // ── Storage keys ────────────────────────────────────────────────────────────
  const assignmentsTableStorageKey = useMemo(
    () => `project-assignments-table:${model.id}`,
    [model.id],
  );
  const assignmentsPresetStorageKey = useMemo(
    () => `project-assignments-presets:${model.id}`,
    [model.id],
  );
  const unitMappingsStorageKey = useMemo(
    () => `project-unit-mappings:${model.id}`,
    [model.id],
  );

  // ── Board data ──────────────────────────────────────────────────────────────
  const loadBoardData = useCallback(async () => {
    setBoardState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/board/data", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load live assignment board data.");
      const payload = (await response.json()) as BoardDataResponse;
      setBoardState({ isLoading: false, data: payload, error: null });
    } catch (error) {
      setBoardState({
        isLoading: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Failed to load live assignment board data.",
      });
    }
  }, []);

  useEffect(() => { void loadBoardData(); }, [loadBoardData]);

  // ── SWS config loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!swsEditorSheetSlug) { setSwsConfig(null); return; }
    setSwsLoading(true);
    fetch(
      `/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(swsEditorSheetSlug)}/sws`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((payload) => {
        if (payload.sws) setSwsConfig(payload.sws as AssignmentSwsConfig);
      })
      .catch(() => { /* silent */ })
      .finally(() => { setSwsLoading(false); });
  }, [swsEditorSheetSlug, project.id]);

  // ── localStorage: unit mappings ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(unitMappingsStorageKey);
      if (raw) setUnitMappings(JSON.parse(raw) as Record<string, string>);
    } catch { /* ignore */ }
  }, [unitMappingsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(unitMappingsStorageKey, JSON.stringify(unitMappings));
  }, [unitMappings, unitMappingsStorageKey]);

  // ── localStorage: table state ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(assignmentsTableStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedAssignmentsTableState;
      if (typeof parsed.globalFilter === "string") setGlobalFilter(parsed.globalFilter);
      const safeFilters = sanitizeColumnFiltersState(parsed.columnFilters);
      if (safeFilters) setColumnFilters(safeFilters);
      const safeSorting = sanitizeSortingState(parsed.sorting);
      if (safeSorting && safeSorting.length > 0) setSorting(safeSorting);
      const safeVisibility = sanitizeColumnVisibilityState(parsed.columnVisibility);
      if (safeVisibility) setColumnVisibility(safeVisibility);
    } catch { window.localStorage.removeItem(assignmentsTableStorageKey); }
  }, [assignmentsTableStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      assignmentsTableStorageKey,
      JSON.stringify({ globalFilter, columnFilters, sorting, columnVisibility }),
    );
  }, [assignmentsTableStorageKey, columnFilters, columnVisibility, globalFilter, sorting]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(assignmentsPresetStorageKey);
      if (!raw) { setSavedPresets([]); return; }
      const parsed = JSON.parse(raw) as SavedAssignmentsPreset[];
      if (!Array.isArray(parsed)) { setSavedPresets([]); return; }
      setSavedPresets(
        parsed.map((preset) => ({
          ...preset,
          sorting: sanitizeSortingState(preset.sorting),
          columnFilters: sanitizeColumnFiltersState(preset.columnFilters),
          columnVisibility: sanitizeColumnVisibilityState(preset.columnVisibility),
        })),
      );
    } catch { window.localStorage.removeItem(assignmentsPresetStorageKey); setSavedPresets([]); }
  }, [assignmentsPresetStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(assignmentsPresetStorageKey, JSON.stringify(savedPresets));
  }, [assignmentsPresetStorageKey, savedPresets]);

  // ── Derived row data ────────────────────────────────────────────────────────
  const boardAssignmentsById = useMemo(() => {
    const entries =
      boardState.data?.projects
        .filter((item) => item.id === model.id)
        .flatMap((item) => item.assignments)
        .map((assignment) => [assignment.assignmentId, assignment] as const) ?? [];
    return new Map<string, BoardAssignmentView>(entries);
  }, [boardState.data?.projects, model.id]);

  const assignmentRows = useMemo<AssignmentRowView[]>(() => {
    return assignments.map((assignment) => {
      const liveBoardAssignment = boardAssignmentsById.get(assignment.boardAssignmentId) ?? null;
      const stageValue =
        quickEdits[assignment.id]?.stage ?? (assignment.stage ?? "STAGE_PENDING");
      const swsType = quickEdits[assignment.id]?.swsType ?? assignment.swsType;
      const assigneeBadge =
        quickEdits[assignment.id]?.assignee ??
        liveBoardAssignment?.assignedBadge ??
        assignment.record?.boardAssignment?.assignedBadge ??
        "Unassigned";
      const workflowStatus =
        quickEdits[assignment.id]?.workflowStatus ??
        liveBoardAssignment?.workflowStatus ??
        assignment.record?.boardAssignment?.workflowStatus ??
        "pending";
      const shiftLabel =
        liveBoardAssignment?.shiftId ??
        assignment.record?.boardAssignment?.shiftId ??
        "No shift";
      const scheduledLabel =
        liveBoardAssignment?.scheduledDate ??
        assignment.record?.boardAssignment?.scheduledDate ??
        "Not scheduled";
      const assigneeName =
        assigneeBadge === "Unassigned"
          ? "Unassigned"
          : (boardState.data?.members?.find((m) => m.badge === assigneeBadge)?.fullName ??
            assigneeBadge);
      const progressPercent = resolveProgressPercent(assignment, workflowStatus);
      const { unitType, normalizedName } = parseUnitTypeFromName(assignment.sheetName);

      return {
        id: assignment.id,
        boardAssignmentId: assignment.boardAssignmentId,
        assignmentName: assignment.sheetName,
        unitType,
        normalizedName,
        swsType,
        templateId: assignment.record
          ? resolveSwsTemplateIdForAssignment(assignment.record)
          : "Not resolved",
        stageLabel: formatStageLabel(stageValue),
        stageValue,
        assigneeBadge,
        assigneeLabel: assigneeName,
        shiftLabel,
        workflowStatus,
        workflowStatusLabel: formatWorkflowLabel(workflowStatus),
        scheduledLabel,
        rowCount: assignment.rowCount,
        progressPercent,
        assignment,
        liveBoardAssignment,
      };
    });
  }, [assignments, boardAssignmentsById, boardState.data?.members, quickEdits]);

  // ── Unit matching ───────────────────────────────────────────────────────────
  const hasUnmatchedAssignments = useMemo(
    () =>
      assignmentRows.some((row) => {
        const effective = unitMappings[row.id] ?? row.unitType;
        return effective === "UNIT" || !effective.trim();
      }),
    [assignmentRows, unitMappings],
  );

  const unmatchedCount = useMemo(
    () =>
      assignmentRows.filter((row) => {
        const effective = unitMappings[row.id] ?? row.unitType;
        return effective === "UNIT" || !effective.trim();
      }).length,
    [assignmentRows, unitMappings],
  );

  // ── Misc derived ────────────────────────────────────────────────────────────
  const assignableMembers = useMemo<AssignableMember[]>(() => {
    return (boardState.data?.members ?? []).map((member) => ({
      badge: member.badge,
      fullName: member.fullName,
      firstName:
        member.preferredName || member.fullName.split(" ")[0] || member.fullName,
      lastName: member.fullName.split(" ").slice(1).join(" ") || member.fullName,
      initials:
        member.initials ||
        member.fullName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      shift: member.shift,
      primaryRole: member.role,
      secondaryRoles: [],
      status:
        member.availabilityStatus === "OFF_SHIFT"
          ? "offline"
          : member.availabilityStatus === "ON_ASSIGNMENT"
            ? "active"
            : "active",
      experiencedStages: [],
      traineeEligibleStages: [],
      avatarPath: null,
      currentProjectIds: member.activeAssignments.map((a) => a.projectId),
      currentSheetNames: member.activeAssignments.map((a) => a.sheetName),
    }));
  }, [boardState.data?.members]);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );
  const managerAssignment = useMemo(
    () => assignments.find((a) => a.id === managerAssignmentId) ?? null,
    [assignments, managerAssignmentId],
  );
  const managerBoardAssignment = managerAssignment
    ? (boardAssignmentsById.get(managerAssignment.boardAssignmentId) ?? null)
    : null;

  const assignmentSwsOptions = useMemo(() => {
    const options = new Set<string>(Object.keys(SWS_TYPE_REGISTRY));
    assignments.forEach((a) => options.add(a.swsType || "UNDECIDED"));
    options.add("UNDECIDED");
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  const statusOptions = useMemo(
    () => ["pending", "scheduled", "in-progress", "completed"] as const,
    [],
  );

  const completedCount = useMemo(
    () => assignmentRows.filter((a) => a.workflowStatus === "completed").length,
    [assignmentRows],
  );
  const completionPercent =
    assignmentRows.length > 0
      ? Math.round((completedCount / assignmentRows.length) * 100)
      : 0;

  // ── Quick edit / persist ────────────────────────────────────────────────────
  const updateQuickEdit = useCallback(
    (assignmentId: string, field: QuickEditField, value: string) => {
      setQuickEdits((prev) => ({
        ...prev,
        [assignmentId]: { ...prev[assignmentId], [field]: value },
      }));
    },
    [],
  );

  const handleAssignmentCrudRefresh = useCallback(async () => {
    await Promise.all([loadBoardData(), Promise.resolve(onProjectRefresh?.())]);
  }, [loadBoardData, onProjectRefresh]);

  const postQuickEdit = useCallback(
    async (body: {
      assignmentId: string;
      projectId: string;
      sheetSlug: string;
      swsType?: string;
      stage?: string;
      assignedBadge?: string;
      workflowStatus?: string;
    }) => {
      const response = await fetch("/api/board/assign/quick-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to persist assignment quick edit.");
      }
    },
    [],
  );

  const persistQuickEdit = useCallback(
    async (assignment: AssignmentEntry, field: QuickEditField, value: string) => {
      updateQuickEdit(assignment.id, field, value);
      const body: Parameters<typeof postQuickEdit>[0] = {
        assignmentId: assignment.boardAssignmentId,
        projectId: model.id,
        sheetSlug: assignment.id,
      };
      if (field === "swsType") body.swsType = value;
      if (field === "stage") body.stage = value;
      if (field === "assignee") body.assignedBadge = value;
      if (field === "workflowStatus") body.workflowStatus = value;
      try {
        await postQuickEdit(body);
        await handleAssignmentCrudRefresh();
      } catch (error) {
        setBoardState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to persist assignment quick edit.",
        }));
      }
    },
    [handleAssignmentCrudRefresh, model.id, postQuickEdit, updateQuickEdit],
  );

  // ── Row callbacks object ─────────────────────────────────────────────────────
  const rowCallbacks = useMemo<RowCallbacks>(
    () => ({
      onOpenManager: setManagerAssignmentId,
      onOpenSws: setSwsEditorSheetSlug,
      onPersistEdit: persistQuickEdit,
      assignableMembers,
      assignmentSwsOptions,
      statusOptions,
    }),
    [assignableMembers, assignmentSwsOptions, persistQuickEdit, statusOptions],
  );

  // ── TanStack table (used for flat sort-by-assignment view) ──────────────────
  const columns = useMemo<ColumnDef<AssignmentRowView>[]>(
    () => [
      {
        id: "unitType",
        accessorKey: "unitType",
        size: 80,
        header: () => <span className="text-sm font-semibold">Unit</span>,
        cell: ({ row }) => (
          <div className="flex items-center">
            <UnitTypeIcon
              unitType={unitMappings[row.original.id] ?? row.original.unitType}
              interactive={false}
              title={unitMappings[row.original.id] ?? row.original.unitType}
            />
          </div>
        ),
      },
      {
        accessorKey: "normalizedName",
        size: 200,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Assignment
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {row.original.normalizedName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "stageValue",
        size: 160,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stage
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <StageSelectorCell
            currentStage={row.original.stageValue}
            onSave={(newStage) => persistQuickEdit(row.original.assignment, "stage", newStage)}
          />
        ),
      },
      {
        accessorKey: "swsType",
        size: 140,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            SWS Type
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <SwsTypePicker
            swsType={row.original.swsType}
            options={assignmentSwsOptions}
            onSelect={(value) =>
              void persistQuickEdit(row.original.assignment, "swsType", value)
            }
          />
        ),
      },
      {
        id: "checklist",
        accessorFn: (row) => `${row.templateId} ${row.stageLabel}`,
        size: 220,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Checklist
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <ChecklistCell
            swsType={row.original.swsType}
            templateId={row.original.templateId}
            onOpenSwsEditor={() => setSwsEditorSheetSlug(row.original.assignment.id)}
          />
        ),
      },
      {
        accessorKey: "assigneeLabel",
        size: 160,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Assignee
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <AssigneeSelectorCell
            members={assignableMembers}
            assigneeBadge={row.original.assigneeBadge}
            stage={row.original.assignment.stage}
            onApply={(value) =>
              persistQuickEdit(row.original.assignment, "assignee", value)
            }
          />
        ),
      },
      {
        accessorKey: "progressPercent",
        size: 160,
        sortingFn: (left, right) => {
          const lv = left.original.progressPercent ?? -1;
          const rv = right.original.progressPercent ?? -1;
          return lv - rv;
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Progress
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <ProgressCell value={row.original.progressPercent} />,
      },
      {
        accessorKey: "workflowStatus",
        size: 130,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                <WorkflowStatusBadge value={row.original.workflowStatus} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="z-[300] w-44 p-2" align="start">
              <div className="space-y-1">
                {statusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      void persistQuickEdit(row.original.assignment, "workflowStatus", option)
                    }
                    className={cn(
                      "flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                      row.original.workflowStatus === option && "bg-primary/10",
                    )}
                  >
                    <WorkflowStatusBadge value={option} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        size: 120,
        header: () => <div className="text-sm font-semibold">Actions</div>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-4 text-sm font-medium"
            onClick={() => setManagerAssignmentId(row.original.assignment.id)}
          >
            {row.original.assigneeBadge !== "Unassigned" ? "Manage" : "Assign"}
          </Button>
        ),
      },
    ],
    [assignableMembers, assignmentSwsOptions, persistQuickEdit, statusOptions, unitMappings],
  );

  const table = useReactTable({
    data: assignmentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, columnFilters, sorting, columnVisibility, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
  });

  // ── Unit groups (sort-by-unit mode) ─────────────────────────────────────────
  const unitGroups = useMemo(() => {
    if (sortMode !== "unit") return [];
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const groupMap = new Map<string, AssignmentRowView[]>();
    rows.forEach((row) => {
      const unit = (unitMappings[row.id] ?? row.unitType) || "UNIT";
      const existing = groupMap.get(unit) ?? [];
      existing.push(row);
      groupMap.set(unit, existing);
    });
    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([unitType, groupRows]) => ({
        unitType,
        rows: [...groupRows].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName)),
      }));
  }, [sortMode, table, unitMappings]);

  // ── Toggle helpers ───────────────────────────────────────────────────────────
  const toggleRow = useCallback((id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Bulk edit ────────────────────────────────────────────────────────────────
  const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);

  const applyBulkEdit = useCallback(
    async (
      field: Extract<QuickEditField, "assignee" | "stage" | "workflowStatus">,
      value: string,
    ) => {
      if (selectedRows.length === 0) return;
      setIsApplyingBulk(true);
      setBoardState((prev) => ({ ...prev, error: null }));
      try {
        selectedRows.forEach((row) => updateQuickEdit(row.assignment.id, field, value));
        await Promise.all(
          selectedRows.map((row) =>
            postQuickEdit({
              assignmentId: row.boardAssignmentId,
              projectId: model.id,
              sheetSlug: row.assignment.id,
              ...(field === "assignee"
                ? { assignedBadge: value }
                : field === "stage"
                  ? { stage: value }
                  : { workflowStatus: value }),
            }),
          ),
        );
        setRowSelection({});
        await handleAssignmentCrudRefresh();
      } catch (error) {
        setBoardState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply bulk assignment updates.",
        }));
      } finally {
        setIsApplyingBulk(false);
      }
    },
    [handleAssignmentCrudRefresh, model.id, postQuickEdit, selectedRows, updateQuickEdit],
  );

  // ── Early-exit states ────────────────────────────────────────────────────────
  if (!hasLegals) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="rounded-full bg-muted/60 p-3">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="max-w-56 text-center">
          <p className="text-sm font-medium">Legals Required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload the UCP wire list and layout PDF first. Assignments are derived from the
            uploaded legals.
          </p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyTabState
        icon={Layers}
        title="Assignments"
        description="No operational sheets found."
      />
    );
  }

  // ── Unmatched assignments empty state ────────────────────────────────────────
  if (hasUnmatchedAssignments) {
    return (
      <>
        <div className="flex flex-col items-center gap-5 py-14">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-800 dark:bg-amber-950/30">
            <Link2Off className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="max-w-sm text-center">
            <h3 className="text-sm font-semibold text-foreground">
              Match Assignments to Units
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {unmatchedCount} assignment{unmatchedCount !== 1 ? "s" : ""}{" "}
              {unmatchedCount !== 1 ? "need" : "needs"} to be matched to a unit before they can
              be grouped and managed. Match each sheet to its unit type to continue.
            </p>
          </div>
          <Button onClick={() => setMappingModalOpen(true)} className="gap-2">
            <GitMerge className="h-4 w-4" />
            Match Assignments
          </Button>
          <p className="text-xs text-muted-foreground">
            {assignments.length - unmatchedCount} of {assignments.length} already matched
          </p>
        </div>

        <AssignmentMappingModal
          open={mappingModalOpen}
          onOpenChange={setMappingModalOpen}
          assignments={assignmentRows}
          unitMappings={unitMappings}
          onSave={setUnitMappings}
        />
      </>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Assignments</h3>
          <Badge size="sm" className="h-6 px-2 text-xs">
            {completedCount}/{assignments.length}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setSortMode("assignment")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sortMode === "assignment"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sort by Assignment
            </button>
            <button
              type="button"
              onClick={() => setSortMode("unit")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sortMode === "unit"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sort by Unit
            </button>
          </div>

          {/* Re-map button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMappingModalOpen(true)}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Edit Mappings
          </Button>

          {boardState.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{completionPercent}% complete</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  completionPercent === 100 ? "bg-emerald-500" : "bg-blue-500",
                )}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-sm"
            onClick={() => void loadBoardData()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {boardState.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {boardState.error}
        </div>
      ) : null}

      {/* ── Sort by Assignment: flat TanStack table ─────────────────── */}
      {sortMode === "assignment" ? (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
          <div className="max-h-[720px] overflow-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="bg-muted/60 hover:bg-muted/60"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="whitespace-nowrap border-b border-border/60 bg-muted/60 py-3 text-left text-sm font-semibold text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                            (header.column.columnDef.header as any)(header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row, index) => (
                    <TableRow key={row.id} index={index} className="align-middle">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border-b border-border/40 py-4 text-left text-sm align-middle"
                        >
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(cell.column.columnDef.cell as any)(cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getAllLeafColumns().length}
                      className="py-12 text-center text-base text-muted-foreground"
                    >
                      No assignments match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* ── Sort by Unit: collapsible grouped view ─────────────────── */
        <div className="space-y-3">
          {unitGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              No assignments match the current filters.
            </div>
          ) : (
            unitGroups.map(({ unitType, rows }) => (
              <UnitGroupSection
                key={unitType}
                unitType={unitType}
                rows={rows}
                isCollapsed={collapsedGroupIds.has(unitType)}
                onToggleCollapse={() => toggleGroup(unitType)}
                expandedRowIds={expandedRowIds}
                onToggleRow={toggleRow}
                callbacks={rowCallbacks}
              />
            ))
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AssignmentMappingModal
        open={mappingModalOpen}
        onOpenChange={setMappingModalOpen}
        assignments={assignmentRows}
        unitMappings={unitMappings}
        onSave={setUnitMappings}
      />

      <AssignmentDetailsModal
        open={Boolean(selectedAssignment?.record)}
        onOpenChange={(open) => { if (!open) setSelectedAssignmentId(null); }}
        project={model}
        assignment={selectedAssignment?.record ?? null}
        onAssignmentUpdated={handleAssignmentCrudRefresh}
      />

      <ProjectAssignmentManagerDialog
        open={Boolean(managerAssignment)}
        onOpenChange={(open) => { if (!open) setManagerAssignmentId(null); }}
        target={
          managerAssignment
            ? {
                assignmentId: managerAssignment.boardAssignmentId,
                sheetName: managerAssignment.sheetName,
                rowCount: managerAssignment.rowCount,
                swsType: managerAssignment.swsType,
                stage: managerAssignment.stage,
              }
            : null
        }
        boardAssignment={managerBoardAssignment}
        members={boardState.data?.members ?? []}
        onApplied={handleAssignmentCrudRefresh}
      />

      {/* SWS Preview Modal */}
      <Dialog
        open={Boolean(swsEditorSheetSlug)}
        onOpenChange={(open) => { if (!open) setSwsEditorSheetSlug(null); }}
      >
        <DialogContent className="h-[90vh] w-[1600px] max-w-[96vw] overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              SWS Preview
              {swsEditorSheetSlug && (
                <span className="text-sm font-normal text-muted-foreground">
                  {assignments.find((a) => a.id === swsEditorSheetSlug)?.sheetName ??
                    swsEditorSheetSlug}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6">
            {swsLoading ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading SWS…</p>
              </div>
            ) : swsConfig ? (
              <SwsWorksheetRenderer
                swsType={(swsConfig.templateId ?? "PANEL_BUILD_WIRE") as SwsTemplateId}
                executionMode={swsConfig.executionState?.activeMode ?? "PRINT_MANUAL"}
                metadata={{
                  pdNumber: swsConfig.worksheetMetadata?.pdNumber ?? project.pdNumber,
                  projectName: swsConfig.worksheetMetadata?.projectName ?? project.name,
                  unit: swsConfig.worksheetMetadata?.unit ?? project.unitNumber,
                  panel: swsConfig.worksheetMetadata?.panel,
                  box: swsConfig.worksheetMetadata?.box,
                  bays: swsConfig.worksheetMetadata?.bays,
                  date:
                    swsConfig.worksheetMetadata?.date ??
                    new Date().toISOString().slice(0, 10),
                  revision: swsConfig.worksheetMetadata?.revision ?? project.revision,
                  swsIpvId: swsConfig.worksheetMetadata?.swsIpvId ?? swsConfig.templateId,
                  revLevel: swsConfig.worksheetMetadata?.revLevel ?? project.revision,
                  revDate:
                    swsConfig.worksheetMetadata?.revDate ??
                    new Date().toISOString().slice(0, 10),
                }}
              />
            ) : (
              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No SWS Configuration
                </h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  This assignment does not have an SWS configuration yet. Use the SWS tab to
                  set up the Standard Work Sheet.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSwsEditorSheetSlug(null)}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
