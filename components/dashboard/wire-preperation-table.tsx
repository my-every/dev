"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IdentificationFilterKind } from "@/lib/wiring-identification";
import { MechanicalRelayJumpersPrepTable } from "@/components/dashboard/mechanical-relay-jumpers-prep-table";
import { ResistorsWirePrepTable } from "@/components/dashboard/resistors-wire-prep-table";
import { ClipsWirePrepTable } from "@/components/dashboard/clips-wire-prep-table";
import { FuJumpersWirePrepTable } from "@/components/dashboard/fu-jumpers-wire-prep-table";
import { CablesWirePrepTable } from "@/components/dashboard/cables-wire-prep-table";
import { EthernetWirePrepTable } from "@/components/dashboard/ethernet-wire-prep-table";
import { KtJumpersWirePrepTable } from "@/components/dashboard/kt-jumpers-wire-prep-table";
import { KaTwinFerrulesWirePrepTable } from "@/components/dashboard/ka-twin-ferrules-wire-prep-table";
import { GroundsWirePrepTable } from "@/components/dashboard/grounds-wire-prep-table";
import { VioJumpersWirePrepTable } from "@/components/dashboard/vio-jumpers-wire-prep-table";
import { getWirePrepInstructionParts } from "@/components/dashboard/wire-prep-instruction";

export interface WirePreparationRow {
  key: string;
  fromDeviceId: string;
  toDeviceId: string;
  wireId: string;
  wireType?: string;
  gaugeSize: string;
  instruction: string;
}

type WirePreparationColumnKey = "from" | "to" | "wire" | "gauge";

interface WirePreperationTableProps {
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
  kind?: IdentificationFilterKind;
  maxRows?: number;
  prepCount?: number;
  visibleColumns?: WirePreparationColumnKey[];
}

const WIRE_PREP_IMAGE_BY_KIND: Partial<Record<IdentificationFilterKind, string>> = {
  ka_relay_plugin_jumpers: "/wire-prep/relay-mechanical-jumpers.png",
  resistors: "/wire-prep/resistors.png",
};

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim().toUpperCase() || "";
}

function getDeviceSeriesInfo(deviceId: string | undefined): { prefix: string; number: number | null } {
  const base = getBaseDeviceIdValue(deviceId);
  const match = base.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return { prefix: base, number: null };
  }

  return { prefix: match[1], number: Number(match[2]) };
}

function isSequentialDevice(prevDeviceId: string, nextDeviceId: string): boolean {
  const prev = getDeviceSeriesInfo(prevDeviceId);
  const next = getDeviceSeriesInfo(nextDeviceId);
  if (prev.number === null || next.number === null) {
    return false;
  }

  return prev.prefix === next.prefix && Math.abs(prev.number - next.number) === 1;
}

function isEthernetWireId(wireId: string | undefined): boolean {
  return (wireId || "").trim().toUpperCase() === "ENET";
}

function getGroupEndIndexes(rows: WirePreparationRow[], kind?: IdentificationFilterKind): Set<number> {
  const groupEnds = new Set<number>();
  if (rows.length === 0) {
    return groupEnds;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const currentRow = rows[index];
    const nextRow = rows[index + 1];
    if (!nextRow) {
      groupEnds.add(index);
      break;
    }

    if (kind === "cables" || kind === "clips" || kind === "vio_jumpers" || kind === "fu_jumpers") {
      const currentBase = getBaseDeviceIdValue(currentRow.fromDeviceId) || getBaseDeviceIdValue(currentRow.toDeviceId);
      const nextBase = getBaseDeviceIdValue(nextRow.fromDeviceId) || getBaseDeviceIdValue(nextRow.toDeviceId);
      if (currentBase !== nextBase) {
        groupEnds.add(index);
      }
      continue;
    }

    if (kind === "resistors") {
      // Resistors are reviewed in pairings; place a darker separator after each pair.
      if ((index + 1) % 2 === 0) {
        groupEnds.add(index);
      }
      continue;
    }

    if (kind === "ka_relay_plugin_jumpers") {
      const fromSequential = isSequentialDevice(currentRow.fromDeviceId, nextRow.fromDeviceId);
      const toSequential = isSequentialDevice(currentRow.toDeviceId, nextRow.toDeviceId);
      if (!fromSequential && !toSequential) {
        groupEnds.add(index);
      }
      continue;
    }
  }

  return groupEnds;
}

