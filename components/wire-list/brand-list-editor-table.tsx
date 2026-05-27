"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Plus, RotateCcw, Ruler, Trash2 } from "lucide-react";
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BrandListExportSchema, BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import type { BrandListEditableTableModel } from "@/lib/wire-list-sheet-document/types";
import { buildBrandListEditableTableModelFromSections } from "@/lib/wire-list-sheet-document/brand-table";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import { BrandRowMeasurementDialog } from "@/components/wire-list/brand-row-measurement-dialog";
import type { BrandListColumnKey, BrandListSearchMatch } from "@/lib/wire-brand-list/editor-types";

// ─── Column definitions ───────────────────────────────────────────────────────

export const BRAND_EDITOR_COLUMN_OPTIONS: {
  key: BrandListColumnKey;
  label: string;
  width: string;
}[] = [
  { key: "fromDeviceId", label: "From Device", width: "w-36" },
  { key: "wireNo", label: "Wire No.", width: "w-28" },
  { key: "wireId", label: "Wire ID", width: "w-28" },
  { key: "gaugeSize", label: "Gauge", width: "w-20" },
  { key: "length", label: "Length", width: "w-28" },
  { key: "toDeviceId", label: "To Device", width: "w-36" },
  { key: "toLocation", label: "To Location", width: "w-36" },
  { key: "bundleDisplay", label: "Bundle Display", width: "w-36" },
];

function createDefaultColumnVisibility(): VisibilityState {
  return BRAND_EDITOR_COLUMN_OPTIONS.reduce<VisibilityState>((acc, column) => {
    acc[column.key] = true;
    return acc;
  }, {});
}

function normalizeRowValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function resolveRowId(row: BrandListSchemaRow, rowIndex: number, scope = "row"): string {
  const legacyRow = row as Partial<BrandListSchemaRow>;
  if (typeof legacyRow.rowId === "string" && legacyRow.rowId.trim().length > 0) {
    return legacyRow.rowId;
  }
  return `legacy-${scope}-${rowIndex}`;
}

// ─── Search highlight helpers ─────────────────────────────────────────────────

function isCellMatch(
  matches: BrandListSearchMatch[],
  activeMatchIndex: number,
  rowId: string,
  column: BrandListColumnKey,
): { isMatch: boolean; isActive: boolean; match: BrandListSearchMatch | null } {
  const matchIndex = matches.findIndex((m) => m.rowId === rowId && m.column === column);
  if (matchIndex === -1) return { isMatch: false, isActive: false, match: null };
  return {
    isMatch: true,
    isActive: matchIndex === activeMatchIndex,
    match: matches[matchIndex],
  };
}

// ─── Reusable cell component ──────────────────────────────────────────────────

interface EditorCellProps {
  value: string;
  disabled: boolean;
  isMatch?: boolean;
  isActive?: boolean;
  match?: BrandListSearchMatch | null;
  className?: string;
  onChange: (value: string) => void;
}

function EditorCell({
  value,
  disabled,
  isMatch = false,
  isActive = false,
  match = null,
  className,
  onChange,
}: EditorCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const cellRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-scroll to active match
  useEffect(() => {
    if (isActive && cellRef.current) {
      cellRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <div
      className={cn(
        "relative",
        isMatch && "ring-1 ring-inset ring-yellow-400",
        isActive && "ring-2 ring-inset ring-primary",
      )}
    >
      <textarea
        ref={cellRef}
        value={localValue}
        rows={1}
        className={cn(
          "w-full resize-none rounded-none border-0 px-3 py-2 text-sm leading-5 shadow-none outline-none ring-0 transition-colors",
          "min-h-[36px] align-middle",
          "focus:bg-primary/5",
          className,
          disabled && "cursor-default opacity-80",
        )}
        disabled={disabled}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
        }}
        onInput={(e) => {
          // Auto-resize
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
      />
      {isMatch && match && (
        <HighlightOverlay value={localValue} matchStart={match.matchStart} matchEnd={match.matchEnd} isActive={isActive} />
      )}
    </div>
  );
}

function HighlightOverlay({
  value,
  matchStart,
  matchEnd,
  isActive,
}: {
  value: string;
  matchStart: number;
  matchEnd: number;
  isActive: boolean;
}) {
  // Visual-only match indicator shown below the textarea
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 px-3 py-2 text-sm leading-5 opacity-0",
      )}
      aria-hidden
    >
      <span>{value.slice(0, matchStart)}</span>
      <mark
        className={cn(
          "rounded-sm px-0.5",
          isActive ? "bg-primary/30" : "bg-yellow-200",
        )}
      >
        {value.slice(matchStart, matchEnd)}
      </mark>
      <span>{value.slice(matchEnd)}</span>
    </div>
  );
}

