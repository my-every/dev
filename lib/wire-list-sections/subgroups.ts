import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { IdentificationFilterKind, PatternMatchMetadata } from "@/lib/wiring-identification/types";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import { hasMechanicalRelayPartNumber } from "@/lib/wiring-identification/jumper-part-number";

import type { WireListCompiledSubgroup } from "./types";

/**
 * Device prefixes whose rows should be subgrouped by target device
 * and displayed with the target device in the FROM column.
 */
export const TARGET_PAIR_PREFIXES = new Set(["SB", "HL", "SA", "SH"]);

/**
 * Check whether a row's FROM/TO columns should be swapped to put
 * the target pair device in the FROM position.
 * Returns true when the TO device has a target prefix and the FROM does not.
 */
export function shouldSwapForTargetPair(fromDeviceId: string | undefined, toDeviceId: string | undefined): boolean {
  const fromPrefix = (fromDeviceId || "").split(":")[0]?.trim().toUpperCase().replace(/\d+$/, "") || "";
  const toPrefix = (toDeviceId || "").split(":")[0]?.trim().toUpperCase().replace(/\d+$/, "") || "";
  return TARGET_PAIR_PREFIXES.has(toPrefix) && !TARGET_PAIR_PREFIXES.has(fromPrefix);
}

const RUN_GROUP_KINDS = new Set<IdentificationFilterKind>([
  "fu_jumpers",
  "ka_jumpers",
  "kt_jumpers",
  "vio_jumpers",
  "ka_relay_plugin_jumpers",
]);

function buildRunLabel(kind: IdentificationFilterKind, metadata: PatternMatchMetadata): string | null {
  const runId = String(metadata.meta.runId ?? "").trim();
  if (!runId) {
    return null;
  }

  const startDevice = String(metadata.meta.startDevice ?? "").trim();
  const endDevice = String(metadata.meta.endDevice ?? "").trim();
  const terminal = String(metadata.meta.terminal ?? "").toUpperCase().trim();

  if (kind === "ka_relay_plugin_jumpers" && terminal && startDevice && endDevice) {
    return `${terminal}: ${startDevice} -> ${endDevice}`;
  }

  if (kind === "fu_jumpers" && startDevice && endDevice) {
    return `${startDevice}-${endDevice}`;
  }

  // VIO jumpers: use the runId directly (base device ID, e.g. "XT0089")
  if (kind === "vio_jumpers") {
    return runId;
  }

  if (startDevice && endDevice) {
    return `${startDevice} -> ${endDevice}`;
  }

  return runId;
}

function buildPairLabel(kind: IdentificationFilterKind, metadata: PatternMatchMetadata): string | null {
  if (kind === "ka_twin_ferrules") {
    const deviceId = String(metadata.meta.deviceId ?? "").trim();
    const terminal = String(metadata.meta.terminal ?? "").trim();
    const wireNo = String(metadata.meta.wireNo ?? "").trim();

    if (deviceId && terminal && wireNo) {
      return `${deviceId}:${terminal} / ${wireNo}`;
    }

    return null;
  }

  if (kind === "resistors") {
    const pairLabel = String(metadata.meta.pairLabel ?? "").trim();

    if (pairLabel) {
      return pairLabel;
    }
  }

  return null;
}

function getBaseDeviceId(deviceId: string | undefined): string {
  return (deviceId || "").split(":")[0]?.trim().toUpperCase() || "";
}

function getDevicePrefix(deviceId: string | undefined): string {
  const baseDeviceId = getBaseDeviceId(deviceId);
  const match = baseDeviceId.match(/^([A-Z]+)/);
  return match?.[1] ?? baseDeviceId;
}

function getDeviceTerminal(deviceId: string | undefined): string {
  return deviceId?.split(":")[1]?.trim().toUpperCase() || "";
}

