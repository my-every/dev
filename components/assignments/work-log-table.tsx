"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type WorkLogMode = "view" | "edit";

export type WorkLogCellEdit = {
  rowId: string;
  columnKey: string;
  value: string;
};

type WorkLogCellEditorType = "text" | "number" | "time" | "select";

export type WorkLogTableColumn<T> = {
  key: string;
  label: string;
  accessor: (row: T) => string | number | null | undefined;
  editable?: boolean;
  editorType?: WorkLogCellEditorType;
  editorOptions?: string[] | ((row: T) => string[]);
  hidden?: boolean | ((mode: WorkLogMode) => boolean);
  className?: string;
  cellClassName?: string;
  filterPlaceholder?: string;
};

interface WorkLogTableProps<T> {
  title?: string;
  description?: string;
  rows: T[];
  columns: WorkLogTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  mode?: WorkLogMode;
  showFilters?: boolean;
  onModeChange?: (mode: WorkLogMode) => void;
  onSaveEdits?: (edits: WorkLogCellEdit[]) => Promise<void> | void;
  onCellClick?: (params: { row: T; columnKey: string; value: string }) => void;
  className?: string;
}

export function WorkLogTable<T>({
  title = "Work Log Table",
  description = "Search and filter each column to inspect assignment activity.",
  rows,
  columns,
  rowKey,
  mode,
  showFilters = true,
  onModeChange,
  onSaveEdits,
  onCellClick,
  className,
}: WorkLogTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [internalMode, setInternalMode] = useState<WorkLogMode>(mode ?? "view");
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const currentMode = mode ?? internalMode;
  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => {
        if (typeof column.hidden === "function") {
          return !column.hidden(currentMode);
        }
        return column.hidden !== true;
      }),
    [columns, currentMode],
  );

  const getDisplayValue = (row: T, index: number, column: WorkLogTableColumn<T>) => {
    const id = rowKey(row, index);
    const editKey = `${id}:${column.key}`;
    if (pendingEdits[editKey] !== undefined) {
      return pendingEdits[editKey];
    }
    return String(column.accessor(row) ?? "—");
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      visibleColumns.every((column) => {
        const raw = column.accessor(row);
        const value = String(raw ?? "").toLowerCase();
        const query = (filters[column.key] ?? "").trim().toLowerCase();
        if (!query) return true;
        return value.includes(query);
      }),
    );
  }, [filters, rows, visibleColumns]);

  const setMode = (nextMode: WorkLogMode) => {
    onModeChange?.(nextMode);
    if (!mode) {
      setInternalMode(nextMode);
    }
  };

  const handleSave = async () => {
    if (!Object.keys(pendingEdits).length) {
      setMode("view");
      return;
    }

    setIsSaving(true);
    try {
      const edits: WorkLogCellEdit[] = Object.entries(pendingEdits).map(([key, value]) => {
        const [rowId, columnKey] = key.split(":");
        return { rowId, columnKey, value };
      });
      await onSaveEdits?.(edits);
      setPendingEdits({});
      setMode("view");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingEdits({});
    setMode("view");
  };

  return (
    <section className={cn("rounded-2xl border border-border bg-card/60", className)}>
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentMode === "view" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setMode("edit")}>
                Edit
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-240 border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key} className={cn("px-3 py-1 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground", column.className)}>
                  {column.label}
                </th>
              ))}
            </tr>
            {showFilters ? (
              <tr>
                {visibleColumns.map((column) => (
                  <th key={`${column.key}-filter`} className="px-3 py-1">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={filters[column.key] ?? ""}
                        onChange={(event) =>
                          setFilters((previous) => ({
                            ...previous,
                            [column.key]: event.target.value,
                          }))
                        }
                        placeholder={column.filterPlaceholder ?? `Filter ${column.label.toLowerCase()}`}
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={rowKey(row, index)} className="bg-background/70 shadow-sm">
                  {visibleColumns.map((column) => {
                    const id = rowKey(row, index);
                    const value = getDisplayValue(row, index, column);
                    return (
                      <td key={`${id}-${column.key}`} className={cn("rounded-none border-y border-border px-3 py-3 align-top first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r", column.cellClassName)}>
                        <ProjectCell
                          row={row}
                          rowId={id}
                          column={column}
                          value={value}
                          mode={currentMode}
                          onCellClick={onCellClick}
                          onCommit={(nextValue) =>
                            setPendingEdits((previous) => ({
                              ...previous,
                              [`${id}:${column.key}`]: nextValue,
                            }))
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ProjectCellProps<T> = {
  row: T;
  rowId: string;
  column: WorkLogTableColumn<T>;
  value: string;
  mode: WorkLogMode;
  onCellClick?: (params: { row: T; columnKey: string; value: string }) => void;
  onCommit: (value: string) => void;
};

export function ProjectCell<T>({
  row,
  rowId,
  column,
  value,
  mode,
  onCellClick,
  onCommit,
}: ProjectCellProps<T>) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  const editable = mode === "edit" && column.editable;
  const options =
    typeof column.editorOptions === "function"
      ? column.editorOptions(row)
      : column.editorOptions ?? [];

  const commitAndClose = () => {
    onCommit(draft);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      setDraft(value);
    }
  }, [open, value]);

  if (!editable) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start px-0 py-0 text-left text-sm font-normal hover:bg-transparent"
        onClick={() => onCellClick?.({ row, columnKey: column.key, value })}
      >
        <span className="truncate">{value}</span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto w-full justify-start px-0 py-0 text-left text-sm font-normal">
          <span className="truncate">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{column.label}</div>
        {column.editorType === "select" ? (
          <select
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {options.map((option) => (
              <option key={`${rowId}-${column.key}-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            type={column.editorType === "number" ? "number" : column.editorType === "time" ? "time" : "text"}
            className="h-9"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={commitAndClose}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

