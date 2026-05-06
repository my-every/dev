"use client";

import { useMemo, type RefObject } from "react";
import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isGroupStart, generateGroupKey, generateGroupLabel, type WireListGroupConfig } from "@/lib/workbook/group-wire-list-rows";
import { isDeviceGroupStart, getDeviceGroupLabel, type DeviceGroup } from "@/lib/wiring-ordering";
import { isInternalLocation } from "@/lib/wiring-identification/device-parser";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { IdentificationFilterKind, PatternMatchMetadata } from "@/lib/wiring-identification/types";
import type { FilterGroup } from "@/hooks/use-multi-identity-filter";
import { buildRenderableSectionSubgroups, buildSubgroupStartMap, buildWireListRenderPlan } from "@/lib/wire-list-sections";
import type { PartNumberLookupResult } from "@/lib/part-number-list";

function getEffectiveRowLocation(row: SemanticWireListRow): string {
  return row.toLocation || row.fromLocation || row.location || "Unknown";
}

function getLocationGroupLabel(row: SemanticWireListRow, currentSheetName: string, _fallbackLabel: string): string {
  const location = getEffectiveRowLocation(row);

  if (location && currentSheetName && !isInternalLocation(location, currentSheetName)) {
    return `External - ${location}`;
  }

  return location;
}

function getBaseFromDeviceId(row: SemanticWireListRow): string {
  return row.fromDeviceId.split(":")[0]?.trim() || "";
}

function shouldShowKaTerminalGroupHeader(selectedFilter: IdentificationFilterKind): boolean {
  return selectedFilter === "ka_jumpers";
}

function getKaTerminalGroupMeta(
  rowId: string,
  matchMetadata: Record<string, PatternMatchMetadata>,
  selectedFilter?: IdentificationFilterKind,
): { terminal: "A1" | "A2"; label: string } | null {
  const metadata = matchMetadata[rowId];
  const terminal = String(metadata?.meta.terminal ?? "").toUpperCase().trim();

  if (terminal !== "A1" && terminal !== "A2") {
    return null;
  }

  const startDevice = String(metadata?.meta.startDevice ?? "").trim();
  const endDevice = String(metadata?.meta.endDevice ?? "").trim();

  if (selectedFilter === "ka_relay_plugin_jumpers" && startDevice && endDevice) {
    return {
      terminal,
      label: `${terminal}: ${startDevice} -> ${endDevice}`,
    };
  }

  return {
    terminal,
    label: `KA ${terminal}`,
  };
}

interface SemanticWireListTableProps {
  table: ReactTable<SemanticWireListRow>;
  tableContainerRef: RefObject<HTMLDivElement | null>;
  locationFilteredRows: SemanticWireListRow[];
  currentSheetName: string;
  selectedFilter: IdentificationFilterKind;
  matchMetadata: Record<string, PatternMatchMetadata>;
  groupConfig: WireListGroupConfig;
  groupByLocation: boolean;
  showLocationGroupHeader: boolean;
  hasDeviceOrdering: boolean;
  showDeviceGroupHeader: boolean;
  deviceGroups: DeviceGroup[];
  fromCount: number;
  toCount: number;
  lengthCount: number;
  workflowCount: number;
  visibleColumnCount: number;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  wireNoMatchedRowIds: Set<string>;
  shouldShowWireNoHighlighting: boolean;
  activeRowId?: string | null;
  isWireNoSearchActive: boolean;
  wireNoMatchCount: number;
  wireNoSearchValue: string;
  /** Print mode flag */
  printMode?: boolean;
  /** Use print variant for checkboxes (static boxes) */
  printCheckboxVariant?: boolean;
  /** Filter groups for multi-filter rendering in print mode */
  filterGroups?: FilterGroup[];
  /** Hide the From / To / Workflow grouped column header row */
  hideGroupedColumnHeaders?: boolean;
}

