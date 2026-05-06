"use client";

import {
  BASE_COLUMNS,
  isBaseColumnKey,
  type ProjectScheduleSlotsTableRow,
} from "@/components/projects/project-schedule-slots-types";

export function collectMonthOptions(rows: ProjectScheduleSlotsTableRow[]): string[] {
  const monthSet = new Set<string>();
  for (const row of rows) {
    if (row.dueMonth) {
      monthSet.add(row.dueMonth);
    }
  }
  return [...monthSet].sort();
}

export function collectExtraColumns(rows: ProjectScheduleSlotsTableRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const extra = row.extraColumns ?? {};
    for (const key of Object.keys(extra)) {
      if (!key || isBaseColumnKey(key)) {
        continue;
      }
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function buildAllColumns(extraColumns: string[]): string[] {
  return [...BASE_COLUMNS, ...extraColumns];
}

export function buildMultiUnitProjectLookup(
  rows: ProjectScheduleSlotsTableRow[],
): Record<string, boolean> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.pdNumber.trim().toUpperCase();
    if (!key) {
      continue;
    }
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const lookup: Record<string, boolean> = {};
  for (const [key, count] of Object.entries(counts)) {
    lookup[key] = count > 1;
  }

  return lookup;
}

export function reconcileColumnOrder(prev: string[], allColumns: string[]): string[] {
  const known = new Set(allColumns);
  const kept = prev.filter((column) => known.has(column));
  const next = [...kept];
  for (const column of allColumns) {
    if (!next.includes(column)) {
      next.push(column);
    }
  }
  return next;
}

export function reconcileColumnVisibility(
  prev: Record<string, boolean>,
  allColumns: string[],
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const column of allColumns) {
    if (column in prev) {
      next[column] = prev[column];
    } else {
      next[column] = isBaseColumnKey(column);
    }
  }
  return next;
}

export function buildResetColumnVisibility(allColumns: string[]): Record<string, boolean> {
  const nextVisibility: Record<string, boolean> = {};
  for (const column of allColumns) {
    nextVisibility[column] = isBaseColumnKey(column);
  }
  return nextVisibility;
}
