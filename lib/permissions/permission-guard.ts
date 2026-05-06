/**
 * Permission Guard Middleware
 * 
 * Server-side permission validation for API routes.
 * Validates that the requesting user has the required permissions
 * before allowing the request to proceed.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    type GranularPermissions,
    type DashboardAccess,
    type UserSettings,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
} from "@/types/user-settings";
import { type UserRole, USER_ROLE_HIERARCHY } from "@/types/d380-user-session";

// ============================================================================
// Types
// ============================================================================

export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    missingPermissions?: string[];
}

export interface RequestContext {
    /** Badge number of the requesting user */
    badge: string;
    /** Shift of the requesting user */
    shift: string;
    /** User role */
    role: UserRole;
    /** User settings (if loaded) */
    settings?: UserSettings;
}

export type PermissionRequirement = 
    | { type: "permission"; key: keyof GranularPermissions }
    | { type: "anyPermission"; keys: (keyof GranularPermissions)[] }
    | { type: "allPermissions"; keys: (keyof GranularPermissions)[] }
    | { type: "dashboardAccess"; key: keyof DashboardAccess }
    | { type: "minRole"; level: number }
    | { type: "role"; roles: UserRole[] }
    | { type: "custom"; check: (ctx: RequestContext) => boolean };

// ============================================================================
// Guard Functions
// ============================================================================

/**
 * Check if a request context meets a single permission requirement
 */
export function checkRequirement(
    ctx: RequestContext,
    requirement: PermissionRequirement
): PermissionCheckResult {
    switch (requirement.type) {
        case "permission":
            if (!hasPermission(ctx.settings, requirement.key)) {
                return {
                    allowed: false,
                    reason: `Missing permission: ${requirement.key}`,
                    missingPermissions: [requirement.key],
                };
            }
            return { allowed: true };

        case "anyPermission":
            if (!hasAnyPermission(ctx.settings, requirement.keys)) {
                return {
                    allowed: false,
                    reason: `Missing one of permissions: ${requirement.keys.join(", ")}`,
                    missingPermissions: requirement.keys,
                };
            }
            return { allowed: true };

        case "allPermissions":
            const missing = requirement.keys.filter(k => !hasPermission(ctx.settings, k));
            if (missing.length > 0) {
                return {
                    allowed: false,
                    reason: `Missing permissions: ${missing.join(", ")}`,
                    missingPermissions: missing,
                };
            }
            return { allowed: true };

        case "dashboardAccess":
            if (!ctx.settings?.dashboardAccess?.[requirement.key]) {
                return {
                    allowed: false,
                    reason: `Missing dashboard access: ${requirement.key}`,
                };
            }
            return { allowed: true };

        case "minRole":
            const userLevel = USER_ROLE_HIERARCHY[ctx.role] ?? 0;
            if (userLevel < requirement.level) {
                return {
                    allowed: false,
                    reason: `Insufficient role level: ${userLevel} < ${requirement.level}`,
                };
            }
            return { allowed: true };

        case "role":
            if (!requirement.roles.includes(ctx.role)) {
                return {
                    allowed: false,
                    reason: `Role not allowed: ${ctx.role}`,
                };
            }
            return { allowed: true };

        case "custom":
            if (!requirement.check(ctx)) {
                return {
                    allowed: false,
                    reason: "Custom check failed",
                };
            }
            return { allowed: true };

        default:
            return { allowed: true };
    }
}

/**
 * Check if a request context meets all permission requirements
 */
export function checkAllRequirements(
    ctx: RequestContext,
    requirements: PermissionRequirement[]
): PermissionCheckResult {
    const allMissing: string[] = [];
    
    for (const req of requirements) {
        const result = checkRequirement(ctx, req);
        if (!result.allowed) {
            if (result.missingPermissions) {
                allMissing.push(...result.missingPermissions);
            }
            return {
                allowed: false,
                reason: result.reason,
                missingPermissions: allMissing.length > 0 ? allMissing : undefined,
            };
        }
    }
    
    return { allowed: true };
}

/**
 * Check if a request context meets any of the permission requirements
 */