export function SemanticWireListTable({
  table,
  tableContainerRef,
  locationFilteredRows,
  currentSheetName,
  selectedFilter,
  matchMetadata,
  groupConfig,
  groupByLocation,
  showLocationGroupHeader,
  hasDeviceOrdering,
  showDeviceGroupHeader,
  deviceGroups,
  fromCount,
  toCount,
  lengthCount,
  workflowCount,
  visibleColumnCount,
  partNumberMap,
  wireNoMatchedRowIds,
  shouldShowWireNoHighlighting,
  activeRowId,
  isWireNoSearchActive,
  wireNoMatchCount,
  wireNoSearchValue,
  printMode = false,
  printCheckboxVariant = false,
  filterGroups,
  hideGroupedColumnHeaders = false,
}: SemanticWireListTableProps) {
  const subgroupHeaderMap = useMemo(
    () => buildSubgroupStartMap(
      buildRenderableSectionSubgroups(selectedFilter, locationFilteredRows, matchMetadata, partNumberMap),
    ),
    [locationFilteredRows, matchMetadata, partNumberMap, selectedFilter],
  );
  const tableRowModel = table.getRowModel();
  const rowsById = useMemo(
    () => new Map(tableRowModel.rows.map((row) => [row.original.__rowId, row])),
    // table ref is stable — track the actual row model + source data so this
    // recomputes when rows arrive asynchronously or filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableRowModel, locationFilteredRows],
  );
  const renderPlan = useMemo(
    () => buildWireListRenderPlan({
      rows: locationFilteredRows,
      currentSheetName,
      sectionKind: selectedFilter,
      matchMetadata,
      subgroupHeaderMap,
      showDeviceGroupHeader,
      hideDeviceSubheaders:
        selectedFilter === "grounds" ||
        selectedFilter === "ka_relay_plugin_jumpers" ||
        selectedFilter === "ka_jumpers" ||
        selectedFilter === "kt_jumpers" ||
        selectedFilter === "vio_jumpers" ||
        selectedFilter === "cables" ||
        selectedFilter === "single_connections" ||
        selectedFilter === "fu_jumpers" ||
        selectedFilter === "ka_twin_ferrules",
      forceDeviceSeparator: selectedFilter === "grounds",
      getLocation: getEffectiveRowLocation,
      getLocationHeaderLabel: (row, rowIndex, rows, sheetName) => {
        if (!groupByLocation || !isGroupStart(rows, rowIndex, groupConfig)) {
          return null;
        }

        return getLocationGroupLabel(
          row,
          sheetName ?? "",
          generateGroupLabel(generateGroupKey(row, groupConfig), groupConfig),
        );
      },
      getDeviceGroupLabel: (row, rowIndex, rows) => {
        const profileLabel = hasDeviceOrdering && isDeviceGroupStart(rows, rowIndex, deviceGroups)
          ? getDeviceGroupLabel(rowIndex, deviceGroups)
          : null;

        if (profileLabel) {
          return profileLabel;
        }

        const currentBaseFromDeviceId = getBaseFromDeviceId(row);
        const previousBaseFromDeviceId = rowIndex > 0 ? getBaseFromDeviceId(rows[rowIndex - 1]!) : "";
        const isNewLocationGroup = groupByLocation && isGroupStart(rows, rowIndex, groupConfig);

        return currentBaseFromDeviceId && (rowIndex === 0 || isNewLocationGroup || currentBaseFromDeviceId !== previousBaseFromDeviceId)
          ? currentBaseFromDeviceId
          : null;
      },
      getLeadingGroup: (rowId, previousRowId, metadata, kind) => {
        if (!shouldShowKaTerminalGroupHeader(kind ?? "default")) {
          return null;
        }

        const currentTerminalGroup = getKaTerminalGroupMeta(rowId, metadata, kind);
        const previousTerminalGroup = previousRowId ? getKaTerminalGroupMeta(previousRowId, metadata, kind) : null;

        if (!currentTerminalGroup || previousTerminalGroup?.terminal === currentTerminalGroup.terminal) {
          return null;
        }

        return {
          key: `terminal:${currentTerminalGroup.terminal}`,
          label: currentTerminalGroup.label,
        };
      },
    }),
    [currentSheetName, deviceGroups, groupByLocation, groupConfig, hasDeviceOrdering, locationFilteredRows, matchMetadata, selectedFilter, showDeviceGroupHeader, subgroupHeaderMap],
  );

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-foreground/30">
      <div ref={tableContainerRef} className="relative h-full min-h-0 overflow-auto">
        <table data-slot="table" className="relative min-w-300 w-full border-collapse text-sm">
          <TableHeader className="sticky top-0 z-30 bg-background">
            {!hideGroupedColumnHeaders && (fromCount > 0 || lengthCount > 0 || toCount > 0 || workflowCount > 0) && (
              <TableRow className="border-b border-foreground/30 bg-background hover:bg-transparent">
                {fromCount > 0 && (
                  <TableHead colSpan={fromCount} className="border-foreground/30 text-center font-semibold text-foreground py-1">
                    From
                  </TableHead>
                )}
                {lengthCount > 0 && (
                  <TableHead colSpan={lengthCount} className="border-foreground/30 text-center font-bold text-foreground py-1" />
                )}
                {toCount > 0 && (
                  <TableHead
                    colSpan={toCount}
                    className={[
                      " text-center font-semibold text-foreground py-1",
                      workflowCount > 0 ? "border-foreground/30" : "border-foreground/20",
                    ].join(" ")}
                  >
                    To
                  </TableHead>
                )}
                {workflowCount > 0 && (
                  <TableHead colSpan={workflowCount} className=" border-foreground/20   text-center font-semibold text-foreground py-1">
                    Workflow
                  </TableHead>
                )}
              </TableRow>
            )}

            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-foreground/30 bg-muted hover:bg-muted">
                {headerGroup.headers.map((header, index) => {
                  const isCheckboxCol = (header.column.columnDef.meta as { isCheckbox?: boolean } | undefined)?.isCheckbox;
                  const isCompactCol = (header.column.columnDef.meta as { isCompact?: boolean } | undefined)?.isCompact;
                  return (
                    <TableHead
                      key={header.id}
                      style={
                        isCheckboxCol
                          ? { width: 50, minWidth: 50, maxWidth: 50 }
                          : isCompactCol
                            ? { width: "1%" }
                            : undefined
                      }
                      className={[
                        "whitespace-nowrap font-semibold text-xs text-foreground py-3 text-center",
                        "border-r border-foreground/20 last:border-r-0 bg-muted",
                        "border-l border-foreground/20",
                        index === 0 ? "sticky left-0 z-40 min-w-30 px-4" : "",
                        isCompactCol ? "w-[1%]" : "",
                        isCheckboxCol ? "px-2" : "px-4",
                      ].join(" ")}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="relative z-10">
            {tableRowModel.rows.length > 0 ? (
              renderPlan.map((item) => {
                if (item.type === "location-header") {
                  return showLocationGroupHeader ? (
                    <TableRow key={item.key} className="border-b border-foreground/20 bg-muted/95 backdrop-blur-sm">
                      <TableCell
                        colSpan={fromCount + lengthCount + toCount + workflowCount}
                        className="py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/95"
                      >
                        {item.label}
                      </TableCell>
                    </TableRow>
                  ) : null;
                }

                if (item.type === "group-header") {
                  if (item.group.groupKind === "terminal") {
                    return (
                      <TableRow key={item.key} className="border-b border-foreground/20 bg-muted/8">
                        <TableCell
                          colSpan={fromCount + lengthCount + toCount + workflowCount}
                          className="py-1.5 px-4 text-xs font-semibold text-secondary-foreground tracking-wide"
                        >
                          {item.group.label}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (item.group.groupKind === "subgroup") {
                    return (
                      <TableRow
                        key={item.key}
                        className={[
                          "border-b border-foreground/20",
                          item.group.tone === "warning" ? "bg-orange-50/60 border-orange-300" : "bg-muted/8",
                        ].join(" ")}
                      >
                        <TableCell
                          colSpan={fromCount + lengthCount + toCount + workflowCount}
                          className={[
                            "py-1.5 px-4 text-xs font-semibold tracking-wide",
                            item.group.tone === "warning" ? "border-x border-orange-300 text-orange-900" : "text-secondary-foreground",
                          ].join(" ")}
                        >
                          <div>{item.group.label}</div>
                          {item.group.description ? (
                            <div className="mt-0.5 text-[10px] font-medium tracking-normal text-orange-900/90">
                              {item.group.description}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={item.key} className="border-t-[2.5px] border-t-muted bg-transparent">
                      <TableCell
                        colSpan={fromCount + lengthCount + toCount + workflowCount}
                        className="bg-muted/30 px-4 py-1 text-[10px] font-medium text-muted-foreground tracking-wide"
                      >
                        {item.group.label}
                      </TableCell>
                    </TableRow>
                  );
                }

                const row = rowsById.get(item.rowId);
                if (!row) {
                  return null;
                }

                const isActiveRow = activeRowId === item.rowId;

                return (
                  <TableRow
                    key={item.key}
                    data-row-id={item.rowId}
                    className={[
                      "border-b border-foreground/20 hover:bg-muted/30 transition-all",
                      item.showDeviceSeparator ? "border-t-[2px] border-t-muted" : "",
                      item.isWarningRow && !isActiveRow ? "bg-orange-50/35 border-y border-orange-300/70" : "",
                      wireNoMatchedRowIds.has(item.rowId) && shouldShowWireNoHighlighting ? "bg-yellow-50" : "",
                      isActiveRow ? "bg-yellow-50" : "",
                    ].join(" ")}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isCheckboxCol = (cell.column.columnDef.meta as { isCheckbox?: boolean } | undefined)?.isCheckbox;
                      const isCompactCol = (cell.column.columnDef.meta as { isCompact?: boolean } | undefined)?.isCompact;
                      const isFirstCell = index === 0;
                      const isLastCell = index === row.getVisibleCells().length - 1;
                      return (
                        <TableCell
                          key={cell.id}
                          style={
                            isCheckboxCol
                              ? { width: 50, minWidth: 50, maxWidth: 50 }
                              : isCompactCol
                                ? { width: "1%" }
                                : undefined
                          }
                          className={[
                            "whitespace-nowrap font-mono text-sm py-2 text-center",
                            "border-r border-foreground/20 last:border-r-0",
                            isFirstCell ? "sticky left-0 z-10 bg-background font-bold px-4" : "",
                            isCompactCol ? "w-[1%]" : "",
                            isCheckboxCol ? "px-2" : "px-4",
                            item.isWarningRow && !isActiveRow ? "border-y border-orange-300/70" : "",
                            item.isWarningRow && isFirstCell && !isActiveRow ? "border-l-2! border-l-orange-400!" : "",
                            item.isWarningRow && isLastCell && !isActiveRow ? "border-r-2! border-r-orange-400!" : "",
                            isActiveRow ? "bg-yellow-50 border-y-2! border-y-yellow-500!" : "",
                            isActiveRow && isFirstCell ? "border-l-2! border-l-yellow-500!" : "",
                            isActiveRow && isLastCell ? "border-r-2! border-r-yellow-500!" : "",
                          ].join(" ")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnCount || 1} className="h-24 text-center text-muted-foreground">
                  {isWireNoSearchActive && wireNoMatchCount === 0
                    ? `No wire numbers matched "${wireNoSearchValue}"`
                    : "No results found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
