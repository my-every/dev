/**
 * Navigation registry — default nav items and client-side icon registry.
 * Icon keys map to Lucide icons on the client; nothing React-component-shaped is stored here.
 */

import type { NavItemDescriptor } from "@/types/workspace-config";

// ─── Default nav items ────────────────────────────────────────────────────────

export const DEFAULT_NAV_ITEMS: NavItemDescriptor[] = [
  {
    id: "home",
    hrefTemplate: "/{badgeNumber}",
    label: "Home",
    iconKey: "LayoutDashboard",
    order: 0,
    enabled: true,
    visibilityMode: "always",
    minRoleLevel: 0,
    group: "workspace",
  },
  {
    id: "projects",
    hrefTemplate: "/{badgeNumber}/projects",
    label: "Projects",
    iconKey: "FolderKanban",
    order: 10,
    enabled: true,
    visibilityMode: "always",
    minRoleLevel: 0,
    group: "workspace",
  },
  {
    id: "parts",
    hrefTemplate: "/{badgeNumber}/parts",
    label: "Parts",
    iconKey: "Boxes",
    order: 20,
    enabled: true,
    visibilityMode: "always",
    minRoleLevel: 0,
    group: "workspace",
  },
  {
    id: "branding",
    hrefTemplate: "/{badgeNumber}/branding",
    label: "Branding",
    iconKey: "Tag",
    order: 30,
    enabled: true,
    visibilityMode: "role",
    minRoleLevel: 40,
    group: "workspace",
  },
  {
    id: "board",
    hrefTemplate: "/board",
    label: "Board",
    iconKey: "KanbanSquare",
    order: 40,
    enabled: true,
    visibilityMode: "role",
    minRoleLevel: 60,
    group: "workspace",
  },
  {
    id: "schedule",
    hrefTemplate: "/{badgeNumber}/schedule",
    label: "Schedule",
    iconKey: "CalendarDays",
    order: 50,
    enabled: true,
    visibilityMode: "permission",
    minRoleLevel: 60,
    requiredPermission: "canScheduleAssignments",
    group: "operations",
  },
  {
    id: "users",
    hrefTemplate: "/{badgeNumber}/users",
    label: "Users",
    iconKey: "Users",
    order: 60,
    enabled: true,
    visibilityMode: "permission",
    minRoleLevel: 80,
    requiredPermission: "canViewUsers",
    group: "admin",
  },
  {
    id: "engineer",
    hrefTemplate: "/{badgeNumber}/projects",
    label: "Engineer",
    iconKey: "Settings2",
    order: 70,
    enabled: true,
    visibilityMode: "permission",
    minRoleLevel: 70,
    requiredPermission: "canEditManifest",
    featureFlag: "workspace_engineer_tab",
    group: "admin",
  },
  {
    id: "system",
    hrefTemplate: "/system",
    label: "System",
    iconKey: "Terminal",
    order: 100,
    enabled: true,
    visibilityMode: "role",
    minRoleLevel: 200,
    group: "developer",
  },
];

// ─── Client-side icon registry ────────────────────────────────────────────────
// Import this on the client; never import Lucide in server-only code paths.

export const NAV_ICON_KEYS = [
  "LayoutDashboard",
  "FolderKanban",
  "Boxes",
  "Tag",
  "KanbanSquare",
  "CalendarDays",
  "Users",
  "Settings2",
  "Terminal",
  "Home",
  "Activity",
  "Layers",
  "GitBranch",
  "FileText",
  "Bell",
  "ChevronRight",
] as const;

export type NavIconKey = (typeof NAV_ICON_KEYS)[number];
