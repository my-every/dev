"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1",
            "font-mono text-xs border",
            "bg-background hover:bg-muted transition-colors cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            "min-h-[32px]", // Minimum touch target
            value ? "border-border" : "border-dashed border-muted-foreground/50"
          )}
        >
          <span>{value || "Set Unit"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Unit Type</DrawerTitle>
        </DrawerHeader>
        <div 
          role="listbox" 
          aria-label="Select unit type"
          className="flex flex-col px-4 pb-6 gap-1"
        >
          {options.length > 0 ? (
            options.map((unitType) => (
              <button
                key={unitType}
                type="button"
                role="option"
                aria-selected={value === unitType}
                className={cn(
                  "flex items-center justify-between px-4 py-3 text-left text-sm font-mono rounded-lg",
                  "hover:bg-muted active:bg-muted transition-colors",
                  "focus:outline-none focus:bg-muted",
                  "min-h-[44px]", // Touch-friendly target
                  value === unitType && "bg-muted font-medium"
                )}
                onClick={() => handleSelect(unitType)}
              >
                <span>{unitType}</span>
                {value === unitType && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))
          ) : (
            <span className="px-4 py-3 text-sm text-muted-foreground">
              No unit types available
            </span>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
