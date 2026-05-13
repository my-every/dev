"use client";

import { useMemo, useCallback, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileArchive, FileText, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitTypePopover } from "./unit-type-popover";
import { BoxSideCell } from "./box-side-cell";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BoxSideConfig, getDefaultExternalLocationSettings } from "@/boxSide";

// ─── Types ───────────────────────────────────────────────────────────────────
// Visibility Matrix: Unified table for Wire List, Brand List, Cross Wire settings

interface Assignment {
  sheetSlug: string;
  sheetName: string;
  normalizedTitle?: string;
  unitType?: string;
  boxSide?: string;
}

interface VisibilityMatrixProps {
  projectId: string;
  assignments: Assignment[];
  externalLocations: Record<string, string[]>;
  wireListSettings: Record<string, Record<string, boolean>>;
  brandListSettings: Record<string, Record<string, boolean>>;
  crossWireSettings: Record<string, Record<string, boolean>>;
  /** Available box side options per unit type - key is unitType, value is array of box side keys */
  unitTypeBoxSides?: Record<string, string[]>;
  /** Available unit types for selection */
  availableUnitTypes?: string[];
  /** Whether the matrix is in edit mode (controlled by Edit button in workspace) */
  isEditing?: boolean;
  onWireListChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onBrandListChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onCrossWireChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onUnitTypeChange?: (sheetSlug: string, unitType: string) => void;
  onBoxSideChange?: (sheetSlug: string, boxSide: string) => void;
  onSaveAndGenerateAllWireLists?: () => Promise<string | null>; // returns download URL or null
  onSaveAndGenerateAllBrandLists?: () => Promise<string | null>;
  onSaveAndGenerateCrossWire?: () => Promise<string | null>;
  /** Callback to apply default visibility settings based on box side installation order */
  onApplyDefaultSettings?: (options: { overwriteExisting: boolean }) => Promise<void>;
  /** Whether default settings are currently being applied */
  applyingDefaults?: boolean;
  loading?: boolean;
}

type GeneratingState = "idle" | "generating" | "ready" | "error";
type BulkGeneratingState = { state: GeneratingState; downloadUrl: string | null };

// ─── Helper: Infer boxSide key from string ───────────────────────────────────

function inferBoxSideKey(boxSide: string | undefined): string | undefined {
  if (!boxSide) return undefined;
  const normalized = boxSide.toLowerCase().replace(/[\s_-]+/g, '');
  for (const key of Object.keys(BoxSideConfig)) {
    if (normalized === key.toLowerCase()) return key;
  }
  if (normalized.includes('leftdoor')) return 'leftDoor';
  if (normalized.includes('rightdoor')) return 'rightDoor';
  if (normalized.includes('leftback')) return 'leftBackSide';
  if (normalized.includes('rightback')) return 'rightBackSide';
  if (normalized.includes('topback')) return 'topBackSide';
  if (normalized.includes('leftside')) return 'leftSide';
  if (normalized.includes('rightside')) return 'rightSide';
  if (normalized.includes('back') && !normalized.includes('left') && !normalized.includes('right') && !normalized.includes('top')) {
    return 'backSide';
  }
  return undefined;
}

// ─── Helper: Extract unit type from location or title ────────────────────────

