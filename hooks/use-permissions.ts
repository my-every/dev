/**
 * usePermissions Hook
 * 
 * Client-side hook for checking user permissions in React components.
 * Provides utilities for conditionally rendering UI based on permissions.
 */

"use client";

import { useMemo } from "react";
import type { 
    UserSettings, 
    DashboardAccess, 
    GranularPermissions 
} from "@/types/user-settings";
import { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions 
} from "@/types/user-settings";

// ============================================================================
// Types
// ============================================================================

export interface UsePermissionsResult {
    /** Check if user has a specific granular permission */
    can: (permission: keyof GranularPermissions) => boolean;
    /** Check if user has any of the specified permissions */
    canAny: (permissions: (keyof GranularPermissions)[]) => boolean;
    /** Check if user has all of the specified permissions */
    canAll: (permissions: (keyof GranularPermissions)[]) => boolean;
    /** Check if user has dashboard access */
    hasAccess: (access: keyof DashboardAccess) => boolean;
    /** The raw settings object */
    settings: UserSettings | null;
    /** Whether settings are loaded */
    isLoaded: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for checking user permissions
 * 
 * @example
 * ```tsx
 * const { can, hasAccess } = usePermissions(userSettings);
 * 
 * // Check granular permission
 * if (can("canEditSkills")) {
 *   // Show edit button
 * }
 * 
 * // Check dashboard access
 * if (hasAccess("userAccess")) {
 *   // Show user management link
 * }
 * ```
 */
export function usePermissions(settings: UserSettings | null | undefined): UsePermissionsResult {
    return useMemo(() => ({
        can: (permission: keyof GranularPermissions) => 
            hasPermission(settings, permission),
        
        canAny: (permissions: (keyof GranularPermissions)[]) => 
            hasAnyPermission(settings, permissions),
        
        canAll: (permissions: (keyof GranularPermissions)[]) => 
            hasAllPermissions(settings, permissions),
        
        hasAccess: (access: keyof DashboardAccess) => 
            settings?.dashboardAccess?.[access] ?? false,
        
        settings: settings ?? null,
        isLoaded: !!settings,
    }), [settings]);
}

// ============================================================================
// Utility Components
// ============================================================================

interface PermissionGateProps {
    /** Required permission(s) - can be a single permission or array */
    permission?: keyof GranularPermissions | (keyof GranularPermissions)[];
    /** If true, requires ALL permissions. If false (default), requires ANY */
    requireAll?: boolean;
    /** Required dashboard access */
    access?: keyof DashboardAccess;
    /** User settings */
    settings: UserSettings | null | undefined;
    /** Content to render if permission is granted */
    children: React.ReactNode;
    /** Content to render if permission is denied (optional) */
    fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on permissions
 * 
 * @example
 * ```tsx
 * <PermissionGate 
 *   permission="canEditSkills" 
 *   settings={userSettings}
 *   fallback={<p>You don't have permission</p>}
 * >
 *   <EditSkillsButton />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
    permission,
    requireAll = false,
    access,
    settings,
    children,
    fallback = null,
}: PermissionGateProps): React.ReactNode {
    const { can, canAny, canAll, hasAccess } = usePermissions(settings);

    // Check dashboard access if specified
    if (access && !hasAccess(access)) {
        return fallback;
    }

    // Check permissions if specified
    if (permission) {
        const permissions = Array.isArray(permission) ? permission : [permission];
        const hasRequired = requireAll 
            ? canAll(permissions) 
            : canAny(permissions);
        
        if (!hasRequired) {
            return fallback;
        }
    }

    return children;
}

// ============================================================================
// Permission Check Utilities for Specific Features
// ============================================================================

/** Check if user can manage skills */
export function canManageSkills(settings: UserSettings | null | undefined): boolean {
    return hasPermission(settings, "canEditSkills");
}

/** Check if user can manage permissions */
export function canManagePermissions(settings: UserSettings | null | undefined): boolean {
    return hasPermission(settings, "canGrantPermissions");
}

/** Check if user can manage users */
export function canManageUsers(settings: UserSettings | null | undefined): boolean {
    return hasPermission(settings, "canEditUsers");
}

/** Check if user can manage projects */
export function canManageProjects(settings: UserSettings | null | undefined): boolean {
    return hasPermission(settings, "canEditProjects");
}

/** Check if user can assign tasks */
export function canAssignTasks(settings: UserSettings | null | undefined): boolean {
    return hasPermission(settings, "canAssignUsers");
}
