"use client";

import { useMemo, useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
    Boxes,
    Calendar,
    FolderKanban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageLayoutShell, { type RootNavItem } from "@/components/layout/layout";
import { useSession } from "@/hooks/use-session";
import type { DashboardAccess, UserSettings } from "@/types/user-settings";

// ============================================================================
// Types
// ============================================================================

type WorkspaceLayoutProps = {
    children: React.ReactNode;
};

/** Extended nav item with permission requirements */
interface PermissionedNavItem extends RootNavItem {
    /** Key from DashboardAccess that controls visibility */
    requiredAccess?: keyof DashboardAccess;
    /** Always show regardless of permissions */
    alwaysVisible?: boolean;
}

/** Workspace access context value */
interface WorkspaceAccessContextValue {
    /** User's dashboard access flags */
    dashboardAccess: DashboardAccess | null;
    /** Full user settings (includes granular permissions) */
    userSettings: UserSettings | null;
    /** Whether permissions are still loading */
    isLoading: boolean;
    /** Current badge number from URL */
    badgeNumber: string | null;
    /** Check if user has specific dashboard access */
    hasAccess: (key: keyof DashboardAccess) => boolean;
    /** Refresh user settings from API */
    refreshAccess: () => Promise<void>;
}

// ============================================================================
// Context for workspace-level access control
// ============================================================================

const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue | null>(null);

export function useWorkspaceAccess(): WorkspaceAccessContextValue {
    const ctx = useContext(WorkspaceAccessContext);
    if (!ctx) {
        throw new Error("useWorkspaceAccess must be used within WorkspaceLayout");
    }
    return ctx;
}

// ============================================================================
// Helpers
// ============================================================================

function extractBadgeNumber(pathname: string): string | null {
    const segments = pathname.split("/").filter(Boolean);
    // Look for a segment that looks like a badge number (numeric)
    return segments.find((segment) => /^\d+$/.test(segment)) || null;
}

function resolveActiveRoot(pathname: string): string {
  
    if (pathname.includes("/parts")) {
        return "parts";
    }
    if (pathname.includes("/projects")) {
        return "projects";
    }
    return "projects";
}

/** Default dashboard access (no special access) */
const DEFAULT_DASHBOARD_ACCESS: DashboardAccess = {
    projectSchedule: false,
    userAccess: false,
    catalogAccess: false,
    brandingAccess: false,
};

// ============================================================================
// Nav Items Configuration
// ============================================================================

function getNavItems(badgeNumber: string | null): PermissionedNavItem[] {
    if (!badgeNumber) {
        return [
            { id: "projects", href: "/projects", label: "Projects", icon: FolderKanban, alwaysVisible: true },
        ];
    }

    return [
     
        {
            id: "projects",
            href: `/${badgeNumber}/projects`,
            label: "Projects",
            icon: FolderKanban,
            alwaysVisible: true,
        },
        {
            id: "parts",
            href: `/${badgeNumber}/parts`,
            label: "Parts",
            icon: Boxes,
            alwaysVisible: true,
        },
    ];
}

/** Filter nav items based on user's dashboard access and role */
function filterNavItemsByAccess(
    items: PermissionedNavItem[],
    access: DashboardAccess | null,
    userRole: string | null
): RootNavItem[] {
    // Elevated roles always see all nav items
    const elevatedRoles = ["DEVELOPER", "TEAM_LEAD"];
    const hasElevatedRole = userRole && elevatedRoles.includes(userRole);
    
    // Basic roles (ASSEMBLER, etc.) only see Home and Projects by default
    // unless they have explicit permissions
    const basicRoles = ["ASSEMBLER"];
    const isBasicRole = userRole && basicRoles.includes(userRole);

    return items
        .filter((item) => {
            // Always visible items are shown for all roles
            if (item.alwaysVisible) return true;

            // Elevated roles see everything
            if (hasElevatedRole) return true;
            
            // Basic roles: hide ALL non-alwaysVisible items unless explicit permission
            if (isBasicRole) {
                // Only show if they have explicit permission in their settings
                if (!access) return false;
                if (item.requiredAccess) {
                    return access[item.requiredAccess] === true;
                }
                // No requiredAccess defined but not alwaysVisible - hide for basic roles
                return false;
            }

            // For other roles (BRANDER, etc.): check specific permissions
            if (!access) return false;

            if (item.requiredAccess) {
                return access[item.requiredAccess] === true;
            }

            return true;
        })
        .map(({ requiredAccess, alwaysVisible, ...navItem }) => navItem);
}

// ============================================================================
// Main Component
// ============================================================================

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
    const pathname = usePathname();
    const { user, isAuthenticated } = useSession();
    
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [isLoadingAccess, setIsLoadingAccess] = useState(true);
    
    const badgeNumber = useMemo(() => extractBadgeNumber(pathname), [pathname]);
    const activeRootId = useMemo(() => resolveActiveRoot(pathname), [pathname]);

    // Fetch user settings when badge/auth changes
    const fetchUserSettings = async () => {
        if (!user?.badge || !user?.currentShift) {
            setUserSettings(null);
            setIsLoadingAccess(false);
            return;
        }

        setIsLoadingAccess(true);
        try {
            const response = await fetch(
                `/api/users/${encodeURIComponent(user.badge)}/settings?shift=${encodeURIComponent(user.currentShift)}`,
                { cache: "no-store" }
            );
            
            if (response.ok) {
                const payload = (await response.json()) as { settings?: UserSettings };
                setUserSettings(payload.settings ?? null);
            } else {
                setUserSettings(null);
            }
        } catch (error) {
            console.error("[WorkspaceLayout] Failed to fetch user settings:", error);
            setUserSettings(null);
        } finally {
            setIsLoadingAccess(false);
        }
    };

    useEffect(() => {
        void fetchUserSettings();
    }, [user?.badge, user?.currentShift, user?.role]);

    // Compute dashboard access from settings or role
    const dashboardAccess = useMemo<DashboardAccess | null>(() => {
        // If we have explicit settings, use them
        if (userSettings?.dashboardAccess) {
            return userSettings.dashboardAccess;
        }

        // Fall back to role-based defaults
        if (user?.role) {
            const elevatedRoles = ["DEVELOPER", "TEAM_LEAD"];
            if (elevatedRoles.includes(user.role)) {
                return {
                    projectSchedule: true,
                    userAccess: true,
                    catalogAccess: true,
                    brandingAccess: true,
                };
            }
            
            if (user.role === "TEAM_LEAD") {
                return {
                    projectSchedule: true,
                    userAccess: false,
                    catalogAccess: false,
                    brandingAccess: false,
                };
            }
            
        
        }

        return DEFAULT_DASHBOARD_ACCESS;
    }, [userSettings?.dashboardAccess, user?.role]);

    // Build nav items filtered by access
    const allNavItems = useMemo(() => getNavItems(badgeNumber), [badgeNumber]);
    
    const navItems = useMemo<RootNavItem[]>(() => {
        return filterNavItemsByAccess(allNavItems, dashboardAccess, user?.role ?? null);
    }, [allNavItems, dashboardAccess, user?.role]);

    // Access context value
    const accessContextValue = useMemo<WorkspaceAccessContextValue>(() => ({
        dashboardAccess,
        userSettings,
        isLoading: isLoadingAccess,
        badgeNumber,
        hasAccess: (key: keyof DashboardAccess) => {
            // Elevated roles always have access
            const elevatedRoles = ["DEVELOPER", "TEAM_LEAD"];
            if (user?.role && elevatedRoles.includes(user.role)) {
                return true;
            }
            return dashboardAccess?.[key] === true;
        },
        refreshAccess: fetchUserSettings,
    }), [dashboardAccess, userSettings, isLoadingAccess, badgeNumber, user?.role]);

    return (
        <WorkspaceAccessContext.Provider value={accessContextValue}>
            <PageLayoutShell
                navItems={navItems}
                activeRootId={activeRootId}
            >
                {children}
            </PageLayoutShell>
        </WorkspaceAccessContext.Provider>
    );
}
