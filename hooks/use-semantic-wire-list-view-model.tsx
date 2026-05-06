"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type SetStateAction } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ClickableDeviceIdCell } from "@/components/device-details/clickable-device-id-cell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommentsCell } from "@/components/wire-list/cells/comments-cell";
import { FromCheckboxCell } from "@/components/wire-list/cells/from-checkbox-cell";
import { IPVCheckboxCell } from "@/components/wire-list/cells/ipv-checkbox-cell";
import { LengthCell } from "@/components/wire-list/cells/length-cell";
import { LocationUrlCell } from "@/components/wire-list/cells/location-url-cell";
import { ToCheckboxCell } from "@/components/wire-list/cells/to-checkbox-cell";
import { WireImageHoverCell } from "@/components/wire-list/cells/wire-image-hover-cell";
import { HighlightedWireNoCell } from "@/components/wire-list/wire-no-search";
import { useIdentificationFilter } from "@/hooks/use-identification-filter";
import { useProjectLookups, useProjectPartNumbers } from "@/hooks/use-project-lookups";
import { useWireLengthEstimates } from "@/hooks/use-wire-length-estimates";
import { useWireListRowWorkflowState } from "@/hooks/use-wire-list-row-workflow-state";
import { useWireNoSearch } from "@/hooks/use-wire-no-search";
import { useDeviceDetailsContext } from "@/lib/device-details/context";
import { extractKaRelayPluginJumpers } from "@/lib/wiring-identification";
import { parseBlueLabelSheet } from "@/lib/wiring-identification/blue-label-sequence";
import { countNonDeviceChangeRows, filterDeviceChangeRows } from "@/lib/wiring-identification/device-change-pattern";
import { isClipLikeRow, isInternalLocation } from "@/lib/wiring-identification/device-parser";
import { filterRowsByGauge, sortRowsByGaugeSize, type GaugeSortOrder } from "@/lib/wiring-identification/gauge-filter";
import { filterRowsByPrefix } from "@/lib/wiring-identification/prefix-filter";
import { applyDeviceFamilyOrdering, extractDeviceGroups, getTerminalSortRankFn, resolveOrderingEndpoint } from "@/lib/wiring-ordering";
import type {
  BlueLabelSequenceMap,
  IdentificationFilterKind,
  PatternMatchMetadata,
  RelayPluginJumperRun,
} from "@/lib/wiring-identification/types";
import type { WireListGroupConfig } from "@/lib/workbook/group-wire-list-rows";
import { formatGaugeSizeDisplay, getSemanticDisplayColumns } from "@/lib/workbook/semantic-wire-list-parser";
import { estimateWireTime, formatEstTime } from "@/lib/wire-list-print/time-estimation";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { WireListFeatureConfig } from "@/components/wire-list/semantic-wire-list";

export const SEMANTIC_COLUMNS = getSemanticDisplayColumns();
export const ALL_LOCATIONS = "All Locations";

const PART_NUMBER_COLUMN_KEYS = new Set(["fromPartNumber", "toPartNumber"]);

const DEFAULT_FEATURE_CONFIG: WireListFeatureConfig = {
  showFromCheckbox: true,
  showToCheckbox: true,
  showIPVCheckbox: true,
  showComments: true,
  showPartNumber: true,
  showCheckboxColumns: true,
  groupByLocation: true,
  groupByFromDevice: false,
  defaultGaugeSortOrder: "default",
  showLocationGroupHeader: true,
  showDeviceGroupHeader: true,
  hideLocationGroupHeaderWhenLocationColumnVisible: false,
  stickyGroupHeaders: true,
  // Print-specific options
  printMode: false,
  printCheckboxVariant: false,
  showLength: true,
};

const FILTER_COLUMN_PRESETS: Partial<Record<IdentificationFilterKind, Partial<VisibilityState>>> = {
  cables: {
    wireNo: false,
  },
  clips: {
    wireNo: false,
    gaugeSize: false,
  },
  ka_relay_plugin_jumpers: {
    wireNo: false,
    gaugeSize: false,
  },
};

