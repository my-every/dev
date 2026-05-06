"use client";

import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { WireListStandardTableModel } from "@/lib/wire-list-sheet-document/types";

interface WireListReviewTableProps {
  model: WireListStandardTableModel;
}

function matchesSearchValue(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function WireListReviewTable({ model }: WireListReviewTableProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const sections = useMemo(() => {
    if (!normalizedQuery) {
      return model.sections;
    }

    return model.sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter((row) =>
          [
            row.sectionLabel,
            row.location,
            row.fromDeviceId,
            row.toDeviceId,
            row.fromLocation,
            row.toLocation,
            row.wireNo,
            row.wireId,
            row.gaugeSize,
          ].some((value) => matchesSearchValue(value, normalizedQuery)),
        ),
      }))
      .filter((section) => section.rows.length > 0)
      .map((section) => ({
        ...section,
        rowCount: section.rows.length,
      }));
  }, [model.sections, normalizedQuery]);

  const visibleRowCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.rows.length, 0),
    [sections],
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl border bg-card shadow-sm overflow-hidden">
      <div className="border-b bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Editable Wire List Review Table</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {visibleRowCount} visible rows across {sections.length} sections
            </div>
          </div>
          <Badge variant="outline">{model.totalRows} total rows</Badge>
        </div>

        <div className="mt-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by section, device, location, wire no., or wire id"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="min-w-[1140px]">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="bg-muted/40 hover:bg-muted/40">
             
              <TableHead className="w-[180px]">From Device</TableHead>
              <TableHead className="w-[120px]">Wire No.</TableHead>
              <TableHead className="w-[120px]">Wire ID</TableHead>
              <TableHead className="w-[110px]">Gauge</TableHead>
             
              <TableHead className="w-[180px]">To Device</TableHead>
              <TableHead className="w-[160px]">To Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No rows match the current review filter.
                </TableCell>
              </TableRow>
            ) : (
              sections.map((section) => (
                <Fragment key={section.id}>
                  <TableRow className="bg-muted/15 hover:bg-muted/15">
                    <TableCell colSpan={9} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{section.sectionLabel}</span>
                        <Badge variant="secondary">{section.location}</Badge>
                        {section.isExternal ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            External
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{section.rowCount} rows</span>
                      </div>
                    </TableCell>
                  </TableRow>
                {section.rows.map((row) => (
                  <TableRow key={row.rowId}>
                  
                    <TableCell className="font-mono text-sm">{row.fromDeviceId || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{row.wireNo || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{row.wireId || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{row.gaugeSize || "-"}</TableCell>
            
                    <TableCell className="font-mono text-sm">{row.toDeviceId || "-"}</TableCell>
                    <TableCell className="text-sm">{row.toLocation || row.fromLocation || "-"}</TableCell>
                  </TableRow>
                ))}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
