"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { BrandListExportSchema, BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import type { BrandListEditableTableModel } from "@/lib/wire-list-sheet-document/types";
import { buildBrandListEditableTableModelFromSections } from "@/lib/wire-list-sheet-document/brand-table";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import { BrandRowMeasurementDialog } from "@/components/wire-list/brand-row-measurement-dialog";

interface BrandListEditorTableProps {
  schema: BrandListExportSchema;
  model?: BrandListEditableTableModel | null;
  layoutWorkspaceEndpoint?: string | null;
  initialLayoutPageNumber?: number;
  selectedRowIds: Set<string>;
  readOnly?: boolean;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onToggleSection: (rowIds: string[], checked: boolean) => void;
  onRenameBundle: (prefixIndex: number, bundleIndex: number, nextName: string) => void;
  onUpdateRow: (prefixIndex: number, bundleIndex: number, rowIndex: number, patch: Partial<BrandListSchemaRow>) => void;
  onAddRow: (prefixIndex: number, bundleIndex: number) => void;
  onRemoveRow: (prefixIndex: number, bundleIndex: number, rowIndex: number) => void;
}

type EditorTableRow = {
  row: BrandListSchemaRow;
  rowId: string;
  rowIndex: number;
};

const BRAND_EDITOR_COLUMN_OPTIONS = [
  { key: "fromDeviceId", label: "From Device" },
  { key: "wireNo", label: "Wire No." },
  { key: "wireId", label: "Wire ID" },
  { key: "gaugeSize", label: "Gauge" },
  { key: "length", label: "Length" },
  { key: "toDeviceId", label: "To Device" },
  { key: "toLocation", label: "To Location" },
  { key: "bundleDisplay", label: "Bundle Display" },
] as const;

function createDefaultColumnVisibility(): VisibilityState {
  return BRAND_EDITOR_COLUMN_OPTIONS.reduce<VisibilityState>((acc, column) => {
    acc[column.key] = true;
    return acc;
  }, {});
}

function normalizeRowValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function resolveRowId(row: BrandListSchemaRow, rowIndex: number, scope = "row"): string {
  const legacyRow = row as Partial<BrandListSchemaRow>;
  if (typeof legacyRow.rowId === "string" && legacyRow.rowId.trim().length > 0) {
    return legacyRow.rowId;
  }
  return `legacy-${scope}-${rowIndex}`;
}

