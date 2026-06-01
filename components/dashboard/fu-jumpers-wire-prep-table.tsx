"use client";

import {
  PairGroupWirePrepTable,
  type PairGroupWirePrepGroup,
} from "@/components/dashboard/pair-group-wire-prep-table";
import type { WirePreparationRow } from "@/components/dashboard/wire-preperation-table";

interface FuJumpersWirePrepTableProps {
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

function parseFuDeviceNumber(baseDeviceId: string): number | null {
  const match = baseDeviceId.match(/^FU(\d+)$/i);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function getRowEndpointBases(row: WirePreparationRow): string[] {
  const fromBase = getBaseDeviceIdValue(row.fromDeviceId);
  const toBase = getBaseDeviceIdValue(row.toDeviceId);
  return Array.from(new Set([fromBase, toBase].filter(Boolean)));
}

function areRowsSequentialByFuDevices(left: WirePreparationRow, right: WirePreparationRow): boolean {
  const leftBases = getRowEndpointBases(left);
  const rightBases = getRowEndpointBases(right);

  for (const leftBase of leftBases) {
    for (const rightBase of rightBases) {
      if (leftBase === rightBase) {
        return true;
      }

      const leftNumber = parseFuDeviceNumber(leftBase);
      const rightNumber = parseFuDeviceNumber(rightBase);
      if (leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) === 1) {
        return true;
      }
    }
  }

  return false;
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

function buildDeviceChain(rows: WirePreparationRow[]): string[] {
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

function buildFuJumperGroups(rows: WirePreparationRow[]): PairGroupWirePrepGroup[] {
  if (rows.length === 0) {
    return [];
  }

  const groups: PairGroupWirePrepGroup[] = [];
  let currentGroupRows: WirePreparationRow[] = [rows[0]];

  for (let index = 1; index < rows.length; index += 1) {
    const currentRow = rows[index];
    if (areRowsSequentialByFuDevices(rows[index - 1], currentRow)) {
      currentGroupRows.push(currentRow);
      continue;
    }

    groups.push({
      id: `${currentGroupRows[0].key}-${groups.length}`,
      lines: buildDeviceChain(currentGroupRows).map((deviceId, deviceIndex) => ({
        id: `${currentGroupRows[0].key}-${deviceIndex}`,
        from: deviceId,
        to: "",
      })),
      connectorCount: getUniqueDeviceCount(currentGroupRows),
    });

    currentGroupRows = [currentRow];
  }

  groups.push({
    id: `${currentGroupRows[0].key}-${groups.length}`,
    lines: buildDeviceChain(currentGroupRows).map((deviceId, deviceIndex) => ({
      id: `${currentGroupRows[0].key}-${deviceIndex}`,
      from: deviceId,
      to: "",
    })),
    connectorCount: getUniqueDeviceCount(currentGroupRows),
  });

  return groups;
}

export function FuJumpersWirePrepTable({
  title,
  instruction,
  rows,
  maxRows = 400,
  prepCount,
  imageSrc = "/wire-prep/fu-jumpers.png",
}: FuJumpersWirePrepTableProps) {
  const previewRows = maxRows > 0 ? rows.slice(0, maxRows) : rows;
  const groups = buildFuJumperGroups(previewRows);
  const resolvedPrepCount = Math.min(prepCount ?? groups.length, groups.length);

  return (
    <PairGroupWirePrepTable
      title={title}
      instruction={instruction}
      groups={groups}
      imageSrc={imageSrc}
      imageAlt="FU jumper"
      countLabel="Devices"
      prepCount={resolvedPrepCount}
    />
  );
}