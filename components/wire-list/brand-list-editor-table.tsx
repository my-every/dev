"use client";

import { useMemo, useState } from "react";
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
  const measurementRow = useMemo(() => {
    if (!measurementTarget) {
      return null;
    }

    const row = schema.prefixGroups[measurementTarget.prefixIndex]?.bundles[measurementTarget.bundleIndex]?.rows[measurementTarget.rowIndex];
    if (!row) {
      return null;
    }

    return {
      rowId: row.rowId,
      fromDeviceId: row.fromDeviceId,
      toDeviceId: row.toDeviceId,
      toLocation: row.toLocation,
      wireNo: row.wireNo,
      bundleDisplay: row.bundleDisplay,
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
    <div className="overflow-hidden flex flex-col flex-1">

      <div>
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
                const sectionRowIds = bundle.rows.map((row) => row.rowId);
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
                        <div key={row.rowId} className="px-4 py-2">
                          <div className="rounded-xl border bg-muted/10 p-3 xl:hidden">
                            <div className="mb-3 flex items-center justify-between">
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={selectedRowIds.has(row.rowId)}
                                  disabled={readOnly}
                                  onChange={(event) => onToggleRow(row.rowId, event.target.checked)}
                                  aria-label={`Select row ${row.rowId}`}
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
                              <MobileInput label="From Device" value={row.fromDeviceId} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { fromDeviceId: value })} />
                              <div className="grid grid-cols-2 gap-2">
                                <MobileInput label="Wire No." value={row.wireNo} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireNo: value })} />
                                <MobileInput label="Wire ID" value={row.wireId} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { wireId: value })} />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MobileInput label="Gauge" value={row.gaugeSize} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { gaugeSize: value })} />
                                <div className="space-y-1">
                                  <MobileInput
                                    label="Length"
                                    type="number"
                                    value={row.length ?? ""}
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
                                        rowId: row.rowId,
                                      })
                                    }
                                  >
                                    <Ruler className="h-3.5 w-3.5" />
                                    Measure
                                  </Button>
                                </div>
                              </div>
                              <MobileInput label="To Device" value={row.toDeviceId} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toDeviceId: value })} />
                              <MobileInput label="To Location" value={row.toLocation} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { toLocation: normalizeDisplayTitle(value) })} />
                              <MobileInput label="Bundle Display" value={row.bundleDisplay} disabled={readOnly} onChange={(value) => onUpdateRow(prefixIndex, bundleIndex, rowIndex, { bundleDisplay: normalizeDisplayTitle(value) })} />
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
    () => rows.map((row, rowIndex) => ({ row, rowIndex })),
    [rows],
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
            checked={selectedRowIds.has(tableRow.original.row.rowId)}
            disabled={readOnly}
            onChange={(event) =>
              onToggleRow(tableRow.original.row.rowId, event.target.checked)
            }
            aria-label={`Select row ${tableRow.original.row.rowId}`}
          />
        ),
      },
      {
        id: "fromDeviceId",
        header: "From Device",
        cell: ({ row: tableRow }) => (
          <Input
            value={tableRow.original.row.fromDeviceId}
            className="h-9 rounded-none border-0 bg-muted/30 font-mono text-sm shadow-none"
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
          <Input
            value={tableRow.original.row.wireNo}
            className="h-9 rounded-none border-0 bg-muted/20 font-mono text-sm shadow-none"
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
          <Input
            value={tableRow.original.row.wireId}
            className="h-9 rounded-none border-0 bg-muted/30 font-mono text-sm shadow-none"
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
          <Input
            value={tableRow.original.row.gaugeSize}
            className="h-9 rounded-none border-0 bg-muted/20 font-mono text-sm shadow-none"
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
              value={tableRow.original.row.length ?? ""}
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
                onMeasureRow(tableRow.original.rowIndex, tableRow.original.row.rowId)
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
          <Input
            value={tableRow.original.row.toDeviceId}
            className="h-9 rounded-none border-0 bg-muted/30 font-mono text-sm shadow-none"
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
          <Input
            value={tableRow.original.row.toLocation}
            className="h-9 rounded-none border-0 bg-muted/20 text-sm shadow-none"
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
          <Input
            value={tableRow.original.row.bundleDisplay}
            className="h-9 rounded-none border-0 bg-muted/30 text-sm shadow-none"
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
    getRowId: (original) => original.row.rowId,
  });

  return (
    <div className="hidden xl:block">
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
      <Input
        type={type}
        value={value}
        className="h-9 text-sm"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
