"use client";

import type { Dispatch, SetStateAction } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { Search, Columns3, RotateCcw, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IdentificationFilterDropdown } from "./identification-filter-dropdown";
import { PrefixFilterDropdown } from "./prefix-filter-dropdown";
import { GaugeFilterDropdown } from "./gauge-filter-dropdown";
import { WireNoSearch } from "./wire-no-search";
import { PrintModal } from "./print-modal";
import { MultiSheetPrintModal } from "./multi-sheet-print-modal";
import type { SemanticWireListRow, SheetMetadataInfo } from "@/lib/workbook/types";
import { wireListRowsToCSV, downloadWireListCSV } from "@/lib/workbook/types";
import { useSession } from "@/hooks/use-session";
import type { BlueLabelSequenceMap, IdentificationFilterKind, IdentificationFilterOption } from "@/lib/wiring-identification/types";
import type { GaugeSortOrder } from "@/lib/wiring-identification/gauge-filter";

export interface SemanticWireListToolbarOptions {
  showSearchInput?: boolean;
  showIdentifyFilter?: boolean;
  showDeviceFilter?: boolean;
  showGaugeFilter?: boolean;
  showWireNoSearch?: boolean;
  showSearchAll?: boolean;
  showPrint?: boolean;
  showMultiSheet?: boolean;
  showExport?: boolean;
  showCustomize?: boolean;
  showRowCount?: boolean;
}

interface SemanticWireListToolbarProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  selectedFilter: IdentificationFilterKind;
  filterOptions: IdentificationFilterOption[];
  onSelectedFilterChange: (filter: IdentificationFilterKind) => void;
  hasBlueLabels: boolean;
  prefixRows: SemanticWireListRow[];
  filterRows: SemanticWireListRow[];
  fromPrefix: string | null;
  toPrefix: string | null;
  onFromPrefixChange: (prefix: string | null) => void;
  onToPrefixChange: (prefix: string | null) => void;
  selectedGauge: string | null;
  gaugeSortOrder: GaugeSortOrder;
  onSelectedGaugeChange: (gauge: string | null) => void;
  onGaugeSortOrderChange: (order: GaugeSortOrder) => void;
  wireNoSearchValue: string;
  onWireNoSearchValueChange: (value: string) => void;
  onClearWireNoSearch: () => void;
  wireNoMatchCount: number;
  locationDisplayRows: number;
  isWireNoSearchActive: boolean;
  searchModeEnabled: boolean;
  onToggleSearchMode: () => void;
  onWireNoInputFocusChange: (focused: boolean) => void;
  onOpenFullScreenSearch: () => void;
  rows: SemanticWireListRow[];
  blueLabels: BlueLabelSequenceMap | null;
  currentSheetName: string;
  projectId?: string;
  sheetSlug?: string;
  title?: string;
  metadata?: SheetMetadataInfo;
  showFrom: boolean;
  showTo: boolean;
  showIPV: boolean;
  showComments: boolean;
  columnVisibility: VisibilityState;
  setColumnVisibility: Dispatch<SetStateAction<VisibilityState>>;
  semanticColumns: Array<{ key: string; header: string; group: string; visible: boolean }>;
  onResetVisibility: () => void;
  filteredDisplayRows: number;
  showDeviceSubheaders: boolean;
  onShowDeviceSubheadersChange: (show: boolean) => void;
  getRowLength?: (rowId: string) => { display: string; roundedInches: number; confidence: string } | null;
  /** SWS type for the assignment */
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
  options?: SemanticWireListToolbarOptions;
}

