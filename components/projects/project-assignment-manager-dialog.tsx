"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, UserRound } from "lucide-react";

import { DateField } from "@/components/projects/fields";
import {
  MemberAssignmentSelector,
  type AssignableMember,
} from "@/components/projects/member-assignment-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDefaultScheduleDateForShift,
  getDefaultStartTimeForShift,
} from "@/lib/board/assignment-flow";
import type { BoardAssignmentView, BoardMemberView } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import { getOperationCodesForStage } from "@/types/d380-operation-codes";
import type { AssignmentStageId } from "@/types/d380-assignment-stages";
import type { ShiftId } from "@/types/shifts";

export interface ProjectAssignmentManagerTarget {
  assignmentId: string;
  sheetName: string;
  rowCount: number;
  swsType: string;
  stage: AssignmentStageId | null;
}

interface ProjectAssignmentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ProjectAssignmentManagerTarget | null;
  boardAssignment: BoardAssignmentView | null;
  members: BoardMemberView[];
  onApplied: () => Promise<void> | void;
}

function mapAssignmentStageToOperationStage(
  stage: AssignmentStageId | null,
): AssignmentStageId {
  switch (stage) {
    case "CROSS_WIRING":
      return "CROSS_WIRE";
    case "READY_TO_TEST":
      return "TEST_1ST_PASS";
    default:
      return stage ?? "BUILD_UP";
  }
}

function formatAvailability(member: BoardMemberView) {
  if (member.availabilityStatus === "AVAILABLE") {
    return `Available · ${member.shift}`;
  }
  if (member.availabilityStatus === "ON_ASSIGNMENT") {
    return `On assignment · ${member.shift}`;
  }
  return `Off shift · ${member.shift}`;
}

function formatRole(member: BoardMemberView) {
  return [member.role, member.primaryLwc].filter(Boolean).join(" • ");
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeInputValue(value?: string | null): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return trimmed;
  }

  const [, hoursText, minutes, meridiem] = match;
  let hours = Number(hoursText) % 12;
  if (meridiem.toUpperCase() === "PM") {
    hours += 12;
  }

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function mapMemberStatus(member: BoardMemberView): AssignableMember["status"] {
  if (member.availabilityStatus === "AVAILABLE") return "active";
  if (member.availabilityStatus === "ON_ASSIGNMENT") return "meeting";
  return "offline";
}

function mapBoardMemberToAssignable(member: BoardMemberView): AssignableMember {
  const [firstName = member.fullName, ...rest] = member.fullName
    .split(" ")
    .filter(Boolean);
  const lastName = rest.join(" ");
  const competencyStages = Object.keys(
    member.assignmentCompetency?.stageCounts ?? {},
  ).filter(
    (stage) =>
      Number(
        (
          member.assignmentCompetency?.stageCounts as
            | Record<string, number>
            | undefined
        )?.[stage] ?? 0,
      ) > 0,
  );

  return {
    badge: member.badge,
    fullName: member.fullName,
    firstName,
    lastName,
    initials:
      member.initials ??
      member.fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    shift: member.shift,
    primaryRole: member.role,
    secondaryRoles: [],
    status: mapMemberStatus(member),
    experiencedStages: competencyStages,
    traineeEligibleStages: [],
    avatarPath: null,
    currentProjectIds: member.activeAssignments.map(
      (assignment) => assignment.projectId,
    ),
    currentSheetNames: member.activeAssignments.map(
      (assignment) => assignment.sheetName,
    ),
  };
}

