"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Shield,
    Sparkles,
    Loader2,
    Search,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    SlidersHorizontal,
    Eye,
    EyeOff,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import AnimatedTabs from "@/components/ui/animated-tabs";
import { useToast } from "@/hooks/use-toast";
import { useLayoutUI } from "@/components/layout/layout-context";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { UserSettings } from "@/types/user-settings";
import type { TeamMember } from "./user-detail-aside";

// ============================================================================
// Types
// ============================================================================

type PanelVariant = "access" | "skills";

interface UserPermissionsPanelProps {
    managerBadge: string;
    managerShift?: string;
    roleLabel?: string;
    onUserSelect?: (user: UserWithSettings | null) => void;
    selectedBadge?: string | null;
    variant?: PanelVariant;
}

export interface UserWithSettings extends TeamMember {
    settings?: UserSettings | null;
    settingsLoading?: boolean;
}

type SortDir = "asc" | "desc";

const SHIFT_TABS = [
    { id: "1st", label: "1st Shift" },
    { id: "2nd", label: "2nd Shift" },
];

// ============================================================================
// Sub-Components
// ============================================================================

function AccessSwitch({
    checked,
    onCheckedChange,
    disabled,
    label,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className="scale-75"
            />
            <span className="sr-only">{label}</span>
        </div>
    );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function SkeletonRows({ 
    count = 6,
    columns = { schedule: true, userMgmt: true, catalog: false }
}: { 
    count?: number;
    columns?: { schedule: boolean; userMgmt: boolean; catalog: boolean };
}) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    {columns.schedule && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                    {columns.userMgmt && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                    {columns.catalog && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                </TableRow>
            ))}
        </>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserPermissionsPanel({
    managerBadge,
    managerShift = "1st",
    roleLabel = "Manager",
    onUserSelect,
    selectedBadge,
    variant = "access",
}: UserPermissionsPanelProps) {
    const { toast } = useToast();
    const { openAside, closeAside } = useLayoutUI();

    // State
    const [activeShift, setActiveShift] = useState(managerShift);
    const [users, setUsers] = useState<UserWithSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string>("fullName");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [saving, setSaving] = useState<Set<string>>(new Set());
    
    // Column visibility state - hide access columns when in skills mode
    const [visibleColumns, setVisibleColumns] = useState({
        schedule: variant === "access",
        userMgmt: variant === "access",
        catalog: false, // Hidden by default
    });
    
    const toggleColumn = (col: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    // Fetch users
    const fetchUsers = useCallback(async (shift: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/users/team?shift=${shift}`);
            if (res.ok) {
                const data = await res.json();
                const members: TeamMember[] = data.members ?? [];
                setUsers(members.map(m => ({ ...m, settings: null, settingsLoading: false })));
            } else {
                setUsers([]);
            }
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers(activeShift);
    }, [activeShift, fetchUsers]);

    // Load settings for a specific user
    const loadUserSettings = useCallback(async (badge: string) => {
        setUsers(prev => prev.map(u =>
            u.badge === badge ? { ...u, settingsLoading: true } : u
        ));

        try {
            const res = await fetch(`/api/users/${badge}/settings?shift=${activeShift}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(prev => prev.map(u =>
                    u.badge === badge ? { ...u, settings: data.settings, settingsLoading: false } : u
                ));
            }
        } catch {
            toast({
                title: "Failed to load settings",
                description: `Could not load settings for badge #${badge}`,
                duration: 3000,
            });
        } finally {
            setUsers(prev => prev.map(u =>
                u.badge === badge ? { ...u, settingsLoading: false } : u
            ));
        }
    }, [activeShift, toast]);

    // Toggle dashboard access
    const handleToggleAccess = useCallback(async (
        badge: string,
        key: "projectSchedule" | "userAccess" | "catalogAccess",
        enabled: boolean
    ) => {
        setSaving(prev => new Set(prev).add(`${badge}-${key}`));

        try {
            const res = await fetch(`/api/users/${badge}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shift: activeShift,
                    action: "update-access",
                    key,
                    enabled,
                    performedBy: managerBadge,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setUsers(prev => prev.map(u =>
                    u.badge === badge ? { ...u, settings: data.settings } : u
                ));
                toast({
                    title: enabled ? "Access granted" : "Access revoked",
                    duration: 2000,
                });
            } else {
                throw new Error("Failed to update");
            }
        } catch {
            toast({
                title: "Update failed",
                description: "Could not update access permission",
                duration: 3000,
            });
        } finally {
            setSaving(prev => {
                const next = new Set(prev);
                next.delete(`${badge}-${key}`);
                return next;
            });
        }
    }, [activeShift, managerBadge, toast]);

    // Sorting
    const handleSort = useCallback((key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }, [sortKey]);

    // Filter and sort users
    const filteredUsers = useMemo(() => {
        let list = [...users];

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(u =>
                u.fullName.toLowerCase().includes(q) ||
                u.badge.includes(q) ||
                u.role.toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            let av: string | number = "";
            let bv: string | number = "";

            switch (sortKey) {
                case "fullName":
                    av = a.fullName.toLowerCase();
                    bv = b.fullName.toLowerCase();
                    break;
                case "badge":
                    av = a.badge;
                    bv = b.badge;
                    break;
                case "role":
                    av = a.role.toLowerCase();
                    bv = b.role.toLowerCase();
                    break;
            }

            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    }, [users, search, sortKey, sortDir]);

    // Select user - toggle aside open/close
    const handleSelectUser = useCallback((user: UserWithSettings) => {
        // If clicking same user, deselect and close aside
        if (selectedBadge === user.badge) {
            onUserSelect?.(null);
            closeAside();
            return;
        }
        
        // Select user and open aside
        onUserSelect?.(user);
        openAside();
        
        if (!user.settings && !user.settingsLoading) {
            loadUserSettings(user.badge);
        }
    }, [loadUserSettings, onUserSelect, selectedBadge, openAside, closeAside]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        {variant === "skills" ? (
                            <Sparkles className="h-4.5 w-4.5 text-primary" />
                        ) : (
                            <Shield className="h-4.5 w-4.5 text-primary" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">
                            {variant === "skills" ? "User Skills" : "User Permissions"}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {variant === "skills" 
                                ? "Manage user skill assignments and levels"
                                : "Manage dashboard access permissions"
                            }
                        </p>
                    </div>
                </div>

                <AnimatedTabs
                    tabs={SHIFT_TABS}
                    activeTab={activeShift}
                    onChange={setActiveShift}
                    variant="segment"
                    className="w-48"
                />
            </div>

            {/* Search and Column Visibility */}
            <div className="flex items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, badge, or role..."
                        className="pl-9 h-9"
                    />
                </div>
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            <span className="hidden sm:inline">Columns</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" align="end">
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">Toggle Columns</p>
                            <div className="space-y-2">
                                {variant === "access" && (
                                    <>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={visibleColumns.schedule}
                                                onCheckedChange={() => toggleColumn("schedule")}
                                            />
                                            <span className="text-sm">Schedule</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={visibleColumns.userMgmt}
                                                onCheckedChange={() => toggleColumn("userMgmt")}
                                            />
                                            <span className="text-sm">User Mgmt</span>
                                        </label>
                                    </>
                                )}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={visibleColumns.catalog}
                                        onCheckedChange={() => toggleColumn("catalog")}
                                    />
                                    <span className="text-sm">Catalog</span>
                                </label>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-380px)]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("fullName")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Name
                                        <SortIcon active={sortKey === "fullName"} dir={sortDir} />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 transition-colors w-20"
                                    onClick={() => handleSort("badge")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Badge
                                        <SortIcon active={sortKey === "badge"} dir={sortDir} />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("role")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Role
                                        <SortIcon active={sortKey === "role"} dir={sortDir} />
                                    </div>
                                </TableHead>
                                {visibleColumns.schedule && (
                                    <TableHead className="text-center w-24">Schedule</TableHead>
                                )}
                                {visibleColumns.userMgmt && (
                                    <TableHead className="text-center w-24">User Mgmt</TableHead>
                                )}
                                {visibleColumns.catalog && (
                                    <TableHead className="text-center w-24">Catalog</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <SkeletonRows columns={visibleColumns} />
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell 
                                        colSpan={3 + (visibleColumns.schedule ? 1 : 0) + (visibleColumns.userMgmt ? 1 : 0) + (visibleColumns.catalog ? 1 : 0)} 
                                        className="h-32 text-center text-muted-foreground"
                                    >
                                        No users found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const color = getAvatarColor(user.badge);
                                    const isSelected = selectedBadge === user.badge;

                                    return (
                                        <TableRow
                                            key={user.badge}
                                            className={cn(
                                                "cursor-pointer transition-colors",
                                                isSelected && "bg-primary/5"
                                            )}
                                            onClick={() => handleSelectUser(user)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar className="h-7 w-7 shrink-0">
                                                        <AvatarFallback className={cn("text-[10px] font-semibold", color.bg, color.text)}>
                                                            {getAvatarInitials(user.fullName, user.preferredName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate font-medium text-sm">{user.fullName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">{user.badge}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {user.role.replace(/_/g, " ")}
                                                </Badge>
                                            </TableCell>
                                            {visibleColumns.schedule && (
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    {user.settingsLoading ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                                                    ) : user.settings ? (
                                                        <AccessSwitch
                                                            checked={user.settings.dashboardAccess.projectSchedule}
                                                            onCheckedChange={(checked) => handleToggleAccess(user.badge, "projectSchedule", checked)}
                                                            disabled={saving.has(`${user.badge}-projectSchedule`)}
                                                            label="Project Schedule Access"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.userMgmt && (
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    {user.settingsLoading ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                                                    ) : user.settings ? (
                                                        <AccessSwitch
                                                            checked={user.settings.dashboardAccess.userAccess}
                                                            onCheckedChange={(checked) => handleToggleAccess(user.badge, "userAccess", checked)}
                                                            disabled={saving.has(`${user.badge}-userAccess`)}
                                                            label="User Access Management"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.catalog && (
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    {user.settingsLoading ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                                                    ) : user.settings ? (
                                                        <AccessSwitch
                                                            checked={user.settings.dashboardAccess.catalogAccess}
                                                            onCheckedChange={(checked) => handleToggleAccess(user.badge, "catalogAccess", checked)}
                                                            disabled={saving.has(`${user.badge}-catalogAccess`)}
                                                            label="Catalog Access"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-muted-foreground">
                {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
            </div>
        </div>
    );
}