export function SemanticWireListToolbar({
  searchValue,
  onSearchValueChange,
  selectedFilter,
  filterOptions,
  onSelectedFilterChange,
  hasBlueLabels,
  prefixRows,
  filterRows,
  fromPrefix,
  toPrefix,
  onFromPrefixChange,
  onToPrefixChange,
  selectedGauge,
  gaugeSortOrder,
  onSelectedGaugeChange,
  onGaugeSortOrderChange,
  wireNoSearchValue,
  onWireNoSearchValueChange,
  onClearWireNoSearch,
  wireNoMatchCount,
  locationDisplayRows,
  isWireNoSearchActive,
  searchModeEnabled,
  onToggleSearchMode,
  onWireNoInputFocusChange,
  onOpenFullScreenSearch,
  rows,
  blueLabels,
  currentSheetName,
  projectId,
  sheetSlug,
  title,
  metadata,
  showFrom,
  showTo,
  showIPV,
  showComments,
  columnVisibility,
  setColumnVisibility,
  semanticColumns,
  onResetVisibility,
  filteredDisplayRows,
  showDeviceSubheaders,
  onShowDeviceSubheadersChange,
  getRowLength,
  swsType,
  options,
}: SemanticWireListToolbarProps) {
  const { hasRole } = useSession();
  const canExport = hasRole('BRANDER');
  const {
    showSearchInput = true,
    showIdentifyFilter = true,
    showDeviceFilter = true,
    showGaugeFilter = true,
    showWireNoSearch = true,
    showSearchAll = true,
    showPrint = true,
    showMultiSheet = true,
    showExport = true,
    showCustomize = true,
    showRowCount = true,
  } = options ?? {};
  
  // Handle CSV export
  const handleExportCSV = () => {
    if (rows.length === 0) return;
    
    const hasLength = Boolean(getRowLength);
    const csvContent = wireListRowsToCSV(
      rows, 
      currentSheetName || title,
      hasLength,
      getRowLength ? (rowId: string) => {
        const length = getRowLength(rowId);
        return length ? { display: length.display, roundedInches: length.roundedInches } : null;
      } : undefined
    );
    
    const sanitizedSheetName = (currentSheetName || title || 'wire-list').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `wirelist_${sanitizedSheetName}_${timestamp}.csv`;
    
    downloadWireListCSV(csvContent, filename);
  };
  
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {showSearchInput ? (
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all columns..."
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            className="pl-9"
          />
        </div>
      ) : (
        <div className="hidden sm:block sm:flex-1" />
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0">
        {showIdentifyFilter ? (
          <IdentificationFilterDropdown
            selectedFilter={selectedFilter}
            filterOptions={filterOptions}
            onFilterChange={onSelectedFilterChange}
            hasBlueLabels={hasBlueLabels}
          />
        ) : null}

        {showDeviceFilter ? (
          <PrefixFilterDropdown
            rows={filterRows}
            fromPrefix={fromPrefix}
            toPrefix={toPrefix}
            onFromPrefixChange={onFromPrefixChange}
            onToPrefixChange={onToPrefixChange}
          />
        ) : null}

        {showGaugeFilter ? (
          <GaugeFilterDropdown
            rows={prefixRows}
            selectedGauge={selectedGauge}
            sortOrder={gaugeSortOrder}
            onGaugeChange={onSelectedGaugeChange}
            onSortOrderChange={onGaugeSortOrderChange}
          />
        ) : null}

        {showWireNoSearch ? (
          <WireNoSearch
            value={wireNoSearchValue}
            onChange={onWireNoSearchValueChange}
            onClear={onClearWireNoSearch}
            matchCount={wireNoMatchCount}
            totalRows={locationDisplayRows}
            isActive={isWireNoSearchActive}
            searchModeEnabled={searchModeEnabled}
            onToggleSearchMode={onToggleSearchMode}
            onFocusChange={onWireNoInputFocusChange}
          />
        ) : null}

        {showSearchAll ? (
          <Button variant="outline" size="sm" className="gap-2" onClick={onOpenFullScreenSearch}>
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search All</span>
          </Button>
        ) : null}

        {showPrint ? (
          <PrintModal
            rows={rows}
            blueLabels={blueLabels}
            currentSheetName={currentSheetName}
            projectId={projectId}
            sheetSlug={sheetSlug}
            sheetTitle={title}
            metadata={metadata}
            getRowLength={getRowLength}
            swsType={swsType}
          />
        ) : null}

        {showMultiSheet ? (
          <MultiSheetPrintModal
            projectId={projectId}
            currentSheetSlug={sheetSlug}
          />
        ) : null}

        {showExport ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleExportCSV}
            disabled={rows.length === 0 || !canExport}
            title={canExport ? 'Export to CSV' : 'Brander role required to export'}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        ) : null}

        {showCustomize ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Customize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-100 overflow-auto">
            <DropdownMenuLabel>From Section</DropdownMenuLabel>
            {showFrom && (
              <DropdownMenuCheckboxItem
                checked={columnVisibility["fromCheck"] !== false}
                onCheckedChange={(checked) => {
                  setColumnVisibility((prev) => ({ ...prev, fromCheck: checked }));
                }}
              >
                From Check
              </DropdownMenuCheckboxItem>
            )}
            {semanticColumns
              .filter((column) => column.group === "from")
              .map((column) => (
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
            <DropdownMenuLabel>To Section</DropdownMenuLabel>
            {showTo && (
              <DropdownMenuCheckboxItem
                checked={columnVisibility["toCheck"] !== false}
                onCheckedChange={(checked) => {
                  setColumnVisibility((prev) => ({ ...prev, toCheck: checked }));
                }}
              >
                To Check
              </DropdownMenuCheckboxItem>
            )}
            {semanticColumns
              .filter((column) => column.group === "to")
              .map((column) => (
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
            {(showIPV || showComments) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Workflow</DropdownMenuLabel>
                {showIPV && (
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility["ipvCheck"] !== false}
                    onCheckedChange={(checked) => {
                      setColumnVisibility((prev) => ({ ...prev, ipvCheck: checked }));
                    }}
                  >
                    IPV Check
                  </DropdownMenuCheckboxItem>
                )}
                {showComments && (
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.comments !== false}
                    onCheckedChange={(checked) => {
                      setColumnVisibility((prev) => ({ ...prev, comments: checked }));
                    }}
                  >
                    Comments
                  </DropdownMenuCheckboxItem>
                )}
              </>
            )}
            {semanticColumns.some((column) => column.group === "length") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Computed</DropdownMenuLabel>
                {semanticColumns
                  .filter((column) => column.group === "length")
                  .map((column) => (
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
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Display</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={showDeviceSubheaders}
              onCheckedChange={(checked) => {
                onShowDeviceSubheadersChange(Boolean(checked));
              }}
            >
              Device Subheaders
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onResetVisibility}>
                <RotateCcw className="h-3 w-3" />
                Reset to defaults
              </Button>
            </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showRowCount ? (
          <span className="text-sm text-muted-foreground">{filteredDisplayRows} rows</span>
        ) : null}
      </div>
    </div>
  );
}