function getFilterColumnPreset(selectedFilter: IdentificationFilterKind): Partial<VisibilityState> {
  return FILTER_COLUMN_PRESETS[selectedFilter] ?? {};
}

function shouldHideSemanticWireListRow(row: SemanticWireListRow): boolean {
  const normalizedWireNo = (row.wireNo || "").trim();
  const normalizedWireId = (row.wireId || "").trim();
  const isMissingWireId =
    normalizedWireId === "" ||
    /^-+$/.test(normalizedWireId) ||
    normalizedWireId === "—" ||
    normalizedWireId === "–";

  return normalizedWireNo === "*" && isMissingWireId;
}

function getUniqueLocations(
  rows: SemanticWireListRow[],
  currentSheetName: string,
): { location: string; count: number }[] {
  const locationMap = new Map<string, number>();

  for (const row of filterDeviceChangeRows(rows)) {
    const location = row.toLocation || row.fromLocation || row.location || "Unknown";
    locationMap.set(location, (locationMap.get(location) || 0) + 1);
  }

  return Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((left, right) => {
      const leftIsCurrentSheetLocation = isInternalLocation(left.location, currentSheetName);
      const rightIsCurrentSheetLocation = isInternalLocation(right.location, currentSheetName);

      if (leftIsCurrentSheetLocation !== rightIsCurrentSheetLocation) {
        return leftIsCurrentSheetLocation ? -1 : 1;
      }

      return left.location.localeCompare(right.location);
    });
}

function getRowLocation(row: SemanticWireListRow): string {
  return row.toLocation || row.fromLocation || row.location || "Unknown";
}

function shouldUseKaTerminalFirstOrdering(selectedFilter: IdentificationFilterKind): boolean {
  return selectedFilter === "ka_jumpers" || selectedFilter === "ka_relay_plugin_jumpers";
}

function sortRowsForDisplay(
  rows: SemanticWireListRow[],
  selectedFilter: IdentificationFilterKind,
  useLocationFirstOrdering: boolean,
  currentSheetName: string,
): SemanticWireListRow[] {
  if (selectedFilter === "ka_twin_ferrules") {
    return [...rows];
  }

  if (!useLocationFirstOrdering && !shouldUseKaTerminalFirstOrdering(selectedFilter)) {
    return [...rows].sort((left, right) => {
      const leftIsClip = isClipLikeRow(left);
      const rightIsClip = isClipLikeRow(right);

      if (leftIsClip !== rightIsClip) {
        return leftIsClip ? -1 : 1;
      }

      return left.__rowIndex - right.__rowIndex;
    });
  }

  const kaTerminalRank = getTerminalSortRankFn("KA");

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftIsClip = isClipLikeRow(left.row);
      const rightIsClip = isClipLikeRow(right.row);
      if (leftIsClip !== rightIsClip) {
        return leftIsClip ? -1 : 1;
      }

      if (useLocationFirstOrdering) {
        const leftIsCurrentSheetLocation = isInternalLocation(getRowLocation(left.row), currentSheetName);
        const rightIsCurrentSheetLocation = isInternalLocation(getRowLocation(right.row), currentSheetName);

        if (leftIsCurrentSheetLocation !== rightIsCurrentSheetLocation) {
          return leftIsCurrentSheetLocation ? -1 : 1;
        }

        const locationCompare = getRowLocation(left.row).localeCompare(getRowLocation(right.row));
        if (locationCompare !== 0) {
          return locationCompare;
        }
      }

      if (shouldUseKaTerminalFirstOrdering(selectedFilter)) {
        const leftEndpoint = resolveOrderingEndpoint(left.row, "KA");
        const rightEndpoint = resolveOrderingEndpoint(right.row, "KA");

        const leftRank = kaTerminalRank(leftEndpoint?.parsed.terminal ?? null);
        const rightRank = kaTerminalRank(rightEndpoint?.parsed.terminal ?? null);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
      }

      return left.index - right.index;
    })
    .map(({ row }) => row);
}

