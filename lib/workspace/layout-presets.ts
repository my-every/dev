/**
 * Role-based default layout presets.
 * Also re-exports legacyRoleToWorkspaceRole for cross-module use.
 */

import type { UserRole } from "@/types/d380-user-session";
import type { LayoutPreset, WorkspaceRole } from "@/types/workspace-config";

export { legacyRoleToWorkspaceRole } from "@/lib/workspace/permission-resolver";

// ─── Default presets ──────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT_PRESETS: Record<WorkspaceRole, LayoutPreset> = {
  DEVELOPER: {
    id: "developer-default",
    label: "Developer Layout",
    description: "Full system view with all widgets enabled.",
    role: "DEVELOPER",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "leaderboard", widgetId: "leaderboard", colSpan: 2, rowSpan: 1, size: "md", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 2 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 3 },
      { slotId: "skills", widgetId: "skills-sentiment", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 4 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 5 },
    ],
  },

  MANAGER: {
    id: "manager-default",
    label: "Manager Layout",
    description: "Department overview with project load and team metrics.",
    role: "MANAGER",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "leaderboard", widgetId: "leaderboard", colSpan: 2, rowSpan: 1, size: "md", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 2 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 3 },
      { slotId: "skills", widgetId: "skills-sentiment", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 4 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 5 },
    ],
  },

  SUPERVISOR: {
    id: "supervisor-default",
    label: "Supervisor Layout",
    description: "Shift operations with team and project load views.",
    role: "SUPERVISOR",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 2 },
      { slotId: "skills", widgetId: "skills-sentiment", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 3 },
    ],
  },

  ENGINEER: {
    id: "engineer-default",
    label: "Engineer Layout",
    description: "Project manifest and lifecycle operations.",
    role: "ENGINEER",
    slots: [
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 0 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
    ],
  },

  TEAM_LEAD: {
    id: "team-lead-default",
    label: "Team Lead Layout",
    description: "Team assignments and scheduling.",
    role: "TEAM_LEAD",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "leaderboard", widgetId: "leaderboard", colSpan: 2, rowSpan: 1, size: "md", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 2 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 3 },
      { slotId: "skills", widgetId: "skills-sentiment", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 4 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 1, rowSpan: 1, size: "sm", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 5 },
    ],
  },

  QA: {
    id: "qa-default",
    label: "QA Layout",
    description: "Quality verification and stage approval.",
    role: "QA",
    slots: [
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 2, rowSpan: 1, size: "md", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 1 },
    ],
  },

  BRANDER: {
    id: "brander-default",
    label: "Brander Layout",
    description: "Branding workspace and labeling assignments.",
    role: "BRANDER",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 2, rowSpan: 1, size: "md", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 2 },
    ],
  },

  ASSEMBLER: {
    id: "assembler-default",
    label: "Assembler Layout",
    description: "Personal assignments and active work.",
    role: "ASSEMBLER",
    slots: [
      { slotId: "timer", widgetId: "overview-timer", colSpan: 4, rowSpan: 1, size: "full", viewMode: "standard", visible: true, collapsed: false, pinned: true, order: 0 },
      { slotId: "assignments", widgetId: "assignments-list", colSpan: 2, rowSpan: 1, size: "lg", viewMode: "standard", visible: true, collapsed: false, pinned: false, order: 1 },
      { slotId: "training", widgetId: "training-inventory", colSpan: 2, rowSpan: 1, size: "md", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 2 },
    ],
  },

  GUEST: {
    id: "guest-default",
    label: "Guest Layout",
    description: "Read-only view.",
    role: "GUEST",
    slots: [
      { slotId: "project-overview", widgetId: "project-overview-chart", colSpan: 4, rowSpan: 1, size: "full", viewMode: "compact", visible: true, collapsed: false, pinned: false, order: 0 },
    ],
  },
};
