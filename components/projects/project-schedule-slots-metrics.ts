"use client";

import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";

import type {
  LwcMetricSet,
  LwcTabValue,
  OverviewBarDatum,
  ProjectScheduleSlotsTableRow,
} from "@/components/projects/project-schedule-slots-types";
import {
  getExtraColumnValue,
  parseLwcTypeFromValue,
} from "@/components/projects/project-schedule-slots-types";

export const LWC_TABS: LwcTabValue[] = [
  "ALL",
  ...Object.keys(LWC_TYPE_REGISTRY),
] as LwcTabValue[];

const LWC_OVERVIEW_ORDER: LwcType[] = [
  "ONSKID",
  "NEW_FLEX",
  "OFFSKID",
  "NTB",
  "FLOAT",
];

export function getRowLwcType(row: ProjectScheduleSlotsTableRow): LwcType | undefined {
  return parseLwcTypeFromValue(getExtraColumnValue(row, "LWC"));
}

export function getLwcTabLabel(value: LwcTabValue): string {
  if (value === "ALL") {
    return "All";
  }
  return LWC_TYPE_REGISTRY[value].shortLabel;
}

function getTotalProjects(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.length;
}

function getTotalUnits(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.length;
}

function getMultiUnitProjects(rows: ProjectScheduleSlotsTableRow[]): number {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.pdNumber}::${row.projectName}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.values(counts).filter((count) => count > 1).length;
}

function getSingleUnitProjects(rows: ProjectScheduleSlotsTableRow[]): number {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.pdNumber}::${row.projectName}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.values(counts).filter((count) => count === 1).length;
}

function getAvgDaysLate(rows: ProjectScheduleSlotsTableRow[]): number | null {
  const values = rows
    .map((row) => row.daysLate)
    .filter((value): value is number => value != null);
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMedianDaysLate(rows: ProjectScheduleSlotsTableRow[]): number | null {
  const values = rows
    .map((row) => row.daysLate)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return null;
  }

  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[middle];
  }
  return (values[middle - 1] + values[middle]) / 2;
}

function getOverdueCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => (row.daysLate ?? 0) > 0).length;
}

function getEarlyCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => (row.daysLate ?? 0) < 0).length;
}

function getOnTimeCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.daysLate === 0).length;
}

function getLegalsPublishedCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.legalsState === "published").length;
}

function getLegalsPendingRefCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.legalsState === "pending_reference").length;
}

function getLegalsMissingCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.legalsState === "missing").length;
}

function getLegalsInvalidCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.legalsState === "invalid").length;
}

function getStatusCompleteCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.status === "Complete").length;
}

function getStatusInProcessCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.status === "In Process").length;
}

function getStatusPendingCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.status === "Pending").length;
}

function getStatusUpcomingCount(rows: ProjectScheduleSlotsTableRow[]): number {
  return rows.filter((row) => row.status === "Upcoming").length;
}

export function buildMetrics(rows: ProjectScheduleSlotsTableRow[]): LwcMetricSet {
  return {
    totalProjects: getTotalProjects(rows),
    totalUnits: getTotalUnits(rows),
    multiUnitProjects: getMultiUnitProjects(rows),
    singleUnitProjects: getSingleUnitProjects(rows),
    avgDaysLate: getAvgDaysLate(rows),
    medianDaysLate: getMedianDaysLate(rows),
    overdueCount: getOverdueCount(rows),
    earlyCount: getEarlyCount(rows),
    onTimeCount: getOnTimeCount(rows),
    legalsPublishedCount: getLegalsPublishedCount(rows),
    legalsPendingRefCount: getLegalsPendingRefCount(rows),
    legalsMissingCount: getLegalsMissingCount(rows),
    legalsInvalidCount: getLegalsInvalidCount(rows),
    statusCompleteCount: getStatusCompleteCount(rows),
    statusInProcessCount: getStatusInProcessCount(rows),
    statusPendingCount: getStatusPendingCount(rows),
    statusUpcomingCount: getStatusUpcomingCount(rows),
  };
}

export function buildMetricsByLwc(
  rows: ProjectScheduleSlotsTableRow[],
): Record<string, LwcMetricSet> {
  const byLwc: Record<string, LwcMetricSet> = {
    ALL: buildMetrics(rows),
  };

  for (const tab of LWC_TABS) {
    if (tab === "ALL") {
      continue;
    }
    byLwc[tab] = buildMetrics(
      rows.filter((row) => getRowLwcType(row) === tab),
    );
  }

  return byLwc;
}

export function buildOverviewBarData(
  activeLwcTab: LwcTabValue,
  metricsByLwc: Record<string, LwcMetricSet>,
): OverviewBarDatum[] {
  if (activeLwcTab === "ALL") {
    return LWC_OVERVIEW_ORDER.map((tab) => ({
      key: tab,
      label: LWC_TYPE_REGISTRY[tab].shortLabel,
      value: metricsByLwc[tab]?.totalProjects ?? 0,
      color: LWC_TYPE_REGISTRY[tab].dotColor,
    }));
  }

  const metrics = metricsByLwc[activeLwcTab] ?? buildMetrics([]);
  return [
    {
      key: "totalProjects",
      label: "Projects",
      value: metrics.totalProjects,
      color: LWC_TYPE_REGISTRY[activeLwcTab].dotColor,
    },
    {
      key: "overdue",
      label: "Late",
      value: metrics.overdueCount,
      color: "#ef4444",
    },
    {
      key: "early",
      label: "Early",
      value: metrics.earlyCount,
      color: "#16a34a",
    },
    {
      key: "onTime",
      label: "On Time",
      value: metrics.onTimeCount,
      color: "#0284c7",
    },
    {
      key: "pendingRef",
      label: "Pending Ref",
      value: metrics.legalsPendingRefCount,
      color: "#f59e0b",
    },
    {
      key: "complete",
      label: "Complete",
      value: metrics.statusCompleteCount,
      color: "#0d9488",
    },
  ];
}

export function getOverviewStatCards(
  activeLwcTab: LwcTabValue,
  metricsByLwc: Record<string, LwcMetricSet>,
): Array<{ label: string; value: string | number; valueClassName?: string }> {
  const metrics = metricsByLwc[activeLwcTab] ?? buildMetrics([]);

  if (activeLwcTab === "ALL") {
    return [
      { label: "Projects", value: metrics.totalProjects },
      { label: "Late", value: metrics.overdueCount, valueClassName: "text-destructive" },
      { label: "On Time", value: metrics.onTimeCount },
      {
        label: "Avg Days Late",
        value: metrics.avgDaysLate == null ? "-" : metrics.avgDaysLate.toFixed(1),
      },
    ];
  }

  return [
    { label: "Projects", value: metrics.totalProjects },
    { label: "Late", value: metrics.overdueCount, valueClassName: "text-destructive" },
    { label: "Early", value: metrics.earlyCount, valueClassName: "text-emerald-600" },
    { label: "Pending Ref", value: metrics.legalsPendingRefCount },
  ];
}

