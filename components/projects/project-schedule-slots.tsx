"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Columns3,
  FileUp,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LwcTypeField } from "@/components/projects/fields/lwc-type-field";
import { cn } from "@/lib/utils";
import { parseProjectScheduleLegalsValue } from "@/lib/project-schedule/adapters";
import {
  filterProjectScheduleRows,
  getDateRangeLabel,
  getFilterValueLabel,
} from "@/components/projects/project-schedule-slots-filters";
import { buildGroupedDisplayEntries } from "@/components/projects/project-schedule-slots-grouping";
import {
  buildMetricsByLwc,
  getLwcTabLabel,
  getRowLwcType,
} from "@/components/projects/project-schedule-slots-metrics";
import {
  ProjectScheduleDateRangeFilter,
  ProjectScheduleOverviewBarChartSwitcher,
} from "@/components/projects/project-schedule-slots-presenters";
import {
  BASE_COLUMNS,
  BASE_COLUMN_LABELS,
  getExtraColumnValue,
  getLegalsBadgeLabel,
  getLegalsBadgeVariant,
  getStatusBadgeVariant,
  getStatusDotClass,
  getUploadBadgeLabel,
  getUploadBadgeVariant,
  GroupedDisplayEntry,
  isBaseColumnKey,
  normalizeColumnLabel,
  parseLwcTypeFromValue,
  type LwcMetricSet,
  type LwcTabValue,
  type ProjectScheduleUploadStatus,
  type ProjectScheduleSlotsProps,
  type ProjectScheduleSlotsTableRow,
  type TableFilters,
} from "@/components/projects/project-schedule-slots-types";
import {
  buildAllColumns,
  buildMultiUnitProjectLookup,
  buildResetColumnVisibility,
  collectExtraColumns,
  collectMonthOptions,
  reconcileColumnOrder,
  reconcileColumnVisibility,
} from "@/components/projects/project-schedule-slots-state";
import {
  ProjectScheduleDetailsModal,
} from "@/components/projects/project-schedule-details-modal";
import { ProjectScheduleDetailsModalAlt } from "@/components/projects/project-schedule-details-modal-alt";
import { ProjectLifecycleModal } from "@/components/projects/project-lifecycle-modal";
import { ProjectUploadFlow } from "@/components/projects/project-upload-flow";
import { SheetDetailModal } from "@/components/projects/sheet-detail-modal";
import { ProjectExportsModal } from "@/components/projects/project-exports-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type {
  ProjectScheduleLegalsState,
  ProjectScheduleSlotsProps,
  ProjectScheduleSlotsTableRow,
  ProjectScheduleStatus,
  TableFilters,
} from "@/components/projects/project-schedule-slots-types";

type RawSlotsRow = Record<string, unknown>;

interface ProjectScheduleSlotsFromJsonProps {
  currentBadge?: string;
  detailsModalVariant?: "default" | "alt";
}

interface SlotProjectSeedStatusRow {
  projectId: string;
  displayName: string;
  folderName: string;
  manifestExists: boolean;
  hasUploadedProjectFiles: boolean;
  legalsUploadStatus: ProjectScheduleUploadStatus;
}

interface ProjectActionStatePayload {
  summary?: {
    hasOperationalSheets?: boolean;
    hasBrandingExports?: boolean;
    hasWireListExports?: boolean;
    brandListReady?: boolean;
    brandingCombinedRelativePath?: string | null;
  };
}

interface ProjectManifestLookupPayload {
  manifest?: {
    id: string;
    name: string;
    pdNumber: string;
    sheets?: Array<{ slug: string; name: string; kind?: string }>;
  };
}

const BASE_COLUMN_TO_SLOT_KEY: Partial<Record<string, string>> = {
  unit: "UNIT",
  pdNumber: "PD#",
  projectName: "PROJECT",
  due: "DEPT 380 TARGET",
  daysLate: "DAYS LATE",
  legals: "LEGALS",
  status: "STATUS",
};

