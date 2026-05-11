"use client";

import { useState, useCallback, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoxSideConfig, type BoxSideName } from "@/boxSide";

// ─── Box Side Options ────────────────────────────────────────────────────────

const ALL_BOX_SIDE_OPTIONS: { value: BoxSideName; label: string }[] = Object.entries(
  BoxSideConfig
).map(([key, config]) => ({
  value: key as BoxSideName,
  label: config.name,
}));

export function normalizeBoxSideName(boxSide: string | undefined): string {
  if (!boxSide) return "";
  const config = BoxSideConfig[boxSide as BoxSideName];
  return config?.name ?? boxSide;
}

// ─── BoxSidePopover Component ────────────────────────────────────────────────

interface BoxSidePopoverProps {
  value?: string;
  /** Optional filter - only show these box sides. If empty, show all. */
  availableBoxSides?: string[];
  disabled?: boolean;
  onSelect: (boxSide: string) => void;
}

export function BoxSidePopover({
  value,
  availableBoxSides,
  disabled = false,
  onSelect,
}: BoxSidePopoverProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (availableBoxSides && availableBoxSides.length > 0) {
      return ALL_BOX_SIDE_OPTIONS.filter((opt) =>
        availableBoxSides.includes(opt.value)
      );
    }
    return ALL_BOX_SIDE_OPTIONS;
  }, [availableBoxSides]);

  const handleSelect = useCallback(
    (boxSide: string) => {
      onSelect(boxSide);
      setOpen(false);
    },
    [onSelect]
  );

  const displayValue = normalizeBoxSideName(value);

  if (disabled) {
    return value ? (
      <span className="inline-flex rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {displayValue}
      </span>
    ) : null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
            "bg-background hover:bg-muted text-muted-foreground",
            "transition-colors cursor-pointer border",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            value ? "border-border" : "border-dashed border-muted-foreground/50"
          )}
        >
          <span className="truncate max-w-[100px]">
            {displayValue || "Set Box Side"}
          </span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-40 p-1" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div 
          role="listbox" 
          aria-label="Select box side"
          className="flex flex-col max-h-48 overflow-y-auto"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 text-left text-xs rounded",
                "hover:bg-muted transition-colors",
                "focus:outline-none focus:bg-muted",
                value === option.value && "bg-muted font-medium"
              )}
              onClick={() => handleSelect(option.value)}
            >
              <span>{option.label}</span>
              {value === option.value && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
