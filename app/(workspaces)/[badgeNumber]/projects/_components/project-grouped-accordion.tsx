"use client";

import { useMemo, type ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";

import { ProjectNavCard } from "./project-nav-card";
import type { DueProjectNavItem } from "./projects-side-panel-nav";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Minimum shape a project must have to be groupable. Most callers will pass
 * `DueProjectNavItem` (the side-panel nav item) which satisfies this.
 */
export type ProjectGroupableItem = {
  id: string;
  lwcType?: string | null;
  dueDate?: string | null;
  daysLate?: number | null;
  status?: string | null;
  priorityLabel?: string | null;
};

/**
 * One bucket definition for the grouped accordion.
 *
 * `match` is the predicate used to assign projects to this group. Predicates
 * can overlap — by default a project lands in every bucket whose predicate
 * returns true. Use `mode="exclusive"` on the parent to change that.
 */
export type ProjectGroupFilter<TProject extends ProjectGroupableItem> = {
  /** Stable id; doubles as the accordion item value. */
  id: string;
  /** Visible label shown in the accordion trigger. */
  label: string;
  /** Optional dot/swatch color rendered next to the label. */
  dotColor?: string;
  /**
   * Optional glyph rendered before the label. Takes precedence over
   * `dotColor`. Useful for unit-type SVGs or other custom icons.
   */
  icon?: ReactNode;
  /** Optional helper text shown beneath the label when the group is open. */
  description?: string;
  /** Predicate that decides whether a project belongs to this group. */
  match: (project: TProject) => boolean;
  /**
   * When set, renders this content directly below the trigger (always visible,
   * even when the accordion is collapsed). Used to pin a project card.
   */
  pinnedContent?: ReactNode;
  /**
   * Id of a project to exclude from the main list because it is already
   * shown via `pinnedContent`.
   */
  pinnedProjectId?: string;
};

export type ProjectGroupingMode = "overlap" | "exclusive";

type ProjectGroupedAccordionProps<TProject extends ProjectGroupableItem> = {
  projects: TProject[];
  groups: ProjectGroupFilter<TProject>[];
  /**
   * Render override for individual project cards. Defaults to
   * {@link ProjectNavCard} when projects are `DueProjectNavItem`s.
   */
  renderProject?: (project: TProject) => ReactNode;
  /**
   * - "overlap" (default): a project appears in every group whose predicate matches.
   * - "exclusive": each project is assigned to the first matching group only.
   */
  mode?: ProjectGroupingMode;
  /** Whether the accordion allows multiple open sections. Defaults to "multiple". */
  type?: "single" | "multiple";
  /** Initially-open group ids. */
  defaultOpenIds?: string[];
  /** Hide groups that contain zero projects. Defaults to true. */
  hideEmpty?: boolean;
  /** Wrapper className applied to the Accordion root. */
  className?: string;
  /** Message shown inside an open group with no projects. */
  emptyGroupMessage?: string;
  /** Tailwind max-height class applied to the scrollable content area. Defaults to "max-h-72". */
  contentMaxHeight?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Reusable accordion that groups project cards by configurable filter
 * predicates. The bucket configuration is fully data-driven, so callers can
 * combine the prebuilt {@link LWC_GROUP_FILTERS} and
 * {@link STATUS_GROUP_FILTERS} or supply their own.
 */
export function ProjectGroupedAccordion<TProject extends ProjectGroupableItem>({
  projects,
  groups,
  renderProject,
  mode = "overlap",
  type = "multiple",
  defaultOpenIds,
  hideEmpty = true,
  className,
  emptyGroupMessage = "No projects in this group.",
  contentMaxHeight = "max-h-72",
}: ProjectGroupedAccordionProps<TProject>) {
  const renderItem =
    renderProject ??
    (((project: ProjectGroupableItem) => (
      <ProjectNavCard project={project as DueProjectNavItem} />
    )) as (project: TProject) => ReactNode);

  const bucketed = useMemo(
    () => bucketProjectsByFilters(projects, groups, mode),
    [projects, groups, mode]
  );

  const visibleGroups = hideEmpty
    ? groups.filter((group) => (bucketed.get(group.id)?.length ?? 0) > 0)
    : groups;

  const fallbackDefault = useMemo(() => {
    if (defaultOpenIds && defaultOpenIds.length > 0) return defaultOpenIds;
    if (type === "single") {
      return visibleGroups[0] ? [visibleGroups[0].id] : [];
    }
    return visibleGroups.map((group) => group.id);
  }, [defaultOpenIds, type, visibleGroups]);

  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground sm:rounded-2xl sm:py-6 sm:text-sm">
        {emptyGroupMessage}
      </div>
    );
  }

  // The Accordion primitive treats single vs. multiple as different prop
  // shapes, so split the trees to keep the types honest.
  if (type === "single") {
    return (
      <Accordion
        type="single"
        collapsible
        defaultValue={fallbackDefault[0]}
        className={cn("w-full max-w-full flex flex-col gap-2", className)}
      >
        {visibleGroups.map((group, index) => (
          <ProjectAccordionGroupItem
            key={group.id}
            group={group}
            projects={bucketed.get(group.id) ?? []}
            index={index}
            renderProject={renderItem}
            emptyGroupMessage={emptyGroupMessage}
            contentMaxHeight={contentMaxHeight}
          />
        ))}
      </Accordion>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={fallbackDefault}
      className={cn("w-full max-w-full flex flex-col gap-2", className)}
    >
      {visibleGroups.map((group, index) => (
        <ProjectAccordionGroupItem
          key={group.id}
          group={group}
          projects={bucketed.get(group.id) ?? []}
          index={index}
          renderProject={renderItem}
          emptyGroupMessage={emptyGroupMessage}
          contentMaxHeight={contentMaxHeight}
        />
      ))}
    </Accordion>
  );
}

// ─── Internal pieces ─────────────────────────────────────────────────────────

type ProjectAccordionGroupItemProps<TProject extends ProjectGroupableItem> = {
  group: ProjectGroupFilter<TProject>;
  projects: TProject[];
  index: number;
  renderProject: (project: TProject) => ReactNode;
  emptyGroupMessage: string;
  contentMaxHeight: string;
};

function ProjectAccordionGroupItem<TProject extends ProjectGroupableItem>({
  group,
  projects,
  index,
  renderProject,
  emptyGroupMessage,
  contentMaxHeight,
}: ProjectAccordionGroupItemProps<TProject>) {
  const displayProjects = group.pinnedProjectId
    ? projects.filter((p) => p.id !== group.pinnedProjectId)
    : projects;

  return (
    <AccordionItem
      value={group.id}
      index={index}
      className="rounded-xl border border-border bg-background/40 sm:rounded-2xl"
    >
      <AccordionTrigger>
        <ProjectGroupTriggerLabel
          label={group.label}
          dotColor={group.dotColor}
          icon={group.icon}
          count={projects.length}
        />
      </AccordionTrigger>
      {group.pinnedContent ? (
        <div className="px-1.5 pb-1.5 sm:px-2 sm:pb-2">{group.pinnedContent}</div>
      ) : null}
      <AccordionContent>
        {group.description ? (
          <p className="mb-1.5 text-[10px] text-muted-foreground sm:mb-2 sm:text-[11px]">
            {group.description}
          </p>
        ) : null}
        {displayProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[10px] text-muted-foreground sm:rounded-xl sm:px-3 sm:py-4 sm:text-xs">
            {emptyGroupMessage}
          </div>
        ) : (
          <div className={cn("overflow-y-auto space-y-1.5 sm:space-y-2", contentMaxHeight)}>
            {displayProjects.map((project) => (
              <div key={`${group.id}-${project.id}`}>
                {renderProject(project)}
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

type ProjectGroupTriggerLabelProps = {
  label: string;
  count: number;
  dotColor?: string;
  icon?: ReactNode;
};

function ProjectGroupTriggerLabel({
  label,
  count,
  dotColor,
  icon,
}: ProjectGroupTriggerLabelProps) {
  return (
    <span className="flex w-full items-center gap-1.5 sm:gap-2">
      {icon ? (
        <span aria-hidden className="flex shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : dotColor ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2"
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      <span className="flex-1 truncate text-left text-xs sm:text-sm">{label}</span>
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground sm:px-2 sm:text-[11px]">
        {count}
      </span>
    </span>
  );
}

// ─── Bucketing helpers ───────────────────────────────────────────────────────

function bucketProjectsByFilters<TProject extends ProjectGroupableItem>(
  projects: TProject[],
  groups: ProjectGroupFilter<TProject>[],
  mode: ProjectGroupingMode
): Map<string, TProject[]> {
  const buckets = new Map<string, TProject[]>();
  groups.forEach((group) => buckets.set(group.id, []));

  projects.forEach((project) => {
    if (mode === "exclusive") {
      const firstMatch = groups.find((group) => group.match(project));
      if (firstMatch) {
        buckets.get(firstMatch.id)!.push(project);
      }
      return;
    }

    groups.forEach((group) => {
      if (group.match(project)) {
        buckets.get(group.id)!.push(project);
      }
    });
  });

  return buckets;
}

// ─── Prebuilt filter sets ────────────────────────────────────────────────────

/**
 * LWC-type buckets matching the filter list the team uses in the side panel:
 * Onskid, Offskid, New/Flex.
 */
export const LWC_GROUP_FILTERS: ProjectGroupFilter<ProjectGroupableItem>[] = [
  {
    id: "lwc-onskid",
    label: LWC_TYPE_REGISTRY.ONSKID.label,
    dotColor: LWC_TYPE_REGISTRY.ONSKID.dotColor,
    description: LWC_TYPE_REGISTRY.ONSKID.description,
    match: (project) => normalizeLwc(project.lwcType) === "ONSKID",
  },
  {
    id: "lwc-offskid",
    label: LWC_TYPE_REGISTRY.OFFSKID.label,
    dotColor: LWC_TYPE_REGISTRY.OFFSKID.dotColor,
    description: LWC_TYPE_REGISTRY.OFFSKID.description,
    match: (project) => normalizeLwc(project.lwcType) === "OFFSKID",
  },
  {
    id: "lwc-new-flex",
    label: LWC_TYPE_REGISTRY.NEW_FLEX.label,
    dotColor: LWC_TYPE_REGISTRY.NEW_FLEX.dotColor,
    description: LWC_TYPE_REGISTRY.NEW_FLEX.description,
    match: (project) => normalizeLwc(project.lwcType) === "NEW_FLEX",
  },
];

/**
 * Lifecycle buckets: Green Change, Late, Upcoming, Active. Kept separate from
 * LWC filters so callers can mix-and-match.
 */
export const STATUS_GROUP_FILTERS: ProjectGroupFilter<ProjectGroupableItem>[] = [
  {
    id: "status-green-change",
    label: "Green Change",
    dotColor: "#10B981",
    description: "Approved and trending green.",
    match: (project) =>
      hasMarker(project.priorityLabel, "green") ||
      hasMarker(project.status, "green"),
  },
  {
    id: "status-late",
    label: "Late",
    dotColor: "#EF4444",
    description: "Past due or flagged as late.",
    match: isLate,
  },
  {
    id: "status-upcoming",
    label: "Upcoming",
    dotColor: "#F59E0B",
    description: "Due within the next two weeks.",
    match: isUpcoming,
  },
  {
    id: "status-active",
    label: "Active",
    dotColor: "#3B82F6",
    description: "Currently in progress.",
    match: (project) => hasMarker(project.status, "active"),
  },
];

/**
 * Convenience filter set that matches the order in the spec:
 * Onskid → Offskid → New/Flex → Green Change → Late → Upcoming → Active.
 */
export const PROJECT_GROUP_FILTERS: ProjectGroupFilter<ProjectGroupableItem>[] = [
  ...LWC_GROUP_FILTERS,
  ...STATUS_GROUP_FILTERS,
];

// ─── Predicate helpers ───────────────────────────────────────────────────────

const UPCOMING_WINDOW_DAYS = 14;

function normalizeLwc(value: string | null | undefined): string {
  const v = String(value || "").trim().toUpperCase();
  if (!v) return "";
  if (v === "NEW" || v.includes("NEW") || v.includes("FLEX")) return "NEW_FLEX";
  if (v.includes("OFFSKID") || v === "OFF_SKID" || v === "OFFSKID") return "OFFSKID";
  if (v.includes("OFF")) return "OFFSKID";
  if (v.includes("ONSKID") || v === "ON_SKID" || v === "ONSKID") return "ONSKID";
  if (v.includes("ON") || v.includes("SKID")) return "ONSKID";
  return v;
}

function hasMarker(value: string | null | undefined, needle: string) {
  return String(value || "").toLowerCase().includes(needle.toLowerCase());
}

function isLate(project: ProjectGroupableItem): boolean {
  if (typeof project.daysLate === "number" && project.daysLate > 0) {
    return true;
  }
  if (hasMarker(project.priorityLabel, "late") || hasMarker(project.status, "late")) {
    return true;
  }
  if (!project.dueDate) return false;
  const dueMs = Date.parse(project.dueDate);
  if (!Number.isFinite(dueMs)) return false;
  return dueMs < startOfToday();
}

function isUpcoming(project: ProjectGroupableItem): boolean {
  if (!project.dueDate) return false;
  const dueMs = Date.parse(project.dueDate);
  if (!Number.isFinite(dueMs)) return false;
  const today = startOfToday();
  const horizon = today + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return dueMs >= today && dueMs <= horizon;
}

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}
