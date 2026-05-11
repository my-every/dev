"use client";

import { useState, useCallback } from "react";
import { BoxSideConfig, type BoxSideName } from "@/boxSide";
import { useToast } from "@/hooks/use-toast";

interface Assignment {
  sheetSlug: string;
  sheetName: string;
  normalizedTitle?: string;
  boxSide?: string;
}

interface BoxSideTestTableProps {
  projectId: string;
  assignments: Assignment[];
  badgeNumber?: string;
}

const BOX_SIDE_OPTIONS = Object.entries(BoxSideConfig).map(([key, config]) => ({
  value: key as BoxSideName,
  label: config.name,
}));

export function BoxSideTestTable({ projectId, assignments, badgeNumber }: BoxSideTestTableProps) {
  const { toast } = useToast();
  // Local state to track boxSide values - independent of parent state
  const [localBoxSides, setLocalBoxSides] = useState<Record<string, string | undefined>>(() => {
    const initial: Record<string, string | undefined> = {};
    for (const a of assignments) {
      initial[a.sheetSlug] = a.boxSide;
    }
    return initial;
  });
  const [loading, setLoading] = useState<string | null>(null);

  const handleBoxSideChange = useCallback(async (sheetSlug: string, boxSide: string) => {
    console.log("[v0] BoxSideTestTable: handleBoxSideChange called", { sheetSlug, boxSide });
    setLoading(sheetSlug);
    
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(sheetSlug)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-badge-number": badgeNumber ?? "unknown",
          },
          body: JSON.stringify({ boxSide }),
        }
      );

      console.log("[v0] BoxSideTestTable: API response status", res.status);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to update box side");
      }

      const updated = await res.json();
      console.log("[v0] BoxSideTestTable: API response data", updated);

      if (updated.assignment) {
        // Update local state with the new boxSide
        setLocalBoxSides((prev) => ({
          ...prev,
          [sheetSlug]: updated.assignment.boxSide,
        }));
        console.log("[v0] BoxSideTestTable: Local state updated to", updated.assignment.boxSide);
        toast({ title: "Box side updated", description: `${sheetSlug} -> ${updated.assignment.boxSide}` });
      } else {
        console.log("[v0] BoxSideTestTable: No assignment in response!");
      }
    } catch (err) {
      console.error("[v0] BoxSideTestTable: Error", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update box side",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }, [projectId, badgeNumber, toast]);

  // Only show first 3 assignments for testing
  const testAssignments = assignments.slice(0, 3);

  return (
    <div className="rounded-lg border border-dashed border-orange-500 bg-orange-50 p-4 dark:bg-orange-950/20">
      <h3 className="mb-3 text-sm font-semibold text-orange-700 dark:text-orange-400">
        Box Side API Test (No Edit Mode Required)
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-left font-medium">Assignment</th>
            <th className="py-2 text-left font-medium">Current Box Side</th>
            <th className="py-2 text-left font-medium">Change To</th>
          </tr>
        </thead>
        <tbody>
          {testAssignments.map((assignment) => (
            <tr key={assignment.sheetSlug} className="border-b border-border/50">
              <td className="py-2 pr-2">
                <span className="font-mono text-xs">{assignment.sheetSlug}</span>
              </td>
              <td className="py-2 pr-2">
                <span className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {localBoxSides[assignment.sheetSlug] ?? "—"}
                </span>
              </td>
              <td className="py-2">
                <select
                  value={localBoxSides[assignment.sheetSlug] ?? ""}
                  onChange={(e) => handleBoxSideChange(assignment.sheetSlug, e.target.value)}
                  disabled={loading === assignment.sheetSlug}
                  className="h-10 w-full rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select...</option>
                  {BOX_SIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {loading === assignment.sheetSlug && (
                  <span className="ml-2 text-xs text-muted-foreground">Saving...</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
