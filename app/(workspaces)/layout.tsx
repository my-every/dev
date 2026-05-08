"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  Tag,
  Terminal,
  Users,
  KanbanSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import PageLayoutShell, { type RootNavItem } from "@/components/layout/layout";
import { useSession } from "@/hooks/use-session";
import type { DashboardAccess, UserSettings } from "@/types/user-settings";
import type { ResolvedNavItem, WorkspaceProcessPermissions, WorkspaceRole } from "@/types/workspace-config";

// ─── Client-side icon registry ────────────────────────────────────────────────
// Never import this from server paths. Map iconKey strings → Lucide components.

const NAV_ICON_REGISTRY: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Boxes,
  Tag,
  KanbanSquare,
  CalendarDays,
  Users,
  Settings2,
  Terminal,
};

function resolveNavIcon(iconKey: string): LucideIcon {
  return NAV_ICON_REGISTRY[iconKey] ?? FolderKanban;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type WorkspaceLayoutProps = {
  children: ReactNode;
};

export interface WorkspaceAccessContextValue {
  dashboardAccess: DashboardAccess | null;
  userSettings: UserSettings | null;
  role: WorkspaceRole;
  permissions: WorkspaceProcessPermissions | null;
  isLoading: boolean;
  badgeNumber: string | null;
  hasAccess: (key: keyof DashboardAccess) => boolean;
  hasPermission: (key: keyof WorkspaceProcessPermissions) => boolean;
  refreshAccess: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue | null>(null);

export function useWorkspaceAccess(): WorkspaceAccessContextValue {
  const ctx = useContext(WorkspaceAccessContext);
  if (!ctx) throw new Error("useWorkspaceAccess must be used within WorkspaceLayout");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBadgeNumber(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  return segments.find((s) => /^\d+$/.test(s)) ?? null;
}

function resolveActiveRoot(pathname: string): string {
  if (pathname.includes("/projects")) return "projects";
  if (pathname.includes("/parts")) return "parts";
  if (pathname.includes("/branding")) return "branding";
  if (pathname.includes("/users")) return "users";
  if (pathname === "/board" || pathname.startsWith("/board/")) return "board";
  if (pathname.includes("/schedule")) return "schedule";
  if (pathname === "/system" || pathname.startsWith("/system/")) return "system";
  return "home";
}

/** Convert API ResolvedNavItem → shell RootNavItem */
function toRootNavItem(item: ResolvedNavItem): RootNavItem {
  return {
    id: item.id,
    href: item.href,
    label: item.label,
    icon: resolveNavIcon(item.iconKey),
  };
}

/** Fallback nav used before async permissions load */
function buildFallbackNav(badgeNumber: string | null): RootNavItem[] {
  const base = badgeNumber ?? "";
  return [
    { id: "home", href: `/${base}`, label: "Home", icon: LayoutDashboard },
    { id: "projects", href: `/${base}/projects`, label: "Projects", icon: FolderKanban },
    { id: "parts", href: `/${base}/parts`, label: "Parts", icon: Boxes },
  ];
}

const DEFAULT_DASHBOARD_ACCESS: DashboardAccess = {
  projectSchedule: false,
  userAccess: false,
  catalogAccess: false,
  brandingAccess: false,
};

const DEFAULT_PROCESS_PERMISSIONS: WorkspaceProcessPermissions = {
  canEditManifest: false,
  canRecalculateManifest: false,
  canUploadLegals: false,
  canExportBrandLists: false,
  canExportWireLists: false,
  canConfigureExternalLocations: false,
  canAssignUsers: false,
  canReassignTasks: false,
  canScheduleAssignments: false,
  canManageWorkAreas: false,
  canManageShiftQueues: false,
  canVerifyStage: false,
  canApproveStage: false,
  canRejectStage: false,
  canReopenStage: false,
  canBlockAssignment: false,
  canViewUsers: false,
  canEditUsers: false,
  canGrantPermissions: false,
  canConfigureWorkspace: false,
  canManageFeatureFlags: false,
  canManageWidgetRegistry: false,
  canManageNavRegistry: false,
  canManageSystemConfig: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const pathname = usePathname();
  const { user } = useSession();

  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [resolvedNav, setResolvedNav] = useState<ResolvedNavItem[]>([]);
  const [permissions, setPermissions] = useState<WorkspaceProcessPermissions | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("ASSEMBLER");
  const [isLoading, setIsLoading] = useState(true);

  // Prefer the numeric segment from the URL (e.g. /29535/projects → "29535").
  // Fall back to the session user's own badge for routes without one (/board, /system, etc.)
  // so the home nav item always points to the correct badge workspace.
  const badgeNumber = useMemo(
    () => extractBadgeNumber(pathname) ?? user?.badge ?? null,
    [pathname, user?.badge],
  );
  const activeRootId = useMemo(() => resolveActiveRoot(pathname), [pathname]);
  const shift = user?.currentShift ?? "1st";

  // ── Load settings + nav + permissions in parallel ───────────────────────────

  const refreshAccess = useCallback(async () => {
    if (!badgeNumber) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [settingsRes, navRes, permRes] = await Promise.allSettled([
        fetch(
          `/api/users/${encodeURIComponent(badgeNumber)}/settings?shift=${encodeURIComponent(shift)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/workspaces/${encodeURIComponent(badgeNumber)}/navigation?shift=${encodeURIComponent(shift)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/workspaces/${encodeURIComponent(badgeNumber)}/permissions?shift=${encodeURIComponent(shift)}`,
          { cache: "no-store" },
        ),
      ]);

      if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
        const payload = (await settingsRes.value.json()) as { settings?: UserSettings };
        setUserSettings(payload.settings ?? null);
      }

      if (navRes.status === "fulfilled" && navRes.value.ok) {
        const payload = (await navRes.value.json()) as {
          nav?: ResolvedNavItem[];
          role?: WorkspaceRole;
        };
        setResolvedNav(payload.nav ?? []);
        if (payload.role) setRole(payload.role);
      }

      if (permRes.status === "fulfilled" && permRes.value.ok) {
        const payload = (await permRes.value.json()) as {
          permissions?: WorkspaceProcessPermissions;
          role?: WorkspaceRole;
        };
        if (payload.permissions) setPermissions(payload.permissions);
        if (payload.role) setRole(payload.role);
      }
    } finally {
      setIsLoading(false);
    }
  }, [badgeNumber, shift]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  // ── Nav items for shell ─────────────────────────────────────────────────────

  const navItems = useMemo<RootNavItem[]>(() => {
    if (resolvedNav.length > 0) return resolvedNav.map(toRootNavItem);
    return buildFallbackNav(badgeNumber);
  }, [resolvedNav, badgeNumber]);

  // ── dashboardAccess shim (legacy compatibility) ─────────────────────────────

  const dashboardAccess = useMemo<DashboardAccess>(() => {
    if (userSettings?.dashboardAccess) return userSettings.dashboardAccess;
    // Derive from resolved role for backwards compat
    const isElevated = role === "DEVELOPER" || role === "MANAGER" || role === "SUPERVISOR";
    if (isElevated) {
      return { projectSchedule: true, userAccess: true, catalogAccess: true, brandingAccess: true };
    }
    return DEFAULT_DASHBOARD_ACCESS;
  }, [userSettings?.dashboardAccess, role]);

  // ── Access context ──────────────────────────────────────────────────────────

  const accessContextValue = useMemo<WorkspaceAccessContextValue>(
    () => ({
      dashboardAccess,
      userSettings,
      role,
      permissions,
      isLoading,
      badgeNumber,
      hasAccess: (key) => dashboardAccess?.[key] === true,
      hasPermission: (key) => permissions?.[key] === true,
      refreshAccess,
    }),
    [dashboardAccess, userSettings, role, permissions, isLoading, badgeNumber, refreshAccess],
  );

  return (
    <WorkspaceAccessContext.Provider value={accessContextValue}>
      <PageLayoutShell navItems={navItems} activeRootId={activeRootId} defaultSidebarOpen={false}>
        {children}
      </PageLayoutShell>
    </WorkspaceAccessContext.Provider>
  );
}
