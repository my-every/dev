"use client";

import { FullScreenSearch } from "./full-screen-search";
import { RelayPluginJumperRuns } from "./relay-plugin-jumper-runs";
import { SemanticWireListShell } from "./semantic-wire-list-shell";
import { SemanticWireListTable } from "./semantic-wire-list-table";
import { SemanticWireListToolbar, type SemanticWireListToolbarOptions } from "./semantic-wire-list-toolbar";
import { WireListFloatingToolbar } from "./wire-list-floating-toolbar";
import { ALL_LOCATIONS, SEMANTIC_COLUMNS, useSemanticWireListViewModel } from "@/hooks/use-semantic-wire-list-view-model";
import type { GaugeSortOrder } from "@/lib/wiring-identification/gauge-filter";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import type { SemanticWireListRow, SheetMetadataInfo, WireListParserDiagnostics } from "@/lib/workbook/types";
import type { MultiFilterEntry, FilterGroup } from "@/hooks/use-multi-identity-filter";

export type ColumnOrderConfig = {
  [key: string]: number;
};

export interface WireListFeatureConfig {
  showFromCheckbox?: boolean;
  showToCheckbox?: boolean;
  showIPVCheckbox?: boolean;
  showComments?: boolean;
  showPartNumber?: boolean;
  showCheckboxColumns?: boolean;
  groupByLocation?: boolean;
  groupByFromDevice?: boolean;
  defaultGaugeSortOrder?: GaugeSortOrder;
  showLocationGroupHeader?: boolean;
  showDeviceGroupHeader?: boolean;
  hideLocationGroupHeaderWhenLocationColumnVisible?: boolean;
  stickyGroupHeaders?: boolean;
  /** Hide the From / To / Workflow grouped column header row */
  hideGroupedColumnHeaders?: boolean;
  // Print-specific options
  printMode?: boolean;
  printCheckboxVariant?: boolean;
  showLength?: boolean;
}

interface SemanticWireListProps {
  rows: SemanticWireListRow[];
  metadata?: SheetMetadataInfo;
  diagnostics?: WireListParserDiagnostics;
  title?: string;
  blueLabels?: BlueLabelSequenceMap | null;
  currentSheetName?: string;
  projectId?: string;
  sheetSlug?: string;
  featureConfig?: WireListFeatureConfig;
  initialColumnOrder?: ColumnOrderConfig;
  onColumnOrderChange?: (order: ColumnOrderConfig) => void;
  activeRowId?: string | null;
  /** Multi-filter entries for print mode (external control) */
  multiFilterEntries?: MultiFilterEntry[];
  /** Filter groups pre-computed for print mode */
  filterGroups?: FilterGroup[];
  /** Callback when multi-filter changes */
  onMultiFilterChange?: (entries: MultiFilterEntry[]) => void;
  /** Hide the toolbar (for print embedding) */
  hideToolbar?: boolean;
  /** Hide the footer (for print embedding) */
  hideFooter?: boolean;
  /** SWS type for the assignment */
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
  /** Show floating toolbar at bottom */
  showFloatingToolbar?: boolean;
  /** Render toolbar above or below the table shell */
  toolbarPlacement?: "top" | "bottom";
  /** Toggle individual toolbar controls */
  toolbarOptions?: SemanticWireListToolbarOptions;
  /** Hide the metadata panel above the table */
  hideMetadataPanel?: boolean;
  /** Tighter embedded layout spacing */
  compactSpacing?: boolean;
}

