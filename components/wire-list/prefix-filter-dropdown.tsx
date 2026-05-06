"use client";

/**
 * Prefix Filter Dropdown
 * 
 * Provides controls to filter wire list rows by device prefix combinations.
 * Shows "From Prefix -> To Prefix" selections with dynamic population
 * based on available data.
 */

import { useMemo } from "react";
import { ArrowRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import {
  extractFromPrefixes,
  getAvailableToPrefixes,
  countRowsWithPrefix,
} from "@/lib/wiring-identification/prefix-filter";

// ============================================================================
// Types
// ============================================================================

interface PrefixFilterDropdownProps {
  /** All rows (for counting) */
  rows: SemanticWireListRow[];
  /** Selected from prefix */
  fromPrefix: string | null;
  /** Selected to prefix */
  toPrefix: string | null;
  /** Callback when from prefix changes */
  onFromPrefixChange: (prefix: string | null) => void;
  /** Callback when to prefix changes */
  onToPrefixChange: (prefix: string | null) => void;
}

// ============================================================================
// Component
// ============================================================================

export function PrefixFilterDropdown({
  rows,
  fromPrefix,
  toPrefix,
  onFromPrefixChange,
  onToPrefixChange,
}: PrefixFilterDropdownProps) {
  // Get available from prefixes
  const fromPrefixes = useMemo(() => extractFromPrefixes(rows), [rows]);
  
  // Get available to prefixes (filtered by selected from prefix)
  const toPrefixOptions = useMemo(
    () => getAvailableToPrefixes(rows, fromPrefix),
    [rows, fromPrefix]
  );
  
  // Get count for current selection
  const matchCount = useMemo(
    () => countRowsWithPrefix(rows, fromPrefix, toPrefix),
    [rows, fromPrefix, toPrefix]
  );
  
  // Check if filter is active
  const isActive = fromPrefix !== null || toPrefix !== null;
  
  // Build display label
  const filterLabel = useMemo(() => {
    if (!isActive) return "Device Filter";
    
    const from = fromPrefix || "All";
    const to = toPrefix || "All";
    return `${from} -> ${to}`;
  }, [isActive, fromPrefix, toPrefix]);
  
  // Clear both selections
  const handleClear = () => {
    onFromPrefixChange(null);
    onToPrefixChange(null);
  };
  
  // When from changes, clear to if it's no longer valid
  const handleFromChange = (value: string) => {
    const newFrom = value === "all" ? null : value;
    onFromPrefixChange(newFrom);
    
    // Check if current toPrefix is still valid
    if (toPrefix && newFrom) {
      const availableTo = getAvailableToPrefixes(rows, newFrom);
      const stillValid = availableTo.some(p => p.prefix === toPrefix);
      if (!stillValid) {
        onToPrefixChange(null);
      }
    }
  };
  
  const handleToChange = (value: string) => {
    onToPrefixChange(value === "all" ? null : value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {filterLabel}
          {isActive && (
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
              {matchCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Filter by Device Prefix</span>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleClear}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                From Device
              </label>
              <Select
                value={fromPrefix || "all"}
                onValueChange={handleFromChange}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  {fromPrefixes.map(prefix => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex h-9 items-center justify-center px-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                To Device
              </label>
              <Select
                value={toPrefix || "all"}
                onValueChange={handleToChange}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  {toPrefixOptions.map(({ prefix, count }) => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Match count indicator */}
          {isActive && (
            <div className="pt-2 border-t text-center">
              <span className="text-sm text-muted-foreground">
                {matchCount} matching {matchCount === 1 ? "row" : "rows"}
              </span>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
