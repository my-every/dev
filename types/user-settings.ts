/**
 * User Settings Model
 *
 * Stored in Share/users/{shift}/{badge}/settings.json
 * Managed via /api/users/[badge]/settings
 */

/** Individual role permission that can be granted to a user */
export interface RolePermission {
    /** Role key matching the dashboard route (e.g. "developer", "manager") */
    role: string;
    /** Whether this role is enabled for the user */
    enabled: boolean;
    /** Who granted this permission (badge number) */
    grantedBy: string;
    /** When the permission was granted (ISO string) */
    grantedAt: string;
}

/** Dashboard feature access flags */
export interface DashboardAccess {
    /** Can access the project schedule view */
    projectSchedule: boolean;
    /** Can access the user access management view */
    userAccess: boolean;
    /** Can access the catalog management view */
    catalogAccess: boolean;
    /** Can access the branding workspace (Developer, Brander roles) */
    brandingAccess: boolean;
}

/** Granular permission flags for fine-grained access control */
export interface GranularPermissions {
    // Skills Management
    /** Can view skill assignments for users */
    canViewSkills: boolean;
    /** Can edit skill levels for users */
    canEditSkills: boolean;
    /** Can add new skills to the system */
    canManageSkillDefinitions: boolean;

    // Permission Management
    /** Can view permission settings for users */
    canViewPermissions: boolean;
    /** Can grant/revoke permissions for users */
    canGrantPermissions: boolean;
    /** Can grant the "canGrantPermissions" permission to others */
    canDelegatePermissions: boolean;

    // User Management
    /** Can view user profiles */
    canViewUsers: boolean;
    /** Can edit user profiles */
    canEditUsers: boolean;
    /** Can create new users */
    canCreateUsers: boolean;
    /** Can deactivate users */
    canDeactivateUsers: boolean;

    // Project Management
    /** Can view projects */
    canViewProjects: boolean;
    /** Can edit project details */
    canEditProjects: boolean;
    /** Can create new projects */
    canCreateProjects: boolean;
    /** Can delete/archive projects */
    canArchiveProjects: boolean;

    // Assignment Management
    /** Can assign users to tasks */
    canAssignUsers: boolean;
    /** Can reassign tasks between users */
    canReassignTasks: boolean;
}

/** Permission group/preset that bundles multiple permissions */
export interface PermissionGroup {
    /** Group identifier */
    id: string;
    /** Display name */
    label: string;
    /** Description */
    description: string;
    /** Dashboard access flags included */
    dashboardAccess: DashboardAccess;
    /** Granular permissions included */
    permissions: GranularPermissions;
    /** Role level required (from USER_ROLE_HIERARCHY) */
    minRoleLevel: number;
}

/** Default granular permissions (all false) */
export const DEFAULT_GRANULAR_PERMISSIONS: GranularPermissions = {
    canViewSkills: false,
    canEditSkills: false,
    canManageSkillDefinitions: false,
    canViewPermissions: false,
    canGrantPermissions: false,
    canDelegatePermissions: false,
    canViewUsers: false,
    canEditUsers: false,
    canCreateUsers: false,
    canDeactivateUsers: false,
    canViewProjects: false,
    canEditProjects: false,
    canCreateProjects: false,
    canArchiveProjects: false,
    canAssignUsers: false,
    canReassignTasks: false,
};

