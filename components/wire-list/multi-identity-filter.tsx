"use client";

/**
 * Multi-Identity Filter Component
 * 
 * A dropdown that allows selecting multiple identification filters with:
 * - Toggle each filter on/off
 * - Reorder filters via drag-and-drop or up/down buttons
 * - Visual indication of filter order (numbered badges)
 * - Match counts for each filter
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  GripVertical,
  Layers,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MultiFilterEntry } from "@/hooks/use-multi-identity-filter";
import type { IdentificationFilterKind } from "@/lib/wiring-identification/types";

// ============================================================================
// Types
// ============================================================================

interface MultiIdentityFilterProps {
  /** Filter entries with order and state */
  filterEntries: MultiFilterEntry[];
  /** Toggle a filter */
  onToggle: (kind: IdentificationFilterKind) => void;
  /** Move filter up */
  onMoveUp: (kind: IdentificationFilterKind) => void;
  /** Move filter down */
  onMoveDown: (kind: IdentificationFilterKind) => void;
  /** Enable all filters */
  onEnableAll: () => void;
  /** Disable all filters */
  onDisableAll: () => void;
  /** Reset to default order */
  onReset: () => void;
  /** Enabled count */
  enabledCount: number;
  /** Available count */
  availableCount: number;
  /** Whether Blue Labels is available */
  hasBlueLabels?: boolean;
  /** Compact mode for toolbar */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MultiIdentityFilter({
  filterEntries,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEnableAll,
  onDisableAll,
  onReset,
  enabledCount,
  availableCount,
  hasBlueLabels = false,
  compact = false,
}: MultiIdentityFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get position of enabled filters for numbering
  const enabledFilters = filterEntries.filter(e => e.enabled && e.available);
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={enabledCount > 0 ? "default" : "outline"}
          size={compact ? "sm" : "default"}
          className="gap-2"
        >
          <Layers className="h-4 w-4" />
          {compact ? (
            enabledCount > 0 ? `${enabledCount} Filters` : "Filters"
          ) : (
            <>
              Multi-Filter
              {enabledCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {enabledCount}
                </Badge>
              )}
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="font-semibold text-sm">Multi-Identity Filter</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to default order</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={onEnableAll}
          >
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={onDisableAll}
          >
            Disable All
          </Button>
        </div>
        
        {/* Filter List */}
        <div className="max-h-[400px] overflow-y-auto py-1">
          {filterEntries.map((entry, index) => {
            const enabledIndex = enabledFilters.findIndex(e => e.kind === entry.kind);
            const isFirst = index === 0;
            const isLast = index === filterEntries.length - 1;
            
            return (
              <div
                key={entry.kind}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors ${
                  !entry.available ? "opacity-50" : ""
                }`}
              >
                {/* Reorder Controls */}
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => onMoveUp(entry.kind)}
                    disabled={isFirst || !entry.available}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => onMoveDown(entry.kind)}
                    disabled={isLast || !entry.available}
                  >
                    <ChevronDownIcon className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Grip Handle (visual indicator) */}
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                
                {/* Checkbox */}
                <Checkbox
                  id={`filter-${entry.kind}`}
                  checked={entry.enabled}
                  onCheckedChange={() => onToggle(entry.kind)}
                  disabled={!entry.available}
                  className="h-4 w-4"
                />
                
                {/* Label and Count */}
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`filter-${entry.kind}`}
                    className={`text-sm cursor-pointer ${
                      entry.enabled && entry.available ? "font-medium" : ""
                    } ${!entry.available ? "text-muted-foreground" : ""}`}
                  >
                    {entry.label}
                  </Label>
                </div>
                
                {/* Count Badge */}
                <Badge
                  variant={entry.enabled && entry.available ? "default" : "secondary"}
                  className="text-xs min-w-[2rem] justify-center"
                >
                  {entry.count}
                </Badge>
                
                {/* Order Number (when enabled) */}
                {entry.enabled && entry.available && enabledIndex >= 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 min-w-[20px] justify-center bg-secondary/20"
                  >
                    #{enabledIndex + 1}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Footer */}
        <div className="px-3 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {enabledCount} of {availableCount} filters enabled
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Use arrows to reorder. Order affects print output.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Inline Version for Print Modal Sidebar (TOC-style with visibility toggles)
// ============================================================================

interface MultiIdentityFilterInlineProps {
  filterEntries: MultiFilterEntry[];
  onToggle: (kind: IdentificationFilterKind) => void;
  onMoveUp: (kind: IdentificationFilterKind) => void;
  onMoveDown: (kind: IdentificationFilterKind) => void;
  enabledCount: number;
  availableCount: number;
}

export function MultiIdentityFilterInline({
  filterEntries,
  onToggle,
  onMoveUp,
  onMoveDown,
  enabledCount,
  availableCount,
}: MultiIdentityFilterInlineProps) {
  const enabledFilters = filterEntries.filter(e => e.enabled && e.available);
  const availableFilters = filterEntries.filter(e => e.available);
  
  return (
    <div className="space-y-2">
      {/* TOC-style table */}
      <div className="border rounded-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b text-[10px] font-semibold text-muted-foreground">
          <span className="w-5 text-center">#</span>
          <span className="flex-1">Section</span>
          <span className="w-10 text-center">Rows</span>
          <span className="w-6"></span>
        </div>
        
        {/* Section list */}
        <div className="max-h-[280px] overflow-y-auto">
          {availableFilters.map((entry, index) => {
            const enabledIndex = enabledFilters.findIndex(e => e.kind === entry.kind);
            const isFirst = index === 0;
            const isLast = index === availableFilters.length - 1;
            
            return (
              <div
                key={entry.kind}
                className={`flex items-center gap-1.5 px-2 py-1 border-b border-border/30 last:border-b-0 transition-colors ${
                  entry.enabled ? "bg-background" : "bg-muted/20 opacity-60"
                }`}
              >
                {/* Order number / Reorder controls */}
                <div className="w-5 flex flex-col items-center -my-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-3 w-3 p-0 hover:bg-muted"
                    onClick={() => onMoveUp(entry.kind)}
                    disabled={isFirst}
                  >
                    <ChevronUp className="h-2.5 w-2.5" />
                  </Button>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {entry.enabled && enabledIndex >= 0 ? enabledIndex + 1 : "-"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-3 w-3 p-0 hover:bg-muted"
                    onClick={() => onMoveDown(entry.kind)}
                    disabled={isLast}
                  >
                    <ChevronDownIcon className="h-2.5 w-2.5" />
                  </Button>
                </div>
                
                {/* Label */}
                <span
                  className={`flex-1 text-[11px] truncate cursor-pointer ${
                    entry.enabled ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => onToggle(entry.kind)}
                >
                  {entry.label}
                </span>
                
                {/* Row count */}
                <span className="w-10 text-center text-[10px] text-muted-foreground tabular-nums">
                  {entry.count > 0 ? entry.count : "-"}
                </span>
                
                {/* Visibility toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-6 p-0"
                  onClick={() => onToggle(entry.kind)}
                  title={entry.enabled ? "Hide section" : "Show section"}
                >
                  {entry.enabled ? (
                    <Eye className="h-3 w-3 text-secondary-foreground" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      
      <p className="text-[10px] text-muted-foreground">
        {enabledCount} of {availableCount} sections visible
      </p>
    </div>
  );
}

export default MultiIdentityFilter;
