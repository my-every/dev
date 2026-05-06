"use client";

/**
 * Wire List Floating Toolbar
 * 
 * Fixed bottom toolbar for the wire list sheet page with:
 * - Revision switcher (popover)
 * - Navigate to branding list
 * - Icon-only filter controls with hover labels
 * - Back button when navigating from branding
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Tag,
  GitBranch,
  Filter,
  Columns3,
  Download,
  RotateCcw,
  X,
  ArrowLeft,
  Gauge,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VisibilityState } from "@tanstack/react-table";
import type { IdentificationFilterKind, IdentificationFilterOption } from "@/lib/wiring-identification/types";
import type { GaugeSortOrder } from "@/lib/wiring-identification/gauge-filter";

// Revision type for the switcher
interface RevisionOption {
  version: string;
  displayVersion: string;
  date?: string;
  isCurrent?: boolean;
}

interface WireListFloatingToolbarProps {
  projectId: string;
  sheetSlug: string;
  sheetName: string;
  revisions?: RevisionOption[];
  currentRevision?: string;
  onRevisionChange?: (version: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedFilter: IdentificationFilterKind;
  filterOptions: IdentificationFilterOption[];
  onFilterChange: (filter: IdentificationFilterKind) => void;
  selectedGauge: string | null;
  gaugeSortOrder: GaugeSortOrder;
  onGaugeChange: (gauge: string | null) => void;
  onGaugeSortOrderChange: (order: GaugeSortOrder) => void;
  gaugeOptions?: string[];
  columnVisibility: VisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
  semanticColumns: Array<{ key: string; header: string; group: string; visible: boolean }>;
  onResetVisibility: () => void;
  onExport?: () => void;
  canExport?: boolean;
  filteredRows: number;
  totalRows: number;
  showBackButton?: boolean;
  backUrl?: string;
}

export function WireListFloatingToolbar({
  revisions = [],
  currentRevision,
  onRevisionChange,
  searchValue,
  onSearchChange,
  selectedFilter,
  filterOptions,
  onFilterChange,
  selectedGauge,
  gaugeSortOrder,
  onGaugeChange,
  onGaugeSortOrderChange,
  gaugeOptions = [],
  columnVisibility,
  setColumnVisibility,
  semanticColumns,
  onResetVisibility,

  filteredRows,
  totalRows,

}: WireListFloatingToolbarProps) {

  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  const hasActiveFilters = selectedFilter !== "default" || selectedGauge !== null || searchValue.length > 0;
  const activeFilterCount = [
    selectedFilter !== "default",
    selectedGauge !== null,
    searchValue.length > 0,
  ].filter(Boolean).length;


  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      >
        <div className="flex justify-center px-4 pb-5">
          <div className="pointer-events-auto max-w-max">
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="mb-2 rounded-xl border border-border bg-background shadow-lg p-4"
                >
                  <div className="relative min-w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search all columns..."
                      value={searchValue}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10 h-10 pr-9 text-sm"
                      autoFocus
                    />
                    {searchValue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => onSearchChange("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-xl border border-border bg-background shadow-lg">
              <div className="flex items-center gap-2.5 px-4 py-3">

                {revisions.length > 0 ? (
                  <Popover open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-10 gap-2 px-3">
                            <GitBranch className="h-5 w-5" />
                            <Badge variant="secondary" className="h-6 text-xs px-2">
                              {currentRevision || "Latest"}
                            </Badge>
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8}>Switch Revision</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="start" className="w-64 p-0">
                      <div className="p-3 border-b border-border">
                        <h4 className="font-medium text-sm">Revisions</h4>
                        <p className="text-xs text-muted-foreground">Select a revision to view</p>
                      </div>
                      <ScrollArea className="max-h-64">
                        <div className="p-2 flex flex-col gap-1">
                          {revisions.map((rev) => (
                            <button
                              key={rev.version}
                              onClick={() => {
                                onRevisionChange?.(rev.version);
                                setIsRevisionOpen(false);
                              }}
                              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${rev.isCurrent || rev.version === currentRevision ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`}
                            >
                              <div>
                                <span className="font-medium">{rev.displayVersion}</span>
                                {rev.date && <span className="ml-2 text-xs text-muted-foreground">{rev.date}</span>}
                              </div>
                              {(rev.isCurrent || rev.version === currentRevision) && (
                                <Badge variant="outline" className="h-5 text-xs">Current</Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0" disabled>
                        <GitBranch className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>No Revisions</TooltipContent>
                  </Tooltip>
                )}

                <div className="w-px h-8 bg-border mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isSearchOpen || searchValue ? "secondary" : "ghost"}
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Search</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={selectedFilter !== "default" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-10 w-10 p-0"
                        >
                          <Filter className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>Identify</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuLabel>Wire Identification</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {filterOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.kind}
                        checked={selectedFilter === option.kind}
                        onCheckedChange={() => onFilterChange(option.kind)}
                      >
                        {option.label}
                        {option.count !== undefined && (
                          <span className="ml-auto text-xs text-muted-foreground">({option.count})</span>
                        )}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={selectedGauge !== null ? "secondary" : "ghost"}
                          size="sm"
                          className="h-10 w-10 p-0"
                        >
                          <Gauge className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>Gauge Filter</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="center" className="w-48">
                    <DropdownMenuLabel>Filter by Gauge</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedGauge === null}
                      onCheckedChange={() => onGaugeChange(null)}
                    >
                      All Gauges
                    </DropdownMenuCheckboxItem>
                    {gaugeOptions.map((gauge) => (
                      <DropdownMenuCheckboxItem
                        key={gauge}
                        checked={selectedGauge === gauge}
                        onCheckedChange={() => onGaugeChange(gauge)}
                      >
                        {gauge}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Sort Order</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={gaugeSortOrder === "default"}
                      onCheckedChange={() => onGaugeSortOrderChange("default")}
                    >
                      Default
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={gaugeSortOrder === "smallest-first"}
                      onCheckedChange={() => onGaugeSortOrderChange("smallest-first")}
                    >
                      Smallest First
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={gaugeSortOrder === "largest-first"}
                      onCheckedChange={() => onGaugeSortOrderChange("largest-first")}
                    >
                      Largest First
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                          <Columns3 className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>Columns</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="center" className="w-56 max-h-80 overflow-auto">
                    {semanticColumns.length > 0 ? (
                      <>
                        {["from", "length", "to", "workflow"].map((group) => {
                          const groupColumns = semanticColumns.filter((c) => c.group === group);
                          if (groupColumns.length === 0) return null;
                          return (
                            <div key={group}>
                              <DropdownMenuLabel className="capitalize">{group} Section</DropdownMenuLabel>
                              {groupColumns.map((column) => (
                                <DropdownMenuCheckboxItem
                                  key={column.key}
                                  checked={columnVisibility[column.key] !== false}
                                  onCheckedChange={(checked) => {
                                    setColumnVisibility((prev) => ({ ...prev, [column.key]: checked }));
                                  }}
                                >
                                  {column.header}
                                </DropdownMenuCheckboxItem>
                              ))}
                              <DropdownMenuSeparator />
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No columns available
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onResetVisibility}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset to defaults
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-amber-600 hover:text-amber-700"
                        onClick={() => {
                          onSearchChange("");
                          onFilterChange("default");
                          onGaugeChange(null);
                          setIsSearchOpen(false);
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>Clear Filters ({activeFilterCount})</TooltipContent>
                  </Tooltip>
                )}

                <div className="w-px h-8 bg-border mx-0.5" />

           

                <div className="pl-3 pr-1 text-sm text-muted-foreground whitespace-nowrap font-medium">
                  {filteredRows === totalRows ? (
                    <span>{totalRows} rows</span>
                  ) : (
                    <span>{filteredRows} / {totalRows}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
