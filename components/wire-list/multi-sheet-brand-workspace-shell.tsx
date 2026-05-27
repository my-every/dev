"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, ImageIcon, Loader2, RefreshCcw, Search } from "lucide-react";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandListEditorTable, BRAND_EDITOR_COLUMN_OPTIONS } from "@/components/wire-list/brand-list-editor-table";
import { BrandListSearchPanel } from "@/components/wire-list/brand-list-search-panel";
import { BrandListHistoryPanel } from "@/components/wire-list/brand-list-history-panel";
import { useBrandListHistory } from "@/components/wire-list/use-brand-list-history";
import { useBrandListSearch } from "@/components/wire-list/use-brand-list-search";
import type {
  BrandListExportSchema,
  BrandListSchemaRow,
} from "@/lib/wire-brand-list/schema";
import type { BrandListHistoryEntry, BrandListReplacePreview, BrandListSearchMatch } from "@/lib/wire-brand-list/editor-types";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import type { VisibilityState } from "@tanstack/react-table";

interface MultiSheetBrandWorkspaceShellProps {
  activeSlug?: string | null;
  activeSheetName?: string | null;
  activeImageUrl?: string | null;
  layoutWorkspaceEndpoint?: string | null;
  initialLayoutPageNumber?: number;
  activeBrandSchema: BrandListExportSchema | null;
  /** All loaded schemas for cross-sheet search */
  allBrandSchemas?: Array<{ slug: string; name: string; schema: BrandListExportSchema }>;
  /** Project name from the project manifest (used for consistent display) */
  projectName?: string | null;
  /** Project number (PD number) from the project manifest */
  projectNumber?: string | null;
  /** Project color from the project manifest */
  projectColor?: string | null;
  isSavingBrandSchema: boolean;
  reviewReadOnly: boolean;
  selectedBrandRows: Set<string>;
  onOpenLayoutReference: () => void;
  onRegenerate: () => void;
  onUpdateProjectInfo: (patch: Partial<BrandListExportSchema["projectInfo"]>) => void;
  onToggleRow: (rowId: string) => void;
  onToggleSection: (rowIds: string[]) => void;
  onRenameBundle: (prefixIndex: number, bundleIndex: number, nextName: string) => void;
  onUpdateRow: (prefixIndex: number, bundleIndex: number, rowIndex: number, patch: Partial<BrandListSchemaRow>) => void;
  onAddRow: (prefixIndex: number, bundleIndex: number) => void;
  onRemoveRow: (prefixIndex: number, bundleIndex: number, rowIndex: number) => void;
  /** Called when the shell needs to switch to a different sheet (for cross-sheet search navigation) */
  onSelectSheet?: (slug: string) => void;
}

