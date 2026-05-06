"use client";

/**
 * Gauge Size Filter Dropdown
 * 
 * Provides controls to filter and sort wire list rows by gauge/wire size.
 * - Filter by specific gauge size
 * - Sort by smallest to largest (or vice versa)
 */

import { useMemo } from "react";
import { Gauge, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  extractGaugeSizes,
  countRowsWithGauge,
  type GaugeSortOrder,
} from "@/lib/wiring-identification/gauge-filter";

// ============================================================================
// Types
// ============================================================================

interface GaugeFilterDropdownProps {
  /** All rows (for extracting gauge options) */
  rows: SemanticWireListRow[];
  /** Selected gauge size filter */
  selectedGauge: string | null;
  /** Sort order for gauge sizes */
  sortOrder: GaugeSortOrder;
  /** Callback when gauge filter changes */
  onGaugeChange: (gauge: string | null) => void;
  /** Callback when sort order changes */
  onSortOrderChange: (order: GaugeSortOrder) => void;
}

// ============================================================================
// Component
// ============================================================================

export function GaugeFilterDropdown({
  rows,
  selectedGauge,
  sortOrder,
  onGaugeChange,
  onSortOrderChange,
}: GaugeFilterDropdownProps) {
  // Get available gauge sizes
  const gaugeSizes = useMemo(() => extractGaugeSizes(rows), [rows]);
  
  // Get count for current selection
  const matchCount = useMemo(
    () => countRowsWithGauge(rows, selectedGauge),
    [rows, selectedGauge]
  );
  
  // Check if any filter/sort is active
  const isActive = selectedGauge !== null || sortOrder !== "default";
  
  // Build display label
  const filterLabel = useMemo(() => {
    if (selectedGauge) {
      return `${selectedGauge} AWG`;
    }
    if (sortOrder !== "default") {
      return sortOrder === "smallest-first" ? "Small → Large" : "Large → Small";
    }
    return "Gauge";
  }, [selectedGauge, sortOrder]);
  
  // Get sort icon
  const SortIcon = useMemo(() => {
    if (sortOrder === "smallest-first") return ArrowDown;
    if (sortOrder === "largest-first") return ArrowUp;
    return ArrowUpDown;
  }, [sortOrder]);
  
  // Clear all selections
  const handleClear = () => {
    onGaugeChange(null);
    onSortOrderChange("default");
  };
  
  const handleGaugeChange = (value: string) => {
    onGaugeChange(value === "all" ? null : value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          <Gauge className="h-4 w-4" />
          {filterLabel}
          {selectedGauge && (
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
              {matchCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Gauge / Wire Size</span>
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
        
        <div className="p-3 space-y-4">
          {/* Gauge Size Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Filter by Size
            </label>
            <Select
              value={selectedGauge || "all"}
              onValueChange={handleGaugeChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sizes</SelectItem>
                {gaugeSizes.map(({ value, count }) => (
                  <SelectItem key={value} value={value}>
                    {value} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Sort Order */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <SortIcon className="h-3 w-3" />
              Sort Order
            </label>
            <DropdownMenuRadioGroup
              value={sortOrder}
              onValueChange={(value) => onSortOrderChange(value as GaugeSortOrder)}
            >
              <div className="space-y-1">
                <DropdownMenuRadioItem 
                  value="default" 
                  className="cursor-pointer rounded-md border border-transparent px-3 py-2 hover:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <span>Default (by location)</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem 
                  value="smallest-first"
                  className="cursor-pointer rounded-md border border-transparent px-3 py-2 hover:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span>Smallest first</span>
                      <span className="text-xs text-muted-foreground ml-1">(20, 18, 16...)</span>
                    </div>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem 
                  value="largest-first"
                  className="cursor-pointer rounded-md border border-transparent px-3 py-2 hover:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span>Largest first</span>
                      <span className="text-xs text-muted-foreground ml-1">(10, 12, 14...)</span>
                    </div>
                  </div>
                </DropdownMenuRadioItem>
              </div>
            </DropdownMenuRadioGroup>
          </div>
          
          {/* Match count indicator */}
          {selectedGauge && (
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
