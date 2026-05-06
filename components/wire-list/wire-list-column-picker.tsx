"use client";

/**
 * Column visibility picker for the wire list table.
 * Allows users to show/hide columns from a dropdown.
 */

import { useState } from "react";
import { Columns3, Check, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ColumnDisplayConfig } from "@/lib/workbook/column-visibility-config";
import type { ColumnVisibilityState } from "@/lib/workbook/column-visibility-config";

// ============================================================================
// Types
// ============================================================================

interface WireListColumnPickerProps {
  /** Column configurations */
  columns: ColumnDisplayConfig[];
  /** Current visibility state */
  visibility: ColumnVisibilityState;
  /** Callback when visibility changes */
  onVisibilityChange: (visibility: ColumnVisibilityState) => void;
  /** Default visibility state for reset */
  defaultVisibility: ColumnVisibilityState;
}

// ============================================================================
// Component
// ============================================================================

export function WireListColumnPicker({
  columns,
  visibility,
  onVisibilityChange,
  defaultVisibility,
}: WireListColumnPickerProps) {
  const [open, setOpen] = useState(false);

  // Count visible/hidden
  const visibleCount = Object.values(visibility).filter(Boolean).length;
  const hiddenCount = columns.length - visibleCount;

  // Toggle a single column
  const toggleColumn = (key: string) => {
    onVisibilityChange({
      ...visibility,
      [key]: !visibility[key],
    });
  };

  // Show all columns
  const showAll = () => {
    const newVisibility: ColumnVisibilityState = {};
    for (const col of columns) {
      newVisibility[col.key] = true;
    }
    onVisibilityChange(newVisibility);
  };

  // Hide optional columns (keep required visible)
  const hideOptional = () => {
    const newVisibility: ColumnVisibilityState = {};
    for (const col of columns) {
      newVisibility[col.key] = !col.canHide || !col.defaultVisible === false;
    }
    onVisibilityChange(newVisibility);
  };

  // Reset to defaults
  const resetDefaults = () => {
    onVisibilityChange(defaultVisibility);
  };

  // Group columns by group
  const fromColumns = columns.filter(c => c.group === "from");
  const toColumns = columns.filter(c => c.group === "to");
  const otherColumns = columns.filter(c => !c.group);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Columns3 className="h-4 w-4" />
          <span>Columns</span>
          {hiddenCount > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
              {hiddenCount} hidden
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {/* Header actions */}
        <div className="flex items-center justify-between gap-2 border-b p-2">
          <span className="text-sm font-medium">
            {visibleCount} of {columns.length} visible
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={showAll}
            >
              <Eye className="mr-1 h-3 w-3" />
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={resetDefaults}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Column list */}
        <div className="max-h-80 overflow-y-auto p-1">
          {/* From section */}
          {fromColumns.length > 0 && (
            <div className="px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">From</span>
            </div>
          )}
          {fromColumns.map((col) => (
            <ColumnItem
              key={col.key}
              column={col}
              isVisible={visibility[col.key] ?? true}
              onToggle={() => toggleColumn(col.key)}
            />
          ))}

          {/* To section */}
          {toColumns.length > 0 && (
            <>
              <Separator className="my-1" />
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">To</span>
              </div>
            </>
          )}
          {toColumns.map((col) => (
            <ColumnItem
              key={col.key}
              column={col}
              isVisible={visibility[col.key] ?? true}
              onToggle={() => toggleColumn(col.key)}
            />
          ))}

          {/* Other columns */}
          {otherColumns.length > 0 && (
            <>
              <Separator className="my-1" />
              <div className="px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">Other</span>
              </div>
            </>
          )}
          {otherColumns.map((col) => (
            <ColumnItem
              key={col.key}
              column={col}
              isVisible={visibility[col.key] ?? true}
              onToggle={() => toggleColumn(col.key)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Column Item
// ============================================================================

interface ColumnItemProps {
  column: ColumnDisplayConfig;
  isVisible: boolean;
  onToggle: () => void;
}

function ColumnItem({ column, isVisible, onToggle }: ColumnItemProps) {
  const canToggle = column.canHide;

  return (
    <button
      type="button"
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
        canToggle && "hover:bg-muted",
        !canToggle && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          isVisible
            ? "border-primary bg-muted text-secondary-foreground-foreground"
            : "border-muted-foreground/30"
        )}
      >
        {isVisible && <Check className="h-3 w-3" />}
      </div>
      <span className="flex-1 text-left truncate">{column.label}</span>
      {!column.defaultVisible && isVisible && (
        <span className="text-xs text-muted-foreground">shown</span>
      )}
    </button>
  );
}
