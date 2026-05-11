"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleSelect = useCallback(
    (unitType: string) => {
      onSelect(unitType);
      setOpen(false);
      setShowCustomInput(false);
      setCustomValue("");
    },
    [onSelect]
  );

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customValue.trim().toUpperCase();
    if (trimmed) {
      handleSelect(trimmed);
    }
  }, [customValue, handleSelect]);

  if (disabled) {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {value || "—"}
      </Badge>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setShowCustomInput(false);
        setCustomValue("");
      }
    }}>
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
          <DrawerDescription className="sr-only">
            Choose a unit type for this assignment
          </DrawerDescription>
        </DrawerHeader>
        <div 
          role="listbox" 
          aria-label="Select unit type"
          className="flex flex-col px-4 pb-6 gap-1 max-h-[60vh] overflow-y-auto"
        >
          {/* Custom input section */}
          {showCustomInput ? (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCustomSubmit();
                  }
                }}
                placeholder="Enter custom unit type"
                autoFocus
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-mono rounded-lg border",
                  "bg-background focus:outline-none focus:ring-2 focus:ring-ring",
                  "min-h-[44px]"
                )}
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "min-h-[44px]"
                )}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-left text-sm rounded-lg mb-2",
                "border border-dashed border-muted-foreground/50",
                "hover:bg-muted active:bg-muted transition-colors",
                "focus:outline-none focus:bg-muted",
                "min-h-[44px] text-muted-foreground"
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Add custom unit type</span>
            </button>
          )}

          {/* Existing options */}
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
