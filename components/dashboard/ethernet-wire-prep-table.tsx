"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWirePrepInstructionParts } from "@/components/dashboard/wire-prep-instruction";
import type { WirePreparationRow } from "@/components/dashboard/wire-preperation-table";

interface EthernetWirePrepTableProps {
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
  maxRows?: number;
  prepCount?: number;
  imageSrc?: string;
}

interface EthernetWirePrepGroup {
  id: string;
  rows: WirePreparationRow[];
}

interface DisplayEthernetRow {
  row: WirePreparationRow;
  displayFrom: string;
  displayTo: string;
}

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim().toUpperCase() || "";
}

function getGroupKey(row: WirePreparationRow): string {
  const label = (row.wireType || "").trim().toUpperCase();
  if (label) {
    return label;
  }

  return getBaseDeviceIdValue(row.fromDeviceId) || getBaseDeviceIdValue(row.toDeviceId);
}

function isEthernetWireId(wireId: string | undefined): boolean {
  return (wireId || "").trim().toUpperCase() === "ENET";
}

function normalizeDeviceId(deviceId: string | undefined): string {
  return (deviceId || "").trim().toUpperCase();
}

function buildDisplayRows(rows: WirePreparationRow[]): DisplayEthernetRow[] {
  const seenFrom = new Set<string>();
  const seenTo = new Set<string>();

  return rows.map((row) => {
    const fromValue = row.fromDeviceId || "-";
    const toValue = row.toDeviceId || "-";

    const normalizedFrom = normalizeDeviceId(row.fromDeviceId);
    const normalizedTo = normalizeDeviceId(row.toDeviceId);

    const displayFrom = normalizedFrom && seenFrom.has(normalizedFrom) ? "" : fromValue;
    const displayTo = normalizedTo && seenTo.has(normalizedTo) ? "" : toValue;

    if (normalizedFrom) {
      seenFrom.add(normalizedFrom);
    }

    if (normalizedTo) {
      seenTo.add(normalizedTo);
    }

    return {
      row,
      displayFrom,
      displayTo,
    };
  });
}

function buildEthernetGroups(rows: WirePreparationRow[]): EthernetWirePrepGroup[] {
  if (rows.length === 0) {
    return [];
  }

  const groups: EthernetWirePrepGroup[] = [];
  let currentGroupRows: WirePreparationRow[] = [rows[0]];
  let currentGroupKey = getGroupKey(rows[0]);

  for (let index = 1; index < rows.length; index += 1) {
    const currentRow = rows[index];
    const rowGroupKey = getGroupKey(currentRow);

    if (rowGroupKey === currentGroupKey) {
      currentGroupRows.push(currentRow);
      continue;
    }

    groups.push({
      id: `${currentGroupRows[0].key}-${groups.length}`,
      rows: currentGroupRows,
    });

    currentGroupRows = [currentRow];
    currentGroupKey = rowGroupKey;
  }

  groups.push({
    id: `${currentGroupRows[0].key}-${groups.length}`,
    rows: currentGroupRows,
  });

  return groups;
}

export function EthernetWirePrepTable({
  title,
  instruction,
  rows,
  maxRows = 400,
  prepCount,
  imageSrc = "/wire-prep/ethernet.png",
}: EthernetWirePrepTableProps) {
  const ethernetRows = rows.filter((row) => isEthernetWireId(row.wireId));
  const previewRows = maxRows > 0 ? ethernetRows.slice(0, maxRows) : ethernetRows;
  const groups = buildEthernetGroups(previewRows);
  const resolvedPrepCount = Math.min(prepCount ?? groups.length, groups.length);
  const { safeCount, normalizedInstruction } = getWirePrepInstructionParts(instruction, resolvedPrepCount);

  return (
    <Card className="w-full max-w-lg min-w-0 break-inside-avoid-column max-h-max gap-2 rounded-none py-2 shadow-none print:break-inside-avoid-page">
      <CardHeader className="gap-1 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-[12px] leading-tight">{title}</CardTitle>
            <CardDescription className="text-[10px] leading-tight">
              <span>Prepare </span>
              <span className="inline-flex min-w-4 items-center justify-center rounded-sm bg-muted px-1 font-semibold text-foreground">
                {safeCount}
              </span>
              {normalizedInstruction ? <span> {normalizedInstruction}</span> : null}
            </CardDescription>
          </div>
          {imageSrc ? <img src={imageSrc} alt="Ethernet" className="h-12.5 w-12.5 object-cover" /> : null}
        </div>
      </CardHeader>

      <CardContent className="px-3">
        <div className="rounded- min-w-0 border">
          <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-7 px-1.5 py-1 font-medium">#</th>
                <th className="px-1.5 py-1 font-medium">From</th>
                <th className="px-1.5 py-1 font-medium">To</th>
                <th className="w-20 px-1.5 py-1 font-medium">Label</th>
                <th className="w-16 px-1.5 py-1 font-medium">Gauge</th>
                <th className="w-20 px-1.5 py-1 font-medium">Wire ID</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) => {
                const displayRows = buildDisplayRows(group.rows);

                return displayRows.map((displayRow, rowIndex) => (
                  <tr
                    key={`${group.id}-${displayRow.row.key}`}
                    className={`border-b ${rowIndex === group.rows.length - 1 ? "border-b-2 border-b-zinc-400" : "border-b-border"} last:border-b-0`}
                  >
                    {rowIndex === 0 ? (
                      <td
                        rowSpan={group.rows.length}
                        className="border-r px-1.5 py-1 align-middle font-medium"
                      >
                        <div className="flex h-full items-center justify-center">{groupIndex + 1}</div>
                      </td>
                    ) : null}
                    <td className="px-1.5 py-0.5 align-top break-all">{displayRow.displayFrom}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{displayRow.displayTo}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{displayRow.row.wireType || "-"}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{displayRow.row.gaugeSize || "-"}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{displayRow.row.wireId || "-"}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
