"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Shield,
    X,
    Loader2,
    Check,
    Calendar,
    Users,
    BookOpen,
    ChevronDown,
    Sparkles,
    FolderPlus,
    UserCheck,
    History,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { 
    UserSettings, 
    DashboardAccess,
    GranularPermissions,
    PermissionAuditEntry,
} from "@/types/user-settings";
import { 
    PERMISSION_LABELS,
    PERMISSION_GROUPS,
    PERMISSION_CASCADE_MAP,
} from "@/types/user-settings";
import type { UserWithSettings } from "./user-permissions-panel";

// ============================================================================
// Types
// ============================================================================

type AsideVariant = "access" | "skills";

interface UserPermissionsAsideProps {
    selectedUser: UserWithSettings;
    onClose: () => void;
    managerBadge: string;
    shift?: string;
    variant?: AsideVariant;
}

interface PermissionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    saving?: boolean;
    disabled?: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

function PermissionCard({
    icon,
    title,
    description,
    checked,
    onCheckedChange,
    saving,
    disabled,
}: PermissionCardProps) {
    return (
        <div className={cn(
            "flex items-start gap-3 rounded-xl border p-3.5 transition-all",
            checked ? "border-secondary/30 bg-secondary/5" : "border-border bg-card"
        )}>
            <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                checked ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"
            )}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <div className="shrink-0 pt-0.5">
                {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                ) : (
                    <Switch
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                        disabled={disabled || saving}
                    />
                )}
            </div>
        </div>
    );
}

function PermissionsSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border p-3.5">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-5 w-9 rounded-full" />
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// Permission Category Groups
// ============================================================================

interface PermissionCategory {
    id: string;
    label: string;
    icon: React.ReactNode;
    permissions: (keyof GranularPermissions)[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        id: "skills",
        label: "Skills Management",
        icon: <Sparkles className="h-4 w-4" />,
        permissions: ["canViewSkills", "canEditSkills", "canManageSkillDefinitions"],
    },
    {
        id: "permissions",
        label: "Permission Management",
        icon: <Shield className="h-4 w-4" />,
        permissions: ["canViewPermissions", "canGrantPermissions", "canDelegatePermissions"],
    },
    {
        id: "users",
        label: "User Management",
        icon: <Users className="h-4 w-4" />,
        permissions: ["canViewUsers", "canEditUsers", "canCreateUsers", "canDeactivateUsers"],
    },
    {
        id: "projects",
        label: "Project Management",
        icon: <FolderPlus className="h-4 w-4" />,
        permissions: ["canViewProjects", "canEditProjects", "canCreateProjects", "canArchiveProjects"],
    },
    {
        id: "assignments",
        label: "Assignment Management",
        icon: <UserCheck className="h-4 w-4" />,
        permissions: ["canAssignUsers", "canReassignTasks"],
    },
];

// ============================================================================
// Sub Components
// ============================================================================

function GranularPermissionItem({
    permKey,
    checked,
    onToggle,
    saving,
    disabled,
    hasDependents,
}: {
    permKey: keyof GranularPermissions;
    checked: boolean;
    onToggle: (enabled: boolean) => void;
    saving?: boolean;
    disabled?: boolean;
    hasDependents?: boolean;
}) {
    const meta = PERMISSION_LABELS[permKey];
    const dependents = PERMISSION_CASCADE_MAP[permKey];

    return (
        <div className={cn(
            "flex items-center justify-between gap-2 py-2 px-3 rounded-lg transition-colors",
            checked ? "bg-secondary/5" : "hover:bg-muted/50"
        )}>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{meta?.label ?? permKey}</span>
                    {hasDependents && checked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {dependents?.length} deps
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{meta?.description}</p>
            </div>
            {saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-secondary shrink-0" />
            ) : (
                <Switch
                    checked={checked}
                    onCheckedChange={onToggle}
                    disabled={disabled || saving}
                    className="shrink-0"
                />
            )}
        </div>
    );
}

