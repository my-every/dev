"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Clock, Lock, Sparkles, Tags, type LucideIcon } from "lucide-react";

import { Dialog, DialogContent } from "@/components/dialog/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";
import type { ProjectLifecycleGateId, ProjectLifecycleGateState } from "@/types/d380-assignment-stages";
import type { BoardDataResponse } from "@/lib/board/types";
import { ASSIGNMENT_STAGES, type AssignmentStageId } from "@/types/d380-assignment-stages";

type UploadAwareManifest = ProjectManifest & {
  activeWorkbookRevisionId?: string | null;
  activeLayoutRevisionId?: string | null;
};

export type LifecycleStepId =
  | "legals"
  | "brandlist-reviewed"
  | "branding-ready"
  | "kitted"
  | "conlay"
  | "build-up"
  | "wiring"
  | "box-build"
  | "cross-wire"
  | "test"
  | "power-check"
  | "biq";

export type LifecycleStepStatus = "complete" | "available" | "locked" | "overdue";
export type LifecycleStepperAction = "upload" | "brand-review" | "download-branding" | null;

export interface LifecycleStep {
  id: LifecycleStepId;
  label: string;
  description: string;
  status: LifecycleStepStatus;
  action: LifecycleStepperAction;
  icon: LucideIcon;
  plannedDate: Date | null;
  actualDate: Date | null;
  stageId?: AssignmentStageId;
}

export interface ProjectActionStateSummary {
  hasOperationalSheets?: boolean;
  legalsUploaded?: boolean;
  brandingWorkspaceVisited?: boolean;
  brandListStarted?: boolean;
  brandListReady?: boolean;
  brandingCombinedRelativePath?: string | null;
  brandingStarted?: boolean;
  brandingReadyGateComplete?: boolean;
  stateMemberProjectId?: string;
  familyProjectIds?: string[];
}

function getGate(project: ProjectManifest, gateId: ProjectLifecycleGateId): ProjectLifecycleGateState | null {
  return project.lifecycleGates?.find((gate) => gate.gateId === gateId) ?? null;
}

function hasUploadedProjectFiles(project: ProjectManifest) {
  const uploadAwareProject = project as UploadAwareManifest;
  const hasWorkbook = Boolean(uploadAwareProject.activeWorkbookRevisionId);
  const hasLayout = Boolean(uploadAwareProject.activeLayoutRevisionId);
  const hasOperationalSheets = (project.sheets ?? []).some((sheet) => sheet.kind === "operational" && sheet.hasData);

  return (hasWorkbook && hasLayout) || hasOperationalSheets;
}

function parseProjectDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStepStatus(isComplete: boolean, isUnlocked: boolean): LifecycleStepStatus {
  if (isComplete) {
    return "complete";
  }

  return isUnlocked ? "available" : "locked";
}

function toStageOrderMap() {
  return new Map(ASSIGNMENT_STAGES.map((stage) => [stage.id, stage.order]));
}

function getAssignmentStageSummaries(project: ProjectManifest) {
  return Object.values(project.assignments ?? {}).filter((assignment) => assignment.kind === "operational");
}

function hasStartedBeforeConlay(project: ProjectManifest, conlayDate: Date | null) {
  const assignments = getAssignmentStageSummaries(project);
  const startedAt = assignments
    .map((assignment) => assignment.boardAssignment?.actualStartTime)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .find((date) => !Number.isNaN(date.getTime()));

  if (!startedAt) {
    return { started: false, metPlannedDate: false, startedAt: null as Date | null };
  }
  if (!conlayDate) {
    return { started: true, metPlannedDate: true, startedAt };
  }

  return {
    started: true,
    metPlannedDate: startedAt.getTime() <= conlayDate.getTime(),
    startedAt,
  };
}

function areAllAssignmentsAtOrPast(project: ProjectManifest, stageId: AssignmentStageId) {
  const assignments = getAssignmentStageSummaries(project);
  if (assignments.length === 0) return false;
  const stageOrderMap = toStageOrderMap();
  const targetOrder = stageOrderMap.get(stageId);
  if (targetOrder == null) return false;
  return assignments.every((assignment) => {
    const assignmentOrder = stageOrderMap.get(assignment.stage);
    return typeof assignmentOrder === "number" && assignmentOrder >= targetOrder;
  });
}

function formatStepDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getStepLabel(step: LifecycleStep) {
  if (step.status === "complete") {
    return `${step.label} complete`;
  }

  if (step.status === "overdue") {
    return `${step.label} — past planned date, upload required`;
  }

  if (step.status === "available") {
    return `${step.label} is unlocked`;
  }

  return `${step.label} is locked`;
}

export function buildExportHref(projectId: string, relativePath: string) {
  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const encodedSegments = normalizedRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encodedSegments}?download=1`;
}

export function buildProjectLifecycleSteps(
  project: ProjectManifest,
  summary: ProjectActionStateSummary | null,
): LifecycleStep[] {
  const dueDate = parseProjectDate(project.dueDate);
  const conlayDate = parseProjectDate(project.planConlayDate);
  const now = new Date();
  const legalsGate = getGate(project, "LEGALS_READY");
  const brandListGate = getGate(project, "BRANDLIST_COMPLETE");
  const brandingGate = getGate(project, "BRANDING_READY");
  const kittingGate = getGate(project, "KITTING_READY");
  const duePassed = Boolean(dueDate && dueDate.getTime() <= now.getTime());
  const legalsUploaded = summary?.legalsUploaded ?? hasUploadedProjectFiles(project);
  const brandListInProgress = Boolean(summary?.brandListStarted ?? summary?.brandingWorkspaceVisited);
  const brandListReviewed = Boolean(summary?.brandListReady ?? summary?.brandingCombinedRelativePath);
  const brandingInProgress = Boolean(summary?.brandingStarted) && !(summary?.brandingReadyGateComplete ?? brandingGate?.status === "COMPLETE");
  const brandingComplete = Boolean(summary?.brandingReadyGateComplete ?? brandingGate?.status === "COMPLETE");
  const brandingExportPath = summary?.brandingCombinedRelativePath ?? null;
  const kittedComplete = kittingGate?.status === "COMPLETE";
  const conlayStart = hasStartedBeforeConlay(project, conlayDate);
  const buildUpComplete = areAllAssignmentsAtOrPast(project, "BUILD_UP");
  const wiringComplete = areAllAssignmentsAtOrPast(project, "WIRING");
  const boxBuildComplete = areAllAssignmentsAtOrPast(project, "BOX_BUILD");
  const crossWireComplete = areAllAssignmentsAtOrPast(project, "CROSS_WIRE");
  const testComplete = areAllAssignmentsAtOrPast(project, "TEST_1ST_PASS");
  const powerCheckComplete = areAllAssignmentsAtOrPast(project, "POWER_CHECK");
  const biqComplete = areAllAssignmentsAtOrPast(project, "BIQ");

  const legalsPendingStatus: LifecycleStepStatus = legalsUploaded
    ? "complete"
    : duePassed
      ? "overdue"
      : "available";

  return [
    {
      id: "legals",
      label: "Legals Ready",
      description: legalsUploaded
        ? "Legals have been uploaded for this project."
        : duePassed
          ? "The planned date has passed but legals have not been uploaded yet."
          : "Waiting for the planned date to arrive before legals are due.",
      status: legalsPendingStatus,
      action: "upload" as LifecycleStepperAction,
      icon: Clock,
      plannedDate: dueDate ?? parseProjectDate(legalsGate?.targetDate),
      actualDate: legalsUploaded
        ? parseProjectDate(legalsGate?.completedAt) ?? parseProjectDate(project.createdAt)
        : null,
    },
    {
      id: "brandlist-reviewed",
      label: brandListReviewed
        ? "Brandlist Reviewed"
        : brandListInProgress
          ? "Brandlist In Progress"
          : "Brandlist Pending",
      description: brandListReviewed
        ? "Brand list review is complete and the combined workbook has been generated."
        : brandListInProgress
          ? "Review has started. Continue the workspace to approve sheets and combine into one file."
          : "Open the branding workspace and press Start to begin brand list review.",
      status: getStepStatus(brandListReviewed, legalsUploaded),
      action: "brand-review",
      icon: Tags,
      plannedDate: parseProjectDate(brandListGate?.targetDate),
      actualDate: brandListReviewed ? parseProjectDate(brandListGate?.completedAt) : null,
    },
    {
      id: "branding-ready",
      label: brandingComplete
        ? "Brand Wire Complete"
        : brandingInProgress
          ? "Branding In Progress"
          : "Branding Not Started",
      description: brandingComplete
        ? "Brand wire workflow is complete for this project."
        : brandingInProgress
          ? "Branding has started. Continue by badging in and completing the brand wire step."
          : "Not started yet. Once Brandlist is reviewed and exported, click this step to begin branding.",
      status: getStepStatus(brandingComplete, brandListReviewed),
      action: brandingExportPath ? "download-branding" : null,
      icon: Sparkles,
      plannedDate: parseProjectDate(brandingGate?.targetDate),
      actualDate: brandingComplete ? parseProjectDate(brandingGate?.completedAt) : null,
    },
    {
      id: "kitted",
      label: "Kitting/Kitted",
      description: kittedComplete
        ? "Project kitting gate is complete."
        : "Kitting gate is pending completion.",
      status: getStepStatus(kittedComplete, brandingComplete),
      action: null,
      icon: Check,
      plannedDate: parseProjectDate(kittingGate?.targetDate),
      actualDate: parseProjectDate(kittingGate?.completedAt),
    },
    {
      id: "conlay",
      label: "Conlay",
      description: conlayStart.started
        ? conlayStart.metPlannedDate
          ? "Assignments started before Conlay date. Project is early and met the planned date."
          : "Assignments started after Conlay date."
        : "Awaiting first assignment start to evaluate Conlay plan.",
      status: conlayStart.started ? "complete" : getStepStatus(false, kittedComplete),
      action: null,
      icon: Clock,
      plannedDate: conlayDate,
      actualDate: conlayStart.startedAt,
    },
    {
      id: "build-up",
      label: "Build Up",
      description: "Open stage workspace and timeline across available projects in Build Up.",
      status: getStepStatus(buildUpComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "BUILD_UP",
    },
    {
      id: "wiring",
      label: "Wiring",
      description: "Open stage workspace and timeline across available projects in Wiring.",
      status: getStepStatus(wiringComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "WIRING",
    },
    {
      id: "box-build",
      label: "Box Build",
      description: "Open stage workspace and timeline across available projects in Box Build.",
      status: getStepStatus(boxBuildComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "BOX_BUILD",
    },
    {
      id: "cross-wire",
      label: "Cross Wire",
      description: "Open stage workspace and timeline across available projects in Cross Wire.",
      status: getStepStatus(crossWireComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "CROSS_WIRE",
    },
    {
      id: "test",
      label: "Test",
      description: "Open stage workspace and timeline across available projects in Test.",
      status: getStepStatus(testComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "TEST_1ST_PASS",
    },
    {
      id: "power-check",
      label: "PWR CHECK",
      description: "Power check milestone.",
      status: getStepStatus(powerCheckComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "POWER_CHECK",
    },
    {
      id: "biq",
      label: "BIQ",
      description: "Open stage workspace and timeline across available projects in BIQ.",
      status: getStepStatus(biqComplete, conlayStart.started),
      action: null,
      icon: Sparkles,
      plannedDate: null,
      actualDate: null,
      stageId: "BIQ",
    },
  ];
}

export function ProjectLifecycleStepperSkeleton({
  stepCount = 3,
  className,
}: {
  stepCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-start", className)}>
      {Array.from({ length: stepCount }).map((_, index) => (
        <div key={index} className="flex min-w-0 flex-1 items-center">
          <div className="flex flex-1 flex-col items-center gap-1.5 px-1">
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
            <div className="flex min-h-9 w-full flex-col items-center gap-1 pt-1">
              <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
              <div className="h-2 w-10 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
          {index < stepCount - 1 ? (
            <div className="mt-4.5 -mx-1 h-0 w-10 shrink-0 border-t-2 border-dashed border-border/40" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

type ConnectorSize = "sm" | "md" | "lg";

const CONNECTOR_MIN_HEIGHT: Record<ConnectorSize, string> = {
  sm: "0.5rem",
  md: "1.25rem",
  lg: "2rem",
};

interface ProjectLifecycleStepperProps {
  project: ProjectManifest;
  summary: ProjectActionStateSummary | null;
  className?: string;
  actionTargetProject?: ProjectManifest;
  orientation?: "horizontal" | "vertical";
  horizontalScroll?: boolean;
  visibleStepCount?: number;
  autoScrollToLatestComplete?: boolean;
  /** Show a background card behind each vertical step row */
  stepBackground?: boolean;
  /** Controls the minimum height of the connector line between vertical steps */
  connectorSize?: ConnectorSize;
  /** Only render steps from this step id onward (inclusive). */
  fromStep?: LifecycleStepId;
  /** Only render steps up to and including this step id. */
  toStep?: LifecycleStepId;
  onUpload?: (project: ProjectManifest) => void;
  onBrandReview?: (project: ProjectManifest) => void;
  onDownloadBranding?: (project: ProjectManifest, relativePath: string) => void;
}

export function ProjectLifecycleStepper({
  project,
  summary,
  className,
  actionTargetProject,
  orientation = "horizontal",
  horizontalScroll = false,
  visibleStepCount = 4,
  autoScrollToLatestComplete = false,
  stepBackground = false,
  connectorSize = "md",
  fromStep,
  toStep,
  onUpload,
  onBrandReview,
  onDownloadBranding,
}: ProjectLifecycleStepperProps) {
  const steps = useMemo(() => buildProjectLifecycleSteps(project, summary), [project, summary]);

  // Slice to the requested range when fromStep / toStep are provided
  const visibleSteps = useMemo(() => {
    if (!fromStep && !toStep) return steps;
    const ids = steps.map((s) => s.id);
    const fromIndex = fromStep ? ids.indexOf(fromStep) : 0;
    const toIndex = toStep ? ids.indexOf(toStep) : steps.length - 1;
    return steps.slice(
      fromIndex === -1 ? 0 : fromIndex,
      (toIndex === -1 ? steps.length - 1 : toIndex) + 1,
    );
  }, [steps, fromStep, toStep]);

  const targetProject = actionTargetProject ?? project;
  const [selectedStageStep, setSelectedStageStep] = useState<LifecycleStep | null>(null);
  const [boardData, setBoardData] = useState<BoardDataResponse | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/board/data", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: BoardDataResponse | null) => {
        if (!cancelled) setBoardData(payload);
      })
      .catch(() => {
        if (!cancelled) setBoardData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stageProjects = useMemo(() => {
    if (!selectedStageStep?.stageId || !boardData) return [];
    return boardData.projects
      .map((boardProject) => {
        const matching = boardProject.assignments.filter((assignment) => assignment.stage === selectedStageStep.stageId);
        return {
          id: boardProject.id,
          pdNumber: boardProject.pdNumber,
          name: boardProject.name,
          assignmentCount: matching.length,
          assignments: matching.map((assignment) => assignment.sheetName),
        };
      })
      .filter((projectEntry) => projectEntry.assignmentCount > 0)
      .sort((a, b) => b.assignmentCount - a.assignmentCount);
  }, [boardData, selectedStageStep?.stageId]);

  const latestCompletedIndex = useMemo(
    () =>
      visibleSteps.reduce((latestIndex, step, index) => {
        return step.status === "complete" ? index : latestIndex;
      }, -1),
    [visibleSteps],
  );

  useEffect(() => {
    if (!horizontalScroll || !autoScrollToLatestComplete || latestCompletedIndex < 0) {
      return;
    }

    const viewport = scrollViewportRef.current;
    const currentStep = stepRefs.current[latestCompletedIndex];
    if (!viewport || !currentStep) {
      return;
    }

    const alignToIndex = Math.max(0, latestCompletedIndex - Math.max(visibleStepCount - 1, 0));
    const targetStep = stepRefs.current[alignToIndex] ?? currentStep;
    viewport.scrollTo({
      left: targetStep.offsetLeft,
      behavior: "smooth",
    });
  }, [autoScrollToLatestComplete, horizontalScroll, latestCompletedIndex, visibleStepCount]);

  return (
    <div className={cn("w-full", className)}>
      {orientation === "vertical" ? (
        <div className="flex flex-col">
          {visibleSteps.map((step, index) => {
            const Icon = step.status === "complete" ? Check : step.status === "locked" ? Lock : step.status === "overdue" ? AlertTriangle : step.icon;
            const canUpload = step.action === "upload" && onUpload;
            const canReview = step.action === "brand-review" && onBrandReview && step.status !== "locked";
            const canDownload = step.action === "download-branding" && onDownloadBranding && summary?.brandingCombinedRelativePath;
            const canOpenStageModal = Boolean(step.stageId);
            const isInteractive = Boolean(canUpload || canReview || canDownload || canOpenStageModal);
            const isComplete = step.status === "complete";
            const isAvailable = step.status === "available";
            const isOverdue = step.status === "overdue";
            const isLast = index === visibleSteps.length - 1;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-stretch gap-3",
                  stepBackground && "rounded-lg border border-border/50 bg-card/50 px-2 py-1.5",
                  stepBackground && !isLast && "mb-1",
                )}
              >
                {/* Left column: icon + connector */}
                <div className="flex flex-col items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={!isInteractive}
                        aria-label={getStepLabel(step)}
                        onClick={() => {
                          if (canUpload) { onUpload(targetProject); return; }
                          if (canReview) { onBrandReview(targetProject); return; }
                          if (canDownload && summary?.brandingCombinedRelativePath) { onDownloadBranding(targetProject, summary.brandingCombinedRelativePath); return; }
                          if (canOpenStageModal) { setSelectedStageStep(step); }
                        }}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition-all",
                          isComplete && "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25",
                          isOverdue && "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/25",
                          isAvailable && "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/80",
                          step.status === "locked" && "border-border bg-muted text-muted-foreground opacity-70",
                          !isInteractive && "cursor-default hover:border-border hover:bg-muted",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-56 p-2 text-xs">
                      {step.description}
                      <span className="text-[10px] leading-tight text-muted-foreground">
                    {step.actualDate
                      ? `${formatStepDate(step.actualDate)}`
                      : step.plannedDate
                        ? `${formatStepDate(step.plannedDate)}`
                        : null}
                  </span>
                    </TooltipContent>
                  </Tooltip>

                  {!isLast ? (
                    <div
                      className={cn(
                        "my-0.5 w-0.5 rounded-full",
                        stepBackground ? "flex-none" : "flex-1",
                        isComplete ? "bg-emerald-500" : isOverdue ? "bg-orange-400" : "bg-border",
                      )}
                      style={{ minHeight: CONNECTOR_MIN_HEIGHT[connectorSize] }}
                    />
                  ) : null}
                </div>

                {/* Right column: label + date */}
                <div className={cn("flex min-w-0 flex-col justify-center gap-0.5 py-0.5", !isLast && "pb-3")}>
                  <span
                    className={cn(
                      "text-[11px] font-semibold leading-tight",
                      isComplete && "text-emerald-700 dark:text-emerald-400",
                      isOverdue && "text-orange-600 dark:text-orange-400",
                      (isAvailable || step.status === "locked") && "text-foreground",
                      step.status === "locked" && "opacity-60",
                    )}
                  >
                    {step.label}
                  </span>
          
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div
        ref={scrollViewportRef}
        className={cn(
          horizontalScroll
            ? "overflow-x-auto overscroll-x-contain scroll-smooth flex flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            : "overflow-visible",
        )}
      >
        <div className={cn("flex items-start", horizontalScroll ? "w-full  snap-x snap-mandatory" : "w-full")}>
        {visibleSteps.map((step, index) => {
          const Icon = step.status === "complete" ? Check : step.status === "locked" ? Lock : step.status === "overdue" ? AlertTriangle : step.icon;
          const canUpload = step.action === "upload" && onUpload;
          const canReview = step.action === "brand-review" && onBrandReview && step.status !== "locked";
          const canDownload = step.action === "download-branding" && onDownloadBranding && summary?.brandingCombinedRelativePath;
          const canOpenStageModal = Boolean(step.stageId);
          const isInteractive = Boolean(canUpload || canReview || canDownload || canOpenStageModal);
          const isComplete = step.status === "complete";
          const isAvailable = step.status === "available";
          const isOverdue = step.status === "overdue";

          return (
            <div
              key={step.id}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className={cn("flex items-start", horizontalScroll ? "w-[max(180px,calc(100%/4))]  shrink-0 snap-start" : "min-w-0 flex-1")}
              style={horizontalScroll ? { width: `max(180px, calc(100% / ${Math.max(1, visibleStepCount)}))` } : undefined}
            >
              <div className="flex flex-1 flex-col items-center gap-1.5 px-1 text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={!isInteractive}
                      aria-label={getStepLabel(step)}
                      onClick={() => {
                        if (canUpload) {
                          onUpload(targetProject);
                          return;
                        }

                        if (canReview) {
                          onBrandReview(targetProject);
                          return;
                        }

                        if (canDownload && summary?.brandingCombinedRelativePath) {
                          onDownloadBranding(targetProject, summary.brandingCombinedRelativePath);
                          return;
                        }

                        if (canOpenStageModal) {
                          setSelectedStageStep(step);
                        }
                      }}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-all",
                        isComplete && "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25",
                        step.status === "overdue" && "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/25",
                        isAvailable && "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/80",
                        step.status === "locked" && "border-border bg-muted text-muted-foreground opacity-70",
                        !isInteractive && "cursor-default hover:border-border hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-56 border border-border bg-background p-2 text-xs text-foreground shadow-md">
                    {isComplete
                      ? step.actualDate
                        ? `Completed ${formatStepDate(step.actualDate)}`
                        : step.description
                      : (
                        <div className="flex flex-col gap-0.5">
                          <span>{step.description}</span>
                          {step.plannedDate ? (
                            <span className="text-muted-foreground">Plan: {formatStepDate(step.plannedDate)}</span>
                          ) : null}
                        </div>
                      )}
                  </TooltipContent>
                </Tooltip>

                <span className="flex min-h-9 w-full justify-center text-center">
                  <span
                    className={cn(
                      "line-clamp-3 w-full text-center text-[10px] font-semibold leading-tight",
                      isComplete && "text-emerald-700 dark:text-emerald-400",
                      step.status === "overdue" && "text-orange-600 dark:text-orange-400",
                      (isAvailable || step.status === "locked") && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </span>
              </div>

              {index < visibleSteps.length - 1 ? (
                <div
                  className={cn(
                    "mt-4.5 -mx-1 w-10 shrink-0",
                    step.status === "complete"
                      ? "h-0.5 rounded-full bg-emerald-500"
                      : isOverdue
                        ? "h-0 border-t-2 border-dashed border-orange-400"
                        : "h-0 border-t-2 border-dashed border-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
      )}

      <Dialog open={Boolean(selectedStageStep)} onOpenChange={(open) => !open && setSelectedStageStep(null)}>
        <DialogContent className="max-h-[88vh] w-[min(980px,96vw)] overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-lg font-semibold text-foreground">{selectedStageStep?.label} Workspace</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Workflow and timeline rollup for all projects currently active in this stage.
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-5">
            {stageProjects.length > 0 ? (
              <div className="space-y-3">
                {stageProjects.map((stageProject) => (
                  <div key={stageProject.id} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{stageProject.name}</div>
                        <div className="text-xs text-muted-foreground">{stageProject.pdNumber}</div>
                      </div>
                      <div className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                        {stageProject.assignmentCount} assignments
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stageProject.assignments.map((sheetName) => (
                        <span key={`${stageProject.id}-${sheetName}`} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {sheetName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                No projects are currently active in {selectedStageStep?.label}.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