export function BrandListEditorTable({
  schema,
  model,
  layoutWorkspaceEndpoint = null,
  initialLayoutPageNumber,
  selectedRowIds,
  readOnly = false,
  onToggleRow,
  onToggleSection,
  onRenameBundle,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
}: BrandListEditorTableProps) {
  const fallbackModel = useMemo(
    () => buildBrandListEditableTableModelFromSections([]),
    [],
  );
  const tableModel = model ?? fallbackModel;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => createDefaultColumnVisibility(),
  );
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
    if (!measurementTarget) {
      return -1;
    }

    return measurementTargets.findIndex(
      (target) =>
        target.prefixIndex === measurementTarget.prefixIndex &&
        target.bundleIndex === measurementTarget.bundleIndex &&
        target.rowIndex === measurementTarget.rowIndex,
    );
  }, [measurementTarget, measurementTargets]);
  const measurementRow = useMemo(() => {
    if (!measurementTarget) {
      return null;
    }

    const row = schema.prefixGroups[measurementTarget.prefixIndex]?.bundles[measurementTarget.bundleIndex]?.rows[measurementTarget.rowIndex];
    if (!row) {
      return null;
    }

    return {
      rowId: resolveRowId(
        row,
        measurementTarget.rowIndex,
        `p${measurementTarget.prefixIndex}-b${measurementTarget.bundleIndex}`,
      ),
      fromDeviceId: normalizeRowValue(row.fromDeviceId),
      toDeviceId: normalizeRowValue(row.toDeviceId),
      toLocation: normalizeRowValue(row.toLocation),
      wireNo: normalizeRowValue(row.wireNo),
      wireId: normalizeRowValue(row.wireId),
      bundleDisplay: normalizeRowValue(row.bundleDisplay),
    };
  }, [measurementTarget, schema.prefixGroups]);
  const canOpenMeasurement = Boolean(layoutWorkspaceEndpoint) && !readOnly;

  const toggleColumnVisibility = (key: string, checked: boolean) => {
    setColumnVisibility((previous) => ({
      ...previous,
      [key]: checked,
    }));
  };

  const resetColumnVisibility = () => {
    setColumnVisibility(createDefaultColumnVisibility());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="hidden items-center justify-end border-b px-4 py-2 xl:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs">
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
                  onCheckedChange={(value) =>
                    toggleColumnVisibility(column.key, value === true)
                  }
                  className="text-xs"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onSelect={(event) => {
                  event.preventDefault();
                  resetColumnVisibility();
                }}
                className="text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset to defaults
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="divide-y">
          {schema.prefixGroups.map((prefixGroup, prefixIndex) => (
            <div key={`${prefixGroup.prefix}-${prefixIndex}`}>
              <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-4 py-3">
                <div>
                <div className="text-base font-semibold">{prefixGroup.prefix}</div>
                </div>
                <Badge variant="secondary">
                  {prefixGroup.bundles.reduce((sum, bundle) => sum + bundle.rows.length, 0)} rows
                </Badge>
              </div>

              {prefixGroup.bundles.map((bundle, bundleIndex) => {
                const sectionScope = `p${prefixIndex}-b${bundleIndex}`;
                const sectionRowIds = bundle.rows.map((row, rowIndex) =>
                  resolveRowId(row, rowIndex, sectionScope),
                );
                const sectionSelected = sectionRowIds.length > 0 && sectionRowIds.every((rowId) => selectedRowIds.has(rowId));
                const bundleDisplayTitle = normalizeDisplayTitle(bundle.bundleName);
                const locationDisplayTitle = normalizeDisplayTitle(bundle.toLocation || schema.sheetName);

                return (
                  <div key={`${bundle.bundleName}-${bundleIndex}`} className="border-b last:border-b-0">
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/5 px-4 py-2">
                      

             
                    </div>

                    <BundleDesktopTable
                      rows={bundle.rows}
                      prefixIndex={prefixIndex}
                      bundleIndex={bundleIndex}
                      selectedRowIds={selectedRowIds}
                      columnVisibility={columnVisibility}
                      canMeasure={canOpenMeasurement}
                      readOnly={readOnly}
                      onToggleRow={onToggleRow}
                      onMeasureRow={(rowIndex, rowId) =>
                        setMeasurementTarget({
                          prefixIndex,
                          bundleIndex,
                          rowIndex,
                          rowId,
                        })
                      }
                      onUpdateRow={onUpdateRow}
                      onRemoveRow={onRemoveRow}
                    />
                    

                    <div className="divide-y bg-background xl:hidden">
                      {bundle.rows.map((row, rowIndex) => (
                        <div key={resolveRowId(row, rowIndex, sectionScope)} className="px-4 py-2">
                          <div className="rounded-xl border bg-muted/10 p-3 xl:hidden">
                            <div className="mb-3 flex items-center justify-between">
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={selectedRowIds.has(resolveRowId(row, rowIndex, sectionScope))}
                                  disabled={readOnly}
                                  onChange={(event) => onToggleRow(resolveRowId(row, rowIndex, sectionScope), event.target.checked)}
                                  aria-label={`Select row ${resolveRowId(row, rowIndex, sectionScope)}`}
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
                              <MobileInput label="From Device" value={normalizeRowValue(row.fromDeviceId)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { fromDeviceId: value })} />
                              <div className="grid grid-cols-2 gap-2">
                                <MobileInput label="Wire No." value={normalizeRowValue(row.wireNo)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireNo: value })} />
                                <MobileInput label="Wire ID" value={normalizeRowValue(row.wireId)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireId: value })} />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MobileInput label="Gauge" value={normalizeRowValue(row.gaugeSize)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { gaugeSize: value })} />
                                <div className="space-y-1">
                                  <MobileInput
                                    label="Length"
                                    type="number"
                                    value={normalizeRowValue(row.length ?? "")}
                                    disabled={readOnly}
                                    onChange={(value) => {
                                      const nextLength = String(value).trim() === "" ? null : Number(value);
                                      onUpdateRow(prefixIndex, bundleIndex, rowIndex, {
                                        length: typeof nextLength === "number" && !Number.isNaN(nextLength) ? Math.max(0, nextLength) : null,
                                      });
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full justify-start gap-1"
                                    disabled={!canOpenMeasurement}
                                    onClick={() =>
                                      setMeasurementTarget({
                                        prefixIndex,
                                        bundleIndex,
                                        rowIndex,
                                        rowId: resolveRowId(row, rowIndex, sectionScope),
                                      })
                                    }
                                  >
                                    <Ruler className="h-3.5 w-3.5" />
                                    Measure
                                  </Button>
                                </div>
                              </div>
                              <MobileInput label="To Device" value={normalizeRowValue(row.toDeviceId)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toDeviceId: value })} />
                              <MobileInput label="To Location" value={normalizeRowValue(row.toLocation)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toLocation: normalizeDisplayTitle(value) })} />
                              <MobileInput label="Bundle Display" value={normalizeRowValue(row.bundleDisplay)} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { bundleDisplay: normalizeDisplayTitle(value) })} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 flex-1 justify-between px-1 py-2 border-t">
                        <label className="hidden xl:inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={sectionSelected}
                            disabled={readOnly}
                            onChange={(event) => onToggleSection(sectionRowIds, event.target.checked)}
                            aria-label={`Select all rows in ${bundleDisplayTitle}`}
                          />
                          Select bundle
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
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
      <BrandRowMeasurementDialog
        open={measurementTarget !== null}
        endpoint={layoutWorkspaceEndpoint}
        initialPageNumber={initialLayoutPageNumber}
        sheetName={schema.sheetName}
        targetRow={measurementRow}
        rowPosition={
          measurementTargetIndex >= 0
            ? {
                current: measurementTargetIndex + 1,
                total: measurementTargets.length,
              }
            : null
        }
        canGoPreviousRow={measurementTargetIndex > 0}
        canGoNextRow={
          measurementTargetIndex >= 0 &&
          measurementTargetIndex < measurementTargets.length - 1
        }
        onGoToPreviousRow={() => {
          if (measurementTargetIndex <= 0) {
            return;
          }
          setMeasurementTarget(measurementTargets[measurementTargetIndex - 1]);
        }}
        onGoToNextRow={() => {
          if (
            measurementTargetIndex < 0 ||
            measurementTargetIndex >= measurementTargets.length - 1
          ) {
            return;
          }
          setMeasurementTarget(measurementTargets[measurementTargetIndex + 1]);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setMeasurementTarget(null);
          }
        }}
        onApply={(roundedLength) => {
          if (!measurementTarget) {
            return;
          }

          onUpdateRow(
            measurementTarget.prefixIndex,
            measurementTarget.bundleIndex,
            measurementTarget.rowIndex,
            { length: Math.max(0, roundedLength) },
          );
        }}
      />
    </div>
  );
}

