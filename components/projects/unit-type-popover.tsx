"use client";

import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitTypePopoverProps {
  value?: string;
  options: string[];
  disabled?: boolean;
  onSelect: (unitType: string) => void;
}

export function UnitTypePopover({
  value,
  options,
  disabled = false,
  onSelect,
}: UnitTypePopoverProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (unitType: string) => {
      onSelect(unitType);
      setOpen(false);
    },
    [onSelect]
  );

  if (disabled) {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {value || "—"}
      </Badge>
    );
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
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
            "font-mono text-[10px] border",
            "bg-background hover:bg-muted transition-colors cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            value ? "border-border" : "border-dashed border-muted-foreground/50"
          )}
        >
          <span>{value || "Set Unit"}</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-32 p-1" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div 
          role="listbox" 
          aria-label="Select unit type"
          className="flex flex-col max-h-48 overflow-y-auto"
        >
          {options.length > 0 ? (
            options.map((unitType) => (
              <button
                key={unitType}
                type="button"
                role="option"
                aria-selected={value === unitType}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 text-left text-xs font-mono rounded",
                  "hover:bg-muted transition-colors",
                  "focus:outline-none focus:bg-muted",
                  value === unitType && "bg-muted font-medium"
                )}
                onClick={() => handleSelect(unitType)}
              >
                <span>{unitType}</span>
                {value === unitType && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))
          ) : (
            <span className="px-2 py-1.5 text-xs text-muted-foreground">
              No unit types available
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
