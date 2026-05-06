"use client";

/**
 * Wire list table component using TanStack Table.
 * 
 * Features:
 * - Two-level grouped headers (From/To)
 * - Gray header styling matching the reference screenshot
 * - Sticky first column and header
 * - Wire type badges
 * - "---" for empty gauge values
 * - External column visibility control
 */

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedSheetRow } from "@/lib/workbook/types";
import type { NormalizedColumn } from "@/lib/workbook/wire-list-normalizer";
import { ClickableDeviceIdCell } from "@/components/device-details/clickable-device-id-cell";
import { useDeviceDetailsContext } from "@/lib/device-details/context";

interface WireListTableProps {
  /** Normalized column definitions */
  columns: NormalizedColumn[];
  /** Row data */
  data: ParsedSheetRow[];
  /** Global filter value (optional) */
  globalFilter?: string;
  /** External column visibility state */
  columnVisibility?: VisibilityState;
  /** Column visibility change handler */
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
}

/**
 * Header group definitions for the two-level header structure.
 * Maps column types to their parent group.
 */
const FROM_COLUMNS = ["device", "type", "wireNo", "wireId", "gauge", "pageZone"];
const TO_COLUMNS = ["location"];

/**
 * Format cell values for display.
 */
function formatCellValue(value: string | number | boolean | Date | null | undefined, columnType?: string): string {
  if (value === null || value === undefined || value === "") {
    // Use "---" for gauge column empty values, "-" for others
    return columnType === "gauge" ? "---" : "-";
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value);
}

export function WireListTable({
  columns,
  data,
  globalFilter,
  columnVisibility: externalVisibility,
  onColumnVisibilityChange,
}: WireListTableProps) {
  // Use external visibility if provided, otherwise compute default
  const columnVisibility = useMemo<VisibilityState>(() => {
    if (externalVisibility) return externalVisibility;

    const visibility: VisibilityState = {};
    for (const col of columns) {
      visibility[col.originalKey] = col.visibleByDefault !== false;
    }
    return visibility;
  }, [columns, externalVisibility]);

  // Determine if we should use grouped headers (wire list format detected)
  const hasWireListFormat = useMemo(() => {
    const types = columns.map(c => c.columnType);
    return types.includes("device") && (types.includes("wireNo") || types.includes("type"));
  }, [columns]);

  // Count columns for each group based on visibility
  const { fromColumnCount, toColumnCount, otherColumnCount } = useMemo(() => {
    let fromCount = 0;
    let toCount = 0;
    let otherCount = 0;

    for (const col of columns) {
      if (!columnVisibility[col.originalKey]) continue;

      if (FROM_COLUMNS.includes(col.columnType || "")) {
        fromCount++;
      } else if (TO_COLUMNS.includes(col.columnType || "")) {
        toCount++;
      } else {
        otherCount++;
      }
    }

    // Add "To Device ID" to toCount if there's a second device column
    // The second device ID goes in the "To" section
    const visibleDeviceColumns = columns.filter(
      c => c.columnType === "device" && columnVisibility[c.originalKey]
    ).length;
    if (visibleDeviceColumns > 1) {
      fromCount -= 1; // Remove one from "From"
      toCount += 1;   // Add to "To"
    }

    return { fromColumnCount: fromCount, toColumnCount: toCount + otherCount, otherColumnCount: otherCount };
  }, [columns, columnVisibility]);

  const { openDeviceDetails } = useDeviceDetailsContext();

  // Build TanStack Table column definitions from normalized columns
  const tableColumns = useMemo<ColumnDef<ParsedSheetRow>[]>(() => {
    return columns.map((col, index) => ({
      id: col.originalKey,
      accessorKey: col.originalKey,
      header: () => {
        // Use display header with proper formatting
        if (col.columnType === "type") {
          return (
            <div className="text-center leading-tight">
              <div>Cable (W)</div>
              <div>Conductor (SC)</div>
              <div>Jumper Clip (JC)</div>
            </div>
          );
        }
        return col.displayHeader;
      },
      cell: ({ getValue }) => {
        const value = getValue();
        const stringValue = value === null || value === undefined ? "" : String(value);

        if (col.columnType === "device" && stringValue) {
          return (
            <ClickableDeviceIdCell
              deviceId={stringValue}
              onClick={openDeviceDetails}
              isFrom={index === 0}
            />
          );
        }

        return (
          <span className={value === null || value === undefined || value === "" ? "text-muted-foreground" : ""}>
            {formatCellValue(value as string | number | boolean | Date | null, col.columnType)}
          </span>
        );
      },
      meta: {
        isFirstColumn: index === 0,
        columnType: col.columnType,
      },
    }));
  }, [columns, openDeviceDetails]);

  // Add row ID to data for TanStack Table
  const tableData = useMemo(() => {
    return data.map((row, index) => ({
      ...row,
      __rowId: row.__rowId || String(index),
    }));
  }, [data]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      columnVisibility,
    },
    onColumnVisibilityChange: onColumnVisibilityChange
      ? (updater) => {
        const newVisibility = typeof updater === "function"
          ? updater(columnVisibility)
          : updater;
        onColumnVisibilityChange(newVisibility);
      }
      : undefined,
    getRowId: (row) => row.__rowId as string,
  });

  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="relative overflow-x-auto rounded-md border border-foreground/20">
      <Table className="min-w-[800px]">
        <TableHeader>
          {/* First header row - grouped headers (From/To) */}
          {hasWireListFormat && (fromColumnCount > 0 || toColumnCount > 0) && (
            <TableRow className="border-b border-foreground/20 bg-muted hover:bg-muted">
              {fromColumnCount > 0 && (
                <TableHead
                  colSpan={fromColumnCount}
                  className="border-r border-foreground/20 bg-muted text-center font-bold text-foreground py-2"
                >
                  From
                </TableHead>
              )}
              {toColumnCount > 0 && (
                <TableHead
                  colSpan={toColumnCount}
                  className="bg-muted text-center font-bold text-foreground py-2"
                >
                  To
                </TableHead>
              )}
            </TableRow>
          )}
          {/* Second header row - column names */}
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-foreground/20 bg-muted hover:bg-muted">
              {headerGroup.headers.map((header, headerIndex) => (
                <TableHead
                  key={header.id}
                  className={`
                      whitespace-nowrap font-bold text-xs text-foreground py-3 px-4 text-center
                      border-r border-foreground/20 last:border-r-0
                      ${headerIndex === 0 ? "sticky left-0 z-30 bg-muted min-w-[120px]" : ""}
                    `}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-foreground/20 hover:bg-muted/30 overflow-x-auto"
              >
                {row.getVisibleCells().map((cell, cellIndex) => (
                  <TableCell
                    key={cell.id}
                    className={`
                        whitespace-nowrap font-mono text-sm py-2 px-4 text-center
                        border-r border-foreground/20 last:border-r-0
                        ${cellIndex === 0 ? "sticky left-0 z-10 bg-background font-bold" : ""}
                      `}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length || 1}
                className="h-24 text-center text-muted-foreground"
              >
                No results found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
