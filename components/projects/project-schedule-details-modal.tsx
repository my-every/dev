"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheckBig, CircleDashed, Download, FolderOpen, Layers3, Loader2, RefreshCw } from "lucide-react";

import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { ActivityEntry } from "@/types/activity";
import type { ProjectManifest } from "@/types/project-manifest";
import type { ProjectScheduleSlotsTableRow } from "@/components/projects/project-schedule-slots";
import {
  type AssignmentUnitGroup,
  buildAssignmentUnitGroups,
  buildExportFileUrl,
  buildProjectScheduleStats,
  buildProjectScheduleStepper,
  type ExportManifest,
  formatScheduleDisplayDate,
  formatStageLabel,
  getStatusVariant,
  loadProjectScheduleDetailsData,
  STAGE_SUBGROUPS,
} from "@/components/projects/project-schedule-details-shared";
import { ProjectScheduleDetailsShell } from "@/components/projects/project-schedule-details-shell";
import {
  ProjectScheduleFactsCard,
  ProjectScheduleReferencesCard,
  ProjectScheduleStatsGrid,
} from "@/components/projects/project-schedule-details-panels";

interface ProjectScheduleDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProjectScheduleSlotsTableRow | null;
  currentBadge?: string;
}

export function ProjectScheduleDetailsModal({
  open,
  onOpenChange,
  row,
  currentBadge,
}: ProjectScheduleDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [assignments, setAssignments] = useState<MappedAssignment[]>([]);
  const [brandingExports, setBrandingExports] = useState<ExportManifest | null>(null);
  const [wireListExports, setWireListExports] = useState<ExportManifest | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [manifestRefreshing, setManifestRefreshing] = useState(false);
  const [manifestRefreshMessage, setManifestRefreshMessage] = useState<string | null>(null);

  const fallbackUnitType = row?.extraColumns?.["Unit Type"];

  const operationalAssignments = useMemo(
    () => assignments.filter((entry) => entry.sheetKind === "assignment"),
    [assignments],
  );

  const referenceMappings = useMemo(
    () => assignments.filter((entry) => entry.sheetKind === "reference"),
    [assignments],
  );

  const assignmentGroups = useMemo<AssignmentUnitGroup[]>(
    () => buildAssignmentUnitGroups(assignments, fallbackUnitType),
    [assignments, fallbackUnitType],
  );

  const stats = useMemo(
    () => buildProjectScheduleStats(operationalAssignments, assignmentGroups, referenceMappings),
    [assignmentGroups, operationalAssignments, referenceMappings],
  );

  const scheduleStepper = useMemo(
    () => buildProjectScheduleStepper(row, operationalAssignments),
    [operationalAssignments, row],
  );

  const refreshActivities = useCallback(async () => {
    if (!open || !project?.id || !currentBadge) {
      setActivities([]);
      return;
    }

    setActivitiesLoading(true);
    setActivitiesError(null);

    try {
      const shifts = ["1st", "2nd"];
      const responses = await Promise.all(
        shifts.map((shift) =>
          fetch(
            `/api/activity/${encodeURIComponent(currentBadge)}?shift=${encodeURIComponent(shift)}&projectIds=${encodeURIComponent(project.id)}&limit=150&includeDocument=false`,
            { cache: "no-store" },
          ),
        ),
      );

      const payloads = await Promise.all(
        responses.map(async (response) => {
          if (!response.ok) return { activities: [] as ActivityEntry[] };
          return (await response.json()) as { activities?: ActivityEntry[] };
        }),
      );

      const merged = payloads.flatMap((payload) => payload.activities ?? []);
      const uniqueById = new Map<string, ActivityEntry>();
      for (const activity of merged) {
        uniqueById.set(activity.id, activity);
      }

      const mergedActivities = Array.from(uniqueById.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setActivities(mergedActivities);
    } catch (fetchError) {
      setActivitiesError(fetchError instanceof Error ? fetchError.message : "Failed to load project activity");
    } finally {
      setActivitiesLoading(false);
    }
  }, [currentBadge, open, project?.id]);

  const refreshManifest = useCallback(async () => {
    if (!project?.id) {
      return;
    }

    setManifestRefreshing(true);
    setManifestRefreshMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/manifest/regenerate`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Failed to regenerate manifest");
      }

      const payload = (await response.json()) as { manifest?: ProjectManifest };
      if (payload.manifest) {
        setProject(payload.manifest);
      }
      setManifestRefreshMessage("Manifest regenerated successfully.");
    } catch (refreshError) {
      setManifestRefreshMessage(
        refreshError instanceof Error ? refreshError.message : "Failed to regenerate manifest",
      );
    } finally {
      setManifestRefreshing(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (!open || !row) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setProject(null);
      setAssignments([]);
      setBrandingExports(null);
      setWireListExports(null);

      try {
        const payload = await loadProjectScheduleDetailsData(row);
        if (cancelled) return;
        setProject(payload.project);
        setAssignments(payload.assignments);
        setBrandingExports(payload.brandingExports);
        setWireListExports(payload.wireListExports);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load project details");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, row]);

  useEffect(() => {
    void refreshActivities();
  }, [refreshActivities]);

  const title = row
    ? `${row.pdNumber} · Unit ${row.unit}`
    : "Project Details";

  return (
    <ProjectScheduleDetailsShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={row?.projectName || "Review complete project schedule details, grouped assignments, exports, and project activity."}
      contentClassName="h-[88vh] max-w-[95vw] sm:max-w-[95vw]"
      leftPane={
        loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading project details...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <Tabs defaultValue="overview" className="gap-4">
                  <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="assignments">Assignments</TabsTrigger>
                    <TabsTrigger value="exports">Exports</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Actual vs Planned Schedule</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="dot">{scheduleStepper.completed}/{scheduleStepper.total} milestones reached</Badge>
                          <Badge variant="solid">{scheduleStepper.percent}% complete</Badge>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {scheduleStepper.milestones.map((step) => (
                            <div key={step.key} className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  {step.isReached ? (
                                    <CircleCheckBig className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="text-sm font-medium">{step.label}</div>
                                </div>
                                <Badge variant={step.isReached ? "solid" : "dot"} className="text-[10px]">
                                  {step.isReached ? "Reached" : "Pending"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <div className="text-[10px] uppercase text-muted-foreground">Planned</div>
                                  <div className="font-medium">
                                    {formatScheduleDisplayDate(step.plannedDate, step.plannedRaw || "-")}
                                  </div>
                                </div>
                                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                  <div className="text-[10px] uppercase text-muted-foreground">Actual</div>
                                  <div className="font-medium">
                                    {formatScheduleDisplayDate(step.actualDate, step.actualRaw || (step.isReached ? "Reached" : "-"))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden md:block">
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {scheduleStepper.milestones.map((step) => (
                              <div key={step.key} className="rounded-lg border p-3">
                                <div className="mb-2 flex items-center gap-2">
                                  {step.isReached ? (
                                    <CircleCheckBig className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="text-xs font-semibold">{step.label}</div>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Planned:</span>{" "}
                                    {formatScheduleDisplayDate(step.plannedDate, step.plannedRaw || "-")}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Actual:</span>{" "}
                                    {formatScheduleDisplayDate(step.actualDate, step.actualRaw || (step.isReached ? "Reached" : "-"))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <ProjectScheduleStatsGrid stats={stats} dueLabel={row?.dueLabel} />

                    <ProjectScheduleFactsCard project={project} row={row} />

                    <ProjectScheduleReferencesCard references={referenceMappings} />
                  </TabsContent>

                  <TabsContent value="assignments" className="space-y-4">
                    {assignmentGroups.length === 0 ? (
                      <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground">
                          No assignment mappings were found for this project.
                        </CardContent>
                      </Card>
                    ) : (
                      <Accordion type="multiple" className="w-full rounded-lg border px-4">
                        {assignmentGroups.map((group) => (
                          <AccordionItem key={group.unitType} value={group.unitType}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex w-full items-center justify-between gap-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="dot">{group.unitType}</Badge>
                                  <span className="text-sm text-muted-foreground">{group.assignments.length} assignments</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {group.completeCount}/{group.assignments.length} complete ({group.progressPercent}%)
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <Accordion type="multiple" className="rounded-lg border px-3">
                                {group.assignments.map((assignment) => (
                                  <AccordionItem key={assignment.sheetSlug} value={`${group.unitType}-${assignment.sheetSlug}`}>
                                    <AccordionTrigger className="hover:no-underline">
                                      <div className="flex w-full items-center justify-between gap-2 pr-4">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium">{assignment.sheetName}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {assignment.rowCount} rows · {assignment.selectedSwsType}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={getStatusVariant(assignment.selectedStatus)} className="text-[10px]">
                                            {assignment.selectedStatus.replace("_", " ")}
                                          </Badge>
                                          <Badge variant="dot" className="text-[10px]">
                                            {formatStageLabel(assignment.selectedStage)}
                                          </Badge>
                                        </div>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="space-y-2 rounded-md bg-muted/30 p-3">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                          Stage Subgroups
                                        </div>
                                        <div className="grid gap-2 md:grid-cols-3">
                                          {STAGE_SUBGROUPS.map((subgroup) => {
                                            const isActive = subgroup.stages.includes(assignment.selectedStage);
                                            return (
                                              <div
                                                key={`${assignment.sheetSlug}-${subgroup.label}`}
                                                className={cn(
                                                  "rounded-md border px-2 py-1.5 text-xs",
                                                  isActive ? "border-primary bg-primary/5" : "border-border bg-background",
                                                )}
                                              >
                                                <div className="font-medium">{subgroup.label}</div>
                                                <div className="text-muted-foreground">{isActive ? formatStageLabel(assignment.selectedStage) : "-"}</div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {assignment.matchedLayoutTitle ? (
                                          <div className="text-xs text-muted-foreground">
                                            Layout Match: {assignment.matchedLayoutTitle}
                                          </div>
                                        ) : null}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </TabsContent>

                  <TabsContent value="exports" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm">Download Project Exports</CardTitle>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={!project?.id || manifestRefreshing}
                            onClick={() => void refreshManifest()}
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", manifestRefreshing && "animate-spin")} />
                            Regenerate Manifest
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {manifestRefreshMessage ? (
                          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                            {manifestRefreshMessage}
                          </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border p-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                              <Layers3 className="h-4 w-4" /> Branding Exports
                            </div>
                            {project?.id && brandingExports?.combinedRelativePath ? (
                              <Button asChild size="sm" className="w-full justify-start gap-2">
                                <a href={buildExportFileUrl(project.id, brandingExports.combinedRelativePath)}>
                                  <Download className="h-3.5 w-3.5" />
                                  Download Combined Branding Workbook
                                </a>
                              </Button>
                            ) : (
                              <p className="text-xs text-muted-foreground">No combined branding export found yet.</p>
                            )}
                          </div>

                          <div className="rounded-lg border p-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                              <FolderOpen className="h-4 w-4" /> Wire-List Exports
                            </div>
                            {project?.id && (wireListExports?.sheetExports?.length ?? 0) > 0 ? (
                              <div className="space-y-1">
                                {wireListExports?.sheetExports?.slice(0, 3).map((item) => (
                                  <Button key={item.fileName} asChild size="sm" variant="outline" className="w-full justify-start gap-2">
                                    <a href={buildExportFileUrl(project.id, item.relativePath)}>
                                      <Download className="h-3.5 w-3.5" />
                                      {item.sheetName || item.fileName}
                                    </a>
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No wire-list exports found yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                          Reserved for additional export workflows (bundled ZIP, publish package, and downstream handoff files).
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )
      }
      rightPane={
        <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-sm">Project Activity</CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-4.5rem)] overflow-y-auto p-0">
                  {!project?.id ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Activity will appear once a matching project record is resolved.
                    </div>
                  ) : !currentBadge ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Sign-in badge is required to load project-associated activity.
                    </div>
                  ) : (
                    <ActivityTimeline
                      activities={activities}
                      loading={activitiesLoading}
                      error={activitiesError}
                      maxItems={120}
                      compact={false}
                      showStats
                      allowFiltering
                      allowSearch
                      showComments={false}
                      showNestedActivities
                      onRefresh={refreshActivities}
                      currentBadge={currentBadge}
                      className="p-0"
                      containerClassName="p-4"
                    />
                  )}
                </CardContent>
              </Card>
      }
    />
  );
}
