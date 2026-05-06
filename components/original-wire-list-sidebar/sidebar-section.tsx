"use client";

/**
 * Location section in the Original Wire List Sidebar.
 */

import { ChevronDown, ChevronRight, Check, X, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarItem } from "./sidebar-item";
import { SIDEBAR_COLUMNS } from "@/lib/original-wire-list-sidebar";
import type { 
  OriginalWireListSection,
  SidebarColumnVisibility,
} from "@/lib/original-wire-list-sidebar";

interface SidebarSectionProps {
  section: OriginalWireListSection;
  columnVisibility: SidebarColumnVisibility;
  activeRowId: string | null;
  onItemClick: (rowId: string, enhancedRowId?: string) => void;
  onToggleCollapse: () => void;
  /** Whether to show the table header (first section only) */
  showTableHeader?: boolean;
}

/**
 * Table header component showing "From" and "To" group headers with sub-headers.
 */
function SidebarTableHeader({ columnVisibility }: { columnVisibility: SidebarColumnVisibility }) {
  // Get visible columns by group
  const visibleFromColumns = SIDEBAR_COLUMNS.filter(
    col => col.group === "from" && columnVisibility[col.key]
  );
  const visibleToColumns = SIDEBAR_COLUMNS.filter(
    col => col.group === "to" && columnVisibility[col.key]
  );
  const showMatch = columnVisibility.match;
  
  // Don't render if no columns visible
  if (visibleFromColumns.length === 0 && visibleToColumns.length === 0) {
    return null;
  }
  
  return (
    <div className="border-b border-border bg-muted/50 sticky top-0 z-10">
      {/* Group header row */}
      <div className="flex text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
        {visibleFromColumns.length > 0 && (
          <div 
            className="flex-1 px-2 py-1 text-center border-r border-border/50"
            style={{ flex: visibleFromColumns.length }}
          >
            From
          </div>
        )}
        {visibleToColumns.length > 0 && (
          <div 
            className="flex-1 px-2 py-1 text-center"
            style={{ flex: visibleToColumns.length }}
          >
            To
          </div>
        )}
        {showMatch && (
          <div className="w-8 px-1 py-1 text-center" />
        )}
      </div>
      
      {/* Sub-header row (column names) */}
      <div className="flex text-[9px] font-medium text-muted-foreground">
        {visibleFromColumns.map(col => (
          <div key={col.key} className="flex-1 px-2 py-1 truncate text-center">
            {col.label}
          </div>
        ))}
        {visibleToColumns.map(col => (
          <div key={col.key} className="flex-1 px-2 py-1 truncate text-center">
            {col.label}
          </div>
        ))}
        {showMatch && (
          <div className="w-8 px-1 py-1" />
        )}
      </div>
    </div>
  );
}

export function SidebarSection({
  section,
  columnVisibility,
  activeRowId,
  onItemClick,
  onToggleCollapse,
  showTableHeader = false,
}: SidebarSectionProps) {
  const totalItems = section.items.length;
  const ChevronIcon = section.collapsed ? ChevronRight : ChevronDown;
  
  return (
    <div className="border-b border-border last:border-b-0">
      {/* Table header (only show for first section) */}
      {showTableHeader && <SidebarTableHeader columnVisibility={columnVisibility} />}
      {/* Section header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "hover:bg-accent/50 transition-colors",
          "text-left font-medium text-sm",
        )}
      >
        <ChevronIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 truncate">{section.label}</span>
        
        {/* Status counts */}
        <div className="flex items-center gap-1.5 text-xs">
          {section.matchedCount > 0 && (
            <span className="flex items-center gap-0.5 text-green-600">
              <Check className="h-3 w-3" />
              {section.matchedCount}
            </span>
          )}
          {section.hiddenCount > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <EyeOff className="h-3 w-3" />
              {section.hiddenCount}
            </span>
          )}
          {section.missingCount > 0 && (
            <span className="flex items-center gap-0.5 text-destructive">
              <X className="h-3 w-3" />
              {section.missingCount}
            </span>
          )}
          {section.mismatchCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {section.mismatchCount}
            </span>
          )}
        </div>
        
        <span className="text-xs text-muted-foreground tabular-nums">
          ({totalItems})
        </span>
      </button>
      
      {/* Section items - table-row layout with zebra striping */}
      {!section.collapsed && (
        <div className="border-t border-border/50">
          {section.items.map((item, index) => (
            <SidebarItem
              key={item.originalRowId}
              item={item}
              columnVisibility={columnVisibility}
              isActive={activeRowId === item.originalRowId || activeRowId === item.matchedEnhancedRowId}
              isEven={index % 2 === 0}
              onClick={() => onItemClick(item.originalRowId, item.matchedEnhancedRowId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
