"use client";

/**
 * Identification Filter Dropdown
 * 
 * Dropdown component for selecting identification filters.
 * Displays available filters with counts and applies the selected filter.
 */

import { Filter, Info, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { IdentificationFilterKind, IdentificationFilterOption } from "@/lib/wiring-identification/types";

// ============================================================================
// Types
// ============================================================================

interface IdentificationFilterDropdownProps {
  /** Currently selected filter */
  selectedFilter: IdentificationFilterKind;
  /** Available filter options */
  filterOptions: IdentificationFilterOption[];
  /** Callback when filter changes */
  onFilterChange: (filter: IdentificationFilterKind) => void;
  /** Whether Blue Labels is available */
  hasBlueLabels: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function IdentificationFilterDropdown({
  selectedFilter,
  filterOptions,
  onFilterChange,
  hasBlueLabels,
}: IdentificationFilterDropdownProps) {
  // Find the currently selected option
  const selectedOption = filterOptions.find(opt => opt.kind === selectedFilter);
  const isFiltered = selectedFilter !== "default";
  
  // Separate default from other filters
  const defaultOption = filterOptions.find(opt => opt.kind === "default");
  const otherOptions = filterOptions.filter(opt => opt.kind !== "default");
  
  // Group options
  const basicFilters = otherOptions.filter(opt => !opt.requiresBlueLabels);
  const advancedFilters = otherOptions.filter(opt => opt.requiresBlueLabels);

  return (
    <TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={isFiltered ? "default" : "outline"} 
            size="sm" 
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {isFiltered ? selectedOption?.label : "Identify"}
            {isFiltered && selectedOption && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {selectedOption.count}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Identification Filters
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Default option */}
          {defaultOption && (
            <DropdownMenuItem
              onClick={() => onFilterChange("default")}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                {selectedFilter === "default" && <Check className="h-4 w-4" />}
                <span className={selectedFilter === "default" ? "font-medium" : ""}>
                  {defaultOption.label}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {defaultOption.count}
              </span>
            </DropdownMenuItem>
          )}
          
          {/* Basic filters */}
          {basicFilters.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Pattern Filters
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {basicFilters.map(option => (
                  <FilterMenuItem
                    key={option.kind}
                    option={option}
                    isSelected={selectedFilter === option.kind}
                    onClick={() => onFilterChange(option.kind)}
                  />
                ))}
              </DropdownMenuGroup>
            </>
          )}
          
          {/* Advanced filters (require Blue Labels) */}
          {advancedFilters.length > 0 && hasBlueLabels && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                <span>Sequence-Aware</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">
                      These filters use Blue Labels sequence data to identify
                      device adjacency patterns.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {advancedFilters.map(option => (
                  <FilterMenuItem
                    key={option.kind}
                    option={option}
                    isSelected={selectedFilter === option.kind}
                    onClick={() => onFilterChange(option.kind)}
                  />
                ))}
              </DropdownMenuGroup>
            </>
          )}
          
          {/* No Blue Labels hint */}
          {!hasBlueLabels && otherOptions.some(opt => opt.requiresBlueLabels) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <Info className="inline h-3 w-3 mr-1" />
                Additional filters available with Blue Labels data
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

// ============================================================================
// Filter Menu Item
// ============================================================================

interface FilterMenuItemProps {
  option: IdentificationFilterOption;
  isSelected: boolean;
  onClick: () => void;
}

function FilterMenuItem({ option, isSelected, onClick }: FilterMenuItemProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenuItem
            onClick={onClick}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {isSelected && <Check className="h-4 w-4" />}
              {!isSelected && <span className="w-4" />}
              <span className={isSelected ? "font-medium" : ""}>
                {option.label}
              </span>
            </span>
            <Badge 
              variant={isSelected ? "default" : "secondary"} 
              className="text-xs min-w-[2rem] justify-center"
            >
              {option.count}
            </Badge>
          </DropdownMenuItem>
        </TooltipTrigger>
        {option.description && (
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs">{option.description}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export default IdentificationFilterDropdown;
