"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BoxSideConfig, type BoxSideName } from "@/boxSide";

// ─── Box Side Options ────────────────────────────────────────────────────────

const ALL_BOX_SIDE_OPTIONS: { value: BoxSideName; label: string }[] = Object.entries(
  BoxSideConfig
).map(([key, config]) => ({
  value: key as BoxSideName,
  label: config.name,
}));

function normalizeBoxSideName(boxSide: string | undefined): string {
  if (!boxSide) return "";
  const config = BoxSideConfig[boxSide as BoxSideName];
  return config?.name ?? boxSide;
}

// ─── BoxSideCell Component ───────────────────────────────────────────────────

interface BoxSideCellProps {
  sheetSlug: string;
  initialValue?: string;
  availableBoxSides?: string[];
  isEditing: boolean;
  onBoxSideChange?: (sheetSlug: string, boxSide: string) => void;
}

export function BoxSideCell({
  sheetSlug,
  initialValue,
  availableBoxSides,
  isEditing,
  onBoxSideChange,
}: BoxSideCellProps) {
  const options = useMemo(() => {
    if (availableBoxSides && availableBoxSides.length > 0) {
      return ALL_BOX_SIDE_OPTIONS.filter((opt) =>
        availableBoxSides.includes(opt.value)
      );
    }
    return ALL_BOX_SIDE_OPTIONS;
  }, [availableBoxSides]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const boxSide = e.target.value;
      if (onBoxSideChange && boxSide) {
        onBoxSideChange(sheetSlug, boxSide);
      }
    },
    [sheetSlug, onBoxSideChange]
  );

  const displayValue = normalizeBoxSideName(initialValue);

  // When not editing, show static badge
  if (!isEditing) {
    return initialValue ? (
      <span className="inline-flex rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {displayValue}
      </span>
    ) : (
      <span className="text-[10px] text-muted-foreground/50">—</span>
    );
  }

  // When editing, show simple select dropdown
  return (
    <select
      value={initialValue || ""}
      onChange={handleChange}
      className={cn(
        "w-full min-h-[44px] px-2 py-1 text-xs rounded border",
        "bg-background text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        initialValue ? "border-border" : "border-dashed border-muted-foreground/50"
      )}
    >
      <option value="">Set Box Side</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
