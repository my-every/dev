"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Clock,
  GripVertical,
  MoreHorizontal,
  Play,
  User,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BoardAssignmentView, BoardMemberView } from "@/lib/board/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssignmentCardCompactProps {
  assignment: BoardAssignmentView;
  assignedMember?: BoardMemberView | null;
  variant?: "default" | "minimal" | "detailed";
  showProject?: boolean;
  showDragHandle?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-600", label: "Pending" },
  "in-progress": { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
  blocked: { bg: "bg-red-100", text: "text-red-700", label: "Blocked" },
};

const WORKFLOW_STATUS_CONFIG: Record<string, { border: string; glow: string }> = {
  pending: { border: "border-l-slate-300", glow: "" },
  scheduled: { border: "border-l-amber-400", glow: "" },
  "in-progress": { border: "border-l-blue-500", glow: "shadow-blue-100" },
  completed: { border: "border-l-emerald-500", glow: "" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AssignmentCardCompact({
  assignment,
  assignedMember,
  variant = "default",
  showProject = true,
  showDragHandle = false,
  isSelected = false,
  isHighlighted = false,
  onClick,
  onAssign,
  onUnassign,
  onStart,
  onComplete,
  className,
}: AssignmentCardCompactProps) {
  const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending;
  const workflowConfig = WORKFLOW_STATUS_CONFIG[assignment.workflowStatus] || WORKFLOW_STATUS_CONFIG.pending;

  const partNumberPreview = useMemo(() => {
    if (assignment.partNumbers.length === 0) return null;
    if (assignment.partNumbers.length <= 2) return assignment.partNumbers.join(", ");
    return `${assignment.partNumbers.slice(0, 2).join(", ")} +${assignment.partNumbers.length - 2}`;
  }, [assignment.partNumbers]);

  const isAssigned = !!assignment.assignedBadge;
  const canStart = isAssigned && assignment.status === "pending";
  const canComplete = assignment.status === "in-progress";

  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all",
                "hover:border-border hover:bg-muted/50",
                isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                isHighlighted && "ring-2 ring-amber-400",
                className
              )}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isAssigned ? "bg-emerald-500" : "bg-slate-300"
                )}
              />
              <span className="truncate text-xs font-medium">{assignment.sheetName}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{assignment.sheetName}</p>
              <p className="text-xs text-muted-foreground">
                {assignment.pdNumber} - {assignment.projectName}
              </p>
              {assignedMember && (
                <p className="text-xs">Assigned to: {assignedMember.fullName}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative rounded-lg border border-l-4 bg-card transition-all",
        workflowConfig.border,
        workflowConfig.glow && `shadow-sm ${workflowConfig.glow}`,
        isSelected && "ring-2 ring-primary",
        isHighlighted && "ring-2 ring-amber-400",
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-stretch">
        {/* Drag Handle */}
        {showDragHandle && (
          <div className="flex items-center justify-center border-r px-1.5 text-muted-foreground/50 hover:text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            {/* Left Side: Title & Meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-semibold">{assignment.sheetName}</h4>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] font-medium", statusConfig.bg, statusConfig.text)}
                >
                  {statusConfig.label}
                </Badge>
              </div>

              {showProject && (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">{assignment.pdNumber}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{assignment.projectName}</span>
                </div>
              )}

              {/* Meta Row */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatMinutes(assignment.estimatedMinutes)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {assignment.stageRoleLabel}
                  </span>
                </div>
                {partNumberPreview && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{partNumberPreview}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">Part Numbers:</p>
                      <p className="text-xs font-mono">{assignment.partNumbers.join(", ")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Right Side: Assigned Member & Actions */}
            <div className="flex flex-col items-end gap-2">
              {/* Assigned Member Avatar */}
              {isAssigned && assignedMember ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {assignedMember.initials || assignedMember.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="font-medium">{assignedMember.fullName}</p>
                    <p className="text-xs text-muted-foreground">{assignedMember.badge}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign?.();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50 transition-colors hover:border-primary hover:text-primary"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isAssigned && onAssign && (
                    <DropdownMenuItem onClick={onAssign}>
                      <User className="mr-2 h-4 w-4" />
                      Assign Member
                    </DropdownMenuItem>
                  )}
                  {isAssigned && onUnassign && (
                    <DropdownMenuItem onClick={onUnassign}>
                      <User className="mr-2 h-4 w-4" />
                      Unassign
                    </DropdownMenuItem>
                  )}
                  {canStart && onStart && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onStart}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Work
                      </DropdownMenuItem>
                    </>
                  )}
                  {canComplete && onComplete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onComplete}>
                        <Clock className="mr-2 h-4 w-4" />
                        Mark Complete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Detailed Variant: Additional Info */}
          {variant === "detailed" && (
            <div className="mt-3 border-t pt-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Work Area</p>
                  <p className="font-medium">{assignment.workAreaLabel || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Schedule</p>
                  <p className="font-medium">
                    {assignment.scheduledDate
                      ? new Date(assignment.scheduledDate).toLocaleDateString()
                      : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Queue Position</p>
                  <p className="font-medium">{assignment.queueIndex ?? "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
