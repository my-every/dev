/**
 * ActivityTimeline Component
 *
 * Reusable, flexible component for rendering activity feeds
 * Supports filtering, search, pagination, nested activities, and commenting
 */

"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CurvedArrow } from "@/components/dialog/curved-arrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PhotoUploadGallery,
  type PhotoGalleryItem,
} from "@/components/activity/photo-upload-gallery";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  ActivityEntry,
  ActivityAction,
  ActivityTimelineFilterOptions,
  ActivityComment,
} from "@/types/activity";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Bot,
  Zap,
  User,
  Filter,
  Search,
  ChevronRight,
  Reply,
  Send,
  Plus,
  Minus,
  Heart,
  ThumbsUp,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

/** Actions that relate directly to assignment / brand-list workflow */
const BRAND_LIST_ACTIONS: ActivityAction[] = [
  "PROJECT_CREATED",
  "ASSIGNED",
  "REASSIGNED",
  "STARTED",
  "BLOCKED",
  "UNBLOCKED",
  "STAGE_CHANGED",
  "COMPLETED",
  "REOPENED",
  "CANCELLED",
  "SETTINGS_CHANGED",
  "COMMENT_ADDED",
];

type FilterMode = ActivityAction | "all" | "brand_list";

const OPERATION_OPTIONS = [
  "Build",
  "Wire",
  "Cross Wire",
  "Test",
  "Review",
  "Train",
  "Task",
  "IPV",
  "Meeting",
] as const;

const ACTION_OPTIONS = [
  "Initiated",
  "Created",
  "Started",
  "Paused",
  "Assigned",
  "Re-Assigned",
  "Updated",
  "Resumed",
  "Completed",
] as const;

const SCOPE_OPTIONS = [
  "Project",
  "Assignment",
  "Legal",
  "Brand List",
  "Branding",
  "Green Change",
  "Team",
  "Global",
] as const;

const STAGE_OPTIONS = [
  "Kitting",
  "Build Up",
  "Wiring",
  "Box Build",
  "Cross Wire",
  "Test",
  "BIQ",
] as const;

const MILESTONE_OPTIONS = [
  "Ready To Lay",
  "Ready To Wire",
  "Ready for Visual",
  "Ready to Hang",
  "Ready to Test",
  "Ready To Ship",
] as const;

const SHIFT_FILTER_OPTIONS = ["1st", "2nd"] as const;

const ACTION_FILTER_MAP: Record<string, ActivityAction[]> = {
  initiated: ["STARTED"],
  created: ["PROJECT_CREATED"],
  started: ["STARTED"],
  paused: ["BLOCKED"],
  assigned: ["ASSIGNED"],
  "re-assigned": ["REASSIGNED"],
  updated: ["SETTINGS_CHANGED", "STAGE_CHANGED"],
  resumed: ["UNBLOCKED", "REOPENED"],
  completed: ["COMPLETED"],
};

interface ActivityTimelineProps {
  activities: ActivityEntry[];
  loading?: boolean;
  error?: string | null;
  maxItems?: number;
  compact?: boolean;
  showStats?: boolean;
  allowFiltering?: boolean;
  allowSearch?: boolean;
  showComments?: boolean;
  showNestedActivities?: boolean;
  /**
   * Initial active filter when the timeline first mounts.
   * `'brand_list'` shows only assignment-workflow actions (STAGE_CHANGED, COMPLETED, etc.).
   * Defaults to `'all'`.
   */
  initialFilterMode?: FilterMode;
  onRefresh?: () => Promise<void>;
  onFilterChange?: (filters: ActivityTimelineFilterOptions) => void;
  onActivityClick?: (activity: ActivityEntry) => void;
  onCommentAdd?: (activityId: string, comment: string) => Promise<void>;
  onCommentDelete?: (activityId: string, commentId: string) => Promise<void>;
  currentBadge?: string;
  aggregateAcrossUsers?: boolean;
  /** Pass the project ID so the timeline can scope its own fetches if needed */
  projectId?: string;
  className?: string;
  containerClassName?: string;
}

interface CommentInteractionState {
  liked: boolean;
  likedCount: number;
  thumbsUp: boolean;
  thumbsUpCount: number;
}

interface ActivityUserPreview {
  badge: string;
  name: string;
  title?: string;
  role?: string;
  department?: string;
  shift?: string;
  avatarUrl?: string;
}

interface ActivityAttachmentLink {
  kind?: string;
  label: string;
  fileName: string;
  href: string;
}

function normalizeBadgeId(value?: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

function getProjectInitials(name?: string): string {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "PRJ";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function readMilestoneKey(metadata?: Record<string, unknown>): string {
  return typeof metadata?.milestone === "string"
    ? metadata.milestone.toLowerCase()
    : "";
}

function isLifecycleUserAction(activity: ActivityEntry): boolean {
  if (activity.action !== "STARTED" && activity.action !== "COMPLETED") {
    return false;
  }
  return true;
}

function inferProgressPercent(activity: ActivityEntry): number {
  const milestone = readMilestoneKey(
    activity.metadata as Record<string, unknown> | undefined,
  );
  const milestoneProgress: Record<string, number> = {
    start: 10,
    continue: 30,
    import: 45,
    "edit-schema": 60,
    "approve-sheet": 75,
    combine: 90,
    complete: 100,
    "save-later": 40,
  };

  if (activity.action === "COMPLETED") return 100;
  return milestoneProgress[milestone] ?? 20;
}

function inferNextCourseOfAction(activity: ActivityEntry): string {
  const milestone = readMilestoneKey(
    activity.metadata as Record<string, unknown> | undefined,
  );

  if (activity.action === "COMPLETED")
    return "Proceed to downstream workflow gate.";

  const nextByMilestone: Record<string, string> = {
    start: "Continue to data import.",
    continue: "Resume with pending checklist items.",
    import: "Validate schema and mapped fields.",
    "edit-schema": "Review changes and request approval.",
    "approve-sheet": "Finalize and complete the sheet.",
    combine: "Validate combined workbook output.",
    "save-later": "Resume and continue where left off.",
  };
  return nextByMilestone[milestone] ?? "Continue to the next workflow step.";
}

function formatSessionDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function buildSessionSummaryActivity(
  activity: ActivityEntry,
  previousLifecycle?: ActivityEntry,
): ActivityEntry {
  const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
  const endDate = new Date(activity.timestamp);

  const durationMs =
    typeof activity.durationSeconds === "number" && activity.durationSeconds > 0
      ? activity.durationSeconds * 1000
      : undefined;

  const inferredStartMs = durationMs
    ? endDate.getTime() - durationMs
    : previousLifecycle
      ? new Date(previousLifecycle.timestamp).getTime()
      : endDate.getTime();

  const startDate = new Date(inferredStartMs);
  const progress = inferProgressPercent(activity);
  const nextCourse = inferNextCourseOfAction(activity);

  return {
    id: `${activity.id}::summary`,
    timestamp: new Date(endDate.getTime() - 1).toISOString(),
    action: "SETTINGS_CHANGED",
    projectId: activity.projectId,
    stage: activity.stage,
    assignmentId: activity.assignmentId,
    targetBadge: activity.targetBadge,
    performedBy: activity.performedBy,
    result: activity.result,
    metadata: {
      ...metadata,
      syntheticSummary: true,
      actorType: "system",
      source: "automation",
      summaryType: "session",
      sessionStart: startDate.toISOString(),
      sessionEnd: endDate.toISOString(),
      progressPercent: progress,
      nextCourse,
    },
    comment: `Session summary · Start: ${formatSessionDateTime(startDate.toISOString())} · End: ${formatSessionDateTime(endDate.toISOString())} · Progress: ${progress}% · Next: ${nextCourse}`,
    relatedActivityIds: activity.relatedActivityIds,
    comments: [],
  };
}

/**
 * Get icon and color for activity action type with border styling
 */
function getActivityIcon(action: ActivityAction) {
  switch (action) {
    case "COMPLETED":
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bg: "bg-green-50",
        border: "border-green-300",
      };
    case "ASSIGNED":
    case "STARTED":
      return {
        icon: Zap,
        color: "text-yellow-500",
        bg: "bg-yellow-50",
        border: "border-yellow-300",
      };
    case "BLOCKED":
      return {
        icon: AlertCircle,
        color: "text-red-500",
        bg: "bg-red-50",
        border: "border-red-300",
      };
    case "UNBLOCKED":
    case "REOPENED":
      return {
        icon: CheckCircle,
        color: "text-blue-500",
        bg: "bg-blue-50",
        border: "border-blue-300",
      };
    case "REASSIGNED":
      return {
        icon: User,
        color: "text-orange-500",
        bg: "bg-orange-50",
        border: "border-orange-300",
      };
    case "STAGE_CHANGED":
      return {
        icon: Clock,
        color: "text-sky-500",
        bg: "bg-sky-50",
        border: "border-sky-300",
      };
    case "CANCELLED":
      return {
        icon: AlertCircle,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-300",
      };
    case "SETTINGS_CHANGED":
      return {
        icon: User,
        color: "text-indigo-500",
        bg: "bg-indigo-50",
        border: "border-indigo-300",
      };
    case "COMMENT_ADDED":
      return {
        icon: MessageSquare,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-300",
      };
    default:
      return {
        icon: User,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-300",
      };
  }
}

/**
 * Map an activity action to a brand hex colour used by ProjectIcon
 */
function getProjectColorHex(metadata?: Record<string, unknown>): string {
  const candidates = [
    metadata?.projectColor,
    metadata?.color,
    (metadata?.project as Record<string, unknown> | undefined)?.projectColor,
    (metadata?.project as Record<string, unknown> | undefined)?.color,
    (metadata?.project as Record<string, unknown> | undefined)?.accentColor,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(candidate.trim())
    ) {
      return candidate.trim();
    }
  }

  return "#FFCC61";
}