interface UseSemanticWireListViewModelOptions {
  rows: SemanticWireListRow[];
  blueLabels?: BlueLabelSequenceMap | null;
  currentSheetName?: string;
  projectId?: string;
  sheetSlug?: string;
  featureConfig?: WireListFeatureConfig;
  activeRowId?: string | null;
}

export function useSemanticWireListViewModel({
  rows,
  blueLabels = null,
  currentSheetName = "",
  projectId,
  sheetSlug,
  featureConfig = {},
  activeRowId = null,
}: UseSemanticWireListViewModelOptions) {
  const config = { ...DEFAULT_FEATURE_CONFIG, ...featureConfig };

  // Guard against TanStack Table calling onChange during initial render.
  // useLayoutEffect fires synchronously after commit, before any microtasks.
  const mountedRef = useRef(false);
  useLayoutEffect(() => { mountedRef.current = true; }, []);

  const displaySourceRows = useMemo(
    () => rows.filter((row) => !shouldHideSemanticWireListRow(row)),
    [rows],
  );

  const sortedColumns = useMemo(() => {
    return [...SEMANTIC_COLUMNS].sort((left, right) => {
      const groupOrder: Record<string, number> = { from: 0, length: 1, to: 2, meta: 3 };
      const groupDiff = (groupOrder[left.group] ?? 99) - (groupOrder[right.group] ?? 99);
      if (groupDiff !== 0) return groupDiff;
      return left.sortOrder - right.sortOrder;
    });
  }, []);

  const showFrom = Boolean(config.showCheckboxColumns && config.showFromCheckbox);
  const showTo = Boolean(config.showCheckboxColumns && config.showToCheckbox);
  const showIPV = Boolean(config.showCheckboxColumns && config.showIPVCheckbox);
  const showComments = Boolean(config.showComments);
  const showPartNumber = Boolean(config.showPartNumber);
  const printCheckboxVariant = Boolean(config.printCheckboxVariant);

  const availableSemanticColumns = useMemo(() => {
    return SEMANTIC_COLUMNS.filter((column) => {
      if (!showPartNumber && PART_NUMBER_COLUMN_KEYS.has(column.key)) {
        return false;
      }

      return true;
    });
  }, [showPartNumber]);

  const { blueLabelsSheet, partListSheet } = useProjectLookups();
  const { getPartNumber, partNumberMap } = useProjectPartNumbers();

  const effectiveBlueLabels = useMemo<BlueLabelSequenceMap | null>(() => {
    if (blueLabels?.isValid) {
      return blueLabels;
    }

    const parsedBlueLabels = parseBlueLabelSheet(blueLabelsSheet);
    return parsedBlueLabels.isValid ? parsedBlueLabels : null;
  }, [blueLabels, blueLabelsSheet]);

  const {
    selectedFilter,
    setSelectedFilter,
    filterOptions,
    filterResult,
    hasBlueLabels,
    currentFilterMeta,
  } = useIdentificationFilter({ rows: displaySourceRows, blueLabels: effectiveBlueLabels, currentSheetName, partNumberMap });

  const {
    wireNoSearchValue,
    setWireNoSearchValue,
    clearWireNoSearch,
    isSearchActive: isWireNoSearchActive,
    setIsInputFocused: setWireNoInputFocused,
    shouldShowHighlighting: shouldShowWireNoHighlighting,
    matchedRowIds: wireNoMatchedRowIds,
    matchCount: wireNoMatchCount,
    searchModeEnabled,
    toggleSearchMode,
  } = useWireNoSearch({ rows: filterResult.rows });

  const workflowState = useWireListRowWorkflowState({
    projectId,
    sheetSlug,
    persist: true,
  });
  const { openDeviceDetails } = useDeviceDetailsContext();

  const { getRowLength } = useWireLengthEstimates({
    rows: displaySourceRows,
    blueLabelsSheet,
    partListSheet,
    sheetName: currentSheetName,
    enabled: true,
  });

  const groupConfig: WireListGroupConfig = {
    groupByLocation: Boolean(config.groupByLocation),
    groupByFromDevice: Boolean(config.groupByFromDevice),
  };

  const [fromPrefix, setFromPrefix] = useState<string | null>(null);
  const [toPrefix, setToPrefix] = useState<string | null>(null);
  const [selectedGauge, setSelectedGauge] = useState<string | null>(null);
  const [gaugeSortOrder, setGaugeSortOrder] = useState<GaugeSortOrder>(config.defaultGaugeSortOrder ?? "default");
  const [storedColumnVisibility, setStoredColumnVisibility] = useState<VisibilityState>(() => {
    const visibility: VisibilityState = {};
    for (const column of SEMANTIC_COLUMNS) {
      visibility[column.key] = column.visible;
    }
    return visibility;
  });
  const [filterColumnOverrides, setFilterColumnOverrides] = useState<Partial<Record<IdentificationFilterKind, Partial<VisibilityState>>>>({});
  const [searchValue, setSearchValue] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(ALL_LOCATIONS);
  const [isFullScreenSearchOpen, setIsFullScreenSearchOpen] = useState(false);
  const [showDeviceSubheaders, setShowDeviceSubheaders] = useState(Boolean(config.showDeviceGroupHeader));

  useEffect(() => {
    const availableColumnKeys = new Set(availableSemanticColumns.map((column) => column.key));

    setStoredColumnVisibility((prev) => {
      const next: VisibilityState = { ...prev };
      let changed = false;

      for (const column of SEMANTIC_COLUMNS) {
        if (availableColumnKeys.has(column.key)) {
          if (!(column.key in next)) {
            next[column.key] = column.visible;
            changed = true;
          }
        } else {
          if (next[column.key] !== false) {
            next[column.key] = false;
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [availableSemanticColumns]);

  const columnVisibility = useMemo(() => {
    const next: VisibilityState = { ...storedColumnVisibility };
    const presetVisibility = getFilterColumnPreset(selectedFilter);
    const filterOverrides = filterColumnOverrides[selectedFilter] ?? {};

    for (const [key, visible] of Object.entries(presetVisibility)) {
      next[key] = visible;
    }

    for (const [key, visible] of Object.entries(filterOverrides)) {
      next[key] = visible;
    }

    return next;
  }, [filterColumnOverrides, selectedFilter, storedColumnVisibility]);

  const setColumnVisibility = useCallback((updater: SetStateAction<VisibilityState>) => {
    const nextVisibility = typeof updater === "function"
      ? updater(columnVisibility)
      : updater;
    const presetVisibility = getFilterColumnPreset(selectedFilter);

    setStoredColumnVisibility((prevStored) => {
      const nextStored = { ...prevStored };

      for (const [key, visible] of Object.entries(nextVisibility)) {
        if (key in presetVisibility) {
          continue;
        }

        nextStored[key] = visible;
      }

      return nextStored;
    });

    setFilterColumnOverrides((prevOverrides) => {
      const currentFilterOverrides = { ...(prevOverrides[selectedFilter] ?? {}) };

      for (const [key, presetVisible] of Object.entries(presetVisibility)) {
        const nextValue = nextVisibility[key];

        if (nextValue === presetVisible) {
          delete currentFilterOverrides[key];
        } else {
          currentFilterOverrides[key] = nextValue;
        }
      }

      if (Object.keys(currentFilterOverrides).length === 0) {
        const { [selectedFilter]: _removed, ...rest } = prevOverrides;
        return rest;
      }

      return {
        ...prevOverrides,
        [selectedFilter]: currentFilterOverrides,
      };
    });
  }, [columnVisibility, selectedFilter]);

  useEffect(() => {
    setGaugeSortOrder(config.defaultGaugeSortOrder ?? "default");
  }, [config.defaultGaugeSortOrder]);

  useEffect(() => {
    setShowDeviceSubheaders(Boolean(config.showDeviceGroupHeader));
  }, [config.showDeviceGroupHeader]);

  // NOTE: Automatic column hiding per filter has been removed.
  // All columns are now visible by default to avoid user confusion.
  // Per-section column visibility is handled in the print modal sidebar instead.

  const prefixFilteredRows = useMemo(() => {
    return filterRowsByPrefix(filterResult.rows, fromPrefix, toPrefix);
  }, [filterResult.rows, fromPrefix, toPrefix]);

  const gaugeProcessedRows = useMemo(() => {
    return sortRowsByGaugeSize(filterRowsByGauge(prefixFilteredRows, selectedGauge), gaugeSortOrder);
  }, [prefixFilteredRows, selectedGauge, gaugeSortOrder]);

  const deviceFamilyOrderingResult = useMemo(() => {
    return applyDeviceFamilyOrdering(gaugeProcessedRows, {
      identificationFilter: selectedFilter,
      fromPrefix,
      toPrefix,
      currentSheetName,
    });
  }, [gaugeProcessedRows, selectedFilter, fromPrefix, toPrefix, currentSheetName]);

  const displayRows = useMemo(
    () => sortRowsForDisplay(deviceFamilyOrderingResult.rows, selectedFilter, selectedLocation === ALL_LOCATIONS, currentSheetName),
    [currentSheetName, deviceFamilyOrderingResult.rows, selectedFilter, selectedLocation],
  );
  const deviceGroups = useMemo(() => {
    if (!deviceFamilyOrderingResult.appliedProfile) {
      return [];
    }

    return extractDeviceGroups(displayRows, deviceFamilyOrderingResult.appliedProfile.prefix);
  }, [displayRows, deviceFamilyOrderingResult.appliedProfile]);
  const appliedOrderingProfile = deviceFamilyOrderingResult.appliedProfile;

  const relayPluginJumperRuns = useMemo<RelayPluginJumperRun[]>(() => {
    if (selectedFilter !== "ka_relay_plugin_jumpers") return [];
    if (!effectiveBlueLabels || !effectiveBlueLabels.isValid) return [];

    return extractKaRelayPluginJumpers({
      rows: displaySourceRows,
      blueLabels: effectiveBlueLabels,
      currentSheetName,
      normalizedSheetName: currentSheetName.toUpperCase().trim(),
      partNumberMap,
    }).runs;
  }, [selectedFilter, displaySourceRows, effectiveBlueLabels, currentSheetName, partNumberMap]);

  const locations = useMemo(() => getUniqueLocations(displayRows, currentSheetName), [currentSheetName, displayRows]);

  const locationFilteredRows = useMemo(() => {
    if (selectedLocation === ALL_LOCATIONS) return displayRows;
    return displayRows.filter((row) => {
      const location = row.toLocation || row.fromLocation || row.location || "";
      return location === selectedLocation;
    });
  }, [displayRows, selectedLocation]);

  const tableColumns = useMemo<ColumnDef<SemanticWireListRow>[]>(() => {
    const columns: ColumnDef<SemanticWireListRow>[] = [];

    if (showFrom) {
      columns.push({
        id: "fromCheck",
        header: () => <span className="text-xs">From</span>,
        cell: ({ row }) => (
          <FromCheckboxCell
            rowId={row.original.__rowId}
            checked={workflowState.getRowState(row.original.__rowId).fromChecked}
            onCheckedChange={workflowState.setFromChecked}
            printVariant={printCheckboxVariant}
          />
        ),
        size: 50,
        minSize: 50,
        maxSize: 50,
        meta: { group: "from", isWorkflow: true, isCheckbox: true },
      });
    }

    for (const column of sortedColumns) {
      if (!showPartNumber && PART_NUMBER_COLUMN_KEYS.has(column.key)) {
        continue;
      }

      if (showTo && column.group === "to" && !columns.some((entry) => entry.id === "toCheck")) {
        columns.push({
          id: "toCheck",
          header: () => <span className="text-xs">To</span>,
          cell: ({ row }) => (
            <ToCheckboxCell
              rowId={row.original.__rowId}
              checked={workflowState.getRowState(row.original.__rowId).toChecked}
              onCheckedChange={workflowState.setToChecked}
              printVariant={printCheckboxVariant}
            />
          ),
          size: 50,
          minSize: 50,
          maxSize: 50,
          meta: { group: "to", isWorkflow: true, isCheckbox: true },
        });
      }

      columns.push({
        id: column.key,
        accessorKey: column.key,
        header: () => column.key === "wireType" ? (
          <div className="text-center leading-tight text-xs">
            <div>Cable (W)</div>
            <div>Conductor (SC)</div>
            <div>Jumper Clip (JC)</div>
          </div>
        ) : column.header,
        cell: ({ getValue, row }) => {
          const value = getValue() as string;

          if (column.key === "wireNo") {
            return (
              <HighlightedWireNoCell
                wireNo={value}
                query={shouldShowWireNoHighlighting ? wireNoSearchValue : ""}
                hasMatch={shouldShowWireNoHighlighting && wireNoMatchedRowIds.has(row.original.__rowId)}
              />
            );
          }

          if (column.key === "gaugeSize") {
            return <span className={!value ? "text-muted-foreground" : ""}>{formatGaugeSizeDisplay(value)}</span>;
          }

          if (column.key === "estimatedLength") {
            return <LengthCell estimatedLength={getRowLength(row.original.__rowId)} />;
          }

          if (column.key === "estTime") {
            const est = estimateWireTime(selectedFilter, row.original.gaugeSize);
            return <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatEstTime(est.totalMinutes)}</span>;
          }

          if (column.key === "fromLocation" || column.key === "toLocation") {
            const displayValue = row.original.toLocation || row.original.fromLocation || row.original.location || "";
            return (
              <LocationUrlCell
                location={displayValue}
                projectId={projectId}
                currentSheetSlug={sheetSlug}
                className={!displayValue ? "text-muted-foreground" : ""}
              />
            );
          }

          if (column.key === "fromDeviceId" || column.key === "toDeviceId") {
            if (!value) {
              return <span className="font-mono text-xs text-muted-foreground">-</span>;
            }

            return (
              <ClickableDeviceIdCell
                deviceId={value}
                isFrom={column.key === "fromDeviceId"}
                onClick={openDeviceDetails}
              />
            );
          }

          if (column.key === "fromPartNumber" || column.key === "toPartNumber") {
            const deviceId = column.key === "fromPartNumber" ? row.original.fromDeviceId : row.original.toDeviceId;
            const lookup = getPartNumber(deviceId);

            if (lookup) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-xs cursor-help border-b border-dashed border-muted-foreground/30 hover:border-primary">
                      {lookup.partNumber}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-75">
                    <div className="text-xs space-y-1">
                      <div className="font-medium">{lookup.partNumber}</div>
                      {lookup.description && <div className="text-muted">{lookup.description}</div>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <span className="font-mono text-xs text-muted-foreground">-</span>;
          }

          if (column.key === "wireId") {
            const wireId = row.original.wireId || "";
            const gaugeSize = row.original.gaugeSize || "";
            return <WireImageHoverCell wireId={wireId} gaugeSize={gaugeSize} className={!wireId ? "text-muted-foreground" : ""} />;
          }

          return <span className={!value ? "text-muted-foreground" : ""}>{value || "-"}</span>;
        },
        meta: {
          group: column.group,
          isCompact:
            column.key === "fromPartNumber" ||
            column.key === "toPartNumber" ||
            column.key === "estimatedLength" ||
            column.key === "estTime",
        },
      });
    }

    if (showIPV) {
      columns.push({
        id: "ipvCheck",
        header: () => <span className="text-xs">IPV</span>,
        cell: ({ row }) => (
          <IPVCheckboxCell
            rowId={row.original.__rowId}
            checked={workflowState.getRowState(row.original.__rowId).ipvChecked}
            onCheckedChange={workflowState.setIpvChecked}
            printVariant={printCheckboxVariant}
          />
        ),
        size: 50,
        minSize: 50,
        maxSize: 50,
        meta: { group: "workflow", isWorkflow: true, isCheckbox: true },
      });
    }

    if (showComments) {
      columns.push({
        id: "comments",
        header: () => <span className="text-xs">Comments</span>,
        cell: ({ row }) => (
          <CommentsCell
            rowId={row.original.__rowId}
            value={workflowState.getRowState(row.original.__rowId).comment}
            onChange={workflowState.setComment}
            printVariant={printCheckboxVariant}
          />
        ),
        meta: { group: "workflow", isWorkflow: true },
      });
    }

    return columns;
  }, [
    getPartNumber,
    getRowLength,
    openDeviceDetails,
    printCheckboxVariant,
    projectId,
    sheetSlug,
    shouldShowWireNoHighlighting,
    showComments,
    showFrom,
    showIPV,
    showPartNumber,
    showTo,
    sortedColumns,
    wireNoMatchedRowIds,
    wireNoSearchValue,
    workflowState,
  ]);

  // Memoize row model factory results so they are not recreated every render
  const coreRowModel = useMemo(() => getCoreRowModel<SemanticWireListRow>(), []);
  const filteredRowModel = useMemo(() => getFilteredRowModel<SemanticWireListRow>(), []);
  const sortedRowModel = useMemo(() => getSortedRowModel<SemanticWireListRow>(), []);

  const handleColumnVisibilityChange = useCallback((updater: SetStateAction<VisibilityState>) => {
    if (mountedRef.current) setColumnVisibility(updater);
  }, []);

  const handleGlobalFilterChange = useCallback((updater: unknown) => {
    if (mountedRef.current) setSearchValue(updater as string);
  }, []);

  // Prevent TanStack Table's internal setState from firing before mount.
  // The React adapter unconditionally calls setState inside onStateChange
  // during setOptions() on every render. On the first render this triggers
  // a React 19 "state update before mount" warning because the component
  // has not committed yet.  Providing a no-op onStateChange until after
  // mount suppresses the internal setState call entirely.
  const stateChangeNoop = useCallback(() => { }, []);

  const table = useReactTable({
    data: locationFilteredRows,
    columns: tableColumns,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    state: {
      globalFilter: searchValue,
      columnVisibility,
    },
    onStateChange: mountedRef.current ? undefined : stateChangeNoop,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    getRowId: (row) => row.__rowId,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeRowId) return;
    const container = tableContainerRef.current;
    if (!container) return;
    const rowElement = container.querySelector(`[data-row-id="${activeRowId}"]`) as HTMLElement | null;
    if (!rowElement) return;
    // Scroll only the table container, not outer ancestors
    const rowTop = rowElement.offsetTop;
    const rowHeight = rowElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const targetScrollTop = rowTop - containerHeight / 2 + rowHeight / 2;
    container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
  }, [activeRowId]);

  const columnCounts = useMemo(() => {
    let from = 0;
    let to = 0;
    let length = 0;
    let meta = 0;
    let workflow = 0;

    for (const column of availableSemanticColumns) {
      if (!columnVisibility[column.key]) continue;
      if (column.group === "from") from += 1;
      else if (column.group === "to") to += 1;
      else if (column.group === "length") length += 1;
      else if (column.group === "meta") meta += 1;
    }

    if (showFrom && columnVisibility.fromCheck !== false) from += 1;
    if (showTo && columnVisibility.toCheck !== false) to += 1;
    if (showIPV && columnVisibility.ipvCheck !== false) workflow += 1;
    if (showComments && columnVisibility.comments !== false) workflow += 1;

    return { fromCount: from, toCount: to, lengthCount: length, metaCount: meta, workflowCount: workflow };
  }, [availableSemanticColumns, columnVisibility, showComments, showFrom, showIPV, showTo]);

  const handleResetVisibility = () => {
    const visibility: VisibilityState = {};
    for (const column of SEMANTIC_COLUMNS) {
      visibility[column.key] = availableSemanticColumns.some((entry) => entry.key === column.key)
        ? column.visible
        : false;
    }
    setStoredColumnVisibility(visibility);
    setFilterColumnOverrides((prevOverrides) => {
      const { [selectedFilter]: _removed, ...rest } = prevOverrides;
      return rest;
    });
  };

  const totalDisplayRows = countNonDeviceChangeRows(displaySourceRows);
  const locationDisplayRows = countNonDeviceChangeRows(locationFilteredRows);
  // table ref is stable (useReactTable returns the same instance), so [table]
  // alone never triggers recomputation. Include the values that actually drive
  // table model changes so these memos stay fresh after async data loads.
  const resolvedFilteredModel = useMemo(
    () => table.getFilteredRowModel(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, locationFilteredRows, searchValue, columnVisibility],
  );
  const filteredDisplayRows = useMemo(
    () => countNonDeviceChangeRows(resolvedFilteredModel.rows.map((row) => row.original)),
    [resolvedFilteredModel],
  );
  const preFilteredRows = useMemo(
    () => table.getPreFilteredRowModel().rows.map((row) => row.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, locationFilteredRows],
  );
  const visibleColumnCount = availableSemanticColumns.filter((column) => columnVisibility[column.key] !== false).length;
  const isLocationColumnVisible = ["fromLocation", "toLocation"].some(
    (key) => columnVisibility[key] !== false && availableSemanticColumns.some((column) => column.key === key)
  );

  return {
    config,
    displaySourceRows,
    groupConfig,
    selectedFilter,
    setSelectedFilter,
    filterMatchMetadata: filterResult.matchMetadata as Record<string, PatternMatchMetadata>,
    filterOptions,
    hasBlueLabels,
    currentFilterMeta,
    wireNoSearchValue,
    setWireNoSearchValue,
    clearWireNoSearch,
    isWireNoSearchActive,
    setWireNoInputFocused,
    shouldShowWireNoHighlighting,
    wireNoMatchedRowIds,
    wireNoMatchCount,
    searchModeEnabled,
    toggleSearchMode,
    showFrom,
    showTo,
    showIPV,
    showComments,
    availableSemanticColumns,
    isLocationColumnVisible,
    fromPrefix,
    toPrefix,
    setFromPrefix,
    setToPrefix,
    selectedGauge,
    setSelectedGauge,
    gaugeSortOrder,
    setGaugeSortOrder,
    columnVisibility,
    setColumnVisibility,
    searchValue,
    setSearchValue,
    selectedLocation,
    setSelectedLocation,
    locations,
    locationFilteredRows,
    deviceGroups,
    appliedOrderingProfile,
    relayPluginJumperRuns,
    table,
    tableContainerRef,
    totalDisplayRows,
    locationDisplayRows,
    filteredDisplayRows,
    visibleColumnCount,
    handleResetVisibility,
    isFullScreenSearchOpen,
    setIsFullScreenSearchOpen,
    showDeviceSubheaders,
    setShowDeviceSubheaders,
    columnCounts,
    getRowLength,
    preFilteredRows,
    partNumberMap,
  };
}
