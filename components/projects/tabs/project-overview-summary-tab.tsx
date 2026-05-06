"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, Folder, LibraryBig, ShieldCheck } from "lucide-react";

import { OverviewInsightCard } from "@/components/projects/overview-insight-card";
import { OverviewTimerCard } from "@/components/projects/overview-timer-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";
import type { ProjectActionStateSummary } from "@/components/projects/project-lifecycle-stepper";

export type OverviewActionModalType = "legals" | "files" | "parts" | "sws" | "layout" | "wire-print" | "brand-workspace" | "sheet-workspace";

interface ProjectOverviewSummaryTabProps extends ProjectTabProps {
  badgeNumber?: string;
  onOpenActionModal?: (modal: OverviewActionModalType) => void;
  availableActions?: Partial<Record<OverviewActionModalType, boolean>>;
  onExportProjectPdf?: () => void;
}

interface StageHoursResponse {
  stages: { stageId: string; label: string; estimatedMinutes: number; averageMinutes: number; actualMinutes: number }[];
  totalEstimatedMinutes: number;
  totalAverageMinutes: number;
  totalActualMinutes: number;
}

type SummaryChartMode = "assignment" | "stage" | "sws";

function formatMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0m";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function OverviewActionCards({
  onOpenActionModal,
  availableActions,
}: {
  onOpenActionModal?: (modal: OverviewActionModalType) => void;
  availableActions?: Partial<Record<OverviewActionModalType, boolean>>;
}) {
  const items: { id: OverviewActionModalType; label: string; description: string; icon: ReactNode }[] = [
    {
      id: "legals",
      label: "Legals Uploader",
      description: "Upload or revise legal deliverables and lifecycle gate files.",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      id: "files",
      label: "Files",
      description: "Manage project files and asset attachments.",
      icon: <Folder className="h-4 w-4" />,
    },
    {
      id: "parts",
      label: "Part Numbers",
      description: "Review part numbers, terminals, and compatibility mapping.",
      icon: <LibraryBig className="h-4 w-4" />,
    },
    {
      id: "sws",
      label: "SWS",
      description: "Open SWS templates and stage checklist workflows.",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: "layout",
      label: "Layouts",
      description: "Open the layout workspace with search and page navigation.",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      id: "wire-print",
      label: "Wire Lists",
      description: "Preview and download generated wire list print PDFs.",
      icon: <Folder className="h-4 w-4" />,
    },
    {
      id: "brand-workspace",
      label: "Brand List",
      description: "Open editable brand-list workspace for active review.",
      icon: <LibraryBig className="h-4 w-4" />,
    },
    {
      id: "sheet-workspace",
      label: "Sheet Workspace",
      description: "Open a detailed sheet workspace with revision history and pagination.",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
  ];

  const visibleItems = items.filter((item) => availableActions?.[item.id] !== false);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpenActionModal?.(item.id)}
          className="rounded-xl border border-border/60 bg-background/60 p-3 text-left transition hover:border-foreground/20 hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {item.icon}
            {item.label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
        </button>
      ))}
    </div>
  );
}

