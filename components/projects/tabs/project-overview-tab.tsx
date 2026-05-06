"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  Hash,
  Layers,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import type { ProjectManifest } from "@/types/project-manifest";
import { getDashboardProjectStatus } from "@/lib/projects/dashboard-status";
import {
  ProjectLifecycleStepper,
  type ProjectActionStateSummary,
} from "@/components/projects/project-lifecycle-stepper";
import {
  ASSIGNMENT_STAGES,
  STAGE_DISPLAY_CONFIG,
  type AssignmentStageId,
} from "@/types/d380-assignment-stages";
import {
  CurrentStatusCard,
  MetaRow,
  StatItem,
  StageDot,
  formatMinutes,
  formatMinutesToDays,
} from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";
import { buildExportHref } from "@/components/projects/project-lifecycle-stepper";
import { ProjectActivityTab } from "@/components/projects/tabs/project-activity-tab";
import { useSession } from "@/hooks/use-session";
import { activityService } from "@/lib/services/activity-service";

export function ProjectOverviewTab({
  project,
  projectColor,
  onNavigateToTab,
  onOpenBrandReview,
  actionStateRefreshKey,
}: ProjectTabProps) {
  const { user } = useSession();
  const model = project;
  const lwcConfig = model.lwcType ? LWC_TYPE_REGISTRY[model.lwcType] : null;
  const operationalSheets = model.sheets.filter(
    (sheet) => sheet.kind === "operational",
  );
  const referenceSheets = model.sheets.filter(
    (sheet) => sheet.kind === "reference",
  );
  const totalRows = model.sheets.reduce(
    (sum, sheet) => sum + sheet.rowCount,
    0,
  );

  const assignmentEntries = useMemo(() => {
    const manifestAssignments = Object.values(model.assignments ?? {})
      .filter((assignment) => assignment.kind === "operational")
      .map((assignment) => ({
        id: assignment.sheetSlug,
        sheetName: assignment.sheetName,
        rowCount: assignment.rowCount,
        stage: assignment.stage,
        swsType: assignment.swsType,
      }));

    if (manifestAssignments.length > 0) {
      return manifestAssignments;
    }

    return operationalSheets.map((sheet) => ({
      id: sheet.slug,
      sheetName: sheet.name,
      rowCount: sheet.rowCount,
      stage: null,
      swsType: "UNDECIDED",
    }));
  }, [model.assignments, operationalSheets]);

  const derivedStatus = useMemo(
    () => getDashboardProjectStatus(model),
    [model],
  );
  const gates = model.lifecycleGates ?? [];
  const gateProgress =
    gates.length > 0
      ? gates.filter((gate) => gate.status === "COMPLETE").length / gates.length
      : 0;

  const [stageHours, setStageHours] = useState<{
    stages: {
      stageId: string;
      label: string;
      estimatedMinutes: number;
      averageMinutes: number;
      actualMinutes: number;
    }[];
    sheets: {
      sheetId: string;
      sheetName: string;
      rowCount: number;
      estimatedMinutes: number;
    }[];
    totalEstimatedMinutes: number;
    totalAverageMinutes: number;
    totalActualMinutes: number;
  } | null>(null);
  const [actionStateSummary, setActionStateSummary] =
    useState<ProjectActionStateSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/stage-hours`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStageHours(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.id, actionStateRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/action-state`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { summary?: ProjectActionStateSummary } | null) => {
        if (!cancelled) {
          setActionStateSummary(data?.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActionStateSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const stageGroups = useMemo(() => {
    if (assignmentEntries.length === 0) return [];

    const groupMap = new Map<
      string,
      {
        stageId: AssignmentStageId | "PENDING";
        label: string;
        shortLabel: string;
        color: string;
        order: number;
        sheets: typeof assignmentEntries;
      }
    >();

    for (const assignment of assignmentEntries) {
      const stageId = assignment.stage;
      if (stageId && STAGE_DISPLAY_CONFIG[stageId]) {
        const config = STAGE_DISPLAY_CONFIG[stageId];
        const existing = groupMap.get(stageId);
        if (existing) {
          existing.sheets.push(assignment);
        } else {
          groupMap.set(stageId, {
            stageId,
            label: config.label,
            shortLabel: config.shortLabel,
            color: config.color,
            order:
              ASSIGNMENT_STAGES.find((stage) => stage.id === stageId)?.order ??
              Number.MAX_SAFE_INTEGER,
            sheets: [assignment],
          });
        }
        continue;
      }

      const existing = groupMap.get("PENDING");
      if (existing) {
        existing.sheets.push(assignment);
      } else {
        groupMap.set("PENDING", {
          stageId: "PENDING",
          label: "Pending",
          shortLabel: "Pending",
          color: "slate",
          order: Number.MAX_SAFE_INTEGER,
          sheets: [assignment],
        });
      }
    }

    return Array.from(groupMap.values()).sort(
      (left, right) => left.order - right.order,
    );
  }, [assignmentEntries]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border/50 bg-card/60 p-3 max-w-2xl overflow-hidden">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Project Lifecycle
          </h4>
          {gates.length > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {Math.round(gateProgress * 100)}%
            </Badge>
          ) : null}
        </div>

        <ProjectLifecycleStepper
          project={model}
          summary={actionStateSummary}
          className="min-w-0 rounded-md bg-muted/30 px-2 py-3"
          horizontalScroll
          visibleStepCount={4}
          autoScrollToLatestComplete
          onUpload={() => onNavigateToTab?.("legals")}
          onBrandReview={() => onOpenBrandReview?.()}
          onDownloadBranding={async (_, relativePath) => {
            if (user?.badge) {
              const brandingAlreadyStarted = Boolean(actionStateSummary?.brandingStarted || actionStateSummary?.brandingReadyGateComplete);
              try {
                await activityService.logAction(user.badge, user.currentShift ?? "1st", {
                  action: brandingAlreadyStarted ? "COMPLETED" : "STARTED",
                  projectId: model.id,
                  performedBy: user.badge,
                  result: "success",
                  metadata: {
                    projectId: model.id,
                    projectName: model.name,
                    pdNumber: model.pdNumber,
                    workflow: "branding",
                    milestone: brandingAlreadyStarted ? "complete" : "download",
                  },
                });
              } catch {
                // Keep download non-blocking.
              }
            }

            if (typeof window !== "undefined") {
              window.open(
                buildExportHref(model.id, relativePath),
                "_blank",
                "noopener,noreferrer",
              );
            }
          }}
        />
        <ProjectActivityTab
          project={project}
          projectColor={projectColor}
          onProjectRefresh={undefined}
          onNavigateToTab={onNavigateToTab}
        />
      </div>
    </div>
  );
}
