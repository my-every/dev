"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoardAssignmentView } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import type { AssignmentStageId } from "@/types/d380-assignment-stages";

export type ProjectAssignmentEntry = {
  id: string;
  boardAssignmentId: string;
  sheetName: string;
  swsType: string;
  rowCount: number;
  stage: AssignmentStageId | null;
  assignedBadge?: string | null;
  unitType?: string | null;
};

type ProjectAssignmentRowProps = {
  assignment: ProjectAssignmentEntry;
  liveBoardAssignment: BoardAssignmentView | null;
  /** Adds a top divider — set true for all but the first row in a list. */
  withDivider?: boolean;
  onOpenManager: (assignmentId: string) => void;
};

/**
 * Single assignment card rendered inside the project-details side panel.
 * Extracted from the inline list so it can be reused as the row renderer
 * inside grouping accordions (e.g. `ProjectUnitTypeAccordion`).
 */
export function ProjectAssignmentRow({
  assignment,
  liveBoardAssignment,
  withDivider = false,
  onOpenManager,
}: ProjectAssignmentRowProps) {
  const assignedBadge =
    liveBoardAssignment?.assignedBadge ?? assignment.assignedBadge;
  const swsType = assignment.swsType;
  const stage = assignment.stage
    ? assignment.stage.replace(/[_-]+/g, " ")
    : "Stage pending";

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5",
        withDivider ? "border-t border-border/60" : ""
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {assignment.sheetName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {assignment.rowCount} rows • {swsType} • {stage}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {assignedBadge ? (
          <Badge variant="outline" className="h-5 px-2 text-[10px]">
            {assignedBadge}
          </Badge>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 rounded-full px-2 text-[10px]"
            onClick={() => onOpenManager(assignment.id)}
          >
            Unassigned
          </Button>
        )}
      </div>
    </div>
  );
}
