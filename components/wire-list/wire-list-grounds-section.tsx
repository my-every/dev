"use client";

import { MoveHorizontal } from "lucide-react";
import { ClickableDeviceIdCell } from "@/components/device-details/clickable-device-id-cell";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LengthCell } from "@/components/wire-list/cells/length-cell";
import { LocationUrlCell } from "@/components/wire-list/cells/location-url-cell";
import { useProjectLookups } from "@/hooks/use-project-lookups";
import { useWireLengthEstimates } from "@/hooks/use-wire-length-estimates";
import { useDeviceDetailsContext } from "@/lib/device-details/context";
import { cn } from "@/lib/utils";
import { formatGaugeSizeDisplay } from "@/lib/workbook/semantic-wire-list-parser";
import type { SemanticWireListRow } from "@/lib/workbook/types";

interface WireListGroundsSectionProps {
  rows: SemanticWireListRow[];
  currentSheetName: string;
  projectId?: string;
  sheetSlug?: string;
  title?: string;
  className?: string;
}

export function WireListGroundsSection({
  rows,
  currentSheetName,
  projectId,
  sheetSlug,
  title = "Grounds",
  className,
}: WireListGroundsSectionProps) {
  const { openDeviceDetails } = useDeviceDetailsContext();
  const { blueLabelsSheet, partListSheet } = useProjectLookups();
  const { getRowLength } = useWireLengthEstimates({
    rows,
    blueLabelsSheet,
    partListSheet,
    sheetName: currentSheetName,
    enabled: true,
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <div className="font-mono text-sm text-muted-foreground sm:text-base">
          Total: {rows.length}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-foreground/15 bg-background shadow-sm">
        <div className="overflow-auto">
          <table data-slot="table" className="min-w-225 w-full border-collapse text-sm">
            <TableHeader className="bg-background">
              <TableRow className="border-b border-foreground/10 bg-background hover:bg-background">
                <TableHead colSpan={4} className="py-4 text-center font-semibold text-foreground">
                  From
                </TableHead>
                <TableHead className="py-4 text-center font-semibold text-foreground">
                  <MoveHorizontal className="mx-auto h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">To</span>
                </TableHead>
                <TableHead colSpan={2} className="py-4 text-center font-semibold text-foreground">
                  To
                </TableHead>
              </TableRow>

              <TableRow className="border-b border-foreground/10 bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Device ID
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  No.
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Color
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Size
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Length
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Device ID
                </TableHead>
                <TableHead className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground">
                  Location
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row) => {
                const location = row.toLocation || row.fromLocation || row.location || "";

                return (
                  <TableRow key={row.__rowId} className="border-b border-foreground/10 last:border-b-0">
                    <TableCell className="px-6 py-4 text-center font-mono text-sm font-semibold">
                      <ClickableDeviceIdCell deviceId={row.fromDeviceId} isFrom onClick={openDeviceDetails} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm">{row.wireNo || "-"}</TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm">{row.wireId || "-"}</TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm">
                      {row.gaugeSize ? formatGaugeSizeDisplay(row.gaugeSize) : "-"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm">
                      <LengthCell estimatedLength={getRowLength(row.__rowId)} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm font-semibold">
                      <ClickableDeviceIdCell deviceId={row.toDeviceId} onClick={openDeviceDetails} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono text-sm">
                      <LocationUrlCell
                        location={location}
                        projectId={projectId}
                        currentSheetSlug={sheetSlug}
                        className={!location ? "text-muted-foreground" : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      </div>
    </section>
  );
}