function extractUnitType(location: string): string {
  // Extract unit type from location patterns like "JB71 B,PNL DC PWR" -> "JB71"
  // or "JB71" -> "JB71"
  const match = location.match(/^([A-Z]{1,4}\d{1,3})/i);
  return match ? match[1].toUpperCase() : "";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VisibilityMatrixConcept({
  projectId,
  assignments,
  externalLocations,
  wireListSettings,
  brandListSettings,
  crossWireSettings,
  unitTypeBoxSides,
  availableUnitTypes = [],
  isEditing = false,
  onWireListChange,
  onBrandListChange,
  onCrossWireChange,
  onUnitTypeChange,
  onBoxSideChange,
  onSaveAndGenerateAllWireLists,
  onSaveAndGenerateAllBrandLists,
  onSaveAndGenerateCrossWire,
  onApplyDefaultSettings,
  applyingDefaults = false,
  loading = false,
}: VisibilityMatrixProps) {
  const [wireListBulk, setWireListBulk] = useState<BulkGeneratingState>({ state: "idle", downloadUrl: null });
  const [brandListBulk, setBrandListBulk] = useState<BulkGeneratingState>({ state: "idle", downloadUrl: null });
  const [crossWireBulk, setCrossWireBulk] = useState<BulkGeneratingState>({ state: "idle", downloadUrl: null });

  // Build flat rows: one row per (assignment, location) pair
  const matrixRows = useMemo(() => {
    const rows: Array<{
      unitType: string;
      assignment: Assignment;
      location: string;
      locKey: string;
      isFirstInUnit: boolean;
      isFirstInAssignment: boolean;
      unitRowSpan: number;
      assignmentRowSpan: number;
    }> = [];

    // Helper to get boxSide installation order (lower = earlier in installation)
    const getBoxSideOrder = (boxSide: string | undefined): number => {
      const key = inferBoxSideKey(boxSide);
      if (!key || !BoxSideConfig[key]) return 999; // Unknown goes last
      return BoxSideConfig[key].order;
    };

    // Sort assignments by boxSide installation order:
    // leftDoor (1) -> rightDoor (1) -> leftSide (2) -> topBackSide (3) -> leftBackSide (4) -> rightBackSide (5) -> rightSide (6)
    const sortedAssignments = [...assignments].sort((a, b) => {
      const orderA = getBoxSideOrder(a.boxSide);
      const orderB = getBoxSideOrder(b.boxSide);
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by sheet name for stability
      return (a.sheetName ?? '').localeCompare(b.sheetName ?? '');
    });

    // Group assignments by unit type first (extracted from first external location)
    const unitGroups: Record<string, Assignment[]> = {};
    for (const assignment of sortedAssignments) {
      const locations = externalLocations[assignment.sheetSlug] ?? [];
      // Extract unit type from first location (e.g., "JB71 B,PNL DC PWR" -> "JB71")
      const firstLocation = locations[0] ?? "";
      const unitType = assignment.unitType ?? extractUnitType(firstLocation);
      if (!unitGroups[unitType]) {
        unitGroups[unitType] = [];
      }
      unitGroups[unitType].push(assignment);
    }

    // Sort unit groups by number of assignments (most first)
    const sortedUnitGroups = Object.entries(unitGroups).sort(
      ([, a], [, b]) => b.length - a.length
    );

    // Calculate row spans for each unit and assignment
    for (const [unitType, unitAssignments] of sortedUnitGroups) {
      let unitRowCount = 0;
      const assignmentRowCounts: number[] = [];

      // First pass: count rows per assignment
      for (const assignment of unitAssignments) {
        const locations = externalLocations[assignment.sheetSlug] ?? [];
        const rowCount = Math.max(1, locations.length); // At least 1 row per assignment
        assignmentRowCounts.push(rowCount);
        unitRowCount += rowCount;
      }

      // Second pass: build rows
      let unitRowIdx = 0;
      unitAssignments.forEach((assignment, assignmentIdx) => {
        const locations = externalLocations[assignment.sheetSlug] ?? [];
        const assignmentRowCount = assignmentRowCounts[assignmentIdx];

        if (locations.length === 0) {
          // No locations - single row with empty location
          rows.push({
            unitType,
            assignment,
            location: "",
            locKey: "",
            isFirstInUnit: unitRowIdx === 0,
            isFirstInAssignment: true,
            unitRowSpan: unitRowIdx === 0 ? unitRowCount : 0,
            assignmentRowSpan: assignmentRowCount,
          });
          unitRowIdx++;
        } else {
          // Multiple locations - one row per location
          locations.forEach((location, locIdx) => {
            rows.push({
              unitType,
              assignment,
              location,
              locKey: location.trim().toUpperCase(),
              isFirstInUnit: unitRowIdx === 0,
              isFirstInAssignment: locIdx === 0,
              unitRowSpan: unitRowIdx === 0 ? unitRowCount : 0,
              assignmentRowSpan: locIdx === 0 ? assignmentRowCount : 0,
            });
            unitRowIdx++;
          });
        }
      });
    }

    return rows;
  }, [assignments, externalLocations]);

  // Build location-to-boxSide lookup map from all assignments for default computation
  const locationToBoxSide = useMemo(() => {
    const map: Record<string, string> = {};
    for (const assignment of assignments) {
      const boxSideKey = inferBoxSideKey(assignment.boxSide);
      if (!boxSideKey) continue;
      if (assignment.sheetName) {
        map[assignment.sheetName.trim().toUpperCase()] = boxSideKey;
      }
      if (assignment.normalizedTitle) {
        map[assignment.normalizedTitle.trim().toUpperCase()] = boxSideKey;
      }
      // Add sheet slug variations
      map[assignment.sheetSlug.toUpperCase()] = boxSideKey;
    }
    return map;
  }, [assignments]);

  // Helper to get default visibility based on boxSide logic
  const getDefaultVisibility = useCallback((
    assignmentBoxSide: string | undefined,
    locationKey: string
  ): { wire: boolean; brand: boolean; cross: boolean } => {
    const assignmentBoxSideKey = inferBoxSideKey(assignmentBoxSide);
    if (!assignmentBoxSideKey) {
      // No boxSide set - default to true
      return { wire: true, brand: true, cross: true };
    }

    // Try to find target box side from lookup map
    let targetBoxSideKey = locationToBoxSide[locationKey];
    
    if (!targetBoxSideKey) {
      // Try partial match
      for (const [knownLoc, boxSide] of Object.entries(locationToBoxSide)) {
        if (locationKey.includes(knownLoc) || knownLoc.includes(locationKey)) {
          targetBoxSideKey = boxSide;
          break;
        }
      }
    }

    if (!targetBoxSideKey) {
      // Try inferring from location text itself
      targetBoxSideKey = inferBoxSideKey(locationKey);
    }

    if (!targetBoxSideKey) {
      // Can't determine target - default to true
      return { wire: true, brand: true, cross: true };
    }

    const defaults = getDefaultExternalLocationSettings(assignmentBoxSideKey, targetBoxSideKey);
    return {
      wire: defaults.wire_list,
      brand: defaults.brand_list,
      cross: defaults.cross_wire,
    };
  }, [locationToBoxSide]);

  const handleSaveAndGenerateAllWireLists = useCallback(async () => {
    if (!onSaveAndGenerateAllWireLists) return;
    setWireListBulk({ state: "generating", downloadUrl: null });
    try {
      const url = await onSaveAndGenerateAllWireLists();
      setWireListBulk({ state: "ready", downloadUrl: url });
    } catch {
      setWireListBulk({ state: "error", downloadUrl: null });
    }
  }, [onSaveAndGenerateAllWireLists]);

  const handleSaveAndGenerateAllBrandLists = useCallback(async () => {
    if (!onSaveAndGenerateAllBrandLists) return;
    setBrandListBulk({ state: "generating", downloadUrl: null });
    try {
      const url = await onSaveAndGenerateAllBrandLists();
      setBrandListBulk({ state: "ready", downloadUrl: url });
    } catch {
      setBrandListBulk({ state: "error", downloadUrl: null });
    }
  }, [onSaveAndGenerateAllBrandLists]);

  const handleSaveAndGenerateCrossWire = useCallback(async () => {
    if (!onSaveAndGenerateCrossWire) return;
    setCrossWireBulk({ state: "generating", downloadUrl: null });
    try {
      const url = await onSaveAndGenerateCrossWire();
      setCrossWireBulk({ state: "ready", downloadUrl: url });
    } catch {
      setCrossWireBulk({ state: "error", downloadUrl: null });
    }
  }, [onSaveAndGenerateCrossWire]);

  // Default settings popover state - must be before early returns
  // Default to overwrite=true since applying defaults should reset to standard values
  const [defaultSettingsOpen, setDefaultSettingsOpen] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  const handleApplyDefaults = useCallback(async () => {
    if (!onApplyDefaultSettings) return;
    await onApplyDefaultSettings({ overwriteExisting });
    setDefaultSettingsOpen(false);
    // Reset to true for next time
    setOverwriteExisting(true);
  }, [onApplyDefaultSettings, overwriteExisting]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading visibility settings...</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">No assignments available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Visibility Matrix</h3>
          <p className="text-xs text-muted-foreground">
            Configure visibility for Wire List, Brand List, and Cross Wire per external location
          </p>
        </div>
        {/* Default Settings Drawer - only show when editing */}
        {isEditing && onApplyDefaultSettings && (
          <Drawer open={defaultSettingsOpen} onOpenChange={setDefaultSettingsOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Default Settings</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Apply Default Visibility Settings</DrawerTitle>
                <DrawerDescription>
                  Set visibility based on box side installation order: Door in, top to bottom, left to right.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Logic:</strong> Enable settings for downstream connections, disable for upstream.</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li>Door: All connections enabled</li>
                    <li>Left Side: Enabled downstream, cross-wire only to Door</li>
                    <li>Top/Left/Right Back: Disabled upstream, enabled downstream</li>
                    <li>Right Side: All disabled (endpoint)</li>
                  </ul>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t">
                  <Checkbox
                    id="overwrite-existing"
                    checked={overwriteExisting}
                    onCheckedChange={(checked) => setOverwriteExisting(checked === true)}
                  />
                  <Label htmlFor="overwrite-existing" className="text-sm cursor-pointer">
                    Overwrite existing custom settings
                  </Label>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3">
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setDefaultSettingsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="min-h-[44px]"
                    onClick={handleApplyDefaults}
                    disabled={applyingDefaults}
                  >
                    {applyingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Apply Defaults
                  </Button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[700px] text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-16 px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Unit
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assignment
              </th>
              <th className="w-28 px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Box Side
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ext. Location
              </th>
              <th className="w-16 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Wire
              </th>
              <th className="w-16 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Brand
              </th>
              <th className="w-16 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cross
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, rowIdx) => {
              // Get boxSide-based defaults if no explicit setting exists
              const defaults = row.locKey 
                ? getDefaultVisibility(row.assignment.boxSide, row.locKey)
                : { wire: true, brand: true, cross: true };
              
              // Use explicit settings if they exist, otherwise use boxSide defaults
              const wireVisible = row.locKey 
                ? (wireListSettings[row.assignment.sheetSlug]?.[row.locKey] ?? defaults.wire) 
                : true;
              const brandVisible = row.locKey 
                ? (brandListSettings[row.assignment.sheetSlug]?.[row.locKey] ?? defaults.brand) 
                : true;
              const crossVisible = row.locKey 
                ? (crossWireSettings[row.assignment.sheetSlug]?.[row.locKey] ?? defaults.cross) 
                : true;
              const displayTitle = row.assignment.normalizedTitle ?? row.assignment.sheetName;

              return (
                <tr 
                  key={`${row.assignment.sheetSlug}-${row.locKey || rowIdx}`}
                  className={cn(
                    "border-b border-border/40 transition-colors hover:bg-muted/20",
                    row.isFirstInAssignment && "border-t border-border/60"
                  )}
                >
                  {/* Unit Type - grouped by unit type when viewing, per-assignment when editing */}
                  {isEditing ? (
                    // Edit mode: show dropdown per assignment
                    row.assignmentRowSpan > 0 && (
                      <td 
                        className="border-r border-border/40 bg-muted/30 px-2 py-2 align-top"
                        rowSpan={row.assignmentRowSpan}
                      >
                        <UnitTypePopover
                          value={row.assignment.unitType || row.unitType}
                          options={availableUnitTypes}
                          disabled={false}
                          onSelect={(unitType) => onUnitTypeChange?.(row.assignment.sheetSlug, unitType)}
                        />
                      </td>
                    )
                  ) : (
                    // View mode: group assignments by unit type with rowSpan
                    row.unitRowSpan > 0 && (
                      <td 
                        className="border-r border-border/40 bg-muted/30 px-2 py-2 align-top"
                        rowSpan={row.unitRowSpan}
                      >
                        <span className="inline-flex rounded bg-background border border-border px-2 py-1 font-mono text-[11px] text-foreground">
                          {row.unitType || "—"}
                        </span>
                      </td>
                    )
                  )}

                  {/* Assignment - spans multiple rows per location count */}
                  {row.assignmentRowSpan > 0 && (
                    <td 
                      className="border-r border-border/40 px-3 py-2 align-top"
                      rowSpan={row.assignmentRowSpan}
                    >
                      <span 
                        className="block truncate text-xs font-medium text-foreground" 
                        title={displayTitle}
                      >
                        {displayTitle}
                      </span>
                    </td>
                  )}

                  {/* Box Side - spans multiple rows per assignment */}
                  {row.assignmentRowSpan > 0 && (
                    <td 
                      className="border-r border-border/40 px-2 py-2 align-top"
                      rowSpan={row.assignmentRowSpan}
                    >
                      <BoxSideCell
                        sheetSlug={row.assignment.sheetSlug}
                        initialValue={row.assignment.boxSide}
                        availableBoxSides={unitTypeBoxSides?.[row.unitType]}
                        isEditing={isEditing}
                        onBoxSideChange={onBoxSideChange}
                      />
                    </td>
                  )}

                  {/* External Location */}
                  <td className="px-3 py-2">
                    {row.location ? (
                      <span className="font-mono text-xs text-foreground/80">{row.location}</span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground/50">No locations</span>
                    )}
                  </td>

                  {/* Wire List Toggle */}
                  <td className="px-2 py-2 text-center">
                    {row.locKey ? (
                      <div className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]">
                        <Switch
                          checked={wireVisible}
                          disabled={!isEditing}
                          onCheckedChange={(checked) => {
                            if (isEditing && onWireListChange) {
                              onWireListChange(row.assignment.sheetSlug, row.locKey, checked);
                            }
                          }}
                          aria-label={`Wire list visibility for ${row.location}`}
                        />
                      </div>
                    ) : null}
                  </td>

                  {/* Brand List Toggle */}
                  <td className="px-2 py-2 text-center">
                    {row.locKey ? (
                      <div className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]">
                        <Switch
                          checked={brandVisible}
                          disabled={!isEditing}
                          onCheckedChange={(checked) => {
                            if (isEditing && onBrandListChange) {
                              onBrandListChange(row.assignment.sheetSlug, row.locKey, checked);
                            }
                          }}
                          aria-label={`Brand list visibility for ${row.location}`}
                        />
                      </div>
                    ) : null}
                  </td>

                  {/* Cross Wire Toggle */}
                  <td className="px-2 py-2 text-center">
                    {row.locKey ? (
                      <div className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]">
                        <Switch
                          checked={crossVisible}
                          disabled={!isEditing}
                          onCheckedChange={(checked) => {
                            if (isEditing && onCrossWireChange) {
                              onCrossWireChange(row.assignment.sheetSlug, row.locKey, checked);
                            }
                          }}
                          aria-label={`Cross wire visibility for ${row.location}`}
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Footer row with bulk download buttons */}
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td colSpan={4} className="px-3 py-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Save & Generate All
                </span>
              </td>
              {/* Wire List Download */}
              <td className="px-2 py-3 text-center">
                {wireListBulk.state === "idle" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={handleSaveAndGenerateAllWireLists}
                    disabled={!onSaveAndGenerateAllWireLists}
                  >
                    <FileArchive className="h-3 w-3" />
                    ZIP
                  </Button>
                ) : wireListBulk.state === "generating" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px]" disabled>
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </Button>
                ) : wireListBulk.state === "ready" && wireListBulk.downloadUrl ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                    asChild
                  >
                    <a href={wireListBulk.downloadUrl} download>
                      <Download className="h-3 w-3" />
                      DL
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px] text-destructive" disabled>
                    Error
                  </Button>
                )}
              </td>
              {/* Brand List Download */}
              <td className="px-2 py-3 text-center">
                {brandListBulk.state === "idle" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={handleSaveAndGenerateAllBrandLists}
                    disabled={!onSaveAndGenerateAllBrandLists}
                  >
                    <FileArchive className="h-3 w-3" />
                    ZIP
                  </Button>
                ) : brandListBulk.state === "generating" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px]" disabled>
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </Button>
                ) : brandListBulk.state === "ready" && brandListBulk.downloadUrl ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                    asChild
                  >
                    <a href={brandListBulk.downloadUrl} download>
                      <Download className="h-3 w-3" />
                      DL
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px] text-destructive" disabled>
                    Error
                  </Button>
                )}
              </td>
              {/* Cross Wire Download */}
              <td className="px-2 py-3 text-center">
                {crossWireBulk.state === "idle" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={handleSaveAndGenerateCrossWire}
                    disabled={!onSaveAndGenerateCrossWire}
                  >
                    <FileText className="h-3 w-3" />
                    PDF
                  </Button>
                ) : crossWireBulk.state === "generating" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px]" disabled>
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </Button>
                ) : crossWireBulk.state === "ready" && crossWireBulk.downloadUrl ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                    asChild
                  >
                    <a href={crossWireBulk.downloadUrl} download>
                      <Download className="h-3 w-3" />
                      DL
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px] text-destructive" disabled>
                    Error
                  </Button>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default VisibilityMatrixConcept;