export function WirePreperationTable({
  title,
  instruction,
  rows,
  kind,
  maxRows = 400,
  prepCount,
  visibleColumns = ["from", "to", "wire", "gauge"],
}: WirePreperationTableProps) {
  const previewRows = maxRows > 0 ? rows.slice(0, maxRows) : rows;
  const imageSrc = kind ? WIRE_PREP_IMAGE_BY_KIND[kind] : undefined;
  const resolvedPrepCount = prepCount ?? previewRows.length;
  const { safeCount, normalizedInstruction } = getWirePrepInstructionParts(instruction, resolvedPrepCount);

  if (kind === "ka_relay_plugin_jumpers") {
    return (
      <MechanicalRelayJumpersPrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "resistors") {
    return (
      <ResistorsWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={prepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "clips") {
    return (
      <ClipsWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "fu_jumpers") {
    return (
      <FuJumpersWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "kt_jumpers") {
    return (
      <KtJumpersWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "ka_twin_ferrules") {
    return (
      <KaTwinFerrulesWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "grounds") {
    return (
      <GroundsWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "vio_jumpers") {
    return (
      <VioJumpersWirePrepTable
        title={title}
        instruction={instruction}
        rows={previewRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  if (kind === "cables") {
    const ethernetRows = previewRows.filter((row) => isEthernetWireId(row.wireId));
    const nonEthernetRows = previewRows.filter((row) => !isEthernetWireId(row.wireId));

    if (ethernetRows.length > 0 && nonEthernetRows.length > 0) {
      return (
        <div className="flex min-w-0 flex-col gap-3">
          <EthernetWirePrepTable
            title="Ethernet Cables"
            instruction={instruction}
            rows={ethernetRows}
            maxRows={maxRows}
          />
          <CablesWirePrepTable
            title={title}
            instruction={instruction}
            rows={nonEthernetRows}
            maxRows={maxRows}
            imageSrc={imageSrc}
          />
        </div>
      );
    }

    if (ethernetRows.length > 0) {
      return (
        <EthernetWirePrepTable
          title="Ethernet Cables"
          instruction={instruction}
          rows={ethernetRows}
          maxRows={maxRows}
        />
      );
    }

    return (
      <CablesWirePrepTable
        title={title}
        instruction={instruction}
        rows={nonEthernetRows}
        maxRows={maxRows}
        prepCount={resolvedPrepCount}
        imageSrc={imageSrc}
      />
    );
  }

  const groupEndIndexes = getGroupEndIndexes(previewRows, kind);
  const wireColumnLabel = kind === "cables" ? "Label" : "Wire";

  const showFrom = visibleColumns.includes("from");
  const showTo = visibleColumns.includes("to");
  const showWire = visibleColumns.includes("wire");
  const showGauge = visibleColumns.includes("gauge");

  return (
    <Card className="w-full max-w-lg min-w-0 break-inside-avoid-column max-h-max gap-2 rounded-none py-2 shadow-none print:break-inside-avoid-page">
      <CardHeader className="gap-2 px-3">
        <CardTitle className="text-[12px] mb-2 leading-tight">{title}</CardTitle>
        <CardDescription className="text-[10px] mt-2 leading-tight">
          <span>Prepare </span>
          <span className="inline-flex min-w-4 items-center justify-center rounded-sm bg-muted px-1 font-semibold text-foreground">
            {safeCount}
          </span>
          {normalizedInstruction ? <span> {normalizedInstruction}</span> : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-3">
        <div className="rounded- min-w-0 border">
          <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                {showFrom ? <th className="px-1.5 py-1 font-medium">From</th> : null}
                {showTo ? <th className="px-1.5 py-1 font-medium">To</th> : null}
                {showWire ? <th className="px-1.5 py-1 font-medium">{wireColumnLabel}</th> : null}
                {showGauge ? <th className="px-1.5 py-1 font-medium">Gauge</th> : null}
               
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`border-b ${groupEndIndexes.has(index) ? "border-b-2 border-b-zinc-400!" : "border-b-border"} last:border-b-0`}
                >
                  {showFrom ? <td className="px-1.5 py-0.5 align-top break-all">{row.fromDeviceId || "-"}</td> : null}
                  {showTo ? <td className="px-1.5 py-0.5 align-top break-all">{row.toDeviceId || "-"}</td> : null}
                  {showWire ? <td className="px-1.5 py-0.5 align-top break-all">{(kind === "cables" ? row.wireType : row.wireId) || "-"}</td> : null}
                  {showGauge ? <td className="px-1.5 py-0.5 align-top break-all">{row.gaugeSize || "-"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
