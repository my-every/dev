/**
 * Widget registry — default widget descriptors.
 * widgetType is a string key resolved by the client-side WIDGET_COMPONENT_REGISTRY.
 * No React components are stored here.
 */

import type { WidgetDescriptor } from "@/types/workspace-config";

export const DEFAULT_WIDGET_REGISTRY: WidgetDescriptor[] = [
  // ── Overview Timer ─────────────────────────────────────────────────────────
  {
    id: "overview-timer",
    label: "Time Badge In",
    description: "Badge-credential timer for controlling assignment clock state.",
    widgetType: "OverviewTimerCard",
    modelKey: "boardAssignment",
    apiEndpoint: "/api/board/data",
    refreshPolicy: "on-mount",
    defaultSize: "full",
    allowedSizes: ["full"],
    defaultColSpan: 4,
    defaultRowSpan: 1,
    rolesAllowed: ["DEVELOPER", "MANAGER", "SUPERVISOR", "ENGINEER", "TEAM_LEAD", "QA", "BRANDER", "ASSEMBLER"],
    actions: [],
    emptyState: {
      title: "No selected project",
      description: "Assign work or open a project to enable badge timing.",
    },
    errorState: {
      title: "Timer unavailable",
      description: "Could not load board data.",
      retryable: true,
    },
    enabled: true,
    draggable: false,
    resizable: false,
    defaultViewMode: "standard",
    scope: "user",
  },

  // ── Project Overview Chart ─────────────────────────────────────────────────
  {
    id: "project-overview-chart",
    label: "Project Overview",
    description: "Project load and priority by LWC with due-date weighted urgency.",
    widgetType: "ProjectOverviewChart",
    modelKey: "projectManifest",
    apiEndpoint: "/api/projects",
    queryParams: { limit: "50" },
    refreshPolicy: "on-mount",
    defaultSize: "lg",
    allowedSizes: ["md", "lg", "xl", "full"],
    defaultColSpan: 2,
    defaultRowSpan: 1,
    rolesAllowed: ["DEVELOPER", "MANAGER", "SUPERVISOR", "ENGINEER", "TEAM_LEAD"],
    actions: [
      {
        id: "view-all",
        label: "View All Projects",
        iconKey: "FolderKanban",
      },
    ],
    emptyState: {
      title: "No projects",
      description: "No project load records yet for this period.",
    },
    errorState: {
      title: "Failed to load projects",
      description: "Could not fetch project manifest data.",
      retryable: true,
    },
    enabled: true,
    draggable: true,
    resizable: true,
    defaultViewMode: "standard",
    scope: "workspace",
  },

  // ── Assignments List ───────────────────────────────────────────────────────
  {
    id: "assignments-list",
    label: "Assignments",
    description: "Filter and view active, upcoming, or all assigned projects.",
    widgetType: "AssignmentsList",
    modelKey: "boardAssignment",
    apiEndpoint: "/api/board/data",
    refreshPolicy: "on-mount",
    defaultSize: "lg",
    allowedSizes: ["sm", "md", "lg", "xl", "full"],
    defaultColSpan: 2,
    defaultRowSpan: 1,
    rolesAllowed: [],
    actions: [
      {
        id: "assign",
        label: "Assign",
        iconKey: "UserPlus",
        requiredPermission: "canAssignUsers",
      },
    ],
    emptyState: {
      title: "No assignments",
      description: "No assignments match this filter.",
    },
    errorState: {
      title: "Failed to load assignments",
      description: "Could not fetch board data.",
      retryable: true,
    },
    enabled: true,
    draggable: true,
    resizable: true,
    defaultViewMode: "standard",
    scope: "user",
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "Leadership ranking and throughput benchmark.",
    widgetType: "Leaderboard",
    modelKey: "leaderboard",
    refreshPolicy: "manual",
    defaultSize: "md",
    allowedSizes: ["sm", "md", "lg"],
    defaultColSpan: 2,
    defaultRowSpan: 1,
    rolesAllowed: ["DEVELOPER", "MANAGER", "SUPERVISOR", "TEAM_LEAD"],
    actions: [],
    emptyState: {
      title: "Leaderboard unavailable",
      description: "Leaderboard service is not connected.",
    },
    errorState: {
      title: "Leaderboard error",
      description: "Could not load leaderboard data.",
      retryable: false,
    },
    enabled: true,
    draggable: true,
    resizable: true,
    defaultViewMode: "compact",
    scope: "workspace",
  },

  // ── Skills Sentiment ───────────────────────────────────────────────────────
  {
    id: "skills-sentiment",
    label: "Skills Sentiment",
    description: "Skill matrix health indicator for coaching and readiness.",
    widgetType: "SkillsSentiment",
    modelKey: "userProfile",
    apiEndpoint: "/api/board/data",
    refreshPolicy: "on-mount",
    defaultSize: "sm",
    allowedSizes: ["xs", "sm", "md"],
    defaultColSpan: 1,
    defaultRowSpan: 1,
    rolesAllowed: [],
    actions: [],
    emptyState: {
      title: "No skills data",
      description: "Skills have not been recorded for this user.",
    },
    errorState: {
      title: "Skills unavailable",
      description: "Could not load skills data.",
      retryable: true,
    },
    enabled: true,
    draggable: true,
    resizable: false,
    defaultViewMode: "compact",
    scope: "user",
  },

  // ── Training Inventory ─────────────────────────────────────────────────────
  {
    id: "training-inventory",
    label: "Training",
    description: "Published and draft training module inventory.",
    widgetType: "TrainingInventory",
    modelKey: "training",
    apiEndpoint: "/api/training",
    refreshPolicy: "on-mount",
    defaultSize: "sm",
    allowedSizes: ["xs", "sm", "md"],
    defaultColSpan: 1,
    defaultRowSpan: 1,
    rolesAllowed: [],
    actions: [],
    emptyState: {
      title: "No training modules",
      description: "No training modules are available yet.",
    },
    errorState: {
      title: "Training unavailable",
      description: "Could not load training data.",
      retryable: true,
    },
    enabled: true,
    draggable: true,
    resizable: false,
    defaultViewMode: "compact",
    scope: "workspace",
  },
];

/** Merge admin overrides onto the default widget registry */
export function mergeWidgetOverrides(
  defaults: WidgetDescriptor[],
  overrides: Partial<WidgetDescriptor>[],
): WidgetDescriptor[] {
  return defaults.map((def) => {
    const override = overrides.find((o) => o.id === def.id);
    if (!override) return def;
    return { ...def, ...override, id: def.id };
  });
}
