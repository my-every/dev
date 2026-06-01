"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWirePrepInstructionParts } from "@/components/dashboard/wire-prep-instruction";
import type { WirePreparationRow } from "@/components/dashboard/wire-preperation-table";

interface ResistorsWirePrepTableProps {
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
  maxRows?: number;
  prepCount?: number;
  imageSrc?: string;
}

interface ResistorDisplayRow {
  id: string;
  terminal: string;
  deviceId: string;
}

interface ResistorDisplayGroup {
  id: string;
  fromTo: string;
  rows: ResistorDisplayRow[];
}

function normalizeDeviceId(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\s*:\s*/g, ": ");
}

function isResistorDeviceId(value: string): boolean {
  return /^(RR|VD)[A-Z0-9]*/i.test(value.trim());
}

function getResistorDeviceId(row: WirePreparationRow): string {
  const from = normalizeDeviceId(row.fromDeviceId || "");
  const to = normalizeDeviceId(row.toDeviceId || "");

  if (isResistorDeviceId(from)) {
    return from;
  }

  if (isResistorDeviceId(to)) {
    return to;
  }

  return "";
}

function splitDevice(deviceId: string): { base: string; terminal: string } {
  const [base, ...rest] = deviceId.split(":");
  return {
    base: (base || "").trim(),
    terminal: rest.join(":").trim(),
  };
}

function buildResistorGroups(rows: WirePreparationRow[]): ResistorDisplayGroup[] {
  const groups: ResistorDisplayGroup[] = [];

  for (let index = 0; index < rows.length; index += 2) {
    const pairRows = rows.slice(index, index + 2);
    if (pairRows.length === 0) {
      continue;
    }

    const displayRows: ResistorDisplayRow[] = pairRows.map((pairRow) => {
      const from = normalizeDeviceId(pairRow.fromDeviceId || "");
      const to = normalizeDeviceId(pairRow.toDeviceId || "");

      const resistorDeviceId = isResistorDeviceId(from) ? from : isResistorDeviceId(to) ? to : "";
      const counterpart = resistorDeviceId === from ? to : from;
      const { terminal } = splitDevice(counterpart);

      return {
        id: pairRow.key,
        terminal: terminal || "-",
        deviceId: resistorDeviceId || getResistorDeviceId(pairRow) || "-",
      };
    });

    const firstFrom = normalizeDeviceId(pairRows[0]?.fromDeviceId || "");
    const firstTo = normalizeDeviceId(pairRows[0]?.toDeviceId || "");
    const counterpart = isResistorDeviceId(firstFrom) ? firstTo : firstFrom;
    const { base } = splitDevice(counterpart);

    groups.push({
      id: `${pairRows[0].key}-${groups.length}`,
      fromTo: base || "-",
      rows: displayRows,
    });
  }

  return groups;
}

export function ResistorsWirePrepTable({
  title,
  instruction,
  rows,
  maxRows = 400,
  prepCount,
  imageSrc = "/wire-prep/resistors.png",
}: ResistorsWirePrepTableProps) {
  const previewRows = maxRows > 0 ? rows.slice(0, maxRows) : rows;
  const groups = buildResistorGroups(previewRows);
  const resolvedPrepCount = prepCount ?? groups.length;
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
          {imageSrc ? <img src={imageSrc} alt="Resistor" className="h-12.5 w-12.5 object-cover" /> : null}
        </div>
      </CardHeader>

      <CardContent className="px-3">
        <div className="rounded- min-w-0 border">
          <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-7 px-1.5 py-1 font-medium">#</th>
                <th className="px-1.5 py-1 font-medium">From - To</th>
                <th className="w-20 px-1.5 py-1 font-medium">Terminals</th>
                <th className="w-52 px-1.5 py-1 font-medium">Device ID</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) =>
                group.rows.map((row, rowIndex) => (
                  <tr
                    key={`${group.id}-${row.id}`}
                    className={`border-b ${rowIndex === group.rows.length - 1 ? "border-b-2 border-b-zinc-400" : "border-b-border"} last:border-b-0`}
                  >
                    {rowIndex === 0 ? (
                      <td rowSpan={group.rows.length} className="border-r px-1.5 py-1 align-middle font-medium">
                        <div className="flex h-full items-center justify-center">{groupIndex + 1}</div>
                      </td>
                    ) : null}
                    {rowIndex === 0 ? (
                      <td rowSpan={group.rows.length} className="border-r px-1.5 py-0.5 align-middle break-all">
                        {group.fromTo}
                      </td>
                    ) : null}
                    <td className="px-1.5 py-0.5 align-top break-all border-r">{row.terminal}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{`${row.deviceId}`}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}