"use client";

/**
 * Main wire list component.
 * 
 * This is the primary reusable component for displaying wire list data.
 * It composes the toolbar, table, metadata panel, location tabs, and empty state.
 * 
 * Data transform flow:
 * 1. Parse workbook
 * 2. Select current sheet
 * 3. Determine unique locations
 * 4. Apply selected location tab filter
 * 5. Apply column visibility state
 * 6. Apply search filter
 * 7. Render table
 * 
 * Features:
 * - Column visibility controls with persistence
 * - Location-based filtering with tabs
 * - Smart column normalization for cleaner display
 * - Metadata extraction and display
 * - Wire type badge rendering
 * - Two-level header grouping (From/To)
 */

import { useMemo, useState } from "react";
import { WireListTable } from "./wire-list-table";
import { WireListToolbar } from "./wire-list-toolbar";
import { WireListEmptyState } from "./wire-list-empty-state";
import { WireListLocationTabs } from "./wire-list-location-tabs";
import { SheetMetadataPanel } from "./sheet-metadata-panel";
import type { ParsedSheetRow, ProjectSheetSummary, SemanticWireListRow, SheetMetadataInfo } from "@/lib/workbook/types";
import { normalizeWireListColumns, type NormalizedColumn } from "@/lib/workbook/wire-list-normalizer";
import { useWireListColumnVisibility } from "@/hooks/use-wire-list-column-visibility";
import { useWireListLocationFilter } from "@/hooks/use-wire-list-location-filter";
import { ALL_LOCATIONS_TAB } from "@/lib/workbook/get-unique-sheet-locations";

interface WireListProps {
  /** Unique project ID for persistence */
  projectId: string;
  /** Sheet slug for persistence */
  sheetSlug: string;
  /** Display title for the wire list */
  title: string;
  /** Array of row data */
  rows: ParsedSheetRow[] | SemanticWireListRow[];
  /** Column headers from the sheet */
  headers: string[];
  /** Optional sheet summary for display */
  sheetSummary?: ProjectSheetSummary;
  /** Extracted project metadata from preamble rows */
  sheetMetadata?: SheetMetadataInfo;
}

export function WireList({
  projectId,
  sheetSlug,
  title,
  rows,
  headers,
  sheetSummary,
  sheetMetadata,
}: WireListProps) {
  // Normalize columns for display (cleaner headers, proper ordering, visibility)
  const normalizedColumns = useMemo<NormalizedColumn[]>(() => {
    return normalizeWireListColumns(headers);
  }, [headers]);

  // Column visibility management
  const {
    visibility: columnVisibility,
    setVisibility: setColumnVisibility,
    defaultVisibility,
    columnConfigs,
  } = useWireListColumnVisibility({
    projectId,
    sheetSlug,
    columns: normalizedColumns,
    headers,
  });

  // Location filtering
  const {
    locations,
    selectedLocation,
    setSelectedLocation,
    filteredRows: locationFilteredRows,
    hasMultipleLocations: showLocationTabs,
    totalRowCount,
  } = useWireListLocationFilter({
    projectId,
    sheetSlug,
    headers,
    rows,
  });

  // Search state
  const [searchState, setSearchState] = useState("");

  // Apply search filter
  const filteredRows = useMemo(() => {
    if (!searchState.trim()) {
      return locationFilteredRows;
    }

    const searchLower = searchState.toLowerCase();
    return locationFilteredRows.filter((row) => {
      return Object.values(row).some((value) => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });
  }, [locationFilteredRows, searchState]);

  // Handle empty state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {sheetSummary && (
            <p className="text-sm text-muted-foreground">
              {sheetSummary.columnCount} columns defined
            </p>
          )}
        </div>
        <WireListEmptyState />
      </div>
    );
  }

  // Count visible columns
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Metadata Panel - shown if metadata was extracted */}
      {sheetMetadata && Object.keys(sheetMetadata).length > 0 && (
        <SheetMetadataPanel metadata={sheetMetadata} />
      )}

      {/* Location Tabs */}
      {showLocationTabs && (
        <WireListLocationTabs
          locations={locations}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          totalCount={totalRowCount}
          showCounts
        />
      )}

      {/* Toolbar */}
      <WireListToolbar
        searchValue={searchState}
        onSearchChange={setSearchState}
        totalRows={locationFilteredRows.length}
        filteredRows={searchState.trim() ? filteredRows.length : undefined}
        columnConfigs={columnConfigs}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        defaultColumnVisibility={defaultVisibility}
      />

      {/* Table */}
      <WireListTable
        columns={normalizedColumns}
        data={filteredRows}
        globalFilter={searchState}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {visibleColumnCount} of {normalizedColumns.length} columns
        </span>
        <span>
          {selectedLocation !== ALL_LOCATIONS_TAB && (
            <span className="mr-2 text-secondary-foreground">{selectedLocation}</span>
          )}
          {filteredRows.length === locationFilteredRows.length
            ? `${locationFilteredRows.length} rows`
            : `${filteredRows.length} of ${locationFilteredRows.length} rows`}
        </span>
      </div>
    </div>
  );
}