export function ProjectOverviewSummaryTab({
  project,
  onProjectRefresh,
  onNavigateToTab,
  badgeNumber,
  onOpenActionModal,
  availableActions,
  onExportProjectPdf,
}: ProjectOverviewSummaryTabProps) {
  const [chartMode, setChartMode] = useState<SummaryChartMode>("stage");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [stageHours, setStageHours] = useState<StageHoursResponse | null>(null);
  const [summary, setSummary] = useState<ProjectActionStateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setWarning(null);

    Promise.all([
      fetch(`/api/projects/${encodeURIComponent(project.id)}/stage-hours`, { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : null,
      ),
      fetch(`/api/projects/${encodeURIComponent(project.id)}/action-state`, { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : null,
      ),
    ])
      .then(([hours, actionPayload]: [StageHoursResponse | null, { summary?: ProjectActionStateSummary } | null]) => {
        if (cancelled) return;
        setStageHours(hours);
        setSummary(actionPayload?.summary ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setWarning("Unable to load overview metrics.");
          setStageHours(null);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const stageChartData = useMemo(() => {
    return (stageHours?.stages ?? []).slice(0, 8).map((entry, index) => ({
      name: entry.label,
      hours: Math.round((entry.estimatedMinutes / 60) * 10) / 10,
      fill: `var(--color-chart-${(index % 5) + 1})`,
    }));
  }, [stageHours]);

  const assignmentChartData = useMemo(() => {
    const items = Object.values(project.assignments ?? {})
      .filter((assignment) => assignment.kind === "operational")
      .map((assignment, index) => ({
        name: assignment.sheetName,
        minutes: assignment.totalEstimatedMinutes
          ?? assignment.boardAssignment?.estimatedMinutes
          ?? 0,
        fill: `var(--color-chart-${(index % 5) + 1})`,
      }))
      .filter((assignment) => assignment.minutes > 0);

    const normalized = assignmentFilter.trim().toLowerCase();
    const filtered = normalized
      ? items.filter((assignment) => assignment.name.toLowerCase().includes(normalized))
      : items;

    return filtered
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 12)
      .map((assignment) => ({
        ...assignment,
        hours: Math.round((assignment.minutes / 60) * 10) / 10,
      }));
  }, [assignmentFilter, project.assignments]);

  const swsDonutData = useMemo(() => {
    const entries = Object.values(project.assignments ?? {}).filter((assignment) => assignment.kind === "operational");
    const totalMinutes = entries.reduce(
      (sum, assignment) => sum + (assignment.totalEstimatedMinutes ?? assignment.boardAssignment?.estimatedMinutes ?? 0),
      0,
    );

    const map = new Map<string, number>();
    for (const assignment of entries) {
      const swsType = String(assignment.swsType ?? "UNDECIDED").toUpperCase();
      const minutes = assignment.totalEstimatedMinutes ?? assignment.boardAssignment?.estimatedMinutes ?? 0;
      if (minutes <= 0) continue;
      map.set(swsType, (map.get(swsType) ?? 0) + minutes);
    }

    return Array.from(map.entries())
      .map(([type, minutes], index) => ({
        type,
        minutes,
        hours: Math.round((minutes / 60) * 10) / 10,
        percent: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 1000) / 10 : 0,
        fill: `var(--color-chart-${(index % 5) + 1})`,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [project.assignments]);

  return (
    <div className="space-y-3">
      <OverviewTimerCard
        projectId={project.id}
        defaultBadge={badgeNumber}
        onStatusChange={() => {
          void onProjectRefresh?.();
        }}
      />

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr] xl:items-stretch">
        <OverviewInsightCard
          title="Summary"
          description="Track stage throughput, timers, and lifecycle quality signals."
          state={loading ? "loading" : warning ? "warning" : "success"}
          className="max-w-none"
          statusLabel={`${project.sheets?.length ?? 0} sheets`}
          footer={
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated</p>
                <p className="text-sm font-semibold">{formatMinutes(stageHours?.totalEstimatedMinutes ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Actual</p>
                <p className="text-sm font-semibold">{formatMinutes(stageHours?.totalActualMinutes ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lifecycle</p>
                <p className="text-sm font-semibold">{summary?.brandListReady ? "Brand List Ready" : "In Review"}</p>
              </div>
            </div>
          }
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Tabs value={chartMode} onValueChange={(value) => setChartMode(value as SummaryChartMode)}>
              <TabsList className="h-8 rounded-lg bg-muted/40 p-1">
                <TabsTrigger value="assignment" className="h-6 rounded-md px-2 text-[11px]">Assignments</TabsTrigger>
                <TabsTrigger value="stage" className="h-6 rounded-md px-2 text-[11px]">Stages</TabsTrigger>
                <TabsTrigger value="sws" className="h-6 rounded-md px-2 text-[11px]">Project Types</TabsTrigger>
              </TabsList>
            </Tabs>
            {chartMode === "assignment" ? (
              <Input
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                placeholder="Filter assignment name..."
                className="h-8 w-full max-w-xs text-xs"
              />
            ) : null}
            </div>

            <div className="flex min-h-80 flex-1">
              {chartMode === "assignment" ? (
                assignmentChartData.length === 0 ? (
                  <div className="flex h-full w-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    No assignment estimated-time data found for this filter.
                  </div>
                ) : (
                  <div className="min-h-0 min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assignmentChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} layout="vertical">
                        <defs>
                          <pattern id="summary-estimated-stripes-assignment" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                            <rect width="8" height="8" fill="hsl(var(--muted) / 0.16)" />
                            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(var(--foreground) / 0.18)" strokeWidth="2" />
                          </pattern>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={180} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number | string) => [`${value}h`, "Estimated"]} />
                        <Bar dataKey="hours" radius={[0, 8, 8, 0]}>
                          {assignmentChartData.map((entry) => (
                            <Cell key={entry.name} fill="url(#summary-estimated-stripes-assignment)" stroke={entry.fill} strokeWidth={2} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : null}

              {chartMode === "stage" ? (
                stageChartData.length === 0 ? (
                  <div className="flex h-full w-full flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    No stage metrics captured yet.
                  </div>
                ) : (
                  <div className="min-h-0 min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stageChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <defs>
                          <pattern id="summary-estimated-stripes-stage" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                            <rect width="8" height="8" fill="hsl(var(--muted) / 0.16)" />
                            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(var(--foreground) / 0.18)" strokeWidth="2" />
                          </pattern>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis width={28} tickMargin={6} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number | string) => [`${value}h`, "Estimated"]} />
                        <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                          {stageChartData.map((entry) => (
                            <Cell key={entry.name} fill="url(#summary-estimated-stripes-stage)" stroke={entry.fill} strokeWidth={2} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : null}

              {chartMode === "sws" ? (
                swsDonutData.length === 0 ? (
                  <div className="flex h-full w-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    No SWS estimated-time data available.
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-[1.25fr_1fr]">
                    <div className="min-h-0 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip formatter={(value: number | string) => [`${formatMinutes(Number(value))}`, "Estimated"]} />
                          <Pie
                            data={swsDonutData}
                            dataKey="minutes"
                            nameKey="type"
                            innerRadius={52}
                            outerRadius={88}
                            paddingAngle={2}
                          >
                            {swsDonutData.map((entry) => (
                              <Cell key={entry.type} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1 overflow-auto pr-1">
                      {swsDonutData.map((entry) => (
                        <div key={entry.type} className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                            <span className="font-medium">{entry.type}</span>
                          </div>
                          <span className="text-muted-foreground">{entry.percent}% · {entry.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </OverviewInsightCard>

        <OverviewInsightCard
          title="Action Center"
          description="Open focused workflows without leaving Overview."
          state={warning ? "warning" : "idle"}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("assignments")}>
                Open Assignments
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("settings")}>
                Settings
              </Button>
              {onExportProjectPdf ? (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onExportProjectPdf}>
                  Project PDF Export
                </Button>
              ) : null}
            </div>
          }
        >
          <OverviewActionCards onOpenActionModal={onOpenActionModal} availableActions={availableActions} />
        </OverviewInsightCard>
      </div>

    </div>
  );
}
