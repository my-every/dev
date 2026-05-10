"use client";

import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Assignment {
  sheetSlug: string;
  sheetName: string;
  normalizedTitle?: string;
  unitType?: string;
}

interface VisibilityMatrixProps {
  projectId: string;
  assignments: Assignment[];
  externalLocations: Record<string, string[]>;
  wireListSettings: Record<string, Record<string, boolean>>;
  brandListSettings: Record<string, Record<string, boolean>>;
  crossWireSettings: Record<string, Record<string, boolean>>;
  onWireListChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onBrandListChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onCrossWireChange?: (sheetSlug: string, location: string, visible: boolean) => void;
  onSaveAndGenerate?: (sheetSlug: string) => Promise<void>;
  loading?: boolean;
}

type GeneratingState = "idle" | "generating" | "done" | "error";

// ─── Helper: Extract unit type from normalized title ─────────────────────────

function extractUnitType(title: string): string {
  // Common patterns: "JB71 B,PANEL CTRL" -> "JB71"
  const match = title.match(/^([A-Z]{1,3}\d{1,3})/i);
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
  onWireListChange,
  onBrandListChange,
  onCrossWireChange,
  onSaveAndGenerate,
  loading = false,
}: VisibilityMatrixProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [generatingState, setGeneratingState] = useState<Record<string, GeneratingState>>({});

  // Group assignments by unit type
  const groupedAssignments = useMemo(() => {
    const groups: Record<string, Assignment[]> = {};
    for (const assignment of assignments) {
      const unitType = assignment.unitType ?? extractUnitType(assignment.normalizedTitle ?? assignment.sheetName);
      if (!groups[unitType]) {
        groups[unitType] = [];
      }
      groups[unitType].push(assignment);
    }
    return groups;
  }, [assignments]);

  const toggleRow = useCallback((sheetSlug: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sheetSlug)) {
        next.delete(sheetSlug);
      } else {
        next.add(sheetSlug);
      }
      return next;
    });
  }, []);

  const handleSaveAndGenerate = useCallback(async (sheetSlug: string) => {
    if (!onSaveAndGenerate) return;
    
    setGeneratingState((prev) => ({ ...prev, [sheetSlug]: "generating" }));
    try {
      await onSaveAndGenerate(sheetSlug);
      setGeneratingState((prev) => ({ ...prev, [sheetSlug]: "done" }));
      setTimeout(() => {
        setGeneratingState((prev) => ({ ...prev, [sheetSlug]: "idle" }));
      }, 3000);
    } catch {
      setGeneratingState((prev) => ({ ...prev, [sheetSlug]: "error" }));
    }
  }, [onSaveAndGenerate]);

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
            Configure visibility for Wire List, Brand List, and Cross Wire per assignment
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Unit Type
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assignment
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ext. Locations
              </th>
              <th className="w-20 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Wire
              </th>
              <th className="w-20 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Brand
              </th>
              <th className="w-20 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cross
              </th>
              <th className="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(groupedAssignments).map(([unitType, unitAssignments]) => (
              unitAssignments.map((assignment, assignmentIdx) => {
                const isExpanded = expandedRows.has(assignment.sheetSlug);
                const locations = externalLocations[assignment.sheetSlug] ?? [];
                const genState = generatingState[assignment.sheetSlug] ?? "idle";
                const displayTitle = assignment.normalizedTitle ?? assignment.sheetName;
                
                // Get summary visibility state (all visible = true)
                const wireAllVisible = locations.every((loc) => wireListSettings[assignment.sheetSlug]?.[loc.trim().toUpperCase()] ?? true);
                const brandAllVisible = locations.every((loc) => brandListSettings[assignment.sheetSlug]?.[loc.trim().toUpperCase()] ?? true);
                const crossAllVisible = locations.every((loc) => crossWireSettings[assignment.sheetSlug]?.[loc.trim().toUpperCase()] ?? true);

                return (
                  <tbody key={assignment.sheetSlug}>
                    {/* Main Assignment Row */}
                    <tr 
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        isExpanded && "bg-muted/20"
                      )}
                      onClick={() => locations.length > 0 && toggleRow(assignment.sheetSlug)}
                    >
                      <td className="px-2 py-2.5">
                        {locations.length > 0 && (
                          <ChevronRight 
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                              isExpanded && "rotate-90"
                            )} 
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {assignmentIdx === 0 && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {unitType || "—"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="truncate text-sm font-medium text-foreground" title={displayTitle}>
                          {displayTitle}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {locations.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {locations.length} location{locations.length !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground/50">None</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={cn("text-[10px]", wireAllVisible ? "text-green-600" : "text-muted-foreground")}>
                          {wireAllVisible ? "Visible" : "Partial"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={cn("text-[10px]", brandAllVisible ? "text-green-600" : "text-muted-foreground")}>
                          {brandAllVisible ? "Visible" : "Partial"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={cn("text-[10px]", crossAllVisible ? "text-green-600" : "text-muted-foreground")}>
                          {crossAllVisible ? "Visible" : "Partial"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {genState === "generating" ? (
                          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px]" disabled>
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          </Button>
                        ) : genState === "done" ? (
                          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px] text-green-600" disabled>
                            <Check className="h-2.5 w-2.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-[10px]"
                            onClick={() => handleSaveAndGenerate(assignment.sheetSlug)}
                          >
                            <Download className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Location Rows */}
                    {isExpanded && locations.map((location) => {
                      const locKey = location.trim().toUpperCase();
                      const wireVisible = wireListSettings[assignment.sheetSlug]?.[locKey] ?? true;
                      const brandVisible = brandListSettings[assignment.sheetSlug]?.[locKey] ?? true;
                      const crossVisible = crossWireSettings[assignment.sheetSlug]?.[locKey] ?? true;

                      return (
                        <tr 
                          key={`${assignment.sheetSlug}-${locKey}`}
                          className="bg-muted/10 hover:bg-muted/20"
                        >
                          <td className="px-2 py-1.5" />
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5">
                            <span className="font-mono text-xs text-foreground/80">{location}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Switch
                              checked={wireVisible}
                              onCheckedChange={(checked) => onWireListChange?.(assignment.sheetSlug, locKey, checked)}
                              aria-label={`Wire list visibility for ${location}`}
                              className="scale-75"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Switch
                              checked={brandVisible}
                              onCheckedChange={(checked) => onBrandListChange?.(assignment.sheetSlug, locKey, checked)}
                              aria-label={`Brand list visibility for ${location}`}
                              className="scale-75"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Switch
                              checked={crossVisible}
                              onCheckedChange={(checked) => onCrossWireChange?.(assignment.sheetSlug, locKey, checked)}
                              aria-label={`Cross wire visibility for ${location}`}
                              className="scale-75"
                            />
                          </td>
                          <td className="px-2 py-1.5" />
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span>Visible = All locations visible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
          <span>Partial = Some locations hidden</span>
        </div>
      </div>
    </div>
  );
}

export default VisibilityMatrixConcept;
