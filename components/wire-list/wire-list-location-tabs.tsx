"use client";

/**
 * Location tabs for filtering wire list by location.
 * Shows tabs for each unique location in the sheet.
 */

import { cn } from "@/lib/utils";
import { ALL_LOCATIONS_TAB, type LocationSummary } from "@/lib/workbook/get-unique-sheet-locations";

// ============================================================================
// Types
// ============================================================================

interface WireListLocationTabsProps {
  /** Location summaries with counts */
  locations: LocationSummary[];
  /** Currently selected location (or ALL_LOCATIONS_TAB) */
  selectedLocation: string;
  /** Callback when location changes */
  onLocationChange: (location: string) => void;
  /** Total row count for "All" tab */
  totalCount: number;
  /** Whether to show row counts in tabs */
  showCounts?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function WireListLocationTabs({
  locations,
  selectedLocation,
  onLocationChange,
  totalCount,
  showCounts = true,
}: WireListLocationTabsProps) {
  // Don't render if only one location
  if (locations.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {/* All Locations tab */}
      <LocationTab
        label="All Locations"
        count={showCounts ? totalCount : undefined}
        isSelected={selectedLocation === ALL_LOCATIONS_TAB}
        onClick={() => onLocationChange(ALL_LOCATIONS_TAB)}
      />

      {/* Separator */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Individual location tabs */}
      {locations.map((loc) => (
        <LocationTab
          key={loc.value}
          label={loc.value}
          count={showCounts ? loc.count : undefined}
          isSelected={selectedLocation === loc.value}
          onClick={() => onLocationChange(loc.value)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Location Tab
// ============================================================================

interface LocationTabProps {
  label: string;
  count?: number;
  isSelected: boolean;
  onClick: () => void;
}

function LocationTab({ label, count, isSelected, onClick }: LocationTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        isSelected
          ? "bg-foreground text-background"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="truncate max-w-[200px]">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
            isSelected
              ? "bg-background/20 text-background"
              : "bg-muted-foreground/10 text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

interface WireListLocationTabsCompactProps {
  /** Location summaries with counts */
  locations: LocationSummary[];
  /** Currently selected location (or ALL_LOCATIONS_TAB) */
  selectedLocation: string;
  /** Callback when location changes */
  onLocationChange: (location: string) => void;
  /** Total row count for "All" option */
  totalCount: number;
}

/**
 * Compact dropdown variant for locations when space is limited.
 */
export function WireListLocationSelect({
  locations,
  selectedLocation,
  onLocationChange,
  totalCount,
}: WireListLocationTabsCompactProps) {
  // Don't render if only one location
  if (locations.length <= 1) {
    return null;
  }

  const selectedLabel =
    selectedLocation === ALL_LOCATIONS_TAB
      ? `All Locations (${totalCount})`
      : locations.find((l) => l.value === selectedLocation)?.value || selectedLocation;

  return (
    <select
      value={selectedLocation}
      onChange={(e) => onLocationChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value={ALL_LOCATIONS_TAB}>All Locations ({totalCount})</option>
      {locations.map((loc) => (
        <option key={loc.value} value={loc.value}>
          {loc.value} ({loc.count})
        </option>
      ))}
    </select>
  );
}