/**
 * Get human-readable label for action
 */
function getActionLabel(
  action: ActivityAction,
  _metadata?: Record<string, unknown>,
): string {
  const labels: Partial<Record<ActivityAction, string>> = {
    ASSIGNED: "Assigned",
    REASSIGNED: "Reassigned",
    STARTED: "Started",
    BLOCKED: "Blocked",
    UNBLOCKED: "Unblocked",
    STAGE_CHANGED: "Stage Changed",
    COMPLETED: "Completed",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
    SETTINGS_CHANGED: "Settings Changed",
    COMMENT_ADDED: "Comment",
    PERMISSION_GRANTED: "Permission Granted",
    PERMISSION_REVOKED: "Permission Revoked",
    PROJECT_CREATED: "Project Created",
    PROJECT_ARCHIVED: "Project Archived",
    PROJECT_UNARCHIVED: "Project Restored",
  };
  return (
    labels[action] ??
    action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\B\w+/g, (w) => w.toLowerCase())
  );
}

/**
 * Get detailed description for action based on metadata
 */
function getActionDescription(
  action: ActivityAction,
  metadata?: Record<string, unknown>,
): string | null {
  if (!metadata) return null;
  if (metadata.syntheticSummary === true) return null;

  switch (action) {
    case "ASSIGNED":
    case "REASSIGNED":
      return typeof metadata.assigneeName === "string"
        ? `Assigned to ${metadata.assigneeName}`
        : null;
    case "COMPLETED":
      return typeof metadata.durationSeconds === "number"
        ? `Completed in ${Math.round(metadata.durationSeconds / 60)}m`
        : null;
    case "BLOCKED":
      return typeof metadata.reason === "string"
        ? metadata.reason
        : typeof metadata.blockReason === "string"
          ? metadata.blockReason
          : null;
    case "STAGE_CHANGED":
      return typeof metadata.toStage === "string"
        ? `→ ${metadata.toStage}`
        : null;
    case "SETTINGS_CHANGED":
      return typeof metadata.description === "string"
        ? metadata.description
        : null;
    default:
      return null;
  }
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readWorkflowLabel(metadata?: Record<string, unknown>): string | null {
  const workflow =
    typeof metadata?.workflow === "string" ? metadata.workflow : null;
  if (!workflow) return null;
  if (workflow.toLowerCase() === "brandlist") return "Brand List";
  return toTitleCase(workflow);
}

function readMilestoneLabel(metadata?: Record<string, unknown>): string | null {
  const milestone =
    typeof metadata?.milestone === "string" ? metadata.milestone : null;
  return milestone ? toTitleCase(milestone) : null;
}

function buildWorkflowHeadline(
  actionLabel: string,
  metadata?: Record<string, unknown>,
): string | null {
  const workflowLabel = readWorkflowLabel(metadata);
  const milestoneLabel = readMilestoneLabel(metadata);
  if (!workflowLabel && !milestoneLabel) return null;
  if (workflowLabel && milestoneLabel)
    return `${actionLabel} ${workflowLabel}: ${milestoneLabel}`;
  return `${actionLabel} ${workflowLabel ?? milestoneLabel}`;
}

function formatActionVerb(action: ActivityAction): string {
  switch (action) {
    case "STARTED":
      return "Started";
    case "COMPLETED":
      return "Completed";
    case "BLOCKED":
      return "Blocked";
    case "UNBLOCKED":
      return "Unblocked";
    case "REOPENED":
      return "Reopened";
    case "CANCELLED":
      return "Cancelled";
    case "ASSIGNED":
      return "Assigned";
    case "REASSIGNED":
      return "Reassigned";
    case "STAGE_CHANGED":
      return "Updated stage in";
    case "SETTINGS_CHANGED":
      return "Updated settings in";
    case "COMMENT_ADDED":
      return "Commented in";
    default:
      return getActionLabel(action);
  }
}

function getWorkflowPhrase(metadata?: Record<string, unknown>): string {
  const workflow =
    typeof metadata?.workflow === "string"
      ? metadata.workflow.toLowerCase()
      : "";
  const milestone =
    typeof metadata?.milestone === "string"
      ? metadata.milestone.toLowerCase()
      : "";

  if (workflow === "brandlist" && milestone.includes("approve")) {
    return "Brand List Approval Workflow";
  }
  if (workflow === "brandlist") {
    return "Brand List";
  }
  if (workflow) {
    return `${toTitleCase(workflow)} Workflow`;
  }
  return "Workflow";
}

function buildPreciseSummaryLine(
  activity: ActivityEntry,
  performerName?: string,
): string {
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  if (metadata?.syntheticSummary === true) {
    const sessionStart =
      typeof metadata.sessionStart === "string"
        ? formatSessionDateTime(metadata.sessionStart)
        : "N/A";
    const sessionEnd =
      typeof metadata.sessionEnd === "string"
        ? formatSessionDateTime(metadata.sessionEnd)
        : "N/A";
    const progressPercent =
      typeof metadata.progressPercent === "number"
        ? `${metadata.progressPercent}%`
        : "N/A";
    const nextCourse =
      typeof metadata.nextCourse === "string"
        ? metadata.nextCourse
        : "Continue workflow.";
    return `Start: ${sessionStart} · End: ${sessionEnd} · Progress: ${progressPercent} · Next: ${nextCourse}`;
  }

  const name =
    performerName ||
    `Badge #${normalizeBadgeId(activity.performedBy) ?? activity.performedBy}`;
  const projectName =
    (typeof metadata?.projectName === "string" &&
      metadata.projectName.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    "Unknown Project";
  const pdNumber =
    (typeof metadata?.pdNumber === "string" && metadata.pdNumber.trim()) ||
    activity.assignmentId ||
    "N/A";
  const dateTime = new Date(activity.timestamp).toLocaleString();

  if (activity.action === "STARTED") {
    return `${name}: Started ${getWorkflowPhrase(metadata)} for project - ${projectName} - ${pdNumber}. ${dateTime}`;
  }

  return `${name}: ${formatActionVerb(activity.action)} for project - ${projectName} - ${pdNumber}. ${dateTime}`;
}

function buildStructuredTitle(
  activity: ActivityEntry,
  performerName?: string,
): string {
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  const workflow = readWorkflowLabel(metadata) ?? getWorkflowPhrase(metadata);
  const project =
    (typeof metadata?.projectName === "string" &&
      metadata.projectName.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    "Unknown Project";
  const pdNumber =
    (typeof metadata?.pdNumber === "string" && metadata.pdNumber.trim()) ||
    activity.assignmentId ||
    "?";
  const unitNumber =
    (typeof metadata?.unitNumber === "string" && metadata.unitNumber.trim()) ||
    (typeof metadata?.unitNo === "string" && metadata.unitNo.trim()) ||
    (typeof metadata?.unit === "string" && metadata.unit.trim());

  const unitLabel = unitNumber ? ` - Unit ${unitNumber}` : "";

  return ` ${workflow} ${formatActionVerb(activity.action)} -> ${project} #${pdNumber}${unitLabel}`;
}

function getQuickReplySuggestions(activity: ActivityEntry): string[] {
  switch (activity.action) {
    case "STARTED":
      return [
        "Looks good, continue.",
        "Please confirm approval status.",
        "Need help with this step?",
      ];
    case "COMPLETED":
      return [
        "Great work, approved.",
        "Please share final notes.",
        "Marking this as reviewed.",
      ];
    case "BLOCKED":
      return [
        "What is blocking this?",
        "Escalating for support.",
        "Share blocker details please.",
      ];
    case "STAGE_CHANGED":
      return [
        "Acknowledged stage change.",
        "Any follow-up needed?",
        "Proceed to the next stage.",
      ];
    default:
      return [
        "Acknowledged.",
        "Can you provide an update?",
        "Thanks, moving forward.",
      ];
  }
}

function getActivityHeadline(activity: ActivityEntry): string {
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  if (metadata?.syntheticSummary === true) {
    const progressPercent =
      typeof metadata.progressPercent === "number"
        ? metadata.progressPercent
        : null;
    if (progressPercent !== null) {
      return `Session Summary (${progressPercent}%)`;
    }
    return "Session Summary";
  }

  const projectName =
    typeof metadata?.projectName === "string" ? metadata.projectName : null;
  const toStage =
    typeof metadata?.toStage === "string" ? metadata.toStage : null;
  const fromStage =
    typeof metadata?.fromStage === "string" ? metadata.fromStage : null;
  const assigneeName =
    typeof metadata?.assigneeName === "string" ? metadata.assigneeName : null;
  const targetName =
    typeof metadata?.targetName === "string" ? metadata.targetName : null;
  const stage = typeof activity.stage === "string" ? activity.stage : null;

  switch (activity.action) {
    case "STAGE_CHANGED": {
      if (fromStage && toStage)
        return `Stage changed: ${fromStage} -> ${toStage}`;
      if (toStage) return `Moved to ${toStage}`;
      if (stage) return `Stage update: ${stage}`;
      return "Stage changed";
    }
    case "ASSIGNED":
      if (assigneeName && projectName)
        return `Assigned ${assigneeName} on ${projectName}`;
      if (assigneeName) return `Assigned to ${assigneeName}`;
      return "Assigned";
    case "REASSIGNED":
      if (assigneeName && projectName)
        return `Reassigned to ${assigneeName} on ${projectName}`;
      if (assigneeName) return `Reassigned to ${assigneeName}`;
      return "Reassigned";
    case "COMPLETED":
      {
        const workflowHeadline = buildWorkflowHeadline("Completed", metadata);
        if (workflowHeadline) return workflowHeadline;
      }
      if (stage && projectName) return `Completed ${stage} for ${projectName}`;
      if (projectName) return `Completed ${projectName}`;
      if (stage) return `Completed ${stage}`;
      return "Completed";
    case "STARTED": {
      const workflowHeadline = buildWorkflowHeadline("Started", metadata);
      if (workflowHeadline) return workflowHeadline;
      if (stage && projectName) return `Started ${stage} for ${projectName}`;
      if (projectName) return `Started ${projectName}`;
      if (stage) return `Started ${stage}`;
      return "Started";
    }
    case "BLOCKED": {
      const workflowHeadline = buildWorkflowHeadline("Blocked", metadata);
      if (workflowHeadline) return workflowHeadline;
      return "Blocked";
    }
    case "UNBLOCKED": {
      const workflowHeadline = buildWorkflowHeadline("Unblocked", metadata);
      if (workflowHeadline) return workflowHeadline;
      return "Unblocked";
    }
    case "REOPENED": {
      const workflowHeadline = buildWorkflowHeadline("Reopened", metadata);
      if (workflowHeadline) return workflowHeadline;
      return "Reopened";
    }
    case "CANCELLED": {
      const workflowHeadline = buildWorkflowHeadline("Cancelled", metadata);
      if (workflowHeadline) return workflowHeadline;
      return "Cancelled";
    }
    case "SETTINGS_CHANGED": {
      const workflowHeadline = buildWorkflowHeadline(
        "Settings Updated",
        metadata,
      );
      if (workflowHeadline) return workflowHeadline;
      return "Settings changed";
    }
    case "PROJECT_CREATED":
      if (projectName) return `Project created: ${projectName}`;
      return "Project created";
    case "PROJECT_ARCHIVED":
      if (projectName) return `Project archived: ${projectName}`;
      return "Project archived";
    case "PROJECT_UNARCHIVED":
      if (projectName) return `Project restored: ${projectName}`;
      return "Project restored";
    case "PERMISSION_GRANTED":
      if (targetName) return `Permission granted to ${targetName}`;
      return "Permission granted";
    case "PERMISSION_REVOKED":
      if (targetName) return `Permission revoked for ${targetName}`;
      return "Permission revoked";
    case "COMMENT_ADDED": {
      const comment =
        typeof activity.comment === "string" ? activity.comment : null;
      return comment
        ? `Comment: ${comment.slice(0, 60)}${comment.length > 60 ? "…" : ""}`
        : "Comment added";
    }
    default:
      return getActionLabel(activity.action, metadata);
  }
}

/**
 * Get result badge styling
 */
function getResultBadge(result?: "success" | "failure" | "pending") {
  if (!result) return null;
  const styles = {
    success:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failure: "border-destructive/30 bg-destructive/10 text-destructive",
    pending:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs px-2 py-0.5", styles[result])}
    >
      {result}
    </Badge>
  );
}

function readAutomatedFollowUpAttachments(
  projectId: string | undefined,
  metadata?: Record<string, unknown>,
): ActivityAttachmentLink[] {
  if (!projectId) {
    return [];
  }

  const rawItems = Array.isArray(metadata?.automatedFollowUps)
    ? metadata?.automatedFollowUps
    : metadata?.automatedFollowUp && typeof metadata.automatedFollowUp === "object"
      ? [metadata.automatedFollowUp]
      : [];

  return rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const entry = item as Record<string, unknown>;
    const relativePath = typeof entry.relativePath === "string" ? entry.relativePath.trim() : "";
    const fileName = typeof entry.fileName === "string" ? entry.fileName.trim() : "";
    const label = typeof entry.label === "string" ? entry.label.trim() : "Automated follow-up";
    const kind = typeof entry.kind === "string" ? entry.kind.trim() : undefined;

    if (!relativePath || !fileName) {
      return [];
    }

    const segments = relativePath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return [{
      kind,
      label,
      fileName,
      href: `/api/projects/${encodeURIComponent(projectId)}/exports/files/${segments}?download=1`,
    }];
  });
}

function attachmentIconForFile(fileName: string) {
  return /\.(xlsx|xls|csv)$/i.test(fileName) ? FileSpreadsheet : FileText;
}

function extractPhotoItems(metadata?: Record<string, any>): PhotoGalleryItem[] {
  if (!metadata) return [];

  const candidates = [
    ...(Array.isArray(metadata.photos) ? metadata.photos : []),
    ...(Array.isArray(metadata.photoUrls) ? metadata.photoUrls : []),
    ...(Array.isArray(metadata.images) ? metadata.images : []),
    ...(metadata.photoUrl ? [metadata.photoUrl] : []),
  ];

  const parsed: PhotoGalleryItem[] = [];

  candidates.forEach((entry, index) => {
    if (typeof entry === "string") {
      parsed.push({
        id: `photo-${index}-${entry}`,
        url: entry,
        uploadedAt: new Date().toISOString(),
        tags: [],
      });
      return;
    }

    if (!entry || typeof entry !== "object") return;

    const url = entry.url || entry.src || entry.path || entry.photoUrl;
    if (!url || typeof url !== "string") return;

    const rawTags = Array.isArray(entry.tags)
      ? entry.tags.filter(
          (tag: unknown): tag is string => typeof tag === "string",
        )
      : [];

    parsed.push({
      id: entry.id || `photo-${index}-${url}`,
      url,
      name:
        typeof entry.name === "string"
          ? entry.name
          : typeof entry.fileName === "string"
            ? entry.fileName
            : undefined,
      uploadedAt:
        typeof entry.uploadedAt === "string"
          ? entry.uploadedAt
          : typeof entry.timestamp === "string"
            ? entry.timestamp
            : typeof entry.createdAt === "string"
              ? entry.createdAt
              : new Date().toISOString(),
      tags: rawTags,
    });
  });

  return parsed;
}

export function ActivityTimeline({
  activities,
  loading = false,
  error = null,
  maxItems = 50,
  compact = false,
  showStats = true,
  allowFiltering = false,
  allowSearch = false,
  showComments = true,
  showNestedActivities = true,
  initialFilterMode = "all",
  onRefresh,
  onFilterChange,
  onActivityClick,
  onCommentAdd,
  onCommentDelete,
  currentBadge,
  aggregateAcrossUsers = false,
  projectId: _projectId,
  className,
  containerClassName,
}: ActivityTimelineProps) {
  const [mounted, setMounted] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilterMode);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedLwcs, setSelectedLwcs] = useState<string[]>([]);
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [selectedActionBuckets, setSelectedActionBuckets] = useState<string[]>(
    [],
  );
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    user: true,
    shift: false,
    assignment: false,
    operation: false,
    action: true,
    scope: false,
    stage: false,
    milestone: false,
    lwc: false,
  });
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set(),
  );
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [commentingActivityId, setCommentingActivityId] = useState<
    string | null
  >(null);
  const [loadingComments, setLoadingComments] = useState<Set<string>>(
    new Set(),
  );
  const [deletingComments, setDeletingComments] = useState<Set<string>>(
    new Set(),
  );
  const [commentInteractions, setCommentInteractions] = useState<
    Record<string, CommentInteractionState>
  >({});
  const [userPreviews, setUserPreviews] = useState<
    Record<string, ActivityUserPreview>
  >({});
  const [activityPhotos, setActivityPhotos] = useState<
    Record<string, PhotoGalleryItem[]>
  >({});
  const [clickedActivityId, setClickedActivityId] = useState<string | null>(
    null,
  );
  const clickFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (clickFeedbackTimerRef.current) {
        clearTimeout(clickFeedbackTimerRef.current);
        clickFeedbackTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const badges = Array.from(
      new Set(
        activities
          .map((a) => normalizeBadgeId(a.performedBy) ?? a.performedBy)
          .filter((badge): badge is string => Boolean(badge)),
      ),
    );

    const missing = badges.filter((badge) => !userPreviews[badge]);
    if (missing.length === 0) return;

    void (async () => {
      const loadedEntries = await Promise.all(
        missing.map(async (badge) => {
          try {
            const normalizedBadge = normalizeBadgeId(badge);
            if (!normalizedBadge) return null;

            const response = await fetch(`/api/users/${badge}/profile`);
            if (!response.ok) return null;
            const payload = await response.json();
            const p = payload?.profile;
            if (!p) return null;

            const preview: ActivityUserPreview = {
              badge: normalizedBadge,
              name:
                p.preferredName ||
                p.fullName ||
                p.legalName ||
                `Badge #${normalizedBadge}`,
              title: p.title || undefined,
              role: p.role || undefined,
              department: p.department || undefined,
              shift: p.currentShift || undefined,
              avatarUrl: p.avatarPath || p.avatarUrl || undefined,
            };
            return [normalizedBadge, preview] as const;
          } catch {
            return null;
          }
        }),
      );

      const next: Record<string, ActivityUserPreview> = {};
      for (const entry of loadedEntries) {
        if (!entry) continue;
        next[entry[0]] = entry[1];
      }

      if (Object.keys(next).length > 0) {
        setUserPreviews((prev) => ({ ...prev, ...next }));
      }
    })();
  }, [activities, userPreviews]);

  useEffect(() => {
    setActivityPhotos((prev) => {
      const next = { ...prev };
      for (const activity of activities) {
        if (!next[activity.id]) {
          next[activity.id] = extractPhotoItems(activity.metadata);
        }
      }
      return next;
    });
  }, [activities]);

  const getAvatarInitials = useCallback((name?: string, badge?: string) => {
    if (!name) return badge?.slice(-2) ?? "?";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const normalizePreviewValue = useCallback((value?: string) => {
    if (!value) return undefined;
    const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return undefined;
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const pushFilterPatch = useCallback(
    (patch: ActivityTimelineFilterOptions) => {
      onFilterChange?.(patch);
    },
    [onFilterChange],
  );

  const toggleActivityExpanded = useCallback((activityId: string) => {
    setExpandedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }, []);

  const EXPAND_SPRING = {
    type: "spring" as const,
    stiffness: 340,
    damping: 28,
    mass: 0.7,
  };

  const handleCommentSubmit = useCallback(
    async (activityId: string) => {
      const commentText = commentInputs[activityId]?.trim();
      if (!commentText || !onCommentAdd) return;

      setLoadingComments((prev) => new Set([...prev, activityId]));
      try {
        await onCommentAdd(activityId, commentText);
        setCommentInputs((prev) => {
          const next = { ...prev };
          delete next[activityId];
          return next;
        });
        setCommentingActivityId(null);
      } catch (err) {
        console.error("Failed to add comment:", err);
      } finally {
        setLoadingComments((prev) => {
          const next = new Set(prev);
          next.delete(activityId);
          return next;
        });
      }
    },
    [commentInputs, onCommentAdd],
  );

  const handleCommentDelete = useCallback(
    async (activityId: string, commentId: string) => {
      if (!onCommentDelete) return;

      setDeletingComments((prev) => new Set([...prev, commentId]));
      try {
        await onCommentDelete(activityId, commentId);
      } catch (err) {
        console.error("Failed to delete comment:", err);
      } finally {
        setDeletingComments((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [onCommentDelete],
  );

  const handleQuickReply = useCallback(
    async (activityId: string, text: string) => {
      if (!onCommentAdd) return;

      setCommentingActivityId(activityId);
      setCommentInputs((prev) => ({ ...prev, [activityId]: text }));

      setLoadingComments((prev) => new Set([...prev, activityId]));
      try {
        await onCommentAdd(activityId, text);
        setCommentInputs((prev) => {
          const next = { ...prev };
          delete next[activityId];
          return next;
        });
        setCommentingActivityId(null);
      } catch (err) {
        console.error("Failed to add quick reply:", err);
      } finally {
        setLoadingComments((prev) => {
          const next = new Set(prev);
          next.delete(activityId);
          return next;
        });
      }
    },
    [onCommentAdd],
  );

  const handleToggleLike = useCallback((commentId: string) => {
    setCommentInteractions((prev) => {
      const current = prev[commentId] ?? {
        liked: false,
        likedCount: 0,
        thumbsUp: false,
        thumbsUpCount: 0,
      };

      const nextLiked = !current.liked;
      return {
        ...prev,
        [commentId]: {
          ...current,
          liked: nextLiked,
          likedCount: Math.max(0, current.likedCount + (nextLiked ? 1 : -1)),
        },
      };
    });
  }, []);

  const handleToggleThumbsUp = useCallback((commentId: string) => {
    setCommentInteractions((prev) => {
      const current = prev[commentId] ?? {
        liked: false,
        likedCount: 0,
        thumbsUp: false,
        thumbsUpCount: 0,
      };

      const nextThumbsUp = !current.thumbsUp;
      return {
        ...prev,
        [commentId]: {
          ...current,
          thumbsUp: nextThumbsUp,
          thumbsUpCount: Math.max(
            0,
            current.thumbsUpCount + (nextThumbsUp ? 1 : -1),
          ),
        },
      };
    });
  }, []);

  const filteredActivities = useMemo<ActivityEntry[]>(() => {
    let lifecycle = activities.filter(isLifecycleUserAction);

    if (filterMode === "brand_list") {
      lifecycle = lifecycle.filter((a) =>
        BRAND_LIST_ACTIONS.includes(a.action),
      );
    } else if (filterMode !== "all") {
      lifecycle = lifecycle.filter((a) => a.action === filterMode);
    }

    lifecycle = lifecycle
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, maxItems);

    if (sortOrder === "asc") {
      lifecycle.reverse();
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return lifecycle.filter(
        (a) =>
          a.comment?.toLowerCase().includes(search) ||
          getActionLabel(a.action).toLowerCase().includes(search) ||
          getActivityHeadline(a).toLowerCase().includes(search) ||
          buildPreciseSummaryLine(a).toLowerCase().includes(search) ||
          a.assignmentId?.toLowerCase().includes(search) ||
          a.targetBadge?.includes(search),
      );
    }

    return lifecycle;
  }, [activities, filterMode, searchTerm, sortOrder, maxItems]);

  const stats = useMemo(() => {
    if (!showStats) return null;
    const actionCounts: Record<string, number> = {};
    const lifecycle = activities.filter(isLifecycleUserAction);
    lifecycle.forEach((a) => {
      actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
    });
    return {
      total: lifecycle.length,
      topAction: Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0],
    };
  }, [activities, showStats]);

  const actionTypes = useMemo(() => {
    const types = new Set(
      activities.filter(isLifecycleUserAction).map((a) => a.action),
    );
    return Array.from(types).sort();
  }, [activities]);

  const actorOptions = useMemo(() => {
    const badges = Array.from(
      new Set(
        activities
          .map((entry) => entry.performedBy)
          .filter((badge): badge is string => Boolean(badge)),
      ),
    ).sort();

    if (currentBadge && !badges.includes(currentBadge)) {
      badges.unshift(currentBadge);
    }

    return badges;
  }, [activities, currentBadge]);

  const assignmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        activities
          .map((entry) => entry.assignmentId)
          .filter((id): id is string => Boolean(id && id.trim())),
      ),
    ).sort();
  }, [activities]);

  const lwcOptions = useMemo(() => {
    return Array.from(
      new Set(
        activities
          .flatMap((entry) => {
            const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
            const values: string[] = [];
            if (typeof metadata.lwc === "string" && metadata.lwc.trim()) {
              values.push(metadata.lwc.trim());
            }
            if (
              typeof metadata.lwcSection === "string" &&
              metadata.lwcSection.trim()
            ) {
              values.push(metadata.lwcSection.trim());
            }
            return values;
          })
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [activities]);

  const hasAdvancedFilters =
    selectedActors.length > 0 ||
    selectedAssignments.length > 0 ||
    selectedShifts.length > 0 ||
    selectedLwcs.length > 0 ||
    selectedOperations.length > 0 ||
    selectedActionBuckets.length > 0 ||
    selectedScopes.length > 0 ||
    selectedStages.length > 0 ||
    selectedMilestones.length > 0;

  const toggleMultiValue = useCallback(
    (selected: string[], value: string) =>
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    [],
  );

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {/* Header with controls */}
      <div className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity Timeline
          </h3>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          )}
        </div>

        {showStats && stats && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
              {stats.total} {stats.total === 1 ? "event" : "events"}
            </span>
            {stats.topAction && (
              <span className="text-xs text-muted-foreground">
                · Most:{" "}
                <span className="font-medium text-foreground">
                  {getActionLabel(stats.topAction[0] as ActivityAction)}
                </span>{" "}
                ({stats.topAction[1]})
              </span>
            )}
          </div>
        )}

        {(allowSearch || allowFiltering) && (
          <div className="flex flex-wrap items-center gap-2">
            {allowSearch && (
              <div className="relative min-w-0 flex-1 sm:max-w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    pushFilterPatch({
                      searchText: value.trim() ? value : undefined,
                    });
                  }}
                  className="h-9 pl-9 text-sm"
                />
              </div>
            )}

            {allowFiltering && (
              <Popover
                open={filterPopoverOpen}
                onOpenChange={setFilterPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant={hasAdvancedFilters ? "secondary" : "outline"}
                    size="sm"
                    className="h-9 gap-1.5 px-3 text-sm shrink-0"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    {hasAdvancedFilters ? (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Active
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-w-60 p-0">
                  <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Activity Filters
                    </div>

                    <Collapsible
                      open={openSections.user}
                      onOpenChange={() => toggleSection("user")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full gap-2 justify-between px-2 text-xs">
                          User
                          {openSections.user ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {actorOptions.map((badge) => (
                          <label key={badge} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={selectedActors.includes(badge)}
                              onCheckedChange={() => {
                                const next = toggleMultiValue(selectedActors, badge);
                                setSelectedActors(next);
                                pushFilterPatch({
                                  performedByBadges: next.length ? next : undefined,
                                });
                              }}
                            />
                            <span>Badge {badge}</span>
                          </label>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.shift}
                      onOpenChange={() => toggleSection("shift")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Shift
                          {openSections.shift ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {SHIFT_FILTER_OPTIONS.map((option) => {
                          const value = option.toLowerCase();
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedShifts.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedShifts, value);
                                  setSelectedShifts(next);
                                  pushFilterPatch({
                                    shiftLabels: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.assignment}
                      onOpenChange={() => toggleSection("assignment")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Assignment
                          {openSections.assignment ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {assignmentOptions.map((assignmentId) => (
                          <label key={assignmentId} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={selectedAssignments.includes(assignmentId)}
                              onCheckedChange={() => {
                                const next = toggleMultiValue(selectedAssignments, assignmentId);
                                setSelectedAssignments(next);
                                pushFilterPatch({
                                  assignmentIds: next.length ? next : undefined,
                                });
                              }}
                            />
                            <span>{assignmentId}</span>
                          </label>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.operation}
                      onOpenChange={() => toggleSection("operation")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Operation
                          {openSections.operation ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {OPERATION_OPTIONS.map((option) => {
                          const value = option.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedOperations.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedOperations, value);
                                  setSelectedOperations(next);
                                  pushFilterPatch({
                                    operations: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.action}
                      onOpenChange={() => toggleSection("action")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Action
                          {openSections.action ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {ACTION_OPTIONS.map((option) => {
                          const value = option.toLowerCase();
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedActionBuckets.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedActionBuckets, value);
                                  setSelectedActionBuckets(next);
                                  const mapped = Array.from(new Set(next.flatMap((bucket) => ACTION_FILTER_MAP[bucket] ?? [])));
                                  setFilterMode("all");
                                  pushFilterPatch({
                                    actionTypes: mapped.length ? mapped : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.scope}
                      onOpenChange={() => toggleSection("scope")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Scope
                          {openSections.scope ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {SCOPE_OPTIONS.map((option) => {
                          const value = option.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedScopes.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedScopes, value);
                                  setSelectedScopes(next);
                                  pushFilterPatch({
                                    scopes: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.stage}
                      onOpenChange={() => toggleSection("stage")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Stage
                          {openSections.stage ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {STAGE_OPTIONS.map((option) => {
                          const value = option.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedStages.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedStages, value);
                                  setSelectedStages(next);
                                  pushFilterPatch({
                                    stages: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.milestone}
                      onOpenChange={() => toggleSection("milestone")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          Milestone
                          {openSections.milestone ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {MILESTONE_OPTIONS.map((option) => {
                          const value = option.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedMilestones.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedMilestones, value);
                                  setSelectedMilestones(next);
                                  pushFilterPatch({
                                    milestones: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={openSections.lwc}
                      onOpenChange={() => toggleSection("lwc")}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs">
                          LWC
                          {openSections.lwc ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-2 pb-2">
                        {lwcOptions.map((option) => {
                          const value = option.toLowerCase().replace(/\s+/g, "-");
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={selectedLwcs.includes(value)}
                                onCheckedChange={() => {
                                  const next = toggleMultiValue(selectedLwcs, value);
                                  setSelectedLwcs(next);
                                  pushFilterPatch({
                                    lwcSections: next.length ? next : undefined,
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <ToggleGroup
              type="single"
              value={sortOrder}
              onValueChange={(value) => {
                if (value === "asc" || value === "desc") {
                  setSortOrder(value);
                }
              }}
              variant="outline"
              size="sm"
              className="shrink-0"
              aria-label="Sort activities"
            >
              <ToggleGroupItem value="desc" className="text-xs px-2.5 h-9">
                Newest
              </ToggleGroupItem>
              <ToggleGroupItem value="asc" className="text-xs px-2.5 h-9">
                Oldest
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && filteredActivities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="rounded-full bg-muted/60 p-4 mb-4">
            {searchTerm || filterMode !== "all" || hasAdvancedFilters ? (
              <Search className="h-6 w-6 text-muted-foreground/60" />
            ) : (
              <Clock className="h-6 w-6 text-muted-foreground/60" />
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground mb-1">
            {searchTerm || filterMode !== "all" || hasAdvancedFilters
              ? "No matching activities"
              : "No activity yet"}
          </h4>
          <p className="text-xs text-muted-foreground max-w-55">
            {searchTerm
              ? "Try adjusting your search or removing filters."
              : filterMode === "brand_list"
                ? "No brand list activities found."
                : filterMode !== "all"
                  ? `No ${getActionLabel(filterMode as ActivityAction).toLowerCase()} activities found.`
                  : hasAdvancedFilters
                    ? "No activities match the selected filter combination."
                  : "Activities will appear here as actions are performed."}
          </p>
          {(searchTerm || filterMode !== "all" || hasAdvancedFilters) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs h-7"
              onClick={() => {
                setSearchTerm("");
                setFilterMode("all");
                setSelectedActors([]);
                setSelectedAssignments([]);
                setSelectedShifts([]);
                setSelectedLwcs([]);
                setSelectedOperations([]);
                setSelectedActionBuckets([]);
                setSelectedScopes([]);
                setSelectedStages([]);
                setSelectedMilestones([]);
                pushFilterPatch({
                  actionTypes: undefined,
                  performedByBadges: undefined,
                  assignmentIds: undefined,
                  shiftLabels: undefined,
                  lwcSections: undefined,
                  operations: undefined,
                  scopes: undefined,
                  stages: undefined,
                  milestones: undefined,
                  searchText: undefined,
                });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Timeline */}
      <div
        className={cn(
          "flex flex-col space-y-1.5 px-3 sm:px-4 pb-4",
          containerClassName,
        )}
      >
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`activity-skeleton-${i}`}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-4 w-3/5" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading &&
          filteredActivities.map((activity, idx) => {
            const {
              icon: Icon,
              color,
              bg,
              border,
            } = getActivityIcon(activity.action);
            const isLast = idx === filteredActivities.length - 1;
            const isExpanded = expandedActivities.has(activity.id);
            const isClicked = clickedActivityId === activity.id;
            const metadata = activity.metadata as
              | Record<string, unknown>
              | undefined;
            const isSyntheticSummary = metadata?.syntheticSummary === true;
            const hasRelated =
              !isSyntheticSummary &&
              showNestedActivities &&
              activity.relatedActivityIds &&
              activity.relatedActivityIds.length > 0;
            const hasComments =
              !isSyntheticSummary &&
              showComments &&
              (activity.comments || onCommentAdd);
            const automatedFollowUpAttachments = readAutomatedFollowUpAttachments(
              activity.projectId ?? (typeof metadata?.projectId === "string" ? metadata.projectId : undefined),
              metadata,
            );
            const hasAutomatedAttachments = automatedFollowUpAttachments.length > 0;
            const isExpandable = Boolean(hasRelated || hasComments || hasAutomatedAttachments);
            const normalizedPerformerBadge = normalizeBadgeId(
              activity.performedBy,
            );
            const performer = normalizedPerformerBadge
              ? userPreviews[normalizedPerformerBadge]
              : undefined;
            const performerName =
              performer?.name ??
              (normalizedPerformerBadge
                ? `Badge #${normalizedPerformerBadge}`
                : undefined);
            const performerTitle = normalizePreviewValue(performer?.title);
            const performerRole = normalizePreviewValue(performer?.role);
            const performerDepartment = normalizePreviewValue(
              performer?.department,
            );
            const performerShift = normalizePreviewValue(performer?.shift);
            const photos = activityPhotos[activity.id] ?? [];
            const showPhotoGallery = !isSyntheticSummary && photos.length > 0;
            const quickReplies = isSyntheticSummary
              ? []
              : getQuickReplySuggestions(activity);
            const projectName =
              typeof metadata?.projectName === "string"
                ? metadata.projectName
                : undefined;
            const actorType =
              typeof metadata?.actorType === "string"
                ? metadata.actorType.toLowerCase()
                : "";
            const actionSource =
              typeof metadata?.source === "string"
                ? metadata.source.toLowerCase()
                : "";
            const normalizedPerformer = (
              activity.performedBy ?? ""
            ).toLowerCase();
            const isAutomatedAction =
              actorType === "system" ||
              actionSource === "system" ||
              actionSource === "automation" ||
              normalizedPerformer === "system" ||
              normalizedPerformer === "automation" ||
              normalizedPerformer === "auto";

            const projectIconLabel =
              projectName ||
              (typeof metadata?.pdNumber === "string"
                ? metadata.pdNumber
                : null) ||
              activity.projectId ||
              "Project";
            const showProjectNode = Boolean(projectIconLabel);

            return (
              <div key={activity.id} className="relative">
                <div className="flex items-start gap-3">
                  <div className="relative flex w-10 shrink-0 justify-center self-stretch">
                    {!isLast && (
                      <div
                        className="pointer-events-none absolute left-1/2 top-10 -bottom-2 w-px -translate-x-1/2 bg-border/70"
                        aria-hidden="true"
                      />
                    )}

                    <div className="relative z-10 mt-0.5">
                      {showProjectNode ? (
                        <ProjectIcon
                          name={projectIconLabel}
                          color={getProjectColorHex(metadata)}
                          interactive={false}
                          size="sm"
                        />
                      ) : (
                        <div
                          className={cn(
                            "rounded-full border-2 p-2 shadow-sm",
                            bg,
                            border,
                          )}
                        >
                          {isAutomatedAction ? (
                            <Bot className="h-4 w-4 text-violet-600" />
                          ) : (
                            <Icon className={cn("h-4 w-4", color)} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col space-y-2">
                    <div
                      className={cn(
                        "group relative cursor-pointer rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:bg-accent/40 hover:border-border",
                        isClicked && "scale-[0.995] ring-1 ring-primary/20",
                      )}
                      onClick={() => {
                        setClickedActivityId(activity.id);
                        if (clickFeedbackTimerRef.current) {
                          clearTimeout(clickFeedbackTimerRef.current);
                        }
                        clickFeedbackTimerRef.current = setTimeout(() => {
                          setClickedActivityId(null);
                        }, 220);

                        if (isExpandable) {
                          toggleActivityExpanded(activity.id);
                        }
                        onActivityClick?.(activity);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col space-y-1.5">
                        {/* Primary line with title, description, and expand button */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 min-w-0 gap-2 flex-col flex">
                            {/* Title + timestamp row */}
                            <div className="flex w-full items-start justify-between gap-2">
                              <span
                                className={cn(
                                  "min-w-0 flex-1 text-xs font-semibold leading-snug",
                                  compact
                                    ? "line-clamp-1"
                                    : "line-clamp-2 sm:line-clamp-none",
                                )}
                              >
                                {buildStructuredTitle(
                                  activity,
                                  performer?.name,
                                )}
                              </span>
                            </div>

                            {getActionDescription(
                              activity.action,
                              activity.metadata,
                            ) && (
                              <span className="text-[10px] italic text-muted-foreground">
                                {getActionDescription(
                                  activity.action,
                                  activity.metadata,
                                )}
                              </span>
                            )}
                            {/* Secondary info: performer chip */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {activity.performedBy && (
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex max-w-max sm:max-w-max items-center gap-1.5 rounded-full border border-border/70 bg-background/80 pl-0.5 pr-2 py-0.5 transition-colors hover:bg-background"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Avatar className="h-5 w-5">
                                          <AvatarImage
                                            src={performer?.avatarUrl}
                                            alt={performerName}
                                          />
                                          <AvatarFallback className="text-[10px] font-semibold">
                                            {getAvatarInitials(
                                              performer?.name,
                                              normalizedPerformerBadge ??
                                                activity.performedBy,
                                            )}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate opacity-85">
                                          {performer?.name ??
                                            `#${normalizedPerformerBadge ?? activity.performedBy}`}
                                        </span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      sideOffset={8}
                                      align="start"
                                      className="max-w-max  bg-background pl-2 pr-3 py-1"
                                    >
                                      <div className="space-y-2">
                                        <div className="space-y-0.5">
                                          <div className="text-sm font-semibold leading-none text-foreground">
                                            {performerName}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            Badge #
                                            {normalizedPerformerBadge ??
                                              activity.performedBy}
                                          </div>
                                        </div>
                                        {performerTitle && (
                                          <div className="text-xs text-muted-foreground">
                                            {performerTitle}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                          {performerRole && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px]"
                                            >
                                              {performerRole}
                                            </Badge>
                                          )}
                                       
                                          {performerShift && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px]"
                                            >
                                              {performerShift}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="shrink-0 cursor-default whitespace-nowrap text-xs text-muted-foreground tabular-nums"
                                      suppressHydrationWarning
                                    >
                                      {formatDistanceToNow(
                                        new Date(activity.timestamp),
                                        { addSuffix: true },
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="text-xs"
                                  >
                                    {formatSessionDateTime(activity.timestamp)}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            {!compact && (
                              <p className="text-[10px] text-muted-foreground/95">
                                {getActivityHeadline(activity)}
                              </p>
                            )}

                            {isAutomatedAction && !isSyntheticSummary && (
                              <div className="text-[10px] font-medium uppercase tracking-wide text-violet-700/90">
                                Automated follow-up
                              </div>
                            )}

                            {showPhotoGallery && (
                              <PhotoUploadGallery
                                images={photos}
                                onChange={(nextPhotos) => {
                                  setActivityPhotos((prev) => ({
                                    ...prev,
                                    [activity.id]: nextPhotos,
                                  }));
                                }}
                                className="pt-1"
                              />
                            )}
                          </div>

                          {(hasRelated || hasComments) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 shrink-0 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleActivityExpanded(activity.id);
                              }}
                            >
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isExpanded && "rotate-90",
                                )}
                              />
                            </Button>
                          )}
                        </div>

                        {/* Comment text if present */}
                        {activity.comment && !compact && (
                          <p className="line-clamp-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm italic text-foreground/80">
                            &ldquo;{activity.comment}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -6, height: 0 }}
                            transition={EXPAND_SPRING}
                            className="flex flex-col space-y-3 overflow-hidden rounded-xl border border-border/60 bg-card/50"
                          >
                            {hasAutomatedAttachments && (
                              <div className="rounded-xl p-3">
                                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                  <Bot className="h-3.5 w-3.5 text-violet-600" />
                                  Automated follow-up files
                                </div>
                                <div className="space-y-2">
                                  {automatedFollowUpAttachments.map((attachment) => {
                                    const AttachmentIcon = attachmentIconForFile(attachment.fileName);
                                    return (
                                      <a
                                        key={`${activity.id}-${attachment.href}`}
                                        href={attachment.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[10px] text-emerald-900 transition-colors hover:bg-emerald-100"
                                      >
                                        <AttachmentIcon className="h-3.5 w-3.5 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium">{attachment.label}</div>
                                          <div className="truncate text-emerald-800/80">{attachment.fileName}</div>
                                        </div>
                                        <Download className="h-3.5 w-3.5 shrink-0" />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Related Activities */}
                            {hasRelated && (
                              <div className="rounded bg-muted/30 py-2 pl-3 sm:pl-4 border-l-2 border-dashed border-muted-foreground/30">
                                <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                                  🔗 Related Processes:
                                </h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {activity.relatedActivityIds!.map(
                                    (relatedId) => {
                                      const relatedActivity = activities.find(
                                        (a) => a.id === relatedId,
                                      );
                                      if (!relatedActivity) return null;
                                      return (
                                        <div
                                          key={relatedId}
                                          className="rounded border border-border/50 bg-background p-2 text-xs transition-colors hover:border-border"
                                        >
                                          <div className="font-medium">
                                            {getActionLabel(
                                              relatedActivity.action,
                                            )}
                                          </div>
                                          <div className="text-muted-foreground">
                                            <span suppressHydrationWarning>
                                              {formatDistanceToNow(
                                                new Date(
                                                  relatedActivity.timestamp,
                                                ),
                                                { addSuffix: true },
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Comments & Responses Section */}
                            {hasComments && (
                              <div className="relative">
                                <div className="rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                      <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                                      Comments & Responses
                                    </h4>
                                    {commentingActivityId === activity.id && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] animate-pulse"
                                      >
                                        ✍️ Replying...
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Existing comments */}
                                  {activity.comments &&
                                    activity.comments.length > 0 && (
                                      <div className="mb-4 max-h-48 space-y-2 overflow-y-auto pr-1 sm:pr-2">
                                        {activity.comments.map((comment) => (
                                          <div
                                            key={comment.id}
                                            className="rounded-lg border border-border/60 bg-background p-2.5 text-xs transition-colors hover:border-border sm:p-3"
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="font-semibold text-foreground">
                                                Badge #{comment.author}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className="text-[10px] text-muted-foreground"
                                                  suppressHydrationWarning
                                                >
                                                  {formatDistanceToNow(
                                                    new Date(comment.timestamp),
                                                    { addSuffix: true },
                                                  )}
                                                </span>
                                                {onCommentDelete &&
                                                  currentBadge ===
                                                    comment.author && (
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                                                      title="Delete comment"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        void handleCommentDelete(
                                                          activity.id,
                                                          comment.id,
                                                        );
                                                      }}
                                                      disabled={deletingComments.has(
                                                        comment.id,
                                                      )}
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  )}
                                              </div>
                                            </div>
                                            <div className="text-foreground/90 leading-relaxed">
                                              {comment.text}
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                              <motion.button
                                                type="button"
                                                whileTap={{ scale: 0.9 }}
                                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] transition-colors hover:bg-muted"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleLike(comment.id);
                                                }}
                                              >
                                                <motion.div
                                                  animate={{
                                                    scale: commentInteractions[
                                                      comment.id
                                                    ]?.liked
                                                      ? [1, 1.25, 1]
                                                      : 1,
                                                  }}
                                                  transition={{
                                                    duration: 0.25,
                                                    ease: "easeInOut",
                                                  }}
                                                >
                                                  <Heart
                                                    className={cn(
                                                      "h-3.5 w-3.5 transition-colors",
                                                      commentInteractions[
                                                        comment.id
                                                      ]?.liked
                                                        ? "fill-red-500 text-red-500"
                                                        : "text-muted-foreground",
                                                    )}
                                                  />
                                                </motion.div>
                                                <span className="text-muted-foreground">
                                                  {commentInteractions[
                                                    comment.id
                                                  ]?.likedCount ?? 0}
                                                </span>
                                              </motion.button>

                                              <motion.button
                                                type="button"
                                                whileTap={{ scale: 0.9 }}
                                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] transition-colors hover:bg-muted"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleThumbsUp(
                                                    comment.id,
                                                  );
                                                }}
                                              >
                                                <motion.div
                                                  animate={{
                                                    scale: commentInteractions[
                                                      comment.id
                                                    ]?.thumbsUp
                                                      ? [1, 1.2, 1]
                                                      : 1,
                                                  }}
                                                  transition={{
                                                    duration: 0.22,
                                                    ease: "easeInOut",
                                                  }}
                                                >
                                                  <ThumbsUp
                                                    className={cn(
                                                      "h-3.5 w-3.5 transition-colors",
                                                      commentInteractions[
                                                        comment.id
                                                      ]?.thumbsUp
                                                        ? "fill-blue-500 text-blue-500"
                                                        : "text-muted-foreground",
                                                    )}
                                                  />
                                                </motion.div>
                                                <span className="text-muted-foreground">
                                                  {commentInteractions[
                                                    comment.id
                                                  ]?.thumbsUpCount ?? 0}
                                                </span>
                                              </motion.button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                  {/* Response/Add Comment Section */}
                                  {onCommentAdd && (
                                    <div className="space-y-2 border-t border-dashed border-muted-foreground/20 pt-2">
                                      <div className="text-xs text-muted-foreground font-medium">
                                        {commentingActivityId === activity.id
                                          ? "✍️ Reply"
                                          : "↳ Add Response"}
                                      </div>
                                      <div
                                        className={cn(
                                          "flex gap-1.5 rounded-xl border p-2 transition-colors",
                                          commentingActivityId === activity.id
                                            ? "border-blue-300 bg-blue-50/30"
                                            : "border-border/50 bg-background hover:border-border",
                                        )}
                                        onClick={() =>
                                          setCommentingActivityId(activity.id)
                                        }
                                      >
                                        <Input
                                          placeholder="Type your response..."
                                          value={
                                            commentInputs[activity.id] || ""
                                          }
                                          onChange={(e) =>
                                            setCommentInputs((prev) => ({
                                              ...prev,
                                              [activity.id]: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" &&
                                              e.ctrlKey
                                            ) {
                                              handleCommentSubmit(activity.id);
                                            }
                                            if (
                                              e.key === "Enter" &&
                                              !e.shiftKey &&
                                              !e.ctrlKey
                                            ) {
                                              e.preventDefault();
                                              handleCommentSubmit(activity.id);
                                            }
                                          }}
                                          className="h-9 flex-1 text-xs"
                                          disabled={loadingComments.has(
                                            activity.id,
                                          )}
                                          onFocus={() =>
                                            setCommentingActivityId(activity.id)
                                          }
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleCommentSubmit(activity.id)
                                          }
                                          disabled={
                                            !commentInputs[
                                              activity.id
                                            ]?.trim() ||
                                            loadingComments.has(activity.id)
                                          }
                                          className="h-9 px-2"
                                          variant={
                                            commentInputs[activity.id]?.trim()
                                              ? "default"
                                              : "outline"
                                          }
                                        >
                                          {loadingComments.has(activity.id) ? (
                                            <span className="animate-spin">
                                              ⏳
                                            </span>
                                          ) : (
                                            <Send className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                      {commentingActivityId === activity.id &&
                                        !loadingComments.has(activity.id) && (
                                          <div className="text-[10px] text-muted-foreground">
                                            Press Enter to send, Ctrl+Enter for
                                            new line
                                          </div>
                                        )}
                                      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
                                        {quickReplies.map((reply) => (
                                          <Button
                                            key={`${activity.id}-${reply}`}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleQuickReply(
                                                activity.id,
                                                reply,
                                              );
                                            }}
                                            disabled={loadingComments.has(
                                              activity.id,
                                            )}
                                          >
                                            {reply}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {filteredActivities.length >= maxItems && (
        <div className="text-sm text-muted-foreground text-center py-2 border-t">
          Showing {filteredActivities.length} of {activities.length} activities
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
