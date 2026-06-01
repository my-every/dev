"use client";

import {
  PairGroupWirePrepTable,
  type PairGroupWirePrepGroup,
} from "@/components/dashboard/pair-group-wire-prep-table";
import type { WirePreparationRow } from "@/components/dashboard/wire-preperation-table";

interface MechanicalRelayJumpersPrepTableProps {
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
  maxRows?: number;
  prepCount?: number;
  imageSrc?: string;
}

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

function getUniqueDeviceCount(rows: WirePreparationRow[]): number {
  const devices = new Set<string>();

  for (const row of rows) {
    const from = row.fromDeviceId?.trim();
    const to = row.toDeviceId?.trim();

    if (from) {
      devices.add(from.toUpperCase());
    }

    if (to) {
      devices.add(to.toUpperCase());
    }
  }

  return devices.size;
}

function buildRelayDeviceChain(rows: WirePreparationRow[]): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const endpoints = [row.fromDeviceId?.trim() || "", row.toDeviceId?.trim() || ""];
    for (const endpoint of endpoints) {
      if (!endpoint) {
        continue;
      }

      const normalized = endpoint.toUpperCase();
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      chain.push(endpoint);
    }
  }

  return chain;
}

function buildRelayConnectorGroups(rows: WirePreparationRow[]): PairGroupWirePrepGroup[] {
  if (rows.length === 0) {
    return [];
  }

  const groups: PairGroupWirePrepGroup[] = [];
  let currentGroup: WirePreparationRow[] = [rows[0]];

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];

    const fromSequential = isSequentialDevice(previous.fromDeviceId, current.fromDeviceId);
    const toSequential = isSequentialDevice(previous.toDeviceId, current.toDeviceId);

    if (fromSequential || toSequential) {
      currentGroup.push(current);
      continue;
    }

    groups.push({
      id: `${currentGroup[0].key}-${groups.length}`,
      lines: buildRelayDeviceChain(currentGroup).map((deviceId, deviceIndex) => ({
        id: `${currentGroup[0].key}-${deviceIndex}`,
        from: deviceId,
        to: "",
      })),
      connectorCount: getUniqueDeviceCount(currentGroup),
    });
    currentGroup = [current];
  }

  groups.push({
    id: `${currentGroup[0].key}-${groups.length}`,
    lines: buildRelayDeviceChain(currentGroup).map((deviceId, deviceIndex) => ({
      id: `${currentGroup[0].key}-${deviceIndex}`,
      from: deviceId,
      to: "",
    })),
    connectorCount: getUniqueDeviceCount(currentGroup),
  });

  return groups;
}

export function MechanicalRelayJumpersPrepTable({
  title,
  instruction,
  rows,
  maxRows = 400,
  prepCount,
  imageSrc = "/wire-prep/relay-mechanical-jumpers.png",
}: MechanicalRelayJumpersPrepTableProps) {
  const previewRows = maxRows > 0 ? rows.slice(0, maxRows) : rows;
  const groups = buildRelayConnectorGroups(previewRows);
  const resolvedPrepCount = prepCount ?? previewRows.length;

  return (
    <PairGroupWirePrepTable
      title={title}
      instruction={instruction}
      groups={groups}
      imageSrc={imageSrc}
      imageAlt="Relay cross connector"
      countLabel="Devices"
      prepCount={resolvedPrepCount}
    />
  );
}
