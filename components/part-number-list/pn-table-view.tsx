"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPartNumberEntries, type PartNumberEntry } from "@/lib/part-number-list";
import type { ParsedWorkbookSheet, SheetMetadataInfo } from "@/lib/workbook/types";
import type { SheetSchema } from "@/types/sheet-schema";
import { SheetMetadataPanel } from "@/components/wire-list/sheet-metadata-panel";
import { DeviceProperty } from "@/components/device/device-property";
import { ClickableDeviceIdCell } from "@/components/device-details/clickable-device-id-cell";
import { useDeviceDetailsContext } from "@/lib/device-details/context";
import { LocationUrlCell } from "@/components/wire-list/cells/location-url-cell";

interface Props {
  sheetData?: ParsedWorkbookSheet;
  sheetSchema?: SheetSchema;
  metadata?: SheetMetadataInfo;
  title: string;
  projectId?: string;
  currentSheetSlug?: string;
}

const PAGE_SIZE = 50;

function splitPartNumbers(partNumber: string): string[] {
  return Array.from(new Set(
    partNumber
      .split(/[\n,;]/)
      .map(value => value.trim())
      .filter(Boolean)
  ));
}

function PartNumberTokens({ partNumbers }: { partNumbers: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (partNumbers.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const visiblePartNumbers = isExpanded ? partNumbers : partNumbers.slice(0, 1);
  const remainingCount = Math.max(0, partNumbers.length - visiblePartNumbers.length);

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
      {visiblePartNumbers.map((partNumber) => (
        <span
          key={partNumber}
          className="rounded bg-muted px-2 py-1"
        >
          {partNumber}
        </span>
      ))}

      {partNumbers.length > 1 ? (
        <button
          type="button"
          onClick={() => setIsExpanded(current => !current)}
          className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={isExpanded ? "Collapse part numbers" : `Show ${remainingCount} more part numbers`}
        >
          {isExpanded ? "Show less" : `+${remainingCount}`}
        </button>
      ) : null}
    </div>
  );
}

export function PartNumberListView({ sheetData: sheetDataProp, sheetSchema, metadata, title, projectId, currentSheetSlug }: Props) {
  const { openDeviceDetails } = useDeviceDetailsContext();
  const [search, setSearch] = useState("");

  // Build a ParsedWorkbookSheet-compatible object from SheetSchema if needed
  const sheetData = useMemo<ParsedWorkbookSheet | null>(() => {
    if (sheetDataProp) return sheetDataProp;
    if (!sheetSchema) return null;
    return {
      originalName: sheetSchema.name,
      slug: sheetSchema.slug,
      headers: sheetSchema.headers,
      rows: sheetSchema.rawRows ?? [],
      rowCount: sheetSchema.rowCount,
      columnCount: sheetSchema.headers.length,
      sheetIndex: sheetSchema.sheetIndex,
      warnings: sheetSchema.warnings,
      metadata: sheetSchema.metadata,
    };
  }, [sheetDataProp, sheetSchema]);
  const [activeLoc, setActiveLoc] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const entries = useMemo(() => getPartNumberEntries(sheetData), [sheetData]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.location && set.add(e.location));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (activeLoc) result = result.filter((e) => e.location === activeLoc);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.deviceId.toLowerCase().includes(q) ||
          e.partNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, activeLoc, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PartNumberEntry[]>();
    filtered.forEach((e) => {
      const loc = e.location || "Unknown";
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(e);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([location, items]) => ({ location, entries: items }));
  }, [filtered]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;

  let count = 0;
  const paginated = grouped
    .map((g) => {
      const start = count;
      count += g.entries.length;
      if (count <= startIdx || start >= endIdx) return null;
      const sliceStart = Math.max(0, startIdx - start);
      const sliceEnd = Math.min(g.entries.length, endIdx - start);
      return { location: g.location, entries: g.entries.slice(sliceStart, sliceEnd) };
    })
    .filter(Boolean) as { location: string; entries: PartNumberEntry[] }[];

  return (
    <div className="flex flex-col h-full">
      {metadata && <SheetMetadataPanel metadata={metadata} />}

      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="outline">{filtered.length} devices</Badge>
        </div>

        {locations.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeLoc === null ? "default" : "outline"}
              onClick={() => { setActiveLoc(null); setPage(1); }}
            >
              All ({entries.length})
            </Button>
            {locations.map((loc) => (
              <Button
                key={loc}
                size="sm"
                variant={activeLoc === loc ? "default" : "outline"}
                onClick={() => { setActiveLoc(loc); setPage(1); }}
              >
                {loc} ({entries.filter((e) => e.location === loc).length})
              </Button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices, part numbers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-35">Device ID</TableHead>
              <TableHead className="w-40">Reference Image</TableHead>
              <TableHead className="w-50">Part Number(s)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-35">Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No entries found
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((g, gi) => (
                <React.Fragment key={`g-${gi}-${g.location}`}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={5} className="font-medium text-xs uppercase tracking-wide py-2">
                      LOCATION: {g.location}
                    </TableCell>
                  </TableRow>
                  {g.entries.map((e, ri) => (
                    <TableRow key={`r-${gi}-${ri}-${e.deviceId}`} className="align-middle">
                      {(() => {
                        const partNumbers = splitPartNumbers(e.partNumber);

                        return (
                          <>
                            <TableCell className="align-middle">
                              <ClickableDeviceIdCell deviceId={e.deviceId} onClick={openDeviceDetails} />
                            </TableCell>
                            <TableCell className="align-middle">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {partNumbers.map((partNumber) => (
                                  <DeviceProperty
                                    key={`${e.deviceId}-image-${partNumber}`}
                                    type="referenceImage"
                                    pn={partNumber}
                                    className="h-16 w-16"
                                    fallback={null}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="align-middle">
                              <PartNumberTokens partNumbers={partNumbers} />
                            </TableCell>
                            <TableCell className="text-sm align-middle">{e.description}</TableCell>
                            <TableCell className="text-sm align-middle">
                              <LocationUrlCell location={e.location} projectId={projectId} currentSheetSlug={currentSheetSlug} />
                            </TableCell>
                          </>
                        );
                      })()}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startIdx + 1}-{Math.min(endIdx, totalItems)} of {totalItems}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