function BundleDesktopTable({
  rows,
  prefixIndex,
  bundleIndex,
  selectedRowIds,
  columnVisibility,
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
  canMeasure: boolean;
  readOnly: boolean;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onMeasureRow: (rowIndex: number, rowId: string) => void;
  onUpdateRow: (
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
    patch: Partial<BrandListSchemaRow>,
  ) => void;
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
        header: "Select",
        cell: ({ row: tableRow }) => (
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={selectedRowIds.has(tableRow.original.rowId)}
            disabled={readOnly}
            onChange={(event) =>
              onToggleRow(tableRow.original.rowId, event.target.checked)
            }
            aria-label={`Select row ${tableRow.original.rowId}`}
          />
        ),
      },
      {
        id: "fromDeviceId",
        header: "From Device",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.fromDeviceId)}
            className="bg-muted/30 font-mono"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                fromDeviceId: event.target.value,
              })
            }
          />
        ),
      },
      {
        id: "wireNo",
        header: "Wire No.",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.wireNo)}
            className="bg-muted/20 font-mono"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                wireNo: event.target.value,
              })
            }
          />
        ),
      },
      {
        id: "wireId",
        header: "Wire ID",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.wireId)}
            className="bg-muted/30 font-mono"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                wireId: event.target.value,
              })
            }
          />
        ),
      },
      {
        id: "gaugeSize",
        header: "Gauge",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.gaugeSize)}
            className="bg-muted/20 font-mono"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                gaugeSize: event.target.value,
              })
            }
          />
        ),
      },
      {
        id: "length",
        header: "Length",
        cell: ({ row: tableRow }) => (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={normalizeRowValue(tableRow.original.row.length ?? "")}
              className="h-9 rounded-none border-0 bg-amber-50 font-mono text-sm shadow-none"
              disabled={readOnly}
              onChange={(event) => {
                const nextLength =
                  event.target.value.trim() === ""
                    ? null
                    : Number(event.target.value);
                onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                  length:
                    typeof nextLength === "number" && !Number.isNaN(nextLength)
                      ? Math.max(0, nextLength)
                      : null,
                });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canMeasure}
              onClick={() =>
                onMeasureRow(tableRow.original.rowIndex, tableRow.original.rowId)
              }
            >
              <Ruler className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
      {
        id: "toDeviceId",
        header: "To Device",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.toDeviceId)}
            className="bg-muted/30 font-mono"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                toDeviceId: event.target.value,
              })
            }
          />
        ),
      },
      {
        id: "toLocation",
        header: "To Location",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.toLocation)}
            className="bg-muted/20"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                toLocation: normalizeDisplayTitle(event.target.value),
              })
            }
          />
        ),
      },
      {
        id: "bundleDisplay",
        header: "Bundle Display",
        cell: ({ row: tableRow }) => (
          <AutoSizingCellInput
            value={normalizeRowValue(tableRow.original.row.bundleDisplay)}
            className="bg-muted/30"
            disabled={readOnly}
            onChange={(event) =>
              onUpdateRow(prefixIndex, bundleIndex, tableRow.original.rowIndex, {
                bundleDisplay: normalizeDisplayTitle(event.target.value),
              })
            }
          />
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: "",
        cell: ({ row: tableRow }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            disabled={readOnly}
            onClick={() =>
              onRemoveRow(prefixIndex, bundleIndex, tableRow.original.rowIndex)
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [
      bundleIndex,
      canMeasure,
      onMeasureRow,
      onRemoveRow,
      onToggleRow,
      onUpdateRow,
      prefixIndex,
      readOnly,
      selectedRowIds,
    ],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (original) => original.rowId,
  });

  return (
    <div className="hidden min-h-0 flex-1 xl:block">
      <div className="h-full overflow-auto">
      <Table className="w-full table-fixed">
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="px-2 py-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((tableRow, index) => (
            <TableRow key={tableRow.id} index={index}>
              {tableRow.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="p-1 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function AutoSizingCellInput({
  value,
  className,
  disabled,
  onChange,
}: {
  value: string;
  className: string;
  disabled: boolean;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <textarea
      value={inputValue}
      className={`min-h-9 w-full resize-y rounded-none border-0 px-3 py-2 text-sm leading-snug shadow-none outline-none ring-0 ${className}`}
      disabled={disabled}
      onChange={(event) => {
        setInputValue(event.target.value);
        onChange(event);
      }}
    />
  );
}

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
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          value={normalizeRowValue(value)}
          className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-snug"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
