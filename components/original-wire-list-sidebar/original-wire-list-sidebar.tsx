"use client";

/**
 * Original Wire List Sidebar
 * 
 * A comparison + navigation layer that shows original extracted wire list rows
 * alongside the enhanced/filtered wire list. Helps verify that enhancements
 * and filters did not lose or distort data.
 * 
 * Responsive behavior:
 * - Desktop (md+): Side panel with 288px width
 * - Mobile: Full-screen drawer with backdrop overlay
 */

import { useState, useCallback, useEffect } from "react";
import { 
  Search, 
  X, 
  Columns3, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  History,
  Filter,
  Check,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarSection } from "./sidebar-section";
import { useOriginalWireListSidebar } from "@/hooks/use-original-wire-list-sidebar";
import { useOriginalWireListScrollspy } from "@/hooks/use-original-wire-list-scrollspy";
import { useOriginalWireListRecent } from "@/hooks/use-original-wire-list-recent";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  SIDEBAR_COLUMNS,
  type OriginalWireListSidebarProps,
  type SidebarColumnKey,
} from "@/lib/original-wire-list-sidebar";

export function OriginalWireListSidebar({
  originalRows,
  enhancedRows,
  visibleEnhancedRowIds,
  projectId,
  sheetName,
  onScrollToRow,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: OriginalWireListSidebarProps) {
  const isMobile = useIsMobile();
  
  // Internal collapsed state if not controlled
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  
  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile && !collapsed) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, collapsed]);
  
  // Main sidebar hook
  const sidebar = useOriginalWireListSidebar({
    originalRows,
    enhancedRows,
    visibleEnhancedRowIds,
    projectId,
    sheetName,
  });
  
  // Scrollspy hook
  const scrollspy = useOriginalWireListScrollspy({
    onScrollToRow,
  });
  
  // Recent navigation hook
  const recent = useOriginalWireListRecent({
    projectId,
    sheetName,
  });
  
  // Handle item click
  const handleItemClick = useCallback((originalRowId: string, enhancedRowId?: string) => {
    const item = sidebar.getNavItemByRowId(originalRowId);
    
    if (item) {
      // Add to recent
      recent.addRecent({
        rowId: originalRowId,
        wireNo: item.wireNo,
        fromDeviceId: item.fromDeviceId,
        toDeviceId: item.toDeviceId,
      });
      
      // Scroll to row if it exists and is visible
      if (enhancedRowId && item.matchState !== "missing") {
        scrollspy.scrollToRow(enhancedRowId);
      }
    }
  }, [sidebar, recent, scrollspy]);
  
  // Handle recent item click
  const handleRecentClick = useCallback((rowId: string) => {
    const item = sidebar.getNavItemByRowId(rowId);
    if (item?.matchedEnhancedRowId && item.matchState !== "missing") {
      scrollspy.scrollToRow(item.matchedEnhancedRowId);
    }
  }, [sidebar, scrollspy]);
  
  // Collapsed view (desktop only - mobile uses full close)
  if (collapsed && !isMobile) {
    return (
      <div className="w-10 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        {/* Vertical stats indicator */}
        <div className="mt-4 flex flex-col items-center gap-1 text-xs">
          <div className="flex items-center gap-0.5 text-green-600" title="Matched">
            <Check className="h-3 w-3" />
            <span>{sidebar.statistics.matched}</span>
          </div>
          {sidebar.statistics.missing > 0 && (
            <div className="flex items-center gap-0.5 text-destructive" title="Missing">
              <X className="h-3 w-3" />
              <span>{sidebar.statistics.missing}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // If collapsed on mobile, render nothing (parent shows toggle button)
  if (collapsed && isMobile) {
    return null;
  }
  
  // Mobile: Full-screen drawer with backdrop
  // Desktop: Side panel
  const sidebarContent = (
    <div 
      data-sidebar="original-wire-list"
      className={cn(
        "flex flex-col bg-background border-r border-border",
        // Mobile: full screen
        isMobile && "fixed inset-0 z-50 w-full h-full",
        // Desktop: side panel
        !isMobile && "w-72 flex-shrink-0 h-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">Original Wire List</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="h-7 w-7"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={sidebar.searchQuery}
            onChange={(e) => sidebar.setSearchQuery(e.target.value)}
            placeholder="Search original rows..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {sidebar.searchQuery && (
            <button
              onClick={sidebar.clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Recent */}
      {recent.recentItems.length > 0 && !sidebar.searchQuery && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Recent
            </span>
            <button
              onClick={recent.clearRecent}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="space-y-0.5">
            {recent.recentItems.slice(0, 5).map(item => (
              <button
                key={item.rowId}
                onClick={() => handleRecentClick(item.rowId)}
                className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent/50 truncate"
              >
                <span className="font-medium">{item.fromDeviceId}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span>{item.toDeviceId}</span>
                {item.wireNo && (
                  <span className="ml-1 text-muted-foreground">({item.wireNo})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">Visible Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SIDEBAR_COLUMNS.map(col => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={sidebar.columnVisibility[col.key]}
                onCheckedChange={() => sidebar.toggleColumn(col.key as SidebarColumnKey)}
                className="text-xs"
              >
                {col.label} ({col.group})
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              onClick={sidebar.resetColumnVisibility}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to defaults
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Match state filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">Show Match States</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={sidebar.matchStateFilters.matched}
              onCheckedChange={() => sidebar.toggleMatchStateFilter("matched")}
              className="text-xs"
            >
              <Check className="h-3 w-3 mr-1 text-green-600" />
              Matched ({sidebar.statistics.matched})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sidebar.matchStateFilters.hidden}
              onCheckedChange={() => sidebar.toggleMatchStateFilter("hidden")}
              className="text-xs"
            >
              <EyeOff className="h-3 w-3 mr-1 text-muted-foreground" />
              Hidden ({sidebar.statistics.hidden})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sidebar.matchStateFilters.missing}
              onCheckedChange={() => sidebar.toggleMatchStateFilter("missing")}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1 text-destructive" />
              Missing ({sidebar.statistics.missing})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sidebar.matchStateFilters.mismatch}
              onCheckedChange={() => sidebar.toggleMatchStateFilter("mismatch")}
              className="text-xs"
            >
              <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
              Mismatch ({sidebar.statistics.mismatch})
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              onClick={sidebar.resetMatchStateFilters}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Show all
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="flex-1" />
        
        {/* Statistics badge */}
        <div className="text-xs text-muted-foreground tabular-nums">
          {sidebar.statistics.matchPercentage}% matched
        </div>
      </div>
      
      {/* Sections */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {sidebar.sections.map((section, index) => (
            <SidebarSection
              key={section.location}
              section={section}
              columnVisibility={sidebar.columnVisibility}
              activeRowId={scrollspy.activeRowId}
              onItemClick={handleItemClick}
              onToggleCollapse={() => sidebar.toggleSectionCollapsed(section.location)}
              showTableHeader={index === 0}
            />
          ))}
          
          {sidebar.sections.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {sidebar.searchQuery 
                ? "No matching rows found" 
                : "No rows to display"
              }
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-border bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{sidebar.statistics.totalOriginal} original rows</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-green-600">
              <Check className="h-3 w-3" />
              {sidebar.statistics.matched}
            </span>
            {sidebar.statistics.hidden > 0 && (
              <span className="flex items-center gap-0.5">
                <EyeOff className="h-3 w-3" />
                {sidebar.statistics.hidden}
              </span>
            )}
            {sidebar.statistics.missing > 0 && (
              <span className="flex items-center gap-0.5 text-destructive">
                <X className="h-3 w-3" />
                {sidebar.statistics.missing}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  
  // On mobile, wrap with backdrop overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
        {sidebarContent}
      </>
    );
  }
  
  return sidebarContent;
}