export function checkAnyRequirement(
    ctx: RequestContext,
    requirements: PermissionRequirement[]
): PermissionCheckResult {
    for (const req of requirements) {
        const result = checkRequirement(ctx, req);
        if (result.allowed) {
            return { allowed: true };
        }
    }
    
    return {
        allowed: false,
        reason: "None of the permission requirements were met",
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a permission requirement for a single granular permission
 */
export function requirePermission(key: keyof GranularPermissions): PermissionRequirement {
    return { type: "permission", key };
}

/**
 * Create a requirement for any of the specified permissions
 */
export function requireAnyPermission(keys: (keyof GranularPermissions)[]): PermissionRequirement {
    return { type: "anyPermission", keys };
}

/**
 * Create a requirement for all of the specified permissions
 */
export function requireAllPermissions(keys: (keyof GranularPermissions)[]): PermissionRequirement {
    return { type: "allPermissions", keys };
}

/**
 * Create a requirement for dashboard access
 */
export function requireDashboardAccess(key: keyof DashboardAccess): PermissionRequirement {
    return { type: "dashboardAccess", key };
}

/**
 * Create a requirement for minimum role level
 */
export function requireMinRole(level: number): PermissionRequirement {
    return { type: "minRole", level };
}

/**
 * Create a requirement for specific roles
 */
export function requireRoles(roles: UserRole[]): PermissionRequirement {
    return { type: "role", roles };
}

// ============================================================================
// Permission Guards for Common Operations
// ============================================================================

/** Permission requirements for user management operations */
export const USER_MANAGEMENT_GUARDS = {
    viewUsers: [requirePermission("canViewUsers")],
    editUsers: [requirePermission("canEditUsers")],
    createUsers: [requireAllPermissions(["canViewUsers", "canCreateUsers"])],
    deactivateUsers: [requireAllPermissions(["canEditUsers", "canDeactivateUsers"])],
};

/** Permission requirements for skill management operations */
export const SKILL_MANAGEMENT_GUARDS = {
    viewSkills: [requirePermission("canViewSkills")],
    editSkills: [requireAllPermissions(["canViewSkills", "canEditSkills"])],
    manageDefinitions: [requireAllPermissions(["canEditSkills", "canManageSkillDefinitions"])],
};

/** Permission requirements for permission management operations */
export const PERMISSION_MANAGEMENT_GUARDS = {
    viewPermissions: [requirePermission("canViewPermissions")],
    grantPermissions: [requireAllPermissions(["canViewPermissions", "canGrantPermissions"])],
    delegatePermissions: [requireAllPermissions(["canGrantPermissions", "canDelegatePermissions"])],
};

/** Permission requirements for project operations */
export const PROJECT_MANAGEMENT_GUARDS = {
    viewProjects: [requirePermission("canViewProjects")],
    editProjects: [requireAllPermissions(["canViewProjects", "canEditProjects"])],
    createProjects: [requireAllPermissions(["canEditProjects", "canCreateProjects"])],
    archiveProjects: [requireAllPermissions(["canEditProjects", "canArchiveProjects"])],
};

/** Permission requirements for assignment operations */
export const ASSIGNMENT_MANAGEMENT_GUARDS = {
    assignUsers: [requirePermission("canAssignUsers")],
    reassignTasks: [requireAllPermissions(["canAssignUsers", "canReassignTasks"])],
};

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Create an unauthorized response for permission failures
 */
export function createUnauthorizedResponse(result: PermissionCheckResult): NextResponse {
    return NextResponse.json(
        {
            error: "Permission denied",
            reason: result.reason,
            missingPermissions: result.missingPermissions,
        },
        { status: 403 }
    );
}

/**
 * Create an unauthenticated response
 */
export function createUnauthenticatedResponse(): NextResponse {
    return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
    );
}

// ============================================================================
// Session Context Helpers
// ============================================================================

/**
 * Extract request context from session cookie
 */
export async function getRequestContextFromSession(): Promise<RequestContext | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("d380_session");
        
        if (!sessionCookie?.value) {
            return null;
        }

        const session = JSON.parse(sessionCookie.value);
        
        if (!session?.badge || !session?.shift || !session?.role) {
            return null;
        }

        return {
            badge: session.badge,
            shift: session.shift,
            role: session.role as UserRole,
            settings: session.settings,
        };
    } catch {
        return null;
    }
}

/**
 * Load user settings for a request context
 */
export async function loadSettingsForContext(
    ctx: RequestContext
): Promise<RequestContext> {
    if (ctx.settings) return ctx;

    try {
        const { upsertUserSettings } = await import("@/lib/user-settings/share-user-settings-store");
        const settings = await upsertUserSettings(ctx.badge, ctx.shift);
        return { ...ctx, settings };
    } catch {
        return ctx;
    }
}

/**
 * Wrapper for API route handlers that require permission checks
 */
export function withPermissionGuard<T extends unknown[]>(
    requirements: PermissionRequirement[],
    handler: (ctx: RequestContext, ...args: T) => Promise<NextResponse>
) {
    return async (...args: T): Promise<NextResponse> => {
        const ctx = await getRequestContextFromSession();
        
        if (!ctx) {
            return createUnauthenticatedResponse();
        }

        const ctxWithSettings = await loadSettingsForContext(ctx);
        const result = checkAllRequirements(ctxWithSettings, requirements);
        
        if (!result.allowed) {
            return createUnauthorizedResponse(result);
        }

        return handler(ctxWithSettings, ...args);
    };
}
