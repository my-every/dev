"use client";

/**
 * Table-row based nav item for the Original Wire List Sidebar.
 * Displays wire data in a compact table row format similar to the main wire list.
 */

import { Check, X, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { 
  OriginalWireListNavItem, 
  SidebarColumnVisibility,
  OriginalRowMatchState,
} from "@/lib/original-wire-list-sidebar";

interface SidebarItemProps {
  item: OriginalWireListNavItem;
  columnVisibility: SidebarColumnVisibility;
  isActive: boolean;
  isEven: boolean;
  onClick: () => void;
}

/**
 * Get the match state icon and styling.
 */
function getMatchStateDisplay(state: OriginalRowMatchState) {
  switch (state) {
    case "matched":
      return {
        icon: Check,
        className: "text-green-600",
        bgClassName: "",
        label: "Visible",
      };
    case "hidden":
      return {
        icon: EyeOff,
        className: "text-muted-foreground",
        bgClassName: "bg-muted/30",
        label: "Hidden by filter",
      };
    case "missing":
      return {
        icon: X,
        className: "text-destructive",
        bgClassName: "bg-destructive/5",
        label: "Missing",
      };
    case "mismatch":
      return {
        icon: AlertTriangle,
        className: "text-amber-500",
        bgClassName: "bg-amber-50",
        label: "Mismatch",
      };
  }
}

/**
 * Count visible columns to determine layout.
 */
function countVisibleColumns(visibility: SidebarColumnVisibility): number {
  const keys: (keyof SidebarColumnVisibility)[] = [
    "fromDeviceId", "wireNo", "gaugeSize", "toDeviceId", 
    "wireType", "wireId", "fromPageZone", "toPageZone", "location"
  ];
  return keys.filter(k => visibility[k]).length;
}

function getGreenChangeBadge(changeType?: "added" | "deleted" | "changed") {
  if (changeType === "added") {
    return {
      label: "Added",
      className: "border-green-300 bg-green-50 text-green-700",
    };
  }

  if (changeType === "deleted") {
    return {
      label: "Deleted",
      className: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (changeType === "changed") {
    return {
      label: "Changed",
      className: "border-amber-300 bg-amber-50 text-amber-700",
    };
  }

  return null;
}

export function SidebarItem({ 
  item, 
  columnVisibility, 
  isActive,
  isEven,
  onClick,
}: SidebarItemProps) {
  const matchDisplay = getMatchStateDisplay(item.matchState);
  const MatchIcon = matchDisplay.icon;
  const visibleCount = countVisibleColumns(columnVisibility);
  const needsHorizontalScroll = visibleCount > 4;
  const greenChangeBadge = getGreenChangeBadge(item.greenChangeType);
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left transition-colors",
        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30",
        // Zebra striping
        isEven ? "bg-muted/40" : "bg-background",
        // Active state
        isActive && "ring-2 ring-inset ring-primary/50 bg-primary/10",
        // Match state background
        matchDisplay.bgClassName,
        // Spacing between items
        "mb-0.5",
      )}
    >
      <div 
        className={cn(
          "flex items-center gap-0 text-xs",
          needsHorizontalScroll && "overflow-x-auto"
        )}
      >
        {/* Match status cell */}
        {columnVisibility.match && (
          <div className={cn(
            "flex-shrink-0 w-8 h-8 flex items-center justify-center border-r border-border/50",
            matchDisplay.className
          )}>
            <MatchIcon className="h-3.5 w-3.5" />
          </div>
        )}
        
        {/* From Device ID */}
        {columnVisibility.fromDeviceId && (
          <div className="flex-shrink-0 w-24 px-2 py-1.5 border-r border-border/50 truncate font-medium">
            {item.fromDeviceId || "-"}
          </div>
        )}
        
        {/* Wire No */}
        {columnVisibility.wireNo && (
          <div className="flex-shrink-0 w-20 px-2 py-1.5 border-r border-border/50 truncate text-muted-foreground">
            {item.wireNo || "-"}
          </div>
        )}
        
        {/* Gauge/Size */}
        {columnVisibility.gaugeSize && (
          <div className="flex-shrink-0 w-12 px-2 py-1.5 border-r border-border/50 text-center text-muted-foreground">
            {item.gaugeSize || "-"}
          </div>
        )}
        
        {/* Wire Type */}
        {columnVisibility.wireType && (
          <div className="flex-shrink-0 w-12 px-2 py-1.5 border-r border-border/50 text-center text-muted-foreground text-[10px]">
            {item.wireType || "-"}
          </div>
        )}
        
        {/* Wire ID */}
        {columnVisibility.wireId && (
          <div className="flex-shrink-0 w-14 px-2 py-1.5 border-r border-border/50 truncate text-muted-foreground">
            {item.wireId || "-"}
          </div>
        )}
        
        {/* From Page/Zone */}
        {columnVisibility.fromPageZone && (
          <div className="flex-shrink-0 w-16 px-2 py-1.5 border-r border-border/50 truncate text-muted-foreground text-[10px]">
            {item.fromPageZone || "-"}
          </div>
        )}
        
        {/* To Device ID */}
        {columnVisibility.toDeviceId && (
          <div className="flex-shrink-0 w-24 px-2 py-1.5 border-r border-border/50 truncate font-medium">
            {item.toDeviceId || "-"}
          </div>
        )}
        
        {/* To Page/Zone */}
        {columnVisibility.toPageZone && (
          <div className="flex-shrink-0 w-16 px-2 py-1.5 border-r border-border/50 truncate text-muted-foreground text-[10px]">
            {item.toPageZone || "-"}
          </div>
        )}
        
        {/* Location */}
        {columnVisibility.location && (
          <div className="flex-shrink-0 w-20 px-2 py-1.5 truncate text-muted-foreground">
            {item.location || "-"}
          </div>
        )}
        
        {/* Spacer for remaining space on wider screens */}
        {!needsHorizontalScroll && <div className="flex-1" />}
      </div>
      
      {/* Mismatch indicator - shown below the row */}
      {item.matchState === "mismatch" && item.mismatchFields && (
        <div className="px-2 py-0.5 text-[10px] text-amber-600 bg-amber-50 border-t border-amber-200">
          Differs: {item.mismatchFields.join(", ")}
        </div>
      )}

      {greenChangeBadge && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border/70 px-2 py-1">
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold", greenChangeBadge.className)}>
            {greenChangeBadge.label}
          </span>
          {item.assignmentStageLabel && (
            <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
              {item.assignmentStageLabel}
            </span>
          )}
          {item.location && (
            <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {item.location}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
