"use client";

/**
 * Toolbar component for wire list.
 * 
 * Provides:
 * - Global search
 * - Column visibility picker
 * - Row count display
 * - Integration point for location tabs
 */

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WireListColumnPicker } from "./wire-list-column-picker";
import type { ColumnDisplayConfig, ColumnVisibilityState } from "@/lib/workbook/column-visibility-config";

interface WireListToolbarProps {
  /** Current search value */
  searchValue: string;
  /** Search value change handler */
  onSearchChange: (value: string) => void;
  /** Total row count */
  totalRows: number;
  /** Filtered row count (if different from total) */
  filteredRows?: number;
  /** Column configurations (for picker) */
  columnConfigs?: ColumnDisplayConfig[];
  /** Current column visibility state */
  columnVisibility?: ColumnVisibilityState;
  /** Column visibility change handler */
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;
  /** Default column visibility for reset */
  defaultColumnVisibility?: ColumnVisibilityState;
}

export function WireListToolbar({
  searchValue,
  onSearchChange,
  totalRows,
  filteredRows,
  columnConfigs,
  columnVisibility,
  onColumnVisibilityChange,
  defaultColumnVisibility,
}: WireListToolbarProps) {
  const showFilteredCount = filteredRows !== undefined && filteredRows !== totalRows;

  return (
    <div className="flex flex-col gap-3">
      {/* Main toolbar row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search all columns..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-9"
          />
        </div>

        {/* Right side: Actions and count */}
        <div className="flex items-center gap-3">
          {/* Column visibility picker */}
          {columnConfigs && columnVisibility && onColumnVisibilityChange && defaultColumnVisibility && (
            <WireListColumnPicker
              columns={columnConfigs}
              visibility={columnVisibility}
              onVisibilityChange={onColumnVisibilityChange}
              defaultVisibility={defaultColumnVisibility}
            />
          )}

          {/* Row count */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {showFilteredCount ? (
              <>
                <span className="font-medium text-foreground">{filteredRows.toLocaleString()}</span>
                {" / "}
                <span>{totalRows.toLocaleString()}</span> rows
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{totalRows.toLocaleString()}</span> rows
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
