"use client";

/**
 * From Checkbox Cell
 * 
 * A compact checkbox for marking the "From" side of a wire as complete.
 * Supports a printVariant mode that renders a static box for print output.
 */

import { Checkbox } from "@/components/ui/checkbox";

interface FromCheckboxCellProps {
  /** Row ID for state tracking */
  rowId: string;
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when checkbox state changes */
  onCheckedChange: (rowId: string, checked: boolean) => void;
  /** Whether the cell is disabled */
  disabled?: boolean;
  /** Print variant renders a static box instead of interactive checkbox */
  printVariant?: boolean;
}

export function FromCheckboxCell({
  rowId,
  checked,
  onCheckedChange,
  disabled = false,
  printVariant = false,
}: FromCheckboxCellProps) {
  // Print variant: static box for paper printing
  if (printVariant) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-4 h-4 border border-foreground/40 rounded-sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(rowId, checked === true)}
        disabled={disabled}
        className="h-4 w-4 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        aria-label="Mark From connection complete"
      />
    </div>
  );
}