function AuditEntryItem({ entry }: { entry: PermissionAuditEntry }) {
    const date = new Date(entry.timestamp);
    const formattedDate = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const formattedTime = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex items-start gap-2 py-2 text-xs">
            <div className={cn(
                "mt-0.5 h-2 w-2 rounded-full shrink-0",
                entry.changeType === "grant" ? "bg-green-500" :
                entry.changeType === "revoke" ? "bg-red-500" :
                entry.changeType === "cascade" ? "bg-amber-500" :
                "bg-blue-500"
            )} />
            <div className="flex-1 min-w-0">
                <p className="text-foreground">
                    <span className="font-medium capitalize">{entry.changeType}</span>
                    {" "}
                    <span className="text-muted-foreground">
                        {PERMISSION_LABELS[entry.permissionKey as keyof GranularPermissions]?.label ?? entry.permissionKey}
                    </span>
                </p>
                {entry.cascadedFrom && (
                    <p className="text-muted-foreground">
                        Cascaded from {PERMISSION_LABELS[entry.cascadedFrom as keyof GranularPermissions]?.label}
                    </p>
                )}
                <p className="text-muted-foreground">
                    by #{entry.performedBy} · {formattedDate} {formattedTime}
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserPermissionsAside({
    selectedUser,
    onClose,
    managerBadge,
    shift = "1st",
    variant = "access",
}: UserPermissionsAsideProps) {
    const { toast } = useToast();
    const color = getAvatarColor(selectedUser.badge);

    const [settings, setSettings] = useState<UserSettings | null>(selectedUser.settings ?? null);
    const [loading, setLoading] = useState(!selectedUser.settings);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    // In skills mode, expand skills by default; in access mode, show all collapsed initially
    const [expandedCategories, setExpandedCategories] = useState<string[]>(
        variant === "skills" ? ["skills"] : []
    );
    const [showAudit, setShowAudit] = useState(false);

    // Fetch settings if not loaded
    useEffect(() => {
        if (selectedUser.settings) {
            setSettings(selectedUser.settings);
            setLoading(false);
            return;
        }

        async function fetchSettings() {
            setLoading(true);
            try {
                const res = await fetch(`/api/users/${selectedUser.badge}/settings?shift=${shift}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data.settings);
                }
            } catch {
                toast({
                    title: "Failed to load settings",
                    description: "Could not load permission settings",
                    duration: 3000,
                });
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, [selectedUser.badge, selectedUser.settings, shift, toast]);

    // Toggle dashboard access
    const handleAccessToggle = useCallback(async (key: keyof DashboardAccess, enabled: boolean) => {
        setSaving(prev => ({ ...prev, [key]: true }));

        try {
            const res = await fetch(`/api/users/${selectedUser.badge}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shift,
                    action: "update-access",
                    key,
                    enabled,
                    performedBy: managerBadge,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                toast({
                    title: enabled ? "Access granted" : "Access revoked",
                    description: `${key === "projectSchedule" ? "Project Schedule" : key === "userAccess" ? "User Management" : "Catalog"} access ${enabled ? "enabled" : "disabled"}`,
                    duration: 2000,
                });
            } else {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }
        } catch (e) {
            toast({
                title: "Update failed",
                description: e instanceof Error ? e.message : "Could not update permission",
                duration: 3000,
            });
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    }, [selectedUser.badge, shift, managerBadge, toast]);

    // Toggle granular permission
    const handlePermissionToggle = useCallback(async (key: keyof GranularPermissions, enabled: boolean) => {
        setSaving(prev => ({ ...prev, [key]: true }));

        try {
            const res = await fetch(`/api/users/${selectedUser.badge}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shift,
                    action: "update-permission",
                    key,
                    enabled,
                    performedBy: managerBadge,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                
                const cascaded = data.auditEntries?.filter((e: PermissionAuditEntry) => e.changeType === "cascade");
                
                toast({
                    title: enabled ? "Permission granted" : "Permission revoked",
                    description: cascaded?.length > 0
                        ? `${PERMISSION_LABELS[key]?.label} and ${cascaded.length} dependent permission(s) updated`
                        : PERMISSION_LABELS[key]?.label,
                    duration: 2000,
                });
            } else {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }
        } catch (e) {
            toast({
                title: "Update failed",
                description: e instanceof Error ? e.message : "Could not update permission",
                duration: 3000,
            });
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    }, [selectedUser.badge, shift, managerBadge, toast]);

    // Apply preset
    const handleApplyPreset = useCallback(async (presetId: string) => {
        setSaving(prev => ({ ...prev, preset: true }));

        try {
            const res = await fetch(`/api/users/${selectedUser.badge}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shift,
                    action: "apply-preset",
                    presetId,
                    performedBy: managerBadge,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                
                const preset = PERMISSION_GROUPS.find(g => g.id === presetId);
                toast({
                    title: "Preset applied",
                    description: `Applied "${preset?.label}" permission preset`,
                    duration: 2000,
                });
            } else {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }
        } catch (e) {
            toast({
                title: "Update failed",
                description: e instanceof Error ? e.message : "Could not apply preset",
                duration: 3000,
            });
        } finally {
            setSaving(prev => ({ ...prev, preset: false }));
        }
    }, [selectedUser.badge, shift, managerBadge, toast]);

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const access = settings?.dashboardAccess;
    const permissions = settings?.permissions;
    const audit = settings?.permissionAudit ?? [];

    // Count enabled permissions
    const enabledAccessCount = access
        ? [access.projectSchedule, access.userAccess, access.catalogAccess].filter(Boolean).length
        : 0;
    const enabledPermCount = permissions
        ? Object.values(permissions).filter(Boolean).length
        : 0;

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11 shrink-0">
                        <AvatarFallback className={cn("text-sm font-semibold", color.bg, color.text)}>
                            {getAvatarInitials(selectedUser.fullName, selectedUser.preferredName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate">{selectedUser.fullName}</h3>
                        <p className="text-xs text-muted-foreground">Badge #{selectedUser.badge}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 -mr-2" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {loading ? (
                        <PermissionsSkeleton />
                    ) : settings ? (
                        <>
                            {/* Permission Preset Selector */}
                            <div className="space-y-2">
                                <label className="text-xs text-left font-medium text-muted-foreground">
                                    Quick Preset
                                </label>
                                <Select
                                    value={settings.permissionGroupId || undefined}
                                    onValueChange={handleApplyPreset}
                                    disabled={saving.preset}
                                >
                                    <SelectTrigger className="w-full py-3 px-3 border rounded-lg border-border bg-card text-left">
                                        <SelectValue placeholder="Select a permission preset..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PERMISSION_GROUPS.map(group => (
                                            <SelectItem key={group.id} value={group.id}>
                                                <div className="flex flex-col text-left py-1">
                                                    <span>{group.label}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {group.description}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {settings.permissionGroupId && (
                                    <p className="text-xs text-muted-foreground">
                                        Using preset: {PERMISSION_GROUPS.find(g => g.id === settings.permissionGroupId)?.label}
                                    </p>
                                )}
                            </div>

                            {/* Dashboard Access Section */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-secondary" />
                                    <h4 className="font-medium text-sm">Dashboard Access</h4>
                                </div>
                                <div className="space-y-2">
                                    <PermissionCard
                                        icon={<Calendar className="h-4 w-4" />}
                                        title="Project Schedule"
                                        description="View and manage project schedules"
                                        checked={access?.projectSchedule ?? false}
                                        onCheckedChange={(checked) => handleAccessToggle("projectSchedule", checked)}
                                        saving={saving.projectSchedule}
                                    />
                                    <PermissionCard
                                        icon={<Users className="h-4 w-4" />}
                                        title="User Management"
                                        description="Access user settings and permissions"
                                        checked={access?.userAccess ?? false}
                                        onCheckedChange={(checked) => handleAccessToggle("userAccess", checked)}
                                        saving={saving.userAccess}
                                    />
                                    <PermissionCard
                                        icon={<BookOpen className="h-4 w-4" />}
                                        title="Catalog Access"
                                        description="View and manage part catalogs"
                                        checked={access?.catalogAccess ?? false}
                                        onCheckedChange={(checked) => handleAccessToggle("catalogAccess", checked)}
                                        saving={saving.catalogAccess}
                                    />
                                </div>
                            </div>

                            {/* Granular Permissions */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm">Granular Permissions</h4>
                                </div>
                                <div className="space-y-1">
                                    {PERMISSION_CATEGORIES.map(category => (
                                        <Collapsible
                                            key={category.id}
                                            open={expandedCategories.includes(category.id)}
                                            onOpenChange={() => toggleCategory(category.id)}
                                        >
                                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    {category.icon}
                                                    <span className="text-sm font-medium">{category.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {category.permissions.filter(p => permissions?.[p]).length}/{category.permissions.length}
                                                    </Badge>
                                                    <ChevronDown className={cn(
                                                        "h-4 w-4 text-muted-foreground transition-transform",
                                                        expandedCategories.includes(category.id) && "rotate-180"
                                                    )} />
                                                </div>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="pl-2 border-l ml-4 mt-1 space-y-0.5">
                                                {category.permissions.map(permKey => (
                                                    <GranularPermissionItem
                                                        key={permKey}
                                                        permKey={permKey}
                                                        checked={permissions?.[permKey] ?? false}
                                                        onToggle={(enabled) => handlePermissionToggle(permKey, enabled)}
                                                        saving={saving[permKey]}
                                                        hasDependents={!!PERMISSION_CASCADE_MAP[permKey]}
                                                    />
                                                ))}
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </div>

                            {/* Audit Trail */}
                            {audit.length > 0 && (
                                <Collapsible open={showAudit} onOpenChange={setShowAudit}>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <History className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">Audit Trail</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {audit.length} changes
                                            </Badge>
                                            <ChevronDown className={cn(
                                                "h-4 w-4 text-muted-foreground transition-transform",
                                                showAudit && "rotate-180"
                                            )} />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2 border rounded-lg p-2 bg-muted/30">
                                        <div className="max-h-48 overflow-auto space-y-1">
                                            {audit.slice().reverse().slice(0, 10).map(entry => (
                                                <AuditEntryItem key={entry.id} entry={entry} />
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Shield className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">No settings found</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            {settings && (
                <div className="border-t px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {enabledAccessCount} access · {enabledPermCount} permissions
                    </span>
                    {(enabledAccessCount > 0 || enabledPermCount > 0) && (
                        <div className="flex items-center gap-1 text-xs text-secondary">
                            <Check className="h-3.5 w-3.5" />
                            <span>Active</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
