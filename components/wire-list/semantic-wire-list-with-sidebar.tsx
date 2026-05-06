"use client";

/**
 * Wrapper component that combines SemanticWireList with OriginalWireListSidebar.
 * 
 * This provides the comparison/navigation layer without modifying the core wire list.
 * 
 * Responsive behavior:
 * - Desktop: Sidebar appears as side panel
 * - Mobile: Sidebar becomes full-screen drawer with backdrop
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SemanticWireList,
  type WireListFeatureConfig,
  type ColumnOrderConfig,
} from "./semantic-wire-list";
import { OriginalWireListSidebar } from "@/components/original-wire-list-sidebar/original-wire-list-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SemanticWireListRow, SheetMetadataInfo, WireListParserDiagnostics } from "@/lib/workbook/types";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import type { SemanticWireListToolbarOptions } from "./semantic-wire-list-toolbar";

interface SemanticWireListWithSidebarProps {
  /** Semantic wire list rows */
  rows: SemanticWireListRow[];
  /** Extracted metadata from preamble */
  metadata?: SheetMetadataInfo;
  /** Parser diagnostics for debugging */
  diagnostics?: WireListParserDiagnostics;
  /** Optional title */
  title?: string;
  /** Blue Labels sequence map for identification filters */
  blueLabels?: BlueLabelSequenceMap | null;
  /** Current sheet name (for internal/external detection) */
  currentSheetName?: string;
  /** Project ID for state persistence */
  projectId?: string;
  /** Sheet slug for state persistence */
  sheetSlug?: string;
  /** Feature configuration */
  featureConfig?: WireListFeatureConfig;
  /** Initial column order configuration */
  initialColumnOrder?: ColumnOrderConfig;
  /** Callback when column order changes (for persistence) */
  onColumnOrderChange?: (order: ColumnOrderConfig) => void;
  /** Show sidebar by default */
  showSidebar?: boolean;
  /** SWS type for the assignment */
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
  /** Show floating toolbar at bottom */
  showFloatingToolbar?: boolean;
  /** Automatically sync the sidebar open state to the current screen size */
  autoSyncSidebarWithDeviceSize?: boolean;
  /** Render the semantic toolbar at the top or bottom of the workspace */
  toolbarPlacement?: "top" | "bottom";
  /** Toggle individual toolbar controls */
  toolbarOptions?: SemanticWireListToolbarOptions;
  /** Hide the metadata panel above the wire list */
  hideMetadataPanel?: boolean;
  /** Remove outer gaps for embedded layouts */
  compactSpacing?: boolean;
}

export function SemanticWireListWithSidebar({
  rows,
  metadata,
  diagnostics,
  title,
  blueLabels = null,
  currentSheetName = "",
  projectId = "",
  sheetSlug = "",
  featureConfig,
  initialColumnOrder,
  onColumnOrderChange,
  showSidebar: initialShowSidebar = false,
  swsType,
  showFloatingToolbar = false,
  autoSyncSidebarWithDeviceSize = false,
  toolbarPlacement = "top",
  toolbarOptions,
  hideMetadataPanel = false,
  compactSpacing = false,
}: SemanticWireListWithSidebarProps) {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!initialShowSidebar);
  // Active row ID drives both the outline in the table and the sidebar's scroll-to logic
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  // Track mount state to prevent state updates before mount
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!autoSyncSidebarWithDeviceSize) {
      return;
    }

    setSidebarCollapsed(isMobile);
  }, [autoSyncSidebarWithDeviceSize, isMobile]);
  
  // Track visible row IDs (all rows are considered visible for matching purposes)
  const visibleEnhancedRowIds = useMemo(() => {
    return new Set(rows.map(r => r.__rowId));
  }, [rows]);
  
  // When the sidebar nav item is clicked, set the active row and let
  // SemanticWireList's own useEffect scroll it into view.
  // Active state persists until user clicks elsewhere.
  const handleScrollToRow = useCallback((rowId: string) => {
    setActiveRowId(rowId);
  }, []);
  
  // Clear active row when clicking anywhere in the main content area
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Don't clear if clicking on the row itself or sidebar
    const target = e.target as HTMLElement;
    if (target.closest("[data-row-id]") || target.closest("[data-sidebar]")) {
      return;
    }
    setActiveRowId(null);
  }, []);
  
  // Don't mount child list components until after the first client commit.
  // The previous branch still rendered SemanticWireList here, which caused an
  // immediate mount swap and could trigger async updates against an unmounted tree.
  if (!isMounted) {
    return (
      <div className="flex h-full relative gap-4">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-[70vh] rounded-xl border border-foreground/30 bg-background" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={compactSpacing ? "flex h-full min-h-0 relative gap-0" : "flex h-full min-h-0 relative gap-4"}>
      {/* Original Wire List Sidebar - renders as drawer on mobile */}
      {!sidebarCollapsed && (
        <OriginalWireListSidebar
          originalRows={rows}
          enhancedRows={rows}
          visibleEnhancedRowIds={visibleEnhancedRowIds}
          projectId={projectId}
          sheetName={currentSheetName || sheetSlug}
          onScrollToRow={handleScrollToRow}
          collapsed={false}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}
      
      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col" onClick={handleContentClick}>
        {/* Sidebar toggle button (when collapsed on desktop, or always on mobile) */}
        {(sidebarCollapsed || isMobile) && (
          <div className={compactSpacing ? "border-b px-4 py-3" : "mb-4 flex-shrink-0"}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarCollapsed(false)}
              className="gap-2"
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Show Original</span>
              <span className="sm:hidden">Original</span>
            </Button>
          </div>
        )}
        
        <SemanticWireList
          rows={rows}
          metadata={metadata}
          diagnostics={diagnostics}
          title={title}
          blueLabels={blueLabels}
          currentSheetName={currentSheetName}
          projectId={projectId}
          sheetSlug={sheetSlug}
          featureConfig={featureConfig}
          activeRowId={activeRowId}
          swsType={swsType}
          showFloatingToolbar={showFloatingToolbar}
          toolbarPlacement={toolbarPlacement}
          toolbarOptions={toolbarOptions}
          hideMetadataPanel={hideMetadataPanel}
          compactSpacing={compactSpacing}
        />
      </div>
    </div>
  );
}
