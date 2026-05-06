"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { WorkspaceSidePanelHeader } from "@/app/(workspaces)/[badgeNumber]/_components";
import { ProjectSidePanelLifecycle } from "@/app/(workspaces)/[badgeNumber]/projects/[projectId]/_components/project-side-panel-lifecycle";
import { ProjectUnitTypeAccordion } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-unit-type-accordion";
import { ProjectAssignmentManagerDialog } from "@/components/projects/project-assignment-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BoardAssignmentView, BoardDataResponse } from "@/lib/board/types";
import type { ProjectManifest } from "@/types/project-manifest";

import {
  ProjectAssignmentRow,
  type ProjectAssignmentEntry,
} from "./project-assignment-row";

type SidePanelTab = "assignments" | "lifecycle";
type AssignmentFilter = "unassigned" | "assigned" | "complete";

type AssignmentEntry = ProjectAssignmentEntry;

interface ProjectDetailsSidePanelProps {
  project: ProjectManifest;
  badgeNumber: string;
  statusLabel: string;
}

export function ProjectDetailsSidePanel({ project, badgeNumber, statusLabel }: ProjectDetailsSidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>("assignments");
  const [managerAssignmentId, setManagerAssignmentId] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("unassigned");
  const [boardState, setBoardState] = useState<{
    isLoading: boolean;
    data: BoardDataResponse | null;
    error: string | null;
  }>({ isLoading: true, data: null, error: null });

  const assignments = useMemo<AssignmentEntry[]>(() => {
    const manifestAssignments = Object.values(project.assignments ?? {})
      .filter((assignment) => assignment.kind === "operational")
      .map((assignment) => ({
        id: assignment.sheetSlug,
        boardAssignmentId: assignment.boardAssignment?.assignmentId ?? `${project.id}:${assignment.sheetSlug}`,
        sheetName: assignment.sheetName,
        swsType: assignment.swsType,
        rowCount: assignment.rowCount,
        stage: assignment.stage,
        assignedBadge: assignment.boardAssignment?.assignedBadge,
        unitType: assignment.unitType ?? null,
      }));

    if (manifestAssignments.length > 0) {
      return manifestAssignments;
    }

    return (project.sheets ?? [])
      .filter((sheet) => sheet.kind === "operational")
      .map((sheet) => ({
        id: sheet.slug,
        boardAssignmentId: `${project.id}:${sheet.slug}`,
        sheetName: sheet.name,
        swsType: "UNDECIDED",
        rowCount: sheet.rowCount,
        stage: null,
        assignedBadge: null,
        unitType: null,
      }));
  }, [project.assignments, project.id, project.sheets]);

  const loadBoardData = useCallback(async () => {
    setBoardState((previous) => ({ ...previous, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/board/data", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load live assignment board data.");
      }

      const payload = (await response.json()) as BoardDataResponse;
      setBoardState({ isLoading: false, data: payload, error: null });
    } catch (error) {
      setBoardState({
        isLoading: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to load live assignment board data.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadBoardData().catch(() => {
      if (!cancelled) {
        setBoardState((previous) => ({ ...previous, error: "Failed to load live assignment board data." }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadBoardData]);

  const boardAssignmentsById = useMemo(() => {
    const entries = boardState.data?.projects
      .filter((boardProject) => boardProject.id === project.id)
      .flatMap((boardProject) => boardProject.assignments)
      .map((assignment) => [assignment.assignmentId, assignment] as const) ?? [];

    return new Map<string, BoardAssignmentView>(entries);
  }, [boardState.data?.projects, project.id]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const liveBoardAssignment = boardAssignmentsById.get(assignment.boardAssignmentId) ?? null;
      const workflowStatus = liveBoardAssignment?.workflowStatus ?? "pending";
      const assignedBadge = liveBoardAssignment?.assignedBadge ?? assignment.assignedBadge ?? null;

      if (assignmentFilter === "complete") {
        return workflowStatus === "completed";
      }

      if (assignmentFilter === "assigned") {
        return workflowStatus !== "completed" && Boolean(assignedBadge);
      }

      return workflowStatus !== "completed" && !assignedBadge;
    });
  }, [assignmentFilter, assignments, boardAssignmentsById]);

  const managerAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === managerAssignmentId) ?? null,
    [assignments, managerAssignmentId],
  );
  const managerBoardAssignment = managerAssignment
    ? boardAssignmentsById.get(managerAssignment.boardAssignmentId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <WorkspaceSidePanelHeader
        mode="default"
        eyebrow={`${project.pdNumber}${project.unitNumber ? ` • Unit ${project.unitNumber}` : ""}`}
        title={project.name}
        returnUrl={`/${badgeNumber}/projects`}
        returnLabel="Back to projects"
      />

      <div className="border-b border-border px-3 py-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SidePanelTab)}>
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger
              id={`project-${project.id}-side-tab-trigger-assignments`}
              aria-controls={`project-${project.id}-side-tab-content-assignments`}
              value="assignments"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              id={`project-${project.id}-side-tab-trigger-lifecycle`}
              aria-controls={`project-${project.id}-side-tab-content-lifecycle`}
              value="lifecycle"
            >
              Lifecycle
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 px-3 py-3">
          {activeTab === "assignments" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Assignment Queue</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {boardState.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    {filteredAssignments.length}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1 px-1">
                <Button
                  type="button"
                  variant={assignmentFilter === "unassigned" ? "secondary" : "outline"}
                  size="sm"
                  className="h-6 rounded-full px-2 text-[10px]"
                  onClick={() => setAssignmentFilter("unassigned")}
                >
                  Unassigned
                </Button>
                <Button
                  type="button"
                  variant={assignmentFilter === "assigned" ? "secondary" : "outline"}
                  size="sm"
                  className="h-6 rounded-full px-2 text-[10px]"
                  onClick={() => setAssignmentFilter("assigned")}
                >
                  Assigned
                </Button>
                <Button
                  type="button"
                  variant={assignmentFilter === "complete" ? "secondary" : "outline"}
                  size="sm"
                  className="h-6 rounded-full px-2 text-[10px]"
                  onClick={() => setAssignmentFilter("complete")}
                >
                  Complete
                </Button>
              </div>

              {boardState.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
                  {boardState.error}
                </div>
              ) : null}

              {filteredAssignments.length === 0 ? (
                <div className="rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                  No assignments match this filter.
                </div>
              ) : (
                <ProjectUnitTypeAccordion
                  items={filteredAssignments}
                  unitTypeOrder={project.unitTypes ?? []}
                  emptyGroupMessage="No assignments in this unit type."
                  renderItem={(assignment) => (
                    <ProjectAssignmentRow
                      assignment={assignment}
                      liveBoardAssignment={
                        boardAssignmentsById.get(assignment.boardAssignmentId) ?? null
                      }
                      onOpenManager={setManagerAssignmentId}
                    />
                  )}
                />
              )}
            </div>
          ) : (
            <ProjectSidePanelLifecycle project={project} />
          )}
        </div>
      </ScrollArea>

      <ProjectAssignmentManagerDialog
        open={Boolean(managerAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            setManagerAssignmentId(null);
          }
        }}
        target={
          managerAssignment
            ? {
                assignmentId: managerAssignment.boardAssignmentId,
                sheetName: managerAssignment.sheetName,
                rowCount: managerAssignment.rowCount,
                swsType: managerAssignment.swsType,
                stage: managerAssignment.stage,
              }
            : null
        }
        boardAssignment={managerBoardAssignment}
        members={boardState.data?.members ?? []}
        onApplied={loadBoardData}
      />
    </div>
  );
}