export function SemanticWireList({
  rows,
  metadata,
  diagnostics,
  title,
  blueLabels = null,
  currentSheetName = "",
  projectId,
  sheetSlug,
  featureConfig = {},
  activeRowId = null,
  multiFilterEntries,
  filterGroups,
  onMultiFilterChange,
  hideToolbar = false,
  hideFooter = false,
  swsType,
  showFloatingToolbar = false,
  toolbarPlacement = "top",
  toolbarOptions,
  hideMetadataPanel = false,
  compactSpacing = false,
}: SemanticWireListProps) {
  // Extract print mode from feature config
  const isPrintMode = featureConfig.printMode ?? false;
  const printCheckboxVariant = featureConfig.printCheckboxVariant ?? isPrintMode;
  const {
    config,
    displaySourceRows,
    groupConfig,
    selectedFilter,
    setSelectedFilter,
    filterMatchMetadata,
    filterOptions,
    hasBlueLabels,
    currentFilterMeta,
    wireNoSearchValue,
    setWireNoSearchValue,
    clearWireNoSearch,
    isWireNoSearchActive,
    setWireNoInputFocused,
    shouldShowWireNoHighlighting,
    wireNoMatchedRowIds,
    wireNoMatchCount,
    searchModeEnabled,
    toggleSearchMode,
    showFrom,
    showTo,
    showIPV,
    showComments,
    availableSemanticColumns,
    isLocationColumnVisible,
    fromPrefix,
    toPrefix,
    setFromPrefix,
    setToPrefix,
    selectedGauge,
    setSelectedGauge,
    gaugeSortOrder,
    setGaugeSortOrder,
    columnVisibility,
    setColumnVisibility,
    searchValue,
    setSearchValue,
    selectedLocation,
    setSelectedLocation,
    locations,
    locationFilteredRows,
    deviceGroups,
    appliedOrderingProfile,
    relayPluginJumperRuns,
    table,
    tableContainerRef,
    totalDisplayRows,
    locationDisplayRows,
    filteredDisplayRows,
    visibleColumnCount,
    handleResetVisibility,
    isFullScreenSearchOpen,
    setIsFullScreenSearchOpen,
    showDeviceSubheaders,
    setShowDeviceSubheaders,
    columnCounts: { fromCount, toCount, lengthCount, workflowCount },
    getRowLength,
    preFilteredRows,
    partNumberMap,
  } = useSemanticWireListViewModel({
    rows,
    blueLabels,
    currentSheetName,
    projectId,
    sheetSlug,
    featureConfig,
    activeRowId,
  });

  const toolbarContent = (
    <SemanticWireListToolbar
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
      selectedFilter={selectedFilter}
      filterOptions={filterOptions}
      onSelectedFilterChange={setSelectedFilter}
      hasBlueLabels={hasBlueLabels}
      prefixRows={locationFilteredRows}
      filterRows={preFilteredRows}
      fromPrefix={fromPrefix}
      toPrefix={toPrefix}
      onFromPrefixChange={setFromPrefix}
      onToPrefixChange={setToPrefix}
      selectedGauge={selectedGauge}
      gaugeSortOrder={gaugeSortOrder}
      onSelectedGaugeChange={setSelectedGauge}
      onGaugeSortOrderChange={setGaugeSortOrder}
      wireNoSearchValue={wireNoSearchValue}
      onWireNoSearchValueChange={setWireNoSearchValue}
      onClearWireNoSearch={clearWireNoSearch}
      wireNoMatchCount={wireNoMatchCount}
      locationDisplayRows={locationDisplayRows}
      isWireNoSearchActive={isWireNoSearchActive}
      searchModeEnabled={searchModeEnabled}
      onToggleSearchMode={toggleSearchMode}
      onWireNoInputFocusChange={setWireNoInputFocused}
      onOpenFullScreenSearch={() => setIsFullScreenSearchOpen(true)}
      rows={displaySourceRows}
      blueLabels={blueLabels}
      currentSheetName={currentSheetName}
      projectId={projectId}
      sheetSlug={sheetSlug}
      title={title}
      metadata={metadata}
      showFrom={showFrom}
      showTo={showTo}
      showIPV={showIPV}
      showComments={showComments}
      columnVisibility={columnVisibility}
      setColumnVisibility={setColumnVisibility}
      semanticColumns={availableSemanticColumns}
      onResetVisibility={handleResetVisibility}
      filteredDisplayRows={filteredDisplayRows}
      showDeviceSubheaders={showDeviceSubheaders}
      onShowDeviceSubheadersChange={setShowDeviceSubheaders}
      getRowLength={getRowLength}
      swsType={swsType}
      options={toolbarOptions}
    />
  );

  return (
    <SemanticWireListShell
      metadata={metadata}
      diagnostics={diagnostics}
      locations={locations}
      selectedLocation={selectedLocation}
      allLocationsLabel={ALL_LOCATIONS}
      totalDisplayRows={totalDisplayRows}
      onLocationChange={setSelectedLocation}
      hideToolbar={hideToolbar || isPrintMode || toolbarPlacement === "bottom"}
      hideFooter={hideFooter || isPrintMode}
      hideLocationTabs={isPrintMode}
      hideMetadataPanel={hideMetadataPanel}
      compactSpacing={compactSpacing}
      toolbar={toolbarPlacement === "top" ? toolbarContent : null}
      relayPluginRuns={
        selectedFilter === "ka_relay_plugin_jumpers" && relayPluginJumperRuns.length > 0 ? (
          <RelayPluginJumperRuns runs={relayPluginJumperRuns} className="mb-4" />
        ) : undefined
      }
      table={
        <SemanticWireListTable
          table={table}
          tableContainerRef={tableContainerRef}
          locationFilteredRows={locationFilteredRows}
          currentSheetName={currentSheetName}
          selectedFilter={selectedFilter}
          matchMetadata={filterMatchMetadata}
          groupConfig={groupConfig}
          groupByLocation={Boolean(config.groupByLocation)}
          showLocationGroupHeader={false}
          hasDeviceOrdering={Boolean(appliedOrderingProfile)}
          showDeviceGroupHeader={showDeviceSubheaders}
          deviceGroups={deviceGroups}
          fromCount={fromCount}
          toCount={toCount}
          lengthCount={lengthCount}
          workflowCount={workflowCount}
          visibleColumnCount={visibleColumnCount}
          partNumberMap={partNumberMap}
          wireNoMatchedRowIds={wireNoMatchedRowIds}
          shouldShowWireNoHighlighting={shouldShowWireNoHighlighting}
          activeRowId={activeRowId}
          isWireNoSearchActive={isWireNoSearchActive}
          wireNoMatchCount={wireNoMatchCount}
          wireNoSearchValue={wireNoSearchValue}
          printMode={isPrintMode}
          printCheckboxVariant={printCheckboxVariant}
          filterGroups={filterGroups}
          hideGroupedColumnHeaders={Boolean(config.hideGroupedColumnHeaders)}
        />
      }
      footer={
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {toolbarPlacement === "bottom" ? (
            <div className="min-w-0 flex-1">
              {toolbarContent}
            </div>
          ) : null}
          <div className="flex items-center justify-between text-xs text-muted-foreground xl:justify-end xl:gap-6">
            <span>
              Showing {visibleColumnCount} of {availableSemanticColumns.length} columns
              {selectedFilter !== "default" && <span className="ml-2 text-secondary-foreground">({currentFilterMeta.label})</span>}
              {(fromPrefix || toPrefix) && (
                <span className="ml-2 text-secondary-foreground">({fromPrefix || "All"} -&gt; {toPrefix || "All"})</span>
              )}
              {selectedGauge && <span className="ml-2 text-secondary-foreground">(Gauge: {selectedGauge})</span>}
              {gaugeSortOrder !== "default" && (
                <span className="ml-2 text-secondary-foreground">
                  ({gaugeSortOrder === "smallest-first" ? "Small→Large" : "Large→Small"})
                </span>
              )}
              {appliedOrderingProfile && <span className="ml-2 text-secondary-foreground">({appliedOrderingProfile.label} order)</span>}
            </span>
            <span>
              {selectedLocation !== ALL_LOCATIONS && <span className="mr-2 text-secondary-foreground">{selectedLocation}</span>}
              {filteredDisplayRows === locationDisplayRows
                ? `${locationDisplayRows} rows`
                : `${filteredDisplayRows} of ${locationDisplayRows} rows`}
              {(selectedFilter !== "default" || fromPrefix || toPrefix || selectedGauge || gaugeSortOrder !== "default") &&
                ` of ${totalDisplayRows} total`}
            </span>
          </div>
        </div>
      }
      fullScreenSearch={
        isFullScreenSearchOpen ? (
          <FullScreenSearch
            rows={displaySourceRows}
            isOpen={isFullScreenSearchOpen}
            onClose={() => setIsFullScreenSearchOpen(false)}
            sheetName={currentSheetName || title}
          />
        ) : null
      }
      floatingToolbar={
        showFloatingToolbar && projectId && sheetSlug ? (
          <WireListFloatingToolbar
            projectId={projectId}
            sheetSlug={sheetSlug}
            sheetName={currentSheetName || title || ""}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            selectedFilter={selectedFilter}
            filterOptions={filterOptions}
            onFilterChange={setSelectedFilter}
            selectedGauge={selectedGauge}
            gaugeSortOrder={gaugeSortOrder}
            onGaugeChange={setSelectedGauge}
            onGaugeSortOrderChange={setGaugeSortOrder}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            semanticColumns={availableSemanticColumns}
            onResetVisibility={handleResetVisibility}
            filteredRows={filteredDisplayRows}
            totalRows={totalDisplayRows}
          />
        ) : null
      }
    />
  );
}