export function ProjectAssignmentManagerDialog({
  open,
  onOpenChange,
  target,
  boardAssignment,
  members,
  onApplied,
}: ProjectAssignmentManagerDialogProps) {
  const [selectedBadge, setSelectedBadge] = useState("");
  const [shiftId, setShiftId] = useState<ShiftId>("1st");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formControlClassName =
    "h-10 w-full rounded-md border-input bg-background shadow-sm";

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    const nextShift = boardAssignment?.shiftId ?? "1st";
    setSelectedBadge(boardAssignment?.assignedBadge ?? "");
    setShiftId(nextShift);
    setScheduledDate(
      boardAssignment?.scheduledDate ??
        getDefaultScheduleDateForShift(nextShift),
    );
    setStartTime(
      normalizeTimeInputValue(
        boardAssignment?.startTime ?? getDefaultStartTimeForShift(nextShift),
      ),
    );
    setOperationCode(boardAssignment?.operationCode ?? "");
    setError(null);
  }, [boardAssignment, open, target]);

  const stageId = mapAssignmentStageToOperationStage(target?.stage ?? null);
  const operationCodes = useMemo(
    () => getOperationCodesForStage(stageId),
    [stageId],
  );

  useEffect(() => {
    if (!operationCode && operationCodes.length > 0) {
      setOperationCode(operationCodes[0]?.code ?? "");
    }
  }, [operationCode, operationCodes]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((left, right) => {
      const leftAssigned =
        left.badge === boardAssignment?.assignedBadge ? 0 : 1;
      const rightAssigned =
        right.badge === boardAssignment?.assignedBadge ? 0 : 1;
      if (leftAssigned !== rightAssigned) {
        return leftAssigned - rightAssigned;
      }
      const leftAvailable = left.availabilityStatus === "AVAILABLE" ? 0 : 1;
      const rightAvailable = right.availabilityStatus === "AVAILABLE" ? 0 : 1;
      if (leftAvailable !== rightAvailable) {
        return leftAvailable - rightAvailable;
      }
      return left.fullName.localeCompare(right.fullName);
    });
  }, [boardAssignment?.assignedBadge, members]);

  const selectedMember =
    sortedMembers.find((member) => member.badge === selectedBadge) ?? null;
  const assignableMembers = useMemo(
    () => sortedMembers.map(mapBoardMemberToAssignable),
    [sortedMembers],
  );
  const selectedScheduleDate = useMemo(() => {
    if (!scheduledDate) {
      return undefined;
    }

    const parsed = new Date(`${scheduledDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [scheduledDate]);

  const handleAssign = async () => {
    if (!target) {
      return;
    }

    if (!selectedBadge) {
      setError("Assignee is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/board/assign/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberBadge: selectedBadge,
          shiftId,
          scheduledDate,
          startTime: normalizeTimeInputValue(startTime),
          source: "card",
          items: [
            {
              assignmentId: target.assignmentId,
              operationCode:
                operationCode === "none" ? null : operationCode || null,
            },
          ],
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save assignment.");
      }

      await onApplied();
      onOpenChange(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to save assignment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!target || !boardAssignment?.assignedBadge) {
      return;
    }

    const confirmed = window.confirm(
      `Release ${target.sheetName} from ${boardAssignment.assignedBadge}?`,
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/board/assign/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: target.assignmentId,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to release assignment.");
      }

      await onApplied();
      onOpenChange(false);
    } catch (releaseError) {
      setError(
        releaseError instanceof Error
          ? releaseError.message
          : "Failed to release assignment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="w-[min(960px,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-3xl border border-border/60 p-0"
      >
        <DialogHeader className="border-b border-border/60 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Assignment Control
              </div>
              <DialogTitle className="mt-1 text-2xl">
                {target?.sheetName ?? "Assignment"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Review assignment details, choose an assignee, and schedule the work.
              </DialogDescription>
            </div>
            {target ? (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                {target.rowCount} rows
              </Badge>
            ) : null}
          </div>
        </DialogHeader>

        <div className="grid max-h-[calc(94vh-7rem)] gap-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{target?.swsType ?? "UNDECIDED"}</Badge>
                    <Badge variant="outline">
                      {String(target?.stage ?? "Stage pending").replace(/[_-]+/g, " ")}
                    </Badge>
                    {boardAssignment?.workflowStatus ? (
                      <Badge variant="outline" className="capitalize">
                        {boardAssignment.workflowStatus}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Current Assignee
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {boardAssignment?.assignedBadge ?? "Unassigned"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Scheduled Date
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {boardAssignment?.scheduledDate ?? "Not scheduled"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Start Time
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {normalizeTimeInputValue(boardAssignment?.startTime) || "Not scheduled"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground">Assignment Setup</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick the assignee, tracked operation, and schedule details.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <MemberAssignmentSelector
                        label="Assignee"
                        className="z-40"
                        members={assignableMembers}
                        selected={selectedBadge ? [selectedBadge] : []}
                        onChange={(nextSelected) => setSelectedBadge(nextSelected[0] ?? "")}
                        max={1}
                        maxVisible={1}
                        requiredStage={target?.stage ?? undefined}
                      />

                      {selectedMember ? (
                        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <UserRound className="h-3.5 w-3.5" />
                            {selectedMember.fullName}
                          </div>
                          <div className="mt-2">{formatRole(selectedMember) || "No role assigned"}</div>
                          <div className="mt-1">{formatAvailability(selectedMember)}</div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-xs text-muted-foreground">
                          Select a team member to review assignment details.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-assignment-operation">Operation Code</Label>
                        <Select value={operationCode || "none"} onValueChange={setOperationCode}>
                          <SelectTrigger
                            id="project-assignment-operation"
                            className={cn("text-sm", formControlClassName)}
                          >
                            <SelectValue placeholder="No operation code" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No operation code</SelectItem>
                            {operationCodes.map((code) => (
                              <SelectItem key={code.code} value={code.code}>
                                {code.code} · {code.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Use the stage default or override it for more precise tracking.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="project-assignment-shift">Shift</Label>
                          <Select
                            value={shiftId}
                            onValueChange={(value) => {
                              const nextShift = value as ShiftId;
                              setShiftId(nextShift);
                              if (!boardAssignment?.scheduledDate) {
                                setScheduledDate(getDefaultScheduleDateForShift(nextShift));
                              }
                              if (!boardAssignment?.startTime) {
                                setStartTime(normalizeTimeInputValue(getDefaultStartTimeForShift(nextShift)));
                              }
                            }}
                          >
                            <SelectTrigger
                              id="project-assignment-shift"
                              className={cn("text-sm", formControlClassName)}
                            >
                              <SelectValue placeholder="Select shift" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1st">1st Shift</SelectItem>
                              <SelectItem value="2nd">2nd Shift</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="project-assignment-start">Start Time</Label>
                          <Input
                            id="project-assignment-start"
                            type="time"
                            className={formControlClassName}
                            value={normalizeTimeInputValue(startTime)}
                            onChange={(event) => setStartTime(normalizeTimeInputValue(event.target.value))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <DateField
                          mode="create"
                          label="Scheduled Date"
                          className={formControlClassName}
                          value={selectedScheduleDate}
                          onChange={(nextDate) => setScheduledDate(nextDate ? toIsoDate(nextDate) : "")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:sticky lg:top-0">
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Actions</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Apply changes for this sheet or release the assignment.
                    </p>
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-2">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void handleAssign()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving assignment...
                        </>
                      ) : boardAssignment?.assignedBadge ? (
                        "Save Reassignment"
                      ) : (
                        "Assign Sheet"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => onOpenChange(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>

                    {boardAssignment?.assignedBadge ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700",
                        )}
                        onClick={() => void handleRelease()}
                        disabled={isSubmitting}
                      >
                        Release Assignment
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
      </DialogContent>
    </Dialog>
  );
}
