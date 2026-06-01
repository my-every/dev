"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWirePrepInstructionParts } from "@/components/dashboard/wire-prep-instruction";
import type { WirePreparationRow } from "@/components/dashboard/wire-preperation-table";

interface KtJumpersWirePrepTableProps {
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
  maxRows?: number;
  prepCount?: number;
  imageSrc?: string;
}

interface KtJumperGroup {
  id: string;
  rows: WirePreparationRow[];
}

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim().toUpperCase() || "";
}

function getGroupKey(row: WirePreparationRow): string {
  return getBaseDeviceIdValue(row.fromDeviceId) || getBaseDeviceIdValue(row.toDeviceId);
}

function buildGroups(rows: WirePreparationRow[]): KtJumperGroup[] {
  if (rows.length === 0) {
    return [];
  }

  const groups: KtJumperGroup[] = [];
  let currentRows: WirePreparationRow[] = [rows[0]];
  let currentKey = getGroupKey(rows[0]);

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowKey = getGroupKey(row);
    if (rowKey === currentKey) {
      currentRows.push(row);
      continue;
    }

    groups.push({ id: `${currentRows[0].key}-${groups.length}`, rows: currentRows });
    currentRows = [row];
    currentKey = rowKey;
  }

  groups.push({ id: `${currentRows[0].key}-${groups.length}`, rows: currentRows });
  return groups;
}

export function KtJumpersWirePrepTable({
  title,
  instruction,
  rows,
  maxRows = 400,
  prepCount,
  imageSrc,
}: KtJumpersWirePrepTableProps) {
  const previewRows = maxRows > 0 ? rows.slice(0, maxRows) : rows;
  const groups = buildGroups(previewRows);
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
          {imageSrc ? <img src={imageSrc} alt="KT jumper" className="h-12.5 w-12.5 object-cover" /> : null}
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
                <th className="w-20 px-1.5 py-1 font-medium">Wire</th>
                <th className="w-16 px-1.5 py-1 font-medium">Gauge</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) =>
                group.rows.map((row, rowIndex) => (
                  <tr
                    key={`${group.id}-${row.key}`}
                    className={`border-b ${rowIndex === group.rows.length - 1 ? "border-b-2 border-b-zinc-400" : "border-b-border"} last:border-b-0`}
                  >
                    {rowIndex === 0 ? (
                      <td rowSpan={group.rows.length} className="border-r px-1.5 py-1 align-middle font-medium">
                        <div className="flex h-full items-center justify-center">{groupIndex + 1}</div>
                      </td>
                    ) : null}
                    <td className="px-1.5 py-0.5 align-top break-all">{row.fromDeviceId || "-"}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{row.toDeviceId || "-"}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{row.wireId || "-"}</td>
                    <td className="px-1.5 py-0.5 align-top break-all">{row.gaugeSize || "-"}</td>
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