// ─── Main props ───────────────────────────────────────────────────────────────

interface BrandListEditorTableProps {
  schema: BrandListExportSchema;
  model?: BrandListEditableTableModel | null;
  layoutWorkspaceEndpoint?: string | null;
  initialLayoutPageNumber?: number;
  selectedRowIds: Set<string>;
  readOnly?: boolean;
  searchMatches?: BrandListSearchMatch[];
  activeMatchIndex?: number;
  columnVisibility?: VisibilityState;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onToggleSection: (rowIds: string[], checked: boolean) => void;
  onRenameBundle: (prefixIndex: number, bundleIndex: number, nextName: string) => void;
  onUpdateRow: (prefixIndex: number, bundleIndex: number, rowIndex: number, patch: Partial<BrandListSchemaRow>) => void;
  onAddRow: (prefixIndex: number, bundleIndex: number) => void;
  onRemoveRow: (prefixIndex: number, bundleIndex: number, rowIndex: number) => void;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
}

type EditorTableRow = {
  row: BrandListSchemaRow;
  rowId: string;
  rowIndex: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BrandListEditorTable({
  schema,
  model,
  layoutWorkspaceEndpoint = null,
  initialLayoutPageNumber,
  selectedRowIds,
  readOnly = false,
  searchMatches = [],
  activeMatchIndex = 0,
  columnVisibility: externalColumnVisibility,
  onToggleRow,
  onToggleSection,
  onRenameBundle,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onColumnVisibilityChange,
}: BrandListEditorTableProps) {
  const fallbackModel = useMemo(
    () => buildBrandListEditableTableModelFromSections([]),
    [],
  );
  const tableModel = model ?? fallbackModel;
  void tableModel;

  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>(
    () => createDefaultColumnVisibility(),
  );

  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;

  const [measurementTarget, setMeasurementTarget] = useState<{
    prefixIndex: number;
    bundleIndex: number;
    rowIndex: number;
    rowId: string;
  } | null>(null);

  const measurementTargets = useMemo(
    () =>
      schema.prefixGroups.flatMap((prefixGroup, prefixIndex) =>
        prefixGroup.bundles.flatMap((bundle, bundleIndex) =>
          bundle.rows.map((row, rowIndex) => ({
            prefixIndex,
            bundleIndex,
            rowIndex,
            rowId: resolveRowId(row, rowIndex, `p${prefixIndex}-b${bundleIndex}`),
          })),
        ),
      ),
    [schema.prefixGroups],
  );

  const measurementTargetIndex = useMemo(() => {
    if (!measurementTarget) return -1;
    return measurementTargets.findIndex(
      (target) =>
        target.prefixIndex === measurementTarget.prefixIndex &&
        target.bundleIndex === measurementTarget.bundleIndex &&
        target.rowIndex === measurementTarget.rowIndex,
    );
  }, [measurementTarget, measurementTargets]);

  const measurementRow = useMemo(() => {
    if (!measurementTarget) return null;
    const row = schema.prefixGroups[measurementTarget.prefixIndex]?.bundles[measurementTarget.bundleIndex]?.rows[measurementTarget.rowIndex];
    if (!row) return null;
    return {
      rowId: resolveRowId(row, measurementTarget.rowIndex, `p${measurementTarget.prefixIndex}-b${measurementTarget.bundleIndex}`),
      fromDeviceId: normalizeRowValue(row.fromDeviceId),
      toDeviceId: normalizeRowValue(row.toDeviceId),
      toLocation: normalizeRowValue(row.toLocation),
      wireNo: normalizeRowValue(row.wireNo),
      wireId: normalizeRowValue(row.wireId),
      bundleDisplay: normalizeRowValue(row.bundleDisplay),
    };
  }, [measurementTarget, schema.prefixGroups]);

  const canOpenMeasurement = Boolean(layoutWorkspaceEndpoint) && !readOnly;

  const handleToggleColumnVisibility = (key: string, checked: boolean) => {
    const next = { ...columnVisibility, [key]: checked };
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(next);
    } else {
      setInternalColumnVisibility(next);
    }
  };

  const handleResetColumnVisibility = () => {
    const next = createDefaultColumnVisibility();
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(next);
    } else {
      setInternalColumnVisibility(next);
    }
  };

  const visibleColumns = useMemo(
    () =>
      BRAND_EDITOR_COLUMN_OPTIONS.filter((c) => columnVisibility[c.key] !== false).map((c) => c.key),
    [columnVisibility],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Column visibility toggle */}
        <div className="hidden items-center justify-end border-b px-4 py-1.5 xl:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BRAND_EDITOR_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key] ?? true}
                  onCheckedChange={(value) => handleToggleColumnVisibility(column.key, value === true)}
                  className="text-xs"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onSelect={(e) => {
                  e.preventDefault();
                  handleResetColumnVisibility();
                }}
                className="text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset to defaults
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Section groups */}
        <div className="divide-y">
          {schema.prefixGroups.map((prefixGroup, prefixIndex) => (
            <div key={`${prefixGroup.prefix}-${prefixIndex}`}>
              {/* Prefix header */}
              <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-4 py-2.5">
                <div className="text-sm font-semibold">{prefixGroup.prefix}</div>
                <Badge variant="secondary">
                  {prefixGroup.bundles.reduce((sum, bundle) => sum + bundle.rows.length, 0)} rows
                </Badge>
              </div>

              {prefixGroup.bundles.map((bundle, bundleIndex) => {
                const sectionScope = `p${prefixIndex}-b${bundleIndex}`;
                const sectionRowIds = bundle.rows.map((row, rowIndex) =>
                  resolveRowId(row, rowIndex, sectionScope),
                );
                const sectionSelected =
                  sectionRowIds.length > 0 &&
                  sectionRowIds.every((rowId) => selectedRowIds.has(rowId));
                const bundleDisplayTitle = normalizeDisplayTitle(bundle.bundleName);

                return (
                  <div key={`${bundle.bundleName}-${bundleIndex}`} className="border-b last:border-b-0">
                    {/* Desktop table */}
                    <BundleDesktopTable
                      rows={bundle.rows}
                      prefixIndex={prefixIndex}
                      bundleIndex={bundleIndex}
                      selectedRowIds={selectedRowIds}
                      columnVisibility={columnVisibility}
                      searchMatches={searchMatches}
                      activeMatchIndex={activeMatchIndex}
                      canMeasure={canOpenMeasurement}
                      readOnly={readOnly}
                      onToggleRow={onToggleRow}
                      onMeasureRow={(rowIndex, rowId) =>
                        setMeasurementTarget({ prefixIndex, bundleIndex, rowIndex, rowId })
                      }
                      onUpdateRow={onUpdateRow}
                      onRemoveRow={onRemoveRow}
                    />

                    {/* Mobile cards */}
                    <div className="divide-y bg-background xl:hidden">
                      {bundle.rows.map((row, rowIndex) => {
                        const rowId = resolveRowId(row, rowIndex, sectionScope);
                        return (
                          <div key={rowId} className="px-4 py-2">
                            <div className="rounded-xl border bg-muted/10 p-3">
                              <div className="mb-3 flex items-center justify-between">
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary"
                                    checked={selectedRowIds.has(rowId)}
                                    disabled={readOnly}
                                    onChange={(e) => onToggleRow(rowId, e.target.checked)}
                                    aria-label={`Select row ${rowId}`}
                                  />
                                  Select Row
                                </label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  disabled={readOnly}
                                  onClick={() => onRemoveRow(prefixIndex, bundleIndex, rowIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <MobileInput label="From Device" value={normalizeRowValue(row.fromDeviceId)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { fromDeviceId: v })} />
                                <div className="grid grid-cols-2 gap-2">
                                  <MobileInput label="Wire No." value={normalizeRowValue(row.wireNo)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireNo: v })} />
                                  <MobileInput label="Wire ID" value={normalizeRowValue(row.wireId)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireId: v })} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <MobileInput label="Gauge" value={normalizeRowValue(row.gaugeSize)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { gaugeSize: v })} />
                                  <div className="space-y-1">
                                    <MobileInput label="Length" type="number" value={normalizeRowValue(row.length ?? "")} disabled={readOnly} onChange={(v) => {
                                      const n = v.trim() === "" ? null : Number(v);
                                      onUpdateRow(prefixIndex, bundleIndex, rowIndex, { length: typeof n === "number" && !Number.isNaN(n) ? Math.max(0, n) : null });
                                    }} />
                                    <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-start gap-1" disabled={!canOpenMeasurement} onClick={() => setMeasurementTarget({ prefixIndex, bundleIndex, rowIndex, rowId })}>
                                      <Ruler className="h-3.5 w-3.5" />
                                      Measure
                                    </Button>
                                  </div>
                                </div>
                                <MobileInput label="To Device" value={normalizeRowValue(row.toDeviceId)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toDeviceId: v })} />
                                <MobileInput label="To Location" value={normalizeRowValue(row.toLocation)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toLocation: normalizeDisplayTitle(v) })} />
                                <MobileInput label="Bundle Display" value={normalizeRowValue(row.bundleDisplay)} disabled={readOnly} onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { bundleDisplay: normalizeDisplayTitle(v) })} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bundle footer */}
                    <div className="flex items-center gap-3 flex-1 justify-between px-2 py-1.5 border-t bg-muted/5">
                      <label className="hidden xl:inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={sectionSelected}
                          disabled={readOnly}
                          onChange={(e) => onToggleSection(sectionRowIds, e.target.checked)}
                          aria-label={`Select all rows in ${bundleDisplayTitle}`}
                        />
                        Select bundle
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={readOnly}
                        onClick={() => onAddRow(prefixIndex, bundleIndex)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add row
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Measurement dialog */}
      <BrandRowMeasurementDialog
        open={measurementTarget !== null}
        endpoint={layoutWorkspaceEndpoint}
        initialPageNumber={initialLayoutPageNumber}
        sheetName={schema.sheetName}
        targetRow={measurementRow}
        rowPosition={
          measurementTargetIndex >= 0
            ? { current: measurementTargetIndex + 1, total: measurementTargets.length }
            : null
        }
        canGoPreviousRow={measurementTargetIndex > 0}
        canGoNextRow={measurementTargetIndex >= 0 && measurementTargetIndex < measurementTargets.length - 1}
        onGoToPreviousRow={() => {
          if (measurementTargetIndex <= 0) return;
          setMeasurementTarget(measurementTargets[measurementTargetIndex - 1]);
        }}
        onGoToNextRow={() => {
          if (measurementTargetIndex < 0 || measurementTargetIndex >= measurementTargets.length - 1) return;
          setMeasurementTarget(measurementTargets[measurementTargetIndex + 1]);
        }}
        onOpenChange={(open) => {
          if (!open) setMeasurementTarget(null);
        }}
        onApply={(roundedLength) => {
          if (!measurementTarget) return;
          onUpdateRow(measurementTarget.prefixIndex, measurementTarget.bundleIndex, measurementTarget.rowIndex, { length: Math.max(0, roundedLength) });
        }}
      />
    </div>
  );
}

