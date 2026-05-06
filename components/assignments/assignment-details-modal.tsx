"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { Dialog, DialogContent } from "@/components/dialog/dialog";
import { AssignmentTimeline } from "@/components/assignments/assignment-timeline";
import { AssignmentTimeScheduler } from "@/components/assignments/assignment-time-sheduler";
import { SwsConfigPanel } from "@/components/assignments/sws-config-panel";
import type { ProjectManifest } from "@/types/project-manifest";
import type { OperationTimeEntry } from "@/types/d380-operation-codes";
import type { BoardDataResponse } from "@/lib/board/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssignmentSwsConfig } from "@/types/d380-assignment-sws";
import type { SwsTemplateRecord } from "@/types/sws-library";
import { mapRegistryTemplateToRecord, normalizeStageLabel } from "@/app/(workspaces)/[badgeNumber]/sws/_components";
import { resolveSwsTemplateIdForAssignment } from "@/lib/sws/assignment-template-resolution";
import { Button } from "@/components/ui/button";
import { FLOOR_AREAS, FLOOR_STATIONS, type FloorArea } from "@/types/floor-layout";

type ManifestAssignmentRecord = NonNullable<ProjectManifest["assignments"]>[string];

interface AssignmentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectManifest;
  assignment: ManifestAssignmentRecord | null;
  onAssignmentUpdated?: () => Promise<unknown> | unknown;
}

type LoadState = "loading" | "ready" | "error";