function buildExportDownloadHref(projectId: string, relativePath: string) {
  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const encodedSegments = normalizedRelativePath.split("/").map(encodeURIComponent).join("/");
  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}?download=1`;
}

function ProjectScheduleRowActions({
  row,
  onUploadLegals,
  onOpenWireLists,
  onOpenBrandWorkspace,
  onDownloadBrandList,
  onDownloadWireListBundle,
  onOpenDetails,
}: {
  row: ProjectScheduleSlotsTableRow;
  onUploadLegals: (row: ProjectScheduleSlotsTableRow) => void;
  onOpenWireLists: (row: ProjectScheduleSlotsTableRow) => void;
  onOpenBrandWorkspace: (row: ProjectScheduleSlotsTableRow) => void;
  onDownloadBrandList: (row: ProjectScheduleSlotsTableRow, combinedRelativePath: string) => void;
  onDownloadWireListBundle: (row: ProjectScheduleSlotsTableRow) => void;
  onOpenDetails: (row: ProjectScheduleSlotsTableRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<ProjectActionStatePayload | null>(null);
  const [loadingActions, setLoadingActions] = useState(false);

  useEffect(() => {
    if (!open || !row.slotProjectId || !row.manifestExists) {
      return;
    }

    let cancelled = false;
    setLoadingActions(true);

    void fetch(`/api/projects/${encodeURIComponent(row.slotProjectId)}/action-state`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return response.json() as Promise<ProjectActionStatePayload>;
      })
      .then((payload) => {
        if (!cancelled) {
          setActionState(payload);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingActions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, row.manifestExists, row.slotProjectId]);

  const hasProject = Boolean(row.slotProjectId && row.manifestExists);
  const hasUploadedLegals = Boolean(row.hasUploadedProjectFiles);
  const hasOperationalSheets = Boolean(actionState?.summary?.hasOperationalSheets);
  const brandListReady = Boolean(actionState?.summary?.brandListReady && actionState.summary.brandingCombinedRelativePath);
  const hasWireListExports = Boolean(actionState?.summary?.hasWireListExports);
  const combinedBrandListPath = actionState?.summary?.brandingCombinedRelativePath ?? null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Open actions for ${row.projectName}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>Project actions</span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel>{row.pdNumber || "Project"} Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!hasProject}
          onSelect={() => onUploadLegals(row)}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Upload Legals
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasProject || !hasUploadedLegals || !hasOperationalSheets}
          onSelect={() => onOpenWireLists(row)}
        >
          Open Wire List Sheets
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasProject || !hasUploadedLegals}
          onSelect={() => onOpenBrandWorkspace(row)}
        >
          Open Brand List Workspace
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasProject || !hasUploadedLegals || loadingActions || !brandListReady || !combinedBrandListPath}
          onSelect={() => {
            if (combinedBrandListPath) {
              onDownloadBrandList(row, combinedBrandListPath);
            }
          }}
        >
          Download Combined Brand List
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasProject || !hasUploadedLegals || loadingActions || !hasWireListExports}
          onSelect={() => onDownloadWireListBundle(row)}
        >
          Download Wire List PDF Bundle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenDetails(row)}>
          View Schedule Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toRawText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function inferScheduleStatusFromSlotsRow(
  row: RawSlotsRow,
): ProjectScheduleStatus {
  const legals = parseProjectScheduleLegalsValue(toRawText(row["LEGALS"]));
  const biqComp = toRawText(row["BIQ COMP"]);
  const finalBiq = toRawText(row["D380 FINAL-BIQ"]);

  if (biqComp || finalBiq) {
    return "Complete";
  }

  if (legals.state === "published") {
    return "Pending";
  }

  if (legals.state === "pending_reference") {
    return "Upcoming";
  }

  return "In Process";
}

function adaptSlotsJsonRowToTableRow(
  row: RawSlotsRow,
  index: number,
  slotProjectStatus?: SlotProjectSeedStatusRow,
): ProjectScheduleSlotsTableRow {
  const pdNumber = toRawText(row["PD#"]) || `ROW-${index + 1}`;
  const projectName = toRawText(row["PROJECT"]) || "Untitled Project";
  const unit = toRawText(row["UNIT"]) || "-";
  const dueLabel = toRawText(row["DEPT 380 TARGET"]);
  const legals = parseProjectScheduleLegalsValue(toRawText(row["LEGALS"]));
  const rawDaysLate = Number.parseFloat(toRawText(row["DAYS LATE"]));

  return {
    id: `${pdNumber}:${unit}:${projectName}:${index}`,
    sourceIndex: index,
    pdNumber,
    projectName,
    unit,
    dueLabel,
    dueMonth: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dueLabel)
      ? (() => {
        const [month, , year] = dueLabel.split("/");
        const normalizedYear = year.length === 2 ? `20${year}` : year;
        return `${normalizedYear}-${month.padStart(2, "0")}`;
      })()
      : null,
    daysLate: Number.isFinite(rawDaysLate) ? rawDaysLate : null,
    legalsState: legals.state,
    legalsLabel: legals.raw || getLegalsBadgeLabel(legals.state),
    status: inferScheduleStatusFromSlotsRow(row),
    slotProjectId: slotProjectStatus?.projectId,
    slotProjectDisplayName: slotProjectStatus?.displayName,
    slotProjectFolderName: slotProjectStatus?.folderName,
    manifestExists: slotProjectStatus?.manifestExists ?? false,
    hasUploadedProjectFiles: slotProjectStatus?.hasUploadedProjectFiles ?? false,
    uploadStatus: slotProjectStatus?.legalsUploadStatus ?? "missing_project",
    extraColumns: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, toRawText(value)]),
    ),
  };
}

export function ProjectScheduleSlotsFromJson({
  currentBadge,
  detailsModalVariant = "default",
}: ProjectScheduleSlotsFromJsonProps) {
  const [rows, setRows] = useState<ProjectScheduleSlotsTableRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async (cancelledRef?: { current: boolean }) => {
    setIsLoading(true);
    setError(null);

    try {
      const [slotsResponse, seedStatusResponse] = await Promise.all([
        fetch("/api/schedule/slots", { cache: "no-store" }),
        fetch("/api/schedule/slots/project-seed-status", { cache: "no-store" }).catch(() => null),
      ]);

      if (!slotsResponse.ok) {
        throw new Error("Failed to load Slots.json");
      }

      const payload = await slotsResponse.json() as { rows?: RawSlotsRow[] };
      let seedStatuses: SlotProjectSeedStatusRow[] = [];

      if (seedStatusResponse?.ok) {
        const seedPayload = await seedStatusResponse.json() as { rows?: SlotProjectSeedStatusRow[] };
        seedStatuses = seedPayload.rows ?? [];
      }

      const nextRows = (payload.rows ?? []).map((row, index) =>
        adaptSlotsJsonRowToTableRow(row, index, seedStatuses[index]),
      );

      if (!cancelledRef?.current) {
        setRows(nextRows);
        setSelectedRowId((current) =>
          current && nextRows.some((row) => row.id === current)
            ? current
            : nextRows[0]?.id ?? "",
        );
      }
    } catch (loadError) {
      if (!cancelledRef?.current) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load Slots.json");
      }
    } finally {
      if (!cancelledRef?.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const cancelledRef = { get current() { return cancelled; } };
    void loadRows(cancelledRef);
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading Slots.json...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-8 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProjectScheduleSlotsTable
      rows={rows}
      selectedRowId={selectedRowId}
      onSelectRowId={setSelectedRowId}
      currentBadge={currentBadge}
      detailsModalVariant={detailsModalVariant}
      onRowsChanged={() => loadRows()}
    />
  );
}


export function ProjectScheduleSlotsTable({
  rows,
  selectedRowId,
  onSelectRowId,
  currentBadge,
  detailsModalVariant = "default",
  onRowsChanged,
}: ProjectScheduleSlotsProps) {
  const [activeLwcTab, setActiveLwcTab] = useState<LwcTabValue>("ALL");
  const [filters, setFilters] = useState<TableFilters>({
    search: "",
    dueMonth: "all",
    dueDateFrom: "",
    dueDateTo: "",
    legalsState: "all",
    status: "all",
    multiUnitProject: "all",
  });
  const [columnOrder, setColumnOrder] = useState<string[]>(BASE_COLUMNS);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    for (const column of BASE_COLUMNS) {
      initial[column] = true;
    }
    return initial;
  });

  const monthOptions = useMemo(() => {
    return collectMonthOptions(rows);
  }, [rows]);

  const extraColumns = useMemo(() => {
    return collectExtraColumns(rows);
  }, [rows]);

  const allColumns = useMemo(
    () => buildAllColumns(extraColumns),
    [extraColumns],
  );

  const multiUnitProjectLookup = useMemo(() => {
    return buildMultiUnitProjectLookup(rows);
  }, [rows]);

  const rowsAfterMenuFilters = useMemo(() => {
    return filterProjectScheduleRows(rows, filters, multiUnitProjectLookup);
  }, [filters, rows, multiUnitProjectLookup]);

  const filteredRows = useMemo(() => {
    if (activeLwcTab === "ALL") {
      return rowsAfterMenuFilters;
    }
    return rowsAfterMenuFilters.filter((row) => getRowLwcType(row) === activeLwcTab);
  }, [activeLwcTab, rowsAfterMenuFilters]);

  const metricsByLwc = useMemo(() => {
    return buildMetricsByLwc(rowsAfterMenuFilters);
  }, [rowsAfterMenuFilters]);

  useEffect(() => {
    setColumnOrder((prev) => {
      return reconcileColumnOrder(prev, allColumns);
    });

    setColumnVisibility((prev) => {
      return reconcileColumnVisibility(prev, allColumns);
    });
  }, [allColumns]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      return;
    }

    const selectedStillVisible = filteredRows.some(
      (row) => row.id === selectedRowId,
    );

    if (!selectedStillVisible) {
      onSelectRowId(filteredRows[0].id);
    }
  }, [filteredRows, onSelectRowId, selectedRowId]);

  const visibleColumns = useMemo(
    () => columnOrder.filter((column) => columnVisibility[column]),
    [columnOrder, columnVisibility],
  );

  const [expandedGroupKeys, setExpandedGroupKeys] = useState<
    Record<string, boolean>
  >({});
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<ProjectScheduleSlotsTableRow | null>(null);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [lifecycleProjectId, setLifecycleProjectId] = useState<string | null>(null);
  const [lifecycleProjectName, setLifecycleProjectName] = useState<string | null>(null);
  const [uploadRow, setUploadRow] = useState<ProjectScheduleSlotsTableRow | null>(null);
  const [wireListModal, setWireListModal] = useState<{ projectId: string; sheetSlug: string } | null>(null);
  const [exportsProjectId, setExportsProjectId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const displayEntries = useMemo<GroupedDisplayEntry[]>(() => {
    return buildGroupedDisplayEntries(filteredRows, multiUnitProjectLookup);
  }, [filteredRows, multiUnitProjectLookup]);

  const visibleColumnCount = useMemo(
    () => Object.values(columnVisibility).filter(Boolean).length,
    [columnVisibility],
  );

  const toggleColumnVisibility = (column: string) => {
    setColumnVisibility((prev) => {
      const currentVisibleCount = Object.values(prev).filter(Boolean).length;
      if (prev[column] && currentVisibleCount <= 1) {
        return prev;
      }
      return {
        ...prev,
        [column]: !prev[column],
      };
    });
  };

  const moveColumn = (column: string, direction: "up" | "down") => {
    setColumnOrder((prev) => {
      const currentIndex = prev.indexOf(column);
      if (currentIndex < 0) {
        return prev;
      }

      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const activeFilterCount =
    (filters.dueMonth !== "all" ? 1 : 0) +
    (filters.dueDateFrom ? 1 : 0) +
    (filters.dueDateTo ? 1 : 0) +
    (filters.legalsState !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0);

  const filterValueLabel = getFilterValueLabel(filters);
  const dateRangeLabel = getDateRangeLabel(filters.dueDateFrom, filters.dueDateTo);
  const queueTitle = `Priority Queue: ${getLwcTabLabel(activeLwcTab)} | ${dateRangeLabel}`;

  const getColumnLabel = (column: string): string => {
    if (isBaseColumnKey(column)) {
      return BASE_COLUMN_LABELS[column];
    }
    return normalizeColumnLabel(column);
  };

  const resetVisibilityAndOrder = () => {
    setColumnOrder(allColumns);
    setColumnVisibility(buildResetColumnVisibility(allColumns));
  };

  const openLifecycleForRow = (row: ProjectScheduleSlotsTableRow) => {
    onSelectRowId(row.id);

    if (!row.slotProjectId || !row.manifestExists) {
      return;
    }

    setLifecycleProjectId(row.slotProjectId);
    setLifecycleProjectName(row.slotProjectDisplayName ?? row.projectName);
    setIsLifecycleOpen(true);
  };

  const openDetailsForRow = (row: ProjectScheduleSlotsTableRow) => {
    onSelectRowId(row.id);
    setDetailsRow(row);
    setIsDetailsOpen(true);
  };

  const openUploadForRow = (row: ProjectScheduleSlotsTableRow) => {
    if (!row.slotProjectId || !row.manifestExists) {
      return;
    }

    onSelectRowId(row.id);
    setUploadRow(row);
  };

  const openWireListsForRow = async (row: ProjectScheduleSlotsTableRow) => {
    if (!row.slotProjectId || !row.manifestExists || !row.hasUploadedProjectFiles) {
      return;
    }

    onSelectRowId(row.id);
    const response = await fetch(`/api/projects/${encodeURIComponent(row.slotProjectId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }

    const payload = await response.json() as ProjectManifestLookupPayload;
    const firstOperationalSheet = payload.manifest?.sheets?.find((sheet) => sheet.kind === "operational");
    if (!firstOperationalSheet?.slug) {
      return;
    }

    setWireListModal({
      projectId: row.slotProjectId,
      sheetSlug: firstOperationalSheet.slug,
    });
  };

  const openBrandWorkspaceForRow = (row: ProjectScheduleSlotsTableRow) => {
    if (!row.slotProjectId || !row.manifestExists || !row.hasUploadedProjectFiles) {
      return;
    }

    onSelectRowId(row.id);
    setExportsProjectId(row.slotProjectId);
  };

  const downloadCombinedBrandListForRow = (
    row: ProjectScheduleSlotsTableRow,
    combinedRelativePath: string,
  ) => {
    if (!row.slotProjectId) {
      return;
    }

    window.location.href = buildExportDownloadHref(row.slotProjectId, combinedRelativePath);
  };

  const downloadWireListBundleForRow = (row: ProjectScheduleSlotsTableRow) => {
    if (!row.slotProjectId || !row.hasUploadedProjectFiles) {
      return;
    }

    window.location.href = `/api/projects/${encodeURIComponent(row.slotProjectId)}/wire-list-pdf-bundle?download=1`;
  };

  const getEditableCellValue = (row: ProjectScheduleSlotsTableRow, column: string) => {
    const slotKey = BASE_COLUMN_TO_SLOT_KEY[column] ?? column;
    if (column === "unit") return row.unit === "-" ? "" : row.unit;
    if (column === "pdNumber") return row.pdNumber;
    if (column === "projectName") return row.projectName;
    if (column === "due") return row.dueLabel;
    if (column === "daysLate") return row.daysLate == null ? "" : String(row.daysLate);
    if (column === "legals") return row.extraColumns?.[slotKey] ?? row.legalsLabel;
    if (column === "status") return row.extraColumns?.[slotKey] ?? row.status;
    return row.extraColumns?.[slotKey] ?? "";
  };

  const beginCellEdit = (row: ProjectScheduleSlotsTableRow, column: string) => {
    if (column === "actions") {
      return;
    }

    setEditingCell({ rowId: row.id, column });
    setDraftValue(getEditableCellValue(row, column));
  };

  const commitCellEdit = async (row: ProjectScheduleSlotsTableRow, column: string) => {
    if (!editingCell || editingCell.rowId !== row.id || editingCell.column !== column) {
      return;
    }

    const slotKey = BASE_COLUMN_TO_SLOT_KEY[column] ?? column;
    const nextValue = draftValue.trim();
    const currentValue = getEditableCellValue(row, column).trim();
    setEditingCell(null);

    if (nextValue === currentValue || row.sourceIndex < 0) {
      return;
    }

    const saveKey = `${row.id}:${column}`;
    setSavingCell(saveKey);
    try {
      const response = await fetch("/api/schedule/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: row.sourceIndex,
          updates: { [slotKey]: nextValue },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update schedule cell");
      }

      await onRowsChanged?.();
    } finally {
      setSavingCell(null);
    }
  };

  const createBlankRecord = async () => {
    const response = await fetch("/api/schedule/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: {
          "PD#": "",
          PROJECT: "New Project",
          UNIT: "",
          LEGALS: "",
          "DEPT 380 TARGET": "",
          LWC: "NEW/FLEX",
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create schedule row");
    }

    await onRowsChanged?.();
  };

  const renderRowCells = (
    row: ProjectScheduleSlotsTableRow,
    options: {
      unitMode: "single" | "group-parent" | "group-child";
      keyPrefix?: string;
      expanded?: boolean;
      groupSize?: number;
      onToggleExpanded?: () => void;
    },
  ) => {
    return visibleColumns.map((column) => (
      <TableCell
        key={`${options.keyPrefix ?? row.id}-${options.unitMode}-${column}`}
        onDoubleClick={(event) => {
          event.stopPropagation();
          beginCellEdit(row, column);
        }}
        className={cn(
          column === "unit" && "text-xs",
          column === "daysLate" && "text-xs",
          column === "status" && "text-right",
        )}
      >
        {column !== "actions" && editingCell?.rowId === row.id && editingCell.column === column ? (
          <Input
            autoFocus
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitCellEdit(row, column);
              }
              if (event.key === "Escape") {
                setEditingCell(null);
              }
            }}
            onBlur={() => void commitCellEdit(row, column)}
            className="h-8 min-w-32 rounded-lg text-xs"
            disabled={savingCell === `${row.id}:${column}`}
          />
        ) : null}
        {column !== "actions" && editingCell?.rowId === row.id && editingCell.column === column ? null : (
          <>
        {column === "actions" ? (
          <ProjectScheduleRowActions
            row={row}
            onUploadLegals={openUploadForRow}
            onOpenWireLists={(targetRow) => void openWireListsForRow(targetRow)}
            onOpenBrandWorkspace={openBrandWorkspaceForRow}
            onDownloadBrandList={downloadCombinedBrandListForRow}
            onDownloadWireListBundle={downloadWireListBundleForRow}
            onOpenDetails={openDetailsForRow}
          />
        ) : null}
        {column === "unit" ? (
          <div className="flex items-center gap-2">
            {options.unitMode === "group-parent" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(event) => {
                  event.stopPropagation();
                  options.onToggleExpanded?.();
                }}
              >
                {options.expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : (
              <span className="inline-block h-6 w-6" />
            )}
            <span className="font-medium">
              {options.unitMode === "group-parent"
                ? `${options.groupSize ?? 0} units`
                : row.unit}
            </span>
          </div>
        ) : null}
        {column === "pdNumber" ? (
          <div className="font-medium">{row.pdNumber}</div>
        ) : null}
        {column === "projectName" ? (
          <div className="flex max-w-55 flex-col gap-1">
            <div
              className="truncate text-xs text-muted-foreground"
              title={row.projectName}
            >
              {row.projectName}
            </div>
            <Badge
              variant={getUploadBadgeVariant(row.uploadStatus)}
              className="w-fit text-[10px]"
            >
              {getUploadBadgeLabel(row.uploadStatus)}
            </Badge>
          </div>
        ) : null}
        {column === "due" ? row.dueLabel || "-" : null}
        {column === "daysLate" ? (
          <span
            className={cn(
              "text-muted-foreground",
              (row.daysLate ?? 0) > 0 && "text-destructive",
              (row.daysLate ?? 0) < 0 && "text-emerald-600",
            )}
          >
            {row.daysLate == null ? "-" : `${row.daysLate} days`}
          </span>
        ) : null}
        {column === "legals" ? (
          <div className="flex items-center gap-2">
            {row.legalsLabel ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={getLegalsBadgeVariant(row.legalsState)}
                    className="cursor-help text-[10px]"
                  >
                    {getLegalsBadgeLabel(row.legalsState)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <span className="text-xs">{row.legalsLabel}</span>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge
                variant={getLegalsBadgeVariant(row.legalsState)}
                className="text-[10px]"
              >
                {getLegalsBadgeLabel(row.legalsState)}
              </Badge>
            )}
          </div>
        ) : null}
        {column === "status" ? (
          <Badge
            variant={getStatusBadgeVariant(row.status)}
            className="inline-flex items-center gap-1.5 text-[10px]"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                getStatusDotClass(row.status),
              )}
            />
            {row.status}
          </Badge>
        ) : null}
        {!isBaseColumnKey(column) && column.trim().toUpperCase() === "LWC" ? (
          <LwcTypeField
            mode="status"
            value={parseLwcTypeFromValue(getExtraColumnValue(row, column))}
            className="text-[10px]"
          />
        ) : null}
        {!isBaseColumnKey(column) && column.trim().toUpperCase() !== "LWC"
          ? (row.extraColumns?.[column] || "-")
          : null}
          </>
        )}
      </TableCell>
    ));
  };

  return (
    <>
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">{queueTitle}</CardTitle>
          <CardDescription>
            Reusable queue table with built-in search and filters.
          </CardDescription>
        </div>
        <ProjectScheduleDateRangeFilter
          dueDateFrom={filters.dueDateFrom}
          dueDateTo={filters.dueDateTo}
          onChangeDueDateFrom={(value) =>
            setFilters((prev) => ({ ...prev, dueDateFrom: value }))
          }
          onChangeDueDateTo={(value) =>
            setFilters((prev) => ({ ...prev, dueDateTo: value }))
          }
        />
      </CardHeader>
        <CardContent className="space-y-4">
        <ProjectScheduleOverviewBarChartSwitcher
          activeLwcTab={activeLwcTab}
          onLwcTabChange={setActiveLwcTab}
          metricsByLwc={metricsByLwc}
          dateRangeLabel={dateRangeLabel}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-[50%] rounded-xl">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="Search PD#, project, unit, legals"
              className="pl-8 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-r-none"
              onClick={() => void createBlankRecord()}
            >
              <Plus className="h-4 w-4" />
              New Record
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-none">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>{filterValueLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Due Month
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.dueMonth}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, dueMonth: value }))
                  }
                >
                  <DropdownMenuRadioItem value="all">All months</DropdownMenuRadioItem>
                  {monthOptions.map((month) => (
                    <DropdownMenuRadioItem key={month} value={month}>
                      {month}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground rounded-x-none">
                  Legals
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.legalsState}
                  onValueChange={(value: TableFilters["legalsState"]) =>
                    setFilters((prev) => ({ ...prev, legalsState: value }))
                  }
                >
                  <DropdownMenuRadioItem value="all">All States</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="published">Published</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pending_reference">
                    Pending Legals
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="missing">Missing</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="invalid">Invalid</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="not_applicable">
                    Not Applicable
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Status
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.status}
                  onValueChange={(value: TableFilters["status"]) =>
                    setFilters((prev) => ({ ...prev, status: value }))
                  }
                >
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Complete">Complete</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="In Process">
                    In Process
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Upcoming">Upcoming</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Multi-Unit Project
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.multiUnitProject}
                  onValueChange={(value: TableFilters["multiUnitProject"]) =>
                    setFilters((prev) => ({ ...prev, multiUnitProject: value }))
                  }
                >
                  <DropdownMenuRadioItem value="all">All Projects</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="true">Multi-Unit Only</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="false">Single-Unit Only</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-l-none rounded-r-none">
                  <Columns3 className="h-4 w-4" />
                  Columns ({visibleColumnCount}/{allColumns.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Visibility and Order</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnOrder.map((column, index) => (
                  <div
                    key={column}
                    className="flex items-center justify-between gap-2 px-2 py-1"
                  >
                    <Button
                      type="button"
                      variant={columnVisibility[column] ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 justify-start px-2 text-xs"
                      onClick={() => toggleColumnVisibility(column)}
                    >
                      {columnVisibility[column] ? "Hide" : "Show"} {getColumnLabel(column)}
                    </Button>
                    <div className="flex items-center gap-1">
                      <DropdownMenuItem
                        className="h-7 w-7 justify-center p-0"
                        disabled={index === 0}
                        onSelect={(event) => {
                          event.preventDefault();
                          moveColumn(column, "up");
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="h-7 w-7 justify-center p-0"
                        disabled={index === columnOrder.length - 1}
                        onSelect={(event) => {
                          event.preventDefault();
                          moveColumn(column, "down");
                        }}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </DropdownMenuItem>
                    </div>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              className="rounded-l-none"
              size="sm"
              onClick={() => {
                setFilters({
                  search: "",
                  dueMonth: "all",
                  dueDateFrom: "",
                  dueDateTo: "",
                  legalsState: "all",
                  status: "all",
                  multiUnitProject: "all",
                });
                resetVisibilityAndOrder();
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="max-h-150 overflow-auto rounded-xl border p-1">
          <Table>
            <TableHeader className="sticky top-0">
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column}
                    className={cn(
                      column === "status" ? "text-center" : "text-left",
                    )}
                  >
                    {getColumnLabel(column)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(visibleColumns.length, 1)}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No projects match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                displayEntries.map((entry) => {
                  if (entry.type === "single") {
                    const row = entry.row;
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "cursor-pointer overflow-hidden",
                          selectedRowId === row.id
                            ? "bg-muted/10"
                            : "hover:bg-muted/40 rounded-md",
                        )}
                        onClick={() => onSelectRowId(row.id)}
                      >
                        {renderRowCells(row, { unitMode: "single" })}
                      </TableRow>
                    );
                  }

                  const expanded = Boolean(expandedGroupKeys[entry.key]);
                  const groupLead = entry.lead;
                  const groupHasSelectedRow = entry.rows.some(
                    (row) => row.id === selectedRowId,
                  );

                  return (
                    <Fragment key={entry.key}>
                      <TableRow
                        className={cn(
                          "cursor-pointer overflow-hidden",
                          groupHasSelectedRow
                            ? "bg-muted/10"
                            : "hover:bg-muted/40 rounded-md",
                        )}
                        onClick={() => onSelectRowId(groupLead.id)}
                      >
                        {renderRowCells(groupLead, {
                          unitMode: "group-parent",
                          keyPrefix: entry.key,
                          expanded,
                          groupSize: entry.rows.length,
                          onToggleExpanded: () =>
                            setExpandedGroupKeys((prev) => ({
                              ...prev,
                              [entry.key]: !prev[entry.key],
                            })),
                        })}
                      </TableRow>

                      {expanded ? (
                        entry.rows.map((unitRow) => (
                          <TableRow
                            key={`${entry.key}-${unitRow.id}`}
                            className={cn(
                              "cursor-pointer border-l-2 border-muted/60 bg-muted/10",
                              selectedRowId === unitRow.id && "bg-primary/5",
                            )}
                            onClick={() => onSelectRowId(unitRow.id)}
                          >
                            {renderRowCells(unitRow, {
                              unitMode: "group-child",
                              keyPrefix: `${entry.key}-${unitRow.id}`,
                            })}
                          </TableRow>
                        ))
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

      {detailsModalVariant === "alt" ? (
        <ProjectScheduleDetailsModalAlt
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          row={detailsRow}
          currentBadge={currentBadge}
        />
      ) : (
        <ProjectScheduleDetailsModal
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          row={detailsRow}
          currentBadge={currentBadge}
        />
      )}

      {lifecycleProjectId ? (
        <ProjectLifecycleModal
          open={isLifecycleOpen}
          onOpenChange={setIsLifecycleOpen}
          projectId={lifecycleProjectId}
          projectName={lifecycleProjectName ?? undefined}
        />
      ) : null}
    </>
  );
}