function getSingleConnectionFamilyLabel(
  deviceId: string | undefined,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): string {
  const prefix = getDevicePrefix(deviceId);
  const terminal = getDeviceTerminal(deviceId);

  if (
    prefix === "KA" &&
    (terminal === "A1" || terminal === "A2") &&
    hasMechanicalRelayPartNumber(deviceId || "", partNumberMap)
  ) {
    return `${prefix}:${terminal}`;
  }

  return prefix;
}

function buildSingleConnectionSubgroups(
  rows: SemanticWireListRow[],
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): WireListCompiledSubgroup[] {
  const sourceDeviceGroups = new Map<string, {
    rowIds: string[];
    startRowId: string;
    order: number;
  }>();
  const exactDeviceGroups = new Map<string, {
    fromBase: string;
    toBase: string;
    rowIds: string[];
    startRowId: string;
    order: number;
  }>();

  rows.forEach((row, index) => {
    const fromBase = getBaseDeviceId(row.fromDeviceId);
    const toBase = getBaseDeviceId(row.toDeviceId);

    const sourceGroup = sourceDeviceGroups.get(fromBase);
    if (sourceGroup) {
      sourceGroup.rowIds.push(row.__rowId);
    } else if (fromBase) {
      sourceDeviceGroups.set(fromBase, {
        rowIds: [row.__rowId],
        startRowId: row.__rowId,
        order: index,
      });
    }

    const key = `${fromBase}->${toBase}`;
    const existing = exactDeviceGroups.get(key);

    if (existing) {
      existing.rowIds.push(row.__rowId);
      return;
    }

    exactDeviceGroups.set(key, {
      fromBase,
      toBase,
      rowIds: [row.__rowId],
      startRowId: row.__rowId,
      order: index,
    });
  });

  const groupedRowIds = new Set<string>();
  const subgroups: WireListCompiledSubgroup[] = [];

  // Tier 0: Target Device Pair Groups (SB, HL, SA, SH)
  // Group rows where target pair devices appear in either FROM or TO,
  // prioritized before all other device prefix groups.
  const targetDeviceGroups = new Map<string, {
    rowIds: string[];
    startRowId: string;
    order: number;
  }>();

  rows.forEach((row, index) => {
    const toBase = getBaseDeviceId(row.toDeviceId);
    const fromBase = getBaseDeviceId(row.fromDeviceId);
    const toPrefix = getDevicePrefix(row.toDeviceId);
    const fromPrefix = getDevicePrefix(row.fromDeviceId);

    let targetDevice: string | null = null;
    if (TARGET_PAIR_PREFIXES.has(toPrefix) && toBase) {
      targetDevice = toBase;
    } else if (TARGET_PAIR_PREFIXES.has(fromPrefix) && fromBase) {
      targetDevice = fromBase;
    }

    if (!targetDevice) return;

    const existing = targetDeviceGroups.get(targetDevice);
    if (existing) {
      existing.rowIds.push(row.__rowId);
    } else {
      targetDeviceGroups.set(targetDevice, {
        rowIds: [row.__rowId],
        startRowId: row.__rowId,
        order: index,
      });
    }
  });

  const sortedTargetEntries = Array.from(targetDeviceGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  sortedTargetEntries.forEach(([deviceBase, group], idx) => {
    group.rowIds.forEach((rowId) => groupedRowIds.add(rowId));
    subgroups.push({
      id: `single-target-pair:${deviceBase}`,
      kind: "device_family",
      label: deviceBase,
      tone: "muted",
      rowIds: group.rowIds,
      startRowId: group.startRowId,
      order: -(sortedTargetEntries.length - idx),
    });
  });

  Array.from(sourceDeviceGroups.entries())
    .sort((left, right) => left[1].order - right[1].order)
    .forEach(([fromBase, group]) => {
      if (!fromBase || group.rowIds.length < 2) {
        return;
      }

      // Exclude rows already claimed by Tier 0 target device pair groups
      const remainingRowIds = group.rowIds.filter((rowId) => !groupedRowIds.has(rowId));
      if (remainingRowIds.length < 2) {
        return;
      }

      remainingRowIds.forEach((rowId) => groupedRowIds.add(rowId));
      subgroups.push({
        id: `single-source:${fromBase}`,
        kind: "device_family",
        label: fromBase,
        tone: "muted",
        rowIds: remainingRowIds,
        startRowId: remainingRowIds[0],
        order: group.order,
      });
    });

  Array.from(exactDeviceGroups.values())
    .sort((left, right) => left.order - right.order)
    .forEach((group) => {
      if (
        group.rowIds.length < 2 ||
        !group.fromBase ||
        !group.toBase ||
        group.rowIds.some((rowId) => groupedRowIds.has(rowId))
      ) {
        return;
      }

      group.rowIds.forEach((rowId) => groupedRowIds.add(rowId));
      subgroups.push({
        id: `single-device:${group.fromBase}:${group.toBase}`,
        kind: "device_family",
        label: group.fromBase,
        tone: "muted",
        rowIds: group.rowIds,
        startRowId: group.startRowId,
        order: group.order,
      });
    });

  const prefixGroups = new Map<string, {
    fromPrefix: string;
    toPrefix: string;
    label: string;
    rowIds: string[];
    startRowId: string;
    order: number;
  }>();

  rows.forEach((row, index) => {
    if (groupedRowIds.has(row.__rowId)) {
      return;
    }

    const fromPrefix = getSingleConnectionFamilyLabel(row.fromDeviceId, partNumberMap);
    const toPrefix = getDevicePrefix(row.toDeviceId);
    const key = `${fromPrefix}->${toPrefix}`;
    const label = fromPrefix && toPrefix
      ? `${fromPrefix} - ${toPrefix}`
      : fromPrefix || toPrefix || "Single Connection";
    const existing = prefixGroups.get(key);

    if (existing) {
      existing.rowIds.push(row.__rowId);
      return;
    }

    prefixGroups.set(key, {
      fromPrefix,
      toPrefix,
      label,
      rowIds: [row.__rowId],
      startRowId: row.__rowId,
      order: index,
    });
  });

  const mergedSingletonPrefixGroups = new Map<string, {
    toPrefix: string;
    fromPrefixes: string[];
    rowIds: string[];
    startRowId: string;
    order: number;
  }>();

  Array.from(prefixGroups.entries())
    .sort((left, right) => left[1].order - right[1].order)
    .forEach(([key, group]) => {
      if (!skipSingletonMerge && group.rowIds.length === 1 && group.toPrefix) {
        const existing = mergedSingletonPrefixGroups.get(group.toPrefix);

        if (existing && existing.fromPrefixes.length < 3) {
          existing.rowIds.push(...group.rowIds);
          if (group.fromPrefix && !existing.fromPrefixes.includes(group.fromPrefix)) {
            existing.fromPrefixes.push(group.fromPrefix);
          }
          return;
        }

        if (!existing) {
          mergedSingletonPrefixGroups.set(group.toPrefix, {
            toPrefix: group.toPrefix,
            fromPrefixes: group.fromPrefix ? [group.fromPrefix] : [],
            rowIds: [...group.rowIds],
            startRowId: group.startRowId,
            order: group.order,
          });
          return;
        }
      }

      subgroups.push({
        id: `single-prefix:${key}`,
        kind: "device_family",
        label: group.label,
        tone: "muted",
        rowIds: group.rowIds,
        startRowId: group.startRowId,
        order: group.order,
      });
    });

  mergedSingletonPrefixGroups.forEach((group) => {
    const sourceLabel = group.fromPrefixes.join("/");
    const label = sourceLabel
      ? `${sourceLabel} - ${group.toPrefix}`
      : group.toPrefix;

    subgroups.push({
      id: `single-prefix-merged:${group.toPrefix}`,
      kind: "device_family",
      label,
      tone: "muted",
      rowIds: group.rowIds,
      startRowId: group.startRowId,
      order: group.order,
    });
  });

  return subgroups.sort((left, right) => left.order - right.order);
}

function buildAllSubgroups(
  kind: IdentificationFilterKind,
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata>,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): WireListCompiledSubgroup[] {
  if (kind === "single_connections") {
    return buildSingleConnectionSubgroups(rows, partNumberMap, skipSingletonMerge);
  }

  const subgroups: WireListCompiledSubgroup[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const metadata = matchMetadata[row.__rowId];
    if (!metadata) {
      return;
    }

    if (RUN_GROUP_KINDS.has(kind)) {
      const runId = String(metadata.meta.runId ?? "").trim();
      const label = buildRunLabel(kind, metadata);

      if (runId && label && !seen.has(`run:${runId}`)) {
        seen.add(`run:${runId}`);
        subgroups.push({
          id: `run:${runId}`,
          kind: "run",
          label,
          tone: "muted",
          rowIds: rows.filter((candidate) => String(matchMetadata[candidate.__rowId]?.meta.runId ?? "").trim() === runId).map((candidate) => candidate.__rowId),
          startRowId: row.__rowId,
          order: index,
        });
      }
    }

    if (kind === "ka_twin_ferrules" || kind === "resistors") {
      // For resistors, group by resistor device ID so all pairs for the same
      // device (e.g. RRRB31) appear under a single subgroup header.
      const rawPairId = kind === "ka_twin_ferrules"
        ? String(metadata.meta.groupKey ?? "").trim()
        : String(metadata.meta.resistorDeviceId ?? metadata.meta.pairId ?? "").trim();
      const label = kind === "resistors"
        ? String(metadata.meta.resistorDeviceId ?? "").trim() || buildPairLabel(kind, metadata)
        : buildPairLabel(kind, metadata);
      const tone = kind === "resistors"
        ? (String(metadata.meta.pairTone ?? "muted").trim() as WireListCompiledSubgroup["tone"])
        : "muted";
      const description = kind === "resistors"
        ? String(metadata.meta.pairDescription ?? "").trim() || undefined
        : undefined;

      if (rawPairId && label && !seen.has(`pair:${rawPairId}`)) {
        seen.add(`pair:${rawPairId}`);
        subgroups.push({
          id: `pair:${rawPairId}`,
          kind: "pair",
          label,
          tone,
          description,
          rowIds: rows.filter((candidate) => {
            const candidateMetadata = matchMetadata[candidate.__rowId];
            if (!candidateMetadata) {
              return false;
            }

            if (kind === "ka_twin_ferrules") {
              return String(candidateMetadata.meta.groupKey ?? "").trim() === rawPairId;
            }

            // Group all resistor rows sharing the same resistor device ID
            const candidateDeviceId = String(candidateMetadata.meta.resistorDeviceId ?? "").trim();
            return candidateDeviceId === rawPairId;
          }).map((candidate) => candidate.__rowId),
          startRowId: row.__rowId,
          order: index,
        });
      }
    }
  });

  return subgroups.sort((left, right) => left.order - right.order);
}

export function buildRenderableSectionSubgroups(
  kind: IdentificationFilterKind,
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata>,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): WireListCompiledSubgroup[] {
  const subgroups = buildAllSubgroups(kind, rows, matchMetadata, partNumberMap, skipSingletonMerge);

  if (kind === "single_connections") {
    return subgroups.filter((subgroup) => subgroup.kind === "device_family");
  }

  if (kind === "ka_twin_ferrules" || kind === "resistors") {
    return subgroups.filter((subgroup) => subgroup.kind === "pair");
  }

  if (RUN_GROUP_KINDS.has(kind)) {
    return subgroups.filter((subgroup) => subgroup.kind === "run");
  }

  return [];
}

export function buildSubgroupStartMap(
  subgroups: WireListCompiledSubgroup[],
): Record<string, WireListCompiledSubgroup[]> {
  const map: Record<string, WireListCompiledSubgroup[]> = {};

  for (const subgroup of subgroups) {
    if (!map[subgroup.startRowId]) {
      map[subgroup.startRowId] = [];
    }

    map[subgroup.startRowId]!.push(subgroup);
  }

  return map;
}