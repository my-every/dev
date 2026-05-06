"use client";

import { useCallback, useMemo, useState } from "react";
import { Hash, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyTabState, StatItem } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";

interface PartNumberRow {
  partNumber: string;
  count: number;
  sheets: string[];
}

export function ProjectPartNumbersTab({ project, onNavigateToTab }: ProjectTabProps) {
  const [query, setQuery] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);

  const partRows = useMemo<PartNumberRow[]>(() => {
    const counts = new Map<string, { count: number; sheets: Set<string> }>();

    for (const assignment of Object.values(project.assignments ?? {})) {
      for (const partNumber of assignment.partNumbers ?? []) {
        const normalized = String(partNumber ?? "").trim();
        if (!normalized) continue;
        const existing = counts.get(normalized) ?? { count: 0, sheets: new Set<string>() };
        existing.count += 1;
        existing.sheets.add(assignment.sheetName);
        counts.set(normalized, existing);
      }
    }

    return Array.from(counts.entries())
      .map(([partNumber, value]) => ({
        partNumber,
        count: value.count,
        sheets: Array.from(value.sheets).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((left, right) => right.count - left.count || left.partNumber.localeCompare(right.partNumber));
  }, [project.assignments]);

  const filteredRows = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return partRows;
    return partRows.filter((row) => row.partNumber.toLowerCase().includes(trimmed) || row.sheets.some((sheet) => sheet.toLowerCase().includes(trimmed)));
  }, [partRows, query]);

  const totalOccurrences = useMemo(() => partRows.reduce((sum, row) => sum + row.count, 0), [partRows]);

  const handleResyncTerminals = useCallback(async () => {
    setResyncing(true);
    setResyncMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/parts/resync-terminals`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        updatedPartCount?: number;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to resync part terminals");
      }

      setResyncMessage(
        payload.updatedPartCount
          ? `Resynced terminal intelligence for ${payload.updatedPartCount} part${payload.updatedPartCount === 1 ? "" : "s"}.`
          : "Terminal intelligence is already up to date.",
      );
    } catch (error) {
      setResyncMessage(error instanceof Error ? error.message : "Failed to resync part terminals");
    } finally {
      setResyncing(false);
    }
  }, [project.id]);

  if (partRows.length === 0) {
    return (
      <EmptyTabState
        icon={Hash}
        title="No Part Numbers Yet"
        description="Part numbers will populate here after assignments and layout-driven enrichment are available for the project."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <StatItem icon={Hash} label="Unique Parts" value={String(partRows.length)} />
        <StatItem icon={Hash} label="Occurrences" value={String(totalOccurrences)} color={project.color} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search part numbers or sheet names..."
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {filteredRows.length} shown
        </Badge>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => onNavigateToTab?.("assignments")}
        >
          Open Assignments
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => void handleResyncTerminals()}
          disabled={resyncing}
        >
          <RefreshCcw className={`h-3 w-3 ${resyncing ? "animate-spin" : ""}`} />
          Resync Part Terminals
        </Button>
      </div>
      {resyncMessage ? <p className="text-xs text-muted-foreground">{resyncMessage}</p> : null}

      <div className="rounded-lg border border-border/50 bg-card/60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Part Number List</h4>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-md">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Part Number</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Count</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Assignments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredRows.slice(0, 50).map((row) => (
                <tr key={row.partNumber} className="align-top hover:bg-muted/20">
                  <td className="px-2 py-2 font-mono text-[11px]">{row.partNumber}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{row.count}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.sheets.slice(0, 3).map((sheet) => (
                        <Badge key={sheet} variant="outline" className="h-4 px-1 text-[9px]">
                          {sheet}
                        </Badge>
                      ))}
                      {row.sheets.length > 3 ? (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                          +{row.sheets.length - 3}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