/** Permission presets for common role configurations */
export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: "viewer",
        label: "Viewer",
        description: "Read-only access to view data",
        dashboardAccess: {
            projectSchedule: false,
            userAccess: false,
            catalogAccess: false,
            brandingAccess: false,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canViewUsers: true,
            canViewProjects: true,
        },
        minRoleLevel: 0,
    },
    {
        id: "team-member",
        label: "Team Member",
        description: "Standard team member with basic access",
        dashboardAccess: {
            projectSchedule: false,
            userAccess: false,
            catalogAccess: false,
            brandingAccess: false,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canViewUsers: true,
            canViewProjects: true,
            canViewPermissions: true,
        },
        minRoleLevel: 20,
    },
    {
        id: "brander",
        label: "Brander",
        description: "Branding specialist with access to labeling and marking",
        dashboardAccess: {
            projectSchedule: false,
            userAccess: false,
            catalogAccess: false,
            brandingAccess: true,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canViewUsers: true,
            canViewProjects: true,
        },
        minRoleLevel: 40,
    },
    {
        id: "lead",
        label: "Team Lead",
        description: "Team lead with assignment and skill management",
        dashboardAccess: {
            projectSchedule: true,
            userAccess: false,
            catalogAccess: false,
            brandingAccess: false,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canEditSkills: true,
            canViewPermissions: true,
            canViewUsers: true,
            canViewProjects: true,
            canEditProjects: true,
            canAssignUsers: true,
            canReassignTasks: true,
        },
        minRoleLevel: 60,
    },
    {
        id: "supervisor",
        label: "Supervisor",
        description: "Supervisor with user and permission management",
        dashboardAccess: {
            projectSchedule: true,
            userAccess: true,
            catalogAccess: true,
            brandingAccess: true,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canEditSkills: true,
            canManageSkillDefinitions: true,
            canViewPermissions: true,
            canGrantPermissions: true,
            canViewUsers: true,
            canEditUsers: true,
            canViewProjects: true,
            canEditProjects: true,
            canCreateProjects: true,
            canAssignUsers: true,
            canReassignTasks: true,
        },
        minRoleLevel: 80,
    },
    {
        id: "admin",
        label: "Administrator",
        description: "Full access to all features and settings",
        dashboardAccess: {
            projectSchedule: true,
            userAccess: true,
            catalogAccess: true,
            brandingAccess: true,
        },
        permissions: {
            ...DEFAULT_GRANULAR_PERMISSIONS,
            canViewSkills: true,
            canEditSkills: true,
            canManageSkillDefinitions: true,
            canViewPermissions: true,
            canGrantPermissions: true,
            canDelegatePermissions: true,
            canViewUsers: true,
            canEditUsers: true,
            canCreateUsers: true,
            canDeactivateUsers: true,
            canViewProjects: true,
            canEditProjects: true,
            canCreateProjects: true,
            canArchiveProjects: true,
            canAssignUsers: true,
            canReassignTasks: true,
        },
        minRoleLevel: 100,
    },
];

/** Audit trail entry for permission changes */
export interface PermissionAuditEntry {
    /** Unique ID */
    id: string;
    /** Timestamp ISO string */
    timestamp: string;
    /** Badge of user who made the change */
    performedBy: string;
    /** Badge of user whose permissions changed */
    targetBadge: string;
    /** Type of change */
    changeType: "grant" | "revoke" | "cascade" | "preset-apply";
    /** Permission key that changed */
    permissionKey: string;
    /** Previous value */
    previousValue: boolean;
    /** New value */
    newValue: boolean;
    /** Reason for change (optional) */
    reason?: string;
    /** Related parent permission (for cascade changes) */
    cascadedFrom?: string;
}

/** Complete user settings document */
export interface UserSettings {
    /** Badge number this settings file belongs to */
    badge: string;
    /** Shift for this user */
    shift: string;
    /** Last time settings were modified (ISO string) */
    lastUpdated: string;
    /** Role permissions granted to this user */
    roles: RolePermission[];
    /** Dashboard feature access */
    dashboardAccess: DashboardAccess;
    /** Granular permissions for fine-grained control */
    permissions: GranularPermissions;
    /** Applied permission group ID (null if custom) */
    permissionGroupId: string | null;
    /** Permission audit trail */
    permissionAudit: PermissionAuditEntry[];
}

/** All available roles that can be granted */
export const AVAILABLE_ROLES = [
    { key: "developer", label: "Developer" },
    { key: "manager", label: "Manager" },
    { key: "supervisor", label: "Supervisor" },
    { key: "team-lead", label: "Team Lead" },
    { key: "qa", label: "Quality Assurance" },
    { key: "brander", label: "Brander" },
    { key: "assembler", label: "Assembler" },
] as const;

export type AvailableRoleKey = (typeof AVAILABLE_ROLES)[number]["key"];

/** Roles that are allowed to manage user access */
export const ACCESS_MANAGER_ROLES: AvailableRoleKey[] = [
    "developer",
    "manager",
    "supervisor",
];

export function createDefaultUserSettings(badge: string, shift: string): UserSettings {
    return {
        badge,
        shift,
        lastUpdated: new Date().toISOString(),
        roles: [],
        dashboardAccess: {
            projectSchedule: false,
            userAccess: false,
            catalogAccess: false,
            brandingAccess: false,
        },
        permissions: { ...DEFAULT_GRANULAR_PERMISSIONS },
        permissionGroupId: null,
        permissionAudit: [],
    };
}

