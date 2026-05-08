"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  FolderOpen,
  Layers3,
  Loader2,
  RefreshCw,
  Target,
} from "lucide-react";

import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { resolveProjectMeasurementSource, reuseProjectMeasurements } from "@/lib/project-measurements/client";
import { cn } from "@/lib/utils";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { ActivityEntry } from "@/types/activity";
import type { ProjectManifest } from "@/types/project-manifest";
import type { ProjectScheduleSlotsTableRow } from "@/components/projects/project-schedule-slots";
import { FileCard } from "@/components/projects/file-card";
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
  ProjectScheduleStatsGrid,
} from "@/components/projects/project-schedule-details-panels";

interface ProjectScheduleDetailsModalAltProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProjectScheduleSlotsTableRow | null;
  currentBadge?: string;
}

interface PendingMeasurementReuseConfirmation {
  sourceSheetSlug: string;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
  targetSheetSlugs: string[];
}

export function ProjectScheduleDetailsModalAlt({
  open,
  onOpenChange,
  row,
  currentBadge,
}: ProjectScheduleDetailsModalAltProps) {
  const { toast } = useToast();
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
  const [reusingUnitType, setReusingUnitType] = useState<string | null>(null);
  const [pendingReuseByUnitType, setPendingReuseByUnitType] = useState<Record<string, PendingMeasurementReuseConfirmation>>({});

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

  const runReuseMeasurements = useCallback(async (
    unitType: string,
    sheetSlugs: string[],
    sourceSheetSlug?: string,
  ) => {
    if (!project?.id) {
      toast({
        title: "Project unavailable",
        description: "Open a saved project before reusing measurements.",
      });
      return;
    }

    const targets = sheetSlugs.filter(Boolean);
    if (targets.length === 0) {
      toast({
        title: "No target sheets",
        description: `No assignment sheets were found for ${unitType}.`,
      });
      return;
    }

    setReusingUnitType(unitType);
    try {
      const result = await reuseProjectMeasurements(project.id, {
        sourceSheetSlug,
        targetSheetSlugs: targets,
        mode: "both",
      });

      const brandingTotal = result.results.reduce(
        (sum, entry) => sum + (entry.brandingRowsCopied ?? 0),
        0,
      );
      const wireTotal = result.results.reduce(
        (sum, entry) => sum + (entry.wireListRowsCopied ?? 0),
        0,
      );

      toast({
        title: `Measurements reused for ${unitType}`,
        description: `${brandingTotal} branding rows and ${wireTotal} wire-list rows copied from ${result.sourceSheetSlug}${result.sourceInferenceUsed ? " (auto-resolved)" : ""}.`,
      });
      setPendingReuseByUnitType((prev) => {
        const next = { ...prev };
        delete next[unitType];
        return next;
      });
    } catch (error) {
      toast({
        title: "Reuse failed",
        description: error instanceof Error ? error.message : "Failed to reuse measurements.",
        variant: "destructive",
      });
    } finally {
      setReusingUnitType(null);
    }
  }, [project?.id, toast]);

  const handleReuseMeasurements = useCallback(async (unitType: string, sheetSlugs: string[]) => {
    if (!project?.id) {
      toast({
        title: "Project unavailable",
        description: "Open a saved project before reusing measurements.",
      });
      return;
    }

    const targets = sheetSlugs.filter(Boolean);
    if (targets.length === 0) {
      toast({
        title: "No target sheets",
        description: `No assignment sheets were found for ${unitType}.`,
      });
      return;
    }

    const pending = pendingReuseByUnitType[unitType];
    if (pending) {
      await runReuseMeasurements(unitType, pending.targetSheetSlugs, pending.sourceSheetSlug);
      return;
    }

    try {
      const resolution = await resolveProjectMeasurementSource(project.id, {
        targetSheetSlugs: targets,
      });

      if (resolution.confidence === "high") {
        await runReuseMeasurements(unitType, targets, resolution.sourceSheetSlug);
        return;
      }

      setPendingReuseByUnitType((prev) => ({
        ...prev,
        [unitType]: {
          sourceSheetSlug: resolution.sourceSheetSlug,
          confidence: resolution.confidence,
          reason: resolution.reason,
          targetSheetSlugs: targets,
        },
      }));

      toast({
        title: `Confirm source for ${unitType}`,
        description: `${resolution.reason} Using ${resolution.sourceSheetSlug}. Click the action again to confirm.`,
      });
    } catch (error) {
      toast({
        title: "Source resolution failed",
        description: error instanceof Error ? error.message : "Failed to resolve source sheet.",
        variant: "destructive",
      });
    }
  }, [pendingReuseByUnitType, project?.id, runReuseMeasurements, toast]);

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
      description={row?.projectName || "Alternative project control board"}
      contentClassName="h-[92vh] min-w-[96vw] border-0 bg-card sm:max-w-[96vw]"
      frameClassName="relative overflow-hidden rounded-2xl border border-border text-foreground shadow-2xl"
      headerClassName="relative border-border/90 px-4 py-4 sm:px-6"
      leftPaneClassName="relative min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-5 xl:border-b-0 xl:border-r"
      rightPaneClassName="min-h-0 overflow-y-auto px-4 py-4 sm:px-5"
      metricBadges={
        <>
          <Badge variant="solid" className="border border-slate-700 /80 text-foreground">
            <Target className="mr-1 h-3 w-3" /> {stats.completionPercent}% complete
          </Badge>
          <Badge variant="dot" className="border-slate-700 text-foreground">{stats.total} assignments</Badge>
        </>
      }
      leftPane={
        <>
          <div className="pointer-events-none absolute inset-0 " />
          {loading ? (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading project details...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : (
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="h-auto w-full justify-start overflow-x-auto border border-border p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="workboard">Workboard</TabsTrigger>
                    <TabsTrigger value="exports">Exports</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <Card className="">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                          <CalendarDays className="h-4 w-4 text-sky-300" /> Planned vs Actual Timeline
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-foreground">
                          <span>{scheduleStepper.completed}/{scheduleStepper.total} milestones reached</span>
                          <span>{scheduleStepper.percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full ">
                          <div className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width: `${scheduleStepper.percent}%` }} />
                        </div>

                        <div className="space-y-2 md:hidden">
                          {scheduleStepper.milestones.map((step) => (
                            <div key={step.key} className="rounded-lg border border-border  p-3">
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-sm">
                                  {step.isReached ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-foreground" />}
                                  <span>{step.label}</span>
                                </div>
                                <Badge variant={step.isReached ? "solid" : "dot"} className={cn("text-[10px]", !step.isReached && "border-slate-600 text-foreground")}> 
                                  {step.isReached ? "Reached" : "Pending"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-md  p-2">
                                  <div className="text-[10px] uppercase text-foreground">Planned</div>
                                  <div>{formatScheduleDisplayDate(step.plannedDate, step.plannedRaw || "-")}</div>
                                </div>
                                <div className="rounded-md  p-2">
                                  <div className="text-[10px] uppercase text-foreground">Actual</div>
                                  <div>{formatScheduleDisplayDate(step.actualDate, step.actualRaw || (step.isReached ? "Reached" : "-"))}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden gap-2 overflow-x-auto pb-1 md:flex">
                          {scheduleStepper.milestones.map((step, index) => (
                            <div key={step.key} className="min-w-45 rounded-lg border border-border bg-sky-500 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge variant="dot" className="border-slate-700 text-foreground">{index + 1}</Badge>
                                <div className="truncate text-xs font-semibold text-foreground">{step.label}</div>
                              </div>
                              <div className="space-y-1 text-xs text-foreground">
                                <div>Plan: {formatScheduleDisplayDate(step.plannedDate, step.plannedRaw || "-")}</div>
                                <div>Actual: {formatScheduleDisplayDate(step.actualDate, step.actualRaw || (step.isReached ? "Reached" : "-"))}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <ProjectScheduleStatsGrid stats={stats} tone="contrast" />

                    <Card className="border-border ">
                      <CardHeader>
                        <CardTitle className="text-sm text-foreground">Reference Sheets</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {referenceMappings.length === 0 ? (
                          <div className="text-sm text-foreground">No reference sheets found for this project.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {referenceMappings
                              .slice()
                              .sort((a, b) => a.sheetName.localeCompare(b.sheetName))
                              .map((reference) => (
                                <Badge key={reference.sheetSlug} variant="dot" className="border-slate-700 text-foreground">
                                  {reference.sheetName}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="workboard" className="space-y-4">
                    {assignmentGroups.length === 0 ? (
                      <Card className="border-border ">
                        <CardContent className="py-6 text-sm text-foreground">No assignment mappings were found for this project.</CardContent>
                      </Card>
                    ) : (
                      <Accordion type="multiple" className="space-y-3">
                        {assignmentGroups.map((group) => (
                          <AccordionItem key={group.unitType} value={group.unitType} className="rounded-xl border border-border  px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex w-full items-center justify-between gap-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="dot" className="border-slate-700 text-foreground">{group.unitType}</Badge>
                                  <span className="text-xs text-foreground">{group.assignments.length} assignments</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-full px-3 text-[11px]"
                                    disabled={reusingUnitType === group.unitType}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void handleReuseMeasurements(
                                        group.unitType,
                                        group.assignments.map((assignment) => assignment.sheetSlug),
                                      );
                                    }}
                                  >
                                    {reusingUnitType === group.unitType ? (
                                      <>
                                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                        Reusing
                                      </>
                                    ) : pendingReuseByUnitType[group.unitType] ? (
                                      "Confirm Reuse"
                                    ) : (
                                      "Reuse V1 Measurements"
                                    )}
                                  </Button>
                                </div>
                                <div className="w-36">
                                  <div className="mb-1 flex items-center justify-between text-[11px] text-foreground">
                                    <span>{group.completeCount}/{group.assignments.length}</span>
                                    <span>{group.progressPercent}%</span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full ">
                                    <div className="h-full rounded-full bg-linear-to-r from-sky-500 to-emerald-400" style={{ width: `${group.progressPercent}%` }} />
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pb-2">
                                {pendingReuseByUnitType[group.unitType] ? (
                                  <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                                    <div className="font-medium text-amber-200">
                                      Suggested source: {pendingReuseByUnitType[group.unitType].sourceSheetSlug}
                                    </div>
                                    <div className="mt-1 text-foreground/80">
                                      {pendingReuseByUnitType[group.unitType].reason}
                                    </div>
                                  </div>
                                ) : null}
                                {group.assignments.map((assignment) => (
                                  <div key={assignment.sheetSlug} className="rounded-lg border border-border  p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-foreground">{assignment.sheetName}</div>
                                        <div className="text-xs text-foreground">{assignment.rowCount} rows · {assignment.selectedSwsType}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={getStatusVariant(assignment.selectedStatus)} className="text-[10px]">
                                          {assignment.selectedStatus.replace("_", " ")}
                                        </Badge>
                                        <Badge variant="dot" className="border-slate-700 text-[10px] text-foreground">
                                          {formatStageLabel(assignment.selectedStage)}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                      {STAGE_SUBGROUPS.map((subgroup) => {
                                        const isActive = subgroup.stages.includes(assignment.selectedStage);
                                        return (
                                          <div
                                            key={`${assignment.sheetSlug}-${subgroup.label}`}
                                            className={cn(
                                              "rounded-md border px-2 py-1.5 text-xs",
                                              isActive
                                                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                                                : "border-border  text-foreground",
                                            )}
                                          >
                                            <div className="font-medium">{subgroup.label}</div>
                                            <div>{isActive ? formatStageLabel(assignment.selectedStage) : "-"}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </TabsContent>

                  <TabsContent value="exports" className="space-y-4">
                    <Card className="border-border ">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm text-foreground">Delivery Files</CardTitle>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2 border-slate-700 text-foreground"
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
                          <div className="rounded-md border border-slate-700 px-3 py-2 text-xs text-foreground">
                            {manifestRefreshMessage}
                          </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border  p-3">
                            <div className="mb-3 flex items-center gap-2 text-sm text-foreground">
                              <Layers3 className="h-4 w-4 text-cyan-300" /> Branding Bundle
                            </div>
                            <div className="mb-3">
                              <FileCard formatFile="xlsx" />
                            </div>
                            {project?.id && brandingExports?.combinedRelativePath ? (
                              <Button asChild size="sm" className="w-full justify-start gap-2">
                                <a href={buildExportFileUrl(project.id, brandingExports.combinedRelativePath)}>
                                  <Download className="h-3.5 w-3.5" />
                                  Download Combined Branding Workbook
                                </a>
                              </Button>
                            ) : (
                              <p className="text-xs text-foreground">No combined branding export found yet.</p>
                            )}
                          </div>

                          <div className="rounded-xl border border-border  p-3">
                            <div className="mb-3 flex items-center gap-2 text-sm text-foreground">
                              <FolderOpen className="h-4 w-4 text-emerald-300" /> Wire-list Files
                            </div>
                            {project?.id && (wireListExports?.sheetExports?.length ?? 0) > 0 ? (
                              <div className="space-y-2">
                                {wireListExports?.sheetExports?.slice(0, 3).map((item) => (
                                  <Button key={item.fileName} asChild size="sm" variant="outline" className="w-full justify-start gap-2 border-slate-700 text-foreground">
                                    <a href={buildExportFileUrl(project.id, item.relativePath)}>
                                      <Download className="h-3.5 w-3.5" />
                                      {item.sheetName || item.fileName}
                                    </a>
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-foreground">No wire-list exports found yet.</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
        </>
      }
      rightPane={
        <div className="space-y-4">
                <ProjectScheduleFactsCard project={project} row={row} title="Project Facts" tone="contrast" />

                <Card className="h-[56vh] border-border ">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                      <Clock3 className="h-4 w-4 text-sky-300" /> Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-4.5rem)] overflow-y-auto p-0">
                    {!project?.id ? (
                      <div className="px-4 py-3 text-sm text-foreground">
                        Activity will appear once a matching project record is resolved.
                      </div>
                    ) : !currentBadge ? (
                      <div className="px-4 py-3 text-sm text-foreground">
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
              </div>
      }
    />
  );
}