// ─── Desktop bundle table ─────────────────────────────────────────────────────

function BundleDesktopTable({
  rows,
  prefixIndex,
  bundleIndex,
  selectedRowIds,
  columnVisibility,
  searchMatches,
  activeMatchIndex,
  canMeasure,
  readOnly,
  onToggleRow,
  onMeasureRow,
  onUpdateRow,
  onRemoveRow,
}: {
  rows: BrandListSchemaRow[];
  prefixIndex: number;
  bundleIndex: number;
  selectedRowIds: Set<string>;
  columnVisibility: VisibilityState;
  searchMatches: BrandListSearchMatch[];
  activeMatchIndex: number;
  canMeasure: boolean;
  readOnly: boolean;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onMeasureRow: (rowIndex: number, rowId: string) => void;
  onUpdateRow: (prefixIndex: number, bundleIndex: number, rowIndex: number, patch: Partial<BrandListSchemaRow>) => void;
  onRemoveRow: (prefixIndex: number, bundleIndex: number, rowIndex: number) => void;
}) {
  const data = useMemo<EditorTableRow[]>(
    () =>
      rows.map((row, rowIndex) => ({
        row,
        rowId: resolveRowId(row, rowIndex, `p${prefixIndex}-b${bundleIndex}`),
        rowIndex,
      })),
    [bundleIndex, prefixIndex, rows],
  );

  const columns = useMemo<ColumnDef<EditorTableRow>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        size: 40,
        header: () => <span className="sr-only">Select</span>,
        cell: ({ row: tableRow }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={selectedRowIds.has(tableRow.original.rowId)}
              disabled={readOnly}
              onChange={(e) => onToggleRow(tableRow.original.rowId, e.target.checked)}
              aria-label={`Select row ${tableRow.original.rowId}`}
            />
          </div>
        ),
      },
      {
        id: "fromDeviceId",
        size: 140,
        header: "From Device",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "fromDeviceId");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.fromDeviceId)}
              className="bg-muted/30 font-mono"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { fromDeviceId: v })}
            />
          );
        },
      },
      {
        id: "wireNo",
        size: 110,
        header: "Wire No.",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "wireNo");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.wireNo)}
              className="bg-muted/20 font-mono"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { wireNo: v })}
            />
          );
        },
      },
      {
        id: "wireId",
        size: 110,
        header: "Wire ID",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "wireId");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.wireId)}
              className="bg-muted/30 font-mono"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { wireId: v })}
            />
          );
        },
      },
      {
        id: "gaugeSize",
        size: 80,
        header: "Gauge",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "gaugeSize");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.gaugeSize)}
              className="bg-muted/20 font-mono text-center"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { gaugeSize: v })}
            />
          );
        },
      },
      {
        id: "length",
        size: 110,
        header: "Length",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "length");
          return (
            <div className={cn("flex items-center gap-1", isMatch && "ring-1 ring-inset ring-yellow-400", isActive && "ring-2 ring-inset ring-primary")}>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={normalizeRowValue(tableRow.original.row.length ?? "")}
                className="h-[36px] flex-1 rounded-none border-0 bg-amber-50/60 font-mono text-sm shadow-none focus-visible:ring-0"
                disabled={readOnly}
                onChange={(e) => {
                  const n = e.target.value.trim() === "" ? null : Number(e.target.value);
                  onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                    length: typeof n === "number" && !Number.isNaN(n) ? Math.max(0, n) : null,
                  });
                }}
              />
              <Button type="button" variant="ghost" size="icon" className="h-[36px] w-8 shrink-0" disabled={!canMeasure} onClick={() => onMeasureRow(tableRow.original.rowIndex, tableRow.original.rowId)} title="Measure">
                <Ruler className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
      {
        id: "toDeviceId",
        size: 140,
        header: "To Device",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "toDeviceId");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.toDeviceId)}
              className="bg-muted/30 font-mono"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { toDeviceId: v })}
            />
          );
        },
      },
      {
        id: "toLocation",
        size: 140,
        header: "To Location",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "toLocation");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.toLocation)}
              className="bg-muted/20"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { toLocation: normalizeDisplayTitle(v) })}
            />
          );
        },
      },
      {
        id: "bundleDisplay",
        size: 140,
        header: "Bundle Display",
        cell: ({ row: tableRow }) => {
          const { isMatch, isActive, match } = isCellMatch(searchMatches, activeMatchIndex, tableRow.original.rowId, "bundleDisplay");
          return (
            <EditorCell
              value={normalizeRowValue(tableRow.original.row.bundleDisplay)}
              className="bg-muted/30"
              disabled={readOnly}
              isMatch={isMatch}
              isActive={isActive}
              match={match}
              onChange={(v) => onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, { bundleDisplay: normalizeDisplayTitle(v) })}
            />
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        size: 40,
        header: () => null,
        cell: ({ row: tableRow }) => (
          <div className="flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              disabled={readOnly}
              onClick={() => onRemoveRow(prefixIndex, bundleIndex, tableRow.original.rowIndex)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [
      activeMatchIndex,
      bundleIndex,
      canMeasure,
      onMeasureRow,
      onRemoveRow,
      onToggleRow,
      onUpdateRow,
      prefixIndex,
      readOnly,
      searchMatches,
      selectedRowIds,
    ],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (original) => original.rowId,
  });

  return (
    <div className="hidden min-h-0 xl:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-muted/40 border-b sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "border-r px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground last:border-r-0",
                      header.id === "select" && "w-10 text-center",
                      header.id === "actions" && "w-10",
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((tableRow, index) => {
              const isSelected = selectedRowIds.has(tableRow.original.rowId);
              return (
                <tr
                  key={tableRow.id}
                  className={cn(
                    "transition-colors",
                    index % 2 === 0 ? "bg-background" : "bg-muted/5",
                    isSelected && "bg-primary/5",
                  )}
                >
                  {tableRow.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "border-r p-0 align-middle last:border-r-0",
                        cell.column.id === "select" && "px-1",
                        cell.column.id === "actions" && "px-0.5",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mobile input ─────────────────────────────────────────────────────────────

function MobileInput({
  label,
  value,
  disabled,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  disabled: boolean;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {type === "number" ? (
        <Input
          type={type}
          value={value}
          className="h-9 text-sm"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <textarea
          value={normalizeRowValue(value)}
          rows={1}
          className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-snug"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