/** Apply a permission group to generate dashboard access and granular permissions */
export function applyPermissionGroup(groupId: string): { 
    dashboardAccess: DashboardAccess; 
    permissions: GranularPermissions;
} | null {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    return {
        dashboardAccess: { ...group.dashboardAccess },
        permissions: { ...group.permissions },
    };
}

/** Check if a user has a specific granular permission */
export function hasPermission(
    settings: UserSettings | null | undefined,
    permission: keyof GranularPermissions
): boolean {
    if (!settings?.permissions) return false;
    return settings.permissions[permission] === true;
}

/** Check if user has any of the specified permissions */
export function hasAnyPermission(
    settings: UserSettings | null | undefined,
    permissions: (keyof GranularPermissions)[]
): boolean {
    return permissions.some(p => hasPermission(settings, p));
}

/** Check if user has all of the specified permissions */
export function hasAllPermissions(
    settings: UserSettings | null | undefined,
    permissions: (keyof GranularPermissions)[]
): boolean {
    return permissions.every(p => hasPermission(settings, p));
}

/** 
 * Cascade permission changes: when a parent permission is revoked,
 * automatically revoke dependent child permissions 
 */
export const PERMISSION_CASCADE_MAP: Partial<Record<keyof GranularPermissions, (keyof GranularPermissions)[]>> = {
    // If canViewSkills is revoked, also revoke editing skills
    canViewSkills: ["canEditSkills", "canManageSkillDefinitions"],
    // If canViewPermissions is revoked, also revoke granting permissions
    canViewPermissions: ["canGrantPermissions", "canDelegatePermissions"],
    // If canGrantPermissions is revoked, also revoke delegation
    canGrantPermissions: ["canDelegatePermissions"],
    // If canViewUsers is revoked, also revoke editing/creating users
    canViewUsers: ["canEditUsers", "canCreateUsers", "canDeactivateUsers"],
    // If canEditUsers is revoked, also revoke creating users
    canEditUsers: ["canCreateUsers"],
    // If canViewProjects is revoked, also revoke editing/creating projects
    canViewProjects: ["canEditProjects", "canCreateProjects", "canArchiveProjects"],
    // If canEditProjects is revoked, also revoke creating projects
    canEditProjects: ["canCreateProjects"],
    // If canAssignUsers is revoked, also revoke reassigning
    canAssignUsers: ["canReassignTasks"],
};

/** 
 * Apply cascade logic when a permission is revoked.
 * Returns the list of permissions that were also revoked.
 */
export function applyCascadeRevoke(
    permissions: GranularPermissions,
    revokedKey: keyof GranularPermissions
): { updated: GranularPermissions; cascaded: (keyof GranularPermissions)[] } {
    const updated = { ...permissions };
    const cascaded: (keyof GranularPermissions)[] = [];
    
    const dependents = PERMISSION_CASCADE_MAP[revokedKey];
    if (dependents) {
        for (const dep of dependents) {
            if (updated[dep]) {
                updated[dep] = false;
                cascaded.push(dep);
            }
        }
    }
    
    return { updated, cascaded };
}

/** Human-readable labels for granular permissions */
export const PERMISSION_LABELS: Record<keyof GranularPermissions, { label: string; description: string }> = {
    canViewSkills: { label: "View Skills", description: "View skill assignments for users" },
    canEditSkills: { label: "Edit Skills", description: "Modify skill levels for users" },
    canManageSkillDefinitions: { label: "Manage Skill Definitions", description: "Add or remove skill types from the system" },
    canViewPermissions: { label: "View Permissions", description: "View permission settings for users" },
    canGrantPermissions: { label: "Grant Permissions", description: "Grant or revoke permissions for users" },
    canDelegatePermissions: { label: "Delegate Permissions", description: "Grant the ability to manage permissions to others" },
    canViewUsers: { label: "View Users", description: "View user profiles and information" },
    canEditUsers: { label: "Edit Users", description: "Modify user profile information" },
    canCreateUsers: { label: "Create Users", description: "Create new user accounts" },
    canDeactivateUsers: { label: "Deactivate Users", description: "Deactivate user accounts" },
    canViewProjects: { label: "View Projects", description: "View project details and status" },
    canEditProjects: { label: "Edit Projects", description: "Modify project details" },
    canCreateProjects: { label: "Create Projects", description: "Create new projects" },
    canArchiveProjects: { label: "Archive Projects", description: "Archive or delete projects" },
    canAssignUsers: { label: "Assign Users", description: "Assign users to tasks" },
    canReassignTasks: { label: "Reassign Tasks", description: "Reassign tasks between users" },
};