export function MultiSheetBrandWorkspaceShell(
  props: MultiSheetBrandWorkspaceShellProps,
) {
  const {
    activeSlug,
    activeSheetName,
    activeImageUrl,
    layoutWorkspaceEndpoint,
    initialLayoutPageNumber,
    activeBrandSchema,
    allBrandSchemas,
    projectName,
    projectNumber,
    projectColor,
    isSavingBrandSchema,
    reviewReadOnly,
    selectedBrandRows,
    onOpenLayoutReference,
    onRegenerate,
    onUpdateProjectInfo,
    onToggleRow,
    onToggleSection,
    onRenameBundle,
    onUpdateRow,
    onAddRow,
    onRemoveRow,
    onSelectSheet,
  } = props;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    BRAND_EDITOR_COLUMN_OPTIONS.reduce<VisibilityState>((acc, c) => {
      acc[c.key] = true;
      return acc;
    }, {}),
  );

  const visibleColumns = useMemo(
    () =>
      BRAND_EDITOR_COLUMN_OPTIONS.filter((c) => columnVisibility[c.key] !== false).map(
        (c) => c.key,
      ),
    [columnVisibility],
  );

  // ─── History / Undo-Redo ─────────────────────────────────────────────────

  const history = useBrandListHistory();

  // Wrap onUpdateRow to record history
  const handleUpdateRow = useCallback(
    (
      prefixIndex: number,
      bundleIndex: number,
      rowIndex: number,
      patch: Partial<BrandListSchemaRow>,
    ) => {
      if (!activeBrandSchema || !activeSlug) {
        onUpdateRow(prefixIndex, bundleIndex, rowIndex, patch);
        return;
      }
      const row = activeBrandSchema.prefixGroups[prefixIndex]?.bundles[bundleIndex]?.rows[rowIndex];
      if (row) {
        for (const [key, nextValue] of Object.entries(patch)) {
          const columnKey = key as keyof BrandListSchemaRow;
          const prevValue = row[columnKey];
          // Only record recognised column keys
          const isTrackable = BRAND_EDITOR_COLUMN_OPTIONS.some((c) => c.key === key);
          if (isTrackable) {
            history.pushChange({
              source: "manual-edit",
              sheetSlug: activeSlug,
              sheetName: activeSheetName ?? activeSlug,
              prefixIndex,
              bundleIndex,
              rowIndex,
              rowId: row.rowId,
              column: columnKey as never,
              previousValue: prevValue as string | number | null,
              nextValue: nextValue as string | number | null,
            });
          }
        }
      }
      onUpdateRow(prefixIndex, bundleIndex, rowIndex, patch);
    },
    [activeBrandSchema, activeSheetName, activeSlug, history, onUpdateRow],
  );

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  const schemasForSearch = useMemo<Array<{ slug: string; name: string; schema: BrandListExportSchema }>>(() => {
    if (allBrandSchemas && allBrandSchemas.length > 0) return allBrandSchemas;
    if (activeBrandSchema && activeSlug) {
      return [{ slug: activeSlug, name: activeSheetName ?? activeSlug, schema: activeBrandSchema }];
    }
    return [];
  }, [allBrandSchemas, activeBrandSchema, activeSlug, activeSheetName]);

  const search = useBrandListSearch(schemasForSearch, activeSlug ?? null, visibleColumns);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      // Do not intercept if focus is in an input outside our editor
      const target = e.target as HTMLElement;
      const isEditorFocused = target.closest("[data-brand-editor]") !== null;
      if (!isMod && !isEditorFocused) return;

      if (isMod && e.key === "f") {
        e.preventDefault();
        search.openSearch();
        return;
      }
      if (isMod && e.key === "h") {
        e.preventDefault();
        search.openReplace();
        return;
      }
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const tx = history.undo();
        if (tx) {
          // Apply undo: revert each change
          for (const change of tx.changes) {
            onUpdateRow(change.prefixIndex, change.bundleIndex, change.rowIndex, {
              [change.column]: change.previousValue,
            } as Partial<BrandListSchemaRow>);
          }
        }
        return;
      }
      if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const tx = history.redo();
        if (tx) {
          for (const change of tx.changes) {
            onUpdateRow(change.prefixIndex, change.bundleIndex, change.rowIndex, {
              [change.column]: change.nextValue,
            } as Partial<BrandListSchemaRow>);
          }
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, onUpdateRow, search]);

  // ─── Find & Replace ──────────────────────────────────────────────────────

  const handleReplaceCurrent = useCallback(
    (preview: BrandListReplacePreview) => {
      if (preview.status !== "safe") return;
      const { match } = preview;
      // Navigate to the correct sheet first if needed
      if (onSelectSheet && match.sheetSlug !== activeSlug) {
        onSelectSheet(match.sheetSlug);
      }
      onUpdateRow(match.prefixIndex, match.bundleIndex, match.rowIndex, {
        [match.column]: preview.nextValue,
      } as Partial<BrandListSchemaRow>);
      history.pushBulkTransaction(
        [
          {
            source: "replace",
            sheetSlug: match.sheetSlug,
            sheetName: match.sheetName,
            prefixIndex: match.prefixIndex,
            bundleIndex: match.bundleIndex,
            rowIndex: match.rowIndex,
            rowId: match.rowId,
            column: match.column,
            previousValue: preview.previousValue,
            nextValue: preview.nextValue,
          },
        ],
        "replace",
        `Replace in ${match.columnLabel}`,
      );
      search.goToNextMatch();
    },
    [activeSlug, history, onSelectSheet, onUpdateRow, search],
  );

  const handleReplaceAll = useCallback(() => {
    const safePreviews = search.replacePreviews.filter((p) => p.status === "safe");
    if (safePreviews.length === 0) return;
    for (const preview of safePreviews) {
      const { match } = preview;
      onUpdateRow(match.prefixIndex, match.bundleIndex, match.rowIndex, {
        [match.column]: preview.nextValue,
      } as Partial<BrandListSchemaRow>);
    }
    history.pushBulkTransaction(
      safePreviews.map((p) => ({
        source: "replace" as const,
        sheetSlug: p.match.sheetSlug,
        sheetName: p.match.sheetName,
        prefixIndex: p.match.prefixIndex,
        bundleIndex: p.match.bundleIndex,
        rowIndex: p.match.rowIndex,
        rowId: p.match.rowId,
        column: p.match.column,
        previousValue: p.previousValue,
        nextValue: p.nextValue,
      })),
      "replace",
      `Replace all (${safePreviews.length} cells)`,
    );
  }, [history, onUpdateRow, search]);

  const handleJumpToMatch = useCallback(
    (match: BrandListSearchMatch) => {
      if (onSelectSheet && match.sheetSlug !== activeSlug) {
        onSelectSheet(match.sheetSlug);
      }
    },
    [activeSlug, onSelectSheet],
  );

  // ─── History panel handlers ──────────────────────────────────────────────

  const handleJumpToCell = useCallback((_entry: BrandListHistoryEntry) => {
    // Scroll-into-view is handled by the EditorCell auto-scroll when activeMatch changes
    // For now just switch sheet if needed
    if (onSelectSheet && _entry.sheetSlug !== activeSlug) {
      onSelectSheet(_entry.sheetSlug);
    }
  }, [activeSlug, onSelectSheet]);

  const handleRevert = useCallback(
    (entry: BrandListHistoryEntry) => {
      const revertChange = history.revertEntry(entry.id);
      if (!revertChange) return;
      onUpdateRow(revertChange.prefixIndex, revertChange.bundleIndex, revertChange.rowIndex, {
        [revertChange.column]: revertChange.nextValue,
      } as Partial<BrandListSchemaRow>);
    },
    [history, onUpdateRow],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!activeSlug) return <WorkspaceSkeleton />;

  if (!activeBrandSchema) {
    return (
      <SchemaLoadingSkeleton
        isSavingBrandSchema={isSavingBrandSchema}
        hasLayoutReference={Boolean(activeImageUrl)}
        onOpenLayoutReference={onOpenLayoutReference}
      />
    );
  }

  const canOpenLayoutRef = Boolean(activeImageUrl || layoutWorkspaceEndpoint);
  const statusLabel = reviewReadOnly
    ? "View-only mode"
    : isSavingBrandSchema
      ? "Saving..."
      : "Saved to Share state";

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-brand-editor
    >
      {/* Header */}
      <div className="shrink-0 border-b bg-background/95 px-4 py-4">
        <div className="mx-auto w-full max-w-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <ProjectIcon
                  name={
                    projectNumber ||
                    projectName ||
                    activeBrandSchema.projectInfo.projectNumber ||
                    activeBrandSchema.projectInfo.projectName ||
                    "Project"
                  }
                  color={projectColor || "#ffcc61"}
                  interactive={false}
                />
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Brand List Editor
              </div>
              <h3 className="mt-1 truncate text-2xl font-semibold">
                {normalizeDisplayTitle(
                  activeSheetName || activeBrandSchema.sheetName || activeSlug,
                )}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">
                  {activeBrandSchema.totalRows} export rows
                </Badge>
                <span>{activeBrandSchema.prefixGroups.length} device groups</span>
                <span>{statusLabel}</span>
                {history.entries.length > 0 && (
                  <Badge variant="outline" className="text-[11px]">
                    {history.entries.length} change{history.entries.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            {/* Toolbar buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={search.openSearch}
                title="Search (Cmd+F)"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historyOpen ? "secondary" : "outline"}
                className="gap-1.5"
                onClick={() => setHistoryOpen((v) => !v)}
                title="Toggle history panel"
              >
                <Clock className="h-4 w-4" />
                History
              </Button>
              {/* Undo/Redo compact buttons */}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                disabled={!history.canUndo}
                title="Undo (Cmd+Z)"
                onClick={() => {
                  const tx = history.undo();
                  if (tx) {
                    for (const change of tx.changes) {
                      onUpdateRow(change.prefixIndex, change.bundleIndex, change.rowIndex, {
                        [change.column]: change.previousValue,
                      } as Partial<BrandListSchemaRow>);
                    }
                  }
                }}
              >
                Undo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                disabled={!history.canRedo}
                title="Redo (Cmd+Shift+Z)"
                onClick={() => {
                  const tx = history.redo();
                  if (tx) {
                    for (const change of tx.changes) {
                      onUpdateRow(change.prefixIndex, change.bundleIndex, change.rowIndex, {
                        [change.column]: change.nextValue,
                      } as Partial<BrandListSchemaRow>);
                    }
                  }
                }}
              >
                Redo
              </Button>
              {canOpenLayoutRef && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={onOpenLayoutReference}
                >
                  <ImageIcon className="h-4 w-4" />
                  Layout Ref
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onRegenerate}
                disabled={isSavingBrandSchema}
              >
                {isSavingBrandSchema ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Regenerate
              </Button>
            </div>
          </div>

          {/* Project metadata fields */}
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <SchemaInput label="Project" value={activeBrandSchema.projectInfo.projectName ?? ""} disabled={reviewReadOnly} onChange={(v) => onUpdateProjectInfo({ projectName: v })} />
            <SchemaInput label="PD / Project No." value={activeBrandSchema.projectInfo.projectNumber ?? ""} disabled={reviewReadOnly} onChange={(v) => onUpdateProjectInfo({ projectNumber: v })} />
            <SchemaInput label="Revision" value={activeBrandSchema.projectInfo.revision ?? ""} disabled={reviewReadOnly} onChange={(v) => onUpdateProjectInfo({ revision: v })} />
            <SchemaInput label="Controls DE" value={activeBrandSchema.projectInfo.controlsDE ?? ""} disabled={reviewReadOnly} onChange={(v) => onUpdateProjectInfo({ controlsDE: v })} />
            <SchemaInput label="Controls ME" value={activeBrandSchema.projectInfo.controlsME ?? ""} disabled={reviewReadOnly} onChange={(v) => onUpdateProjectInfo({ controlsME: v })} />
          </div>
        </div>
      </div>

      {/* Search panel */}
      <BrandListSearchPanel
        search={search}
        onReplaceCurrent={handleReplaceCurrent}
        onReplaceAll={handleReplaceAll}
        onJumpToMatch={handleJumpToMatch}
      />

      {/* Main content area: table + optional history aside */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto px-0 py-0">
            <BrandListEditorTable
              schema={activeBrandSchema}
              layoutWorkspaceEndpoint={layoutWorkspaceEndpoint}
              initialLayoutPageNumber={initialLayoutPageNumber}
              selectedRowIds={selectedBrandRows}
              readOnly={reviewReadOnly}
              searchMatches={search.matches}
              activeMatchIndex={search.activeMatchIndex}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              onToggleRow={(rowId) => onToggleRow(rowId)}
              onToggleSection={(rowIds) => onToggleSection(rowIds)}
              onRenameBundle={onRenameBundle}
              onUpdateRow={handleUpdateRow}
              onAddRow={onAddRow}
              onRemoveRow={onRemoveRow}
            />
          </div>
        </div>

        {/* History aside */}
        <BrandListHistoryPanel
          open={historyOpen}
          history={history}
          activeSheetSlug={activeSlug}
          activeSheetName={activeSheetName ?? activeSlug}
          onClose={() => setHistoryOpen(false)}
          onJumpToCell={handleJumpToCell}
          onRevert={handleRevert}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SchemaLoadingSkeleton({
  isSavingBrandSchema,
  hasLayoutReference,
  onOpenLayoutReference,
}: {
  isSavingBrandSchema: boolean;
  hasLayoutReference: boolean;
  onOpenLayoutReference: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b bg-background/95 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Brand List</div>
            <div className="mt-1">
              <Skeleton className="h-9 w-64 max-w-full" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-28" />
              <span>{isSavingBrandSchema ? "Loading brand list..." : "Preparing brand list..."}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasLayoutReference && (
              <Button type="button" variant="outline" onClick={onOpenLayoutReference}>
                Open layout
              </Button>
            )}
            <Button type="button" variant="outline" disabled>
              Preparing...
            </Button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-3 rounded-2xl border bg-card/40 p-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading sheet workspace...
    </div>
  );
}

function SchemaInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <Input value={value} className="h-9" disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