export function AssignmentDetailsModal({
  open,
  onOpenChange,
  project,
  assignment,
  onAssignmentUpdated,
}: AssignmentDetailsModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathSegments = pathname?.split("/").filter(Boolean) ?? [];
  const badgeNumber = pathSegments[0] ?? "";
  
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<BoardDataResponse | null>(null);
  const [operationEntries, setOperationEntries] = useState<OperationTimeEntry[]>([]);
  const [swsConfig, setSwsConfig] = useState<AssignmentSwsConfig | null>(null);
  const [swsTemplate, setSwsTemplate] = useState<SwsTemplateRecord | null>(null);

  const assignmentId = assignment?.boardAssignment?.assignmentId ?? (assignment ? `${project.id}:${assignment.sheetSlug}` : null);

  useEffect(() => {
    const activeAssignment = assignment;
    if (!open || !assignmentId || !activeAssignment) {
      return;
    }

    let mounted = true;

    async function loadDetails() {
      setState("loading");
      setError(null);

      try {
        const [boardResponse, operationResponse, swsResponse] = await Promise.all([
          fetch("/api/board/data", { cache: "no-store" }),
          fetch(`/api/projects/${encodeURIComponent(project.id)}/operation-time`, { cache: "no-store" }),
          fetch(`/api/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(activeAssignment!.sheetSlug)}/sws`, { cache: "no-store" }),
        ]);

        if (!boardResponse.ok) {
          throw new Error("Failed to load assignment board data.");
        }

        const boardPayload = (await boardResponse.json()) as BoardDataResponse;
        const operationPayload = operationResponse.ok
          ? ((await operationResponse.json()) as { entries?: OperationTimeEntry[] })
          : { entries: [] };
        const swsPayload = swsResponse.ok
          ? ((await swsResponse.json()) as { sws?: AssignmentSwsConfig })
          : null;

        const nextResolvedSwsConfig = swsPayload?.sws ?? null;
        const resolvedTemplateId = resolveSwsTemplateIdForAssignment(activeAssignment!, nextResolvedSwsConfig?.templateId ?? null);

        const templateResponse = await fetch(`/api/sws/templates/${encodeURIComponent(resolvedTemplateId)}`, { cache: "no-store" });
        const templatePayload = templateResponse.ok
          ? ((await templateResponse.json()) as { template?: SwsTemplateRecord })
          : null;

        if (!mounted) return;

        setBoardData(boardPayload);
        setOperationEntries(operationPayload.entries ?? []);
        setSwsConfig(nextResolvedSwsConfig);
        setSwsTemplate(templatePayload?.template ?? mapRegistryTemplateToRecord(resolvedTemplateId as never));
        setState("ready");
      } catch (loadError) {
        if (!mounted) return;
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Failed to load assignment details.");
      }
    }

    void loadDetails();

    return () => {
      mounted = false;
    };
  }, [assignment, assignmentId, open, project.id]);

  const schedulerSeed = useMemo(() => {
    if (!assignment || !assignmentId) {
      return { initialFloorArea: "NEW_FLEX" as FloorArea, slotsByArea: undefined };
    }

    const boardAssignment = boardData?.projects
      .find((boardProject) => boardProject.id === project.id)
      ?.assignments.find((candidate) => candidate.assignmentId === assignmentId);

    const requestedArea = (boardAssignment?.floorArea as FloorArea | null | undefined) ?? (assignment.boardAssignment?.floorArea as FloorArea | null | undefined);
    const initialFloorArea: FloorArea = requestedArea && FLOOR_AREAS.includes(requestedArea) ? requestedArea : "NEW_FLEX";
    const fallbackRow = FLOOR_STATIONS[initialFloorArea][0]?.id ?? "ST-1";

    return {
      initialFloorArea,
      slotsByArea: {
        [initialFloorArea]: [
          {
            id: `${assignment.sheetSlug}-primary`,
            assignmentId,
            projectId: project.id,
            projectName: project.name,
            projectColor: project.color ?? "#0ea5e9",
            assignmentLabel: assignment.sheetName,
            member: boardAssignment?.assignedBadge ?? assignment.boardAssignment?.assignedBadge ?? "Unassigned",
            stage: String(assignment.stage),
            status: boardAssignment?.workflowStatus ?? assignment.boardAssignment?.workflowStatus ?? "pending",
            rowId: boardAssignment?.workAreaId ?? assignment.boardAssignment?.workAreaId ?? fallbackRow,
            startTime: boardAssignment?.startTime ?? assignment.boardAssignment?.startTime ?? "07:00",
            duration: Math.max(30, boardAssignment?.estimatedMinutes ?? assignment.boardAssignment?.estimatedMinutes ?? 120),
            completionPct: 0,
            estimatedMinutes: boardAssignment?.estimatedMinutes ?? assignment.boardAssignment?.estimatedMinutes ?? 120,
          },
        ],
      } as any,
    };
  }, [assignment, assignmentId, boardData?.projects, project.color, project.id, project.name]);

  const relatedFiles = useMemo(
    () =>
      assignment
        ? [
            { label: "Panel Wire", path: assignment.files.wireListSchemaPath },
            { label: "Brand List Review", path: assignment.files.brandListSchemaPath },
            { label: "Panel Build Up", path: assignment.files.buildUpSWSSchemaPath },
            { label: "Sheet Source", path: assignment.sheetPath },
          ].filter((file) => Boolean(file.path))
        : [],
    [assignment],
  );

  if (!assignment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent clickBehaviour="none" className="flex max-h-[92vh] w-[min(1560px,98vw)] flex-col overflow-hidden bg-background p-0">
        <div className="border-b border-border/70 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{assignment.sheetName}</h2>
              <p className="text-sm text-muted-foreground">
                {project.name} • {project.pdNumber}
                {project.unitNumber ? ` • Unit ${project.unitNumber}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="dot" className="rounded-full">{assignment.swsType}</Badge>
              <Badge variant="dot" className="rounded-full">{assignment.stage.replace(/[_-]+/g, " ")}</Badge>
              <Badge variant="dot" className="rounded-full">{assignment.rowCount} rows</Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 lg:p-6">
          {state === "loading" ? (
            <AssignmentDetailsSkeleton />
          ) : state === "error" ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error ?? "Failed to load assignment details."}
            </div>
          ) : (
            <AssignmentTimeScheduler
              className="h-full"
              title="Assignment Time Scheduler"
              description="Interactive station timeline linked to this assignment and worklog."
              initialFloorArea={schedulerSeed.initialFloorArea}
              slotsByArea={schedulerSeed.slotsByArea}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RelatedFilesCard({ files }: { files: Array<{ label: string; path: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="text-sm font-semibold text-foreground">Related Files</div>
      <div className="mt-3 space-y-2">
        {files.map((file) => (
          <div key={file.path} className="rounded-xl border border-border bg-card px-3 py-2">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{file.label}</div>
            <div className="mt-1 break-all font-mono text-xs text-foreground">{file.path}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwsChecklistCard({ swsTemplate }: { swsTemplate: SwsTemplateRecord | null }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="text-sm font-semibold text-foreground">SWS Checklist</div>
      <div className="mt-3 space-y-2">
        {swsTemplate?.groups?.length ? (
          swsTemplate.groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-border bg-card px-3 py-3">
              <div className="text-sm font-medium text-foreground">{group.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{group.tasks.length} tasks</div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No checklist groups found for this assignment template.</div>
        )}
      </div>
    </div>
  );
}

function SwsAttachmentCard({
  badgeNumber,
  projectId,
  assignment,
  swsConfig,
  swsTemplate,
}: {
  badgeNumber: string;
  projectId: string;
  assignment: ManifestAssignmentRecord;
  swsConfig: AssignmentSwsConfig | null;
  swsTemplate: SwsTemplateRecord | null;
}) {
  const templateId = swsConfig?.templateId ?? (swsTemplate?.id ?? resolveSwsTemplateIdForAssignment(assignment));
  const groupCount = swsTemplate?.groups.length ?? 0;
  const taskCount = swsTemplate?.groups.reduce((total, group) => total + group.tasks.length, 0) ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">Stage Checklist Attachment</div>
          <div className="text-sm text-muted-foreground">This assignment stage resolves to one primary SWS template for checklist review and completion.</div>
        </div>
        <Badge variant="dot" className="rounded-full">{normalizeStageLabel(assignment.stage)}</Badge>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Template</div>
          <div className="mt-1 text-sm font-medium text-foreground">{swsTemplate?.name ?? templateId}</div>
          <div className="mt-1 text-xs text-muted-foreground">{swsTemplate?.description || "Using the resolved primary SWS template for this stage."}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Review Status</div>
            <div className="mt-1 text-sm text-foreground">{swsConfig?.reviewStatus ?? "pending"}</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Checklist Size</div>
            <div className="mt-1 text-sm text-foreground">{groupCount} groups • {taskCount} tasks</div>
          </div>
        </div>

        {swsTemplate?.groups.slice(0, 2).map((group) => (
          <div key={group.id} className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{group.title}</div>
              <Badge variant="dot">{group.tasks.length} tasks</Badge>
            </div>
            {group.description ? <div className="mt-1 text-xs text-muted-foreground">{group.description}</div> : null}
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${badgeNumber}/projects/${projectId}/sws-review?sheetSlug=${encodeURIComponent(assignment.sheetSlug)}`}>Review Checklist</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/${badgeNumber}/projects/${projectId}/sws-config?sheetSlug=${encodeURIComponent(assignment.sheetSlug)}`}>View Config</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssignmentDetailsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
