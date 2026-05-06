"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectManifest } from "@/types/project-manifest";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { ProjectScheduleSlotsTableRow } from "@/components/projects/project-schedule-slots";
import type { ProjectScheduleStats } from "@/components/projects/project-schedule-details-shared";
import { Badge } from "@/components/ui/badge";

interface ProjectScheduleStatsGridProps {
  stats: ProjectScheduleStats;
  dueLabel?: string | null;
  tone?: "default" | "contrast";
}

interface ProjectScheduleFactsCardProps {
  project: ProjectManifest | null;
  row: ProjectScheduleSlotsTableRow | null;
  title?: string;
  tone?: "default" | "contrast";
}

interface ProjectScheduleReferencesCardProps {
  references: MappedAssignment[];
  title?: string;
  tone?: "default" | "contrast";
}

function getToneClasses(tone: "default" | "contrast") {
  if (tone === "contrast") {
    return {
      card: "border-border",
      title: "text-foreground",
      muted: "text-foreground",
      value: "text-foreground-50",
      empty: "text-foreground",
      badge: "border-slate-700 text-foreground",
    };
  }

  return {
    card: "",
    title: "text-muted-foreground",
    muted: "text-muted-foreground",
    value: "text-foreground",
    empty: "text-muted-foreground",
    badge: "",
  };
}

export function ProjectScheduleStatsGrid({
  stats,
  dueLabel,
  tone = "default",
}: ProjectScheduleStatsGridProps) {
  const toneClasses = getToneClasses(tone);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card className={`md:col-span-2 xl:col-span-2 ${toneClasses.card}`.trim()}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold tabular-nums ${toneClasses.value}`.trim()}>{stats.completionPercent}%</div>
          <div className={`mt-1 text-xs ${toneClasses.muted}`.trim()}>
            {stats.complete}/{stats.total} assignments complete
          </div>
        </CardContent>
      </Card>
      <Card className={toneClasses.card}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>In Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold tabular-nums ${toneClasses.value}`.trim()}>{stats.inProgress}</div>
        </CardContent>
      </Card>
      <Card className={toneClasses.card}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold tabular-nums ${toneClasses.value}`.trim()}>{stats.pending}</div>
        </CardContent>
      </Card>
      <Card className={toneClasses.card}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>Unit Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold tabular-nums ${toneClasses.value}`.trim()}>{stats.unitTypeCount}</div>
        </CardContent>
      </Card>
      {dueLabel !== undefined ? (
        <Card className={toneClasses.card}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold ${toneClasses.value}`.trim()}>{dueLabel || "-"}</div>
          </CardContent>
        </Card>
      ) : null}
      <Card className={toneClasses.card}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-xs ${toneClasses.title}`.trim()}>References</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold tabular-nums ${toneClasses.value}`.trim()}>{stats.referenceCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectScheduleFactsCard({
  project,
  row,
  title = "Project Snapshot",
  tone = "default",
}: ProjectScheduleFactsCardProps) {
  const toneClasses = getToneClasses(tone);

  return (
    <Card className={toneClasses.card}>
      <CardHeader>
        <CardTitle className={`text-sm ${tone === "contrast" ? "text-foreground" : ""}`.trim()}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={`grid gap-2 text-sm ${tone === "contrast" ? "text-foreground sm:grid-cols-2 xl:grid-cols-1" : "md:grid-cols-2"}`.trim()}>
        <div><span className={toneClasses.muted}>Project:</span> {project?.name || row?.projectName || "-"}</div>
        <div><span className={toneClasses.muted}>Project ID:</span> {project?.id || "-"}</div>
        <div><span className={toneClasses.muted}>PD#:</span> {project?.pdNumber || row?.pdNumber || "-"}</div>
        <div><span className={toneClasses.muted}>Unit:</span> {project?.unitNumber || row?.unit || "-"}</div>
        <div><span className={toneClasses.muted}>Legals:</span> {row?.legalsLabel || "-"}</div>
        {"dueLabel" in (row ?? {}) ? <div><span className={toneClasses.muted}>Due:</span> {row?.dueLabel || "-"}</div> : null}
        <div className={tone === "contrast" ? "sm:col-span-2 xl:col-span-1" : undefined}>
          <span className={toneClasses.muted}>Status:</span> {row?.status || "-"}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectScheduleReferencesCard({
  references,
  title = "References",
  tone = "default",
}: ProjectScheduleReferencesCardProps) {
  const toneClasses = getToneClasses(tone);

  return (
    <Card className={toneClasses.card}>
      <CardHeader>
        <CardTitle className={`text-sm ${tone === "contrast" ? "text-foreground" : ""}`.trim()}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {references.length === 0 ? (
          <div className={`text-sm ${toneClasses.empty}`.trim()}>
            No reference sheets found for this project.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {references
              .slice()
              .sort((a, b) => a.sheetName.localeCompare(b.sheetName))
              .map((reference) => (
                <Badge
                  key={reference.sheetSlug}
                  variant="dot"
                  className={tone === "contrast" ? toneClasses.badge : "text-xs"}
                >
                  {reference.sheetName}
                </Badge>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
