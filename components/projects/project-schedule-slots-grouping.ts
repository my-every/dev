"use client";

import type {
  GroupedDisplayEntry,
  ProjectScheduleSlotsTableRow,
} from "@/components/projects/project-schedule-slots-types";

function parseUnitForSort(unit: string): number {
  const parsed = Number(unit);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function buildGroupedDisplayEntries(
  filteredRows: ProjectScheduleSlotsTableRow[],
  multiUnitProjectLookup: Record<string, boolean>,
): GroupedDisplayEntry[] {
  const groupedRows = new Map<string, ProjectScheduleSlotsTableRow[]>();
  const orderedEntries: Array<
    | { type: "single"; row: ProjectScheduleSlotsTableRow }
    | { type: "group"; key: string }
  > = [];

  for (const row of filteredRows) {
    const isMultiUnit =
      multiUnitProjectLookup[row.pdNumber.trim().toUpperCase()] ?? false;

    if (!isMultiUnit) {
      orderedEntries.push({ type: "single", row });
      continue;
    }

    const groupKey = `${row.pdNumber}::${row.projectName}`;
    const existing = groupedRows.get(groupKey);
    if (existing) {
      existing.push(row);
    } else {
      groupedRows.set(groupKey, [row]);
      orderedEntries.push({ type: "group", key: groupKey });
    }
  }

  return orderedEntries.map((entry) => {
    if (entry.type === "single") {
      return entry;
    }

    const rowsInGroup = groupedRows.get(entry.key) ?? [];
    const sortedRows = [...rowsInGroup].sort((a, b) => {
      const unitCompare = parseUnitForSort(a.unit) - parseUnitForSort(b.unit);
      if (unitCompare !== 0) {
        return unitCompare;
      }
      return a.unit.localeCompare(b.unit, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return {
      type: "group",
      key: entry.key,
      lead: sortedRows[0] ?? rowsInGroup[0],
      rows: sortedRows,
    };
  });
}

