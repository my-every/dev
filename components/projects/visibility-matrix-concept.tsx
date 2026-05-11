"use client";

import { useMemo, useCallback, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileArchive, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitTypePopover } from "./unit-type-popover";
import { BoxSideCell } from "./box-side-cell";

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
  loading?: boolean;
}

type GeneratingState = "idle" | "generating" | "ready" | "error";
type BulkGeneratingState = { state: GeneratingState; downloadUrl: string | null };

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

    // Group assignments by unit type first (extracted from first external location)
    const unitGroups: Record<string, Assignment[]> = {};
    for (const assignment of assignments) {
      const locations = externalLocations[assignment.sheetSlug] ?? [];
      // Extract unit type from first location (e.g., "JB71 B,PNL DC PWR" -> "JB71")
      const firstLocation = locations[0] ?? "";
      const unitType = assignment.unitType ?? extractUnitType(firstLocation);
      if (!unitGroups[unitType]) {
        unitGroups[unitType] = [];
      }
      unitGroups[unitType].push(assignment);
    }

    // Calculate row spans for each unit and assignment
    for (const [unitType, unitAssignments] of Object.entries(unitGroups)) {
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
              const wireVisible = row.locKey ? (wireListSettings[row.assignment.sheetSlug]?.[row.locKey] ?? true) : true;
              const brandVisible = row.locKey ? (brandListSettings[row.assignment.sheetSlug]?.[row.locKey] ?? true) : true;
              const crossVisible = row.locKey ? (crossWireSettings[row.assignment.sheetSlug]?.[row.locKey] ?? true) : true;
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
                    {row.locKey && (
                      <Switch
                        checked={wireVisible}
                        onCheckedChange={(checked) => onWireListChange?.(row.assignment.sheetSlug, row.locKey, checked)}
                        aria-label={`Wire list visibility for ${row.location}`}
                        className="scale-75"
                      />
                    )}
                  </td>

                  {/* Brand List Toggle */}
                  <td className="px-2 py-2 text-center">
                    {row.locKey && (
                      <Switch
                        checked={brandVisible}
                        onCheckedChange={(checked) => onBrandListChange?.(row.assignment.sheetSlug, row.locKey, checked)}
                        aria-label={`Brand list visibility for ${row.location}`}
                        className="scale-75"
                      />
                    )}
                  </td>

                  {/* Cross Wire Toggle */}
                  <td className="px-2 py-2 text-center">
                    {row.locKey && (
                      <Switch
                        checked={crossVisible}
                        onCheckedChange={(checked) => onCrossWireChange?.(row.assignment.sheetSlug, row.locKey, checked)}
                        aria-label={`Cross wire visibility for ${row.location}`}
                        className="scale-75"
                      />
                    )}
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
