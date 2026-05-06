"use client";

import { format } from "date-fns";

import type {
  ProjectScheduleSlotsTableRow,
  TableFilters,
} from "@/components/projects/project-schedule-slots-types";
import { getLegalsBadgeLabel } from "@/components/projects/project-schedule-slots-types";

export function getFilterValueLabel(filters: TableFilters): string {
  const parts: string[] = [];
  if (filters.dueMonth !== "all") {
    parts.push(`Due ${filters.dueMonth}`);
  }
  if (filters.dueDateFrom) {
    parts.push(`From ${filters.dueDateFrom}`);
  }
  if (filters.dueDateTo) {
    parts.push(`To ${filters.dueDateTo}`);
  }
  if (filters.legalsState !== "all") {
    parts.push(`Legals ${getLegalsBadgeLabel(filters.legalsState)}`);
  }
  if (filters.status !== "all") {
    parts.push(`Status ${filters.status}`);
  }
  if (filters.multiUnitProject !== "all") {
    parts.push(
      filters.multiUnitProject === "true"
        ? "Multi-unit only"
        : "Single-unit only",
    );
  }

  return parts.length > 0 ? parts.join(" • ") : "All filters";
}

export function parseDueDateForFilter(row: ProjectScheduleSlotsTableRow): Date | null {
  const rawDue = row.dueLabel?.trim();
  if (rawDue) {
    const parsedDue = new Date(rawDue);
    if (!Number.isNaN(parsedDue.getTime())) {
      return parsedDue;
    }
  }

  const rawMonth = row.dueMonth?.trim();
  if (rawMonth) {
    const parsedMonth = new Date(`${rawMonth} 1`);
    if (!Number.isNaN(parsedMonth.getTime())) {
      return parsedMonth;
    }
  }

  return null;
}

export function parseInputDateBoundary(value: string, boundary: "start" | "end"): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (boundary === "end") {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

export function parseFilterDateString(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export function toFilterDateString(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return format(value, "yyyy-MM-dd");
}

export function getDateRangeLabel(dueDateFrom: string, dueDateTo: string): string {
  const fromDate = parseFilterDateString(dueDateFrom);
  const toDate = parseFilterDateString(dueDateTo);

  if (fromDate && toDate) {
    return `${format(fromDate, "MMM d, yyyy")} - ${format(toDate, "MMM d, yyyy")}`;
  }
  if (fromDate) {
    return `From ${format(fromDate, "MMM d, yyyy")}`;
  }
  if (toDate) {
    return `Until ${format(toDate, "MMM d, yyyy")}`;
  }
  return "All Dates";
}

export function filterProjectScheduleRows(
  rows: ProjectScheduleSlotsTableRow[],
  filters: TableFilters,
  multiUnitProjectLookup: Record<string, boolean>,
): ProjectScheduleSlotsTableRow[] {
  const search = filters.search.trim().toLowerCase();
  const dueDateFrom = parseInputDateBoundary(filters.dueDateFrom, "start");
  const dueDateTo = parseInputDateBoundary(filters.dueDateTo, "end");

  return rows.filter((row) => {
    if (filters.dueMonth !== "all" && row.dueMonth !== filters.dueMonth) {
      return false;
    }

    if (dueDateFrom || dueDateTo) {
      const dueDate = parseDueDateForFilter(row);
      if (!dueDate) {
        return false;
      }

      if (dueDateFrom && dueDate < dueDateFrom) {
        return false;
      }
      if (dueDateTo && dueDate > dueDateTo) {
        return false;
      }
    }

    if (filters.legalsState !== "all" && row.legalsState !== filters.legalsState) {
      return false;
    }

    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }

    const isMultiUnit =
      multiUnitProjectLookup[row.pdNumber.trim().toUpperCase()] ?? false;
    if (filters.multiUnitProject === "true" && !isMultiUnit) {
      return false;
    }
    if (filters.multiUnitProject === "false" && isMultiUnit) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [row.pdNumber, row.projectName, row.unit, row.legalsLabel]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

