"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    UserCog,
    Shield,
    Loader2,
    Search,
    ChevronRight,
    Check,
    X,
    Plus,
    Trash2,
    Sparkles,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import AnimatedTabs from "@/components/ui/animated-tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { UserSettings } from "@/types/user-settings";
import { AVAILABLE_ROLES } from "@/types/user-settings";
import type { TeamMember } from "./user-detail-aside";

// ============================================================================
// Types
// ============================================================================

interface UserAccessManagerProps {
    managerBadge: string;
    managerShift?: string;
    roleLabel?: string;
}

interface UserWithSettings extends TeamMember {
    settings?: UserSettings | null;
    settingsLoading?: boolean;
}

type SortDir = "asc" | "desc";

// ============================================================================
// Skill Definitions
// ============================================================================

const DEFAULT_SKILLS = [
    { id: "brandList", label: "Brand List", description: "Cable and component labeling" },
    { id: "branding", label: "Branding", description: "Product marking and identification" },
    { id: "buildUp", label: "Build Up", description: "Initial assembly and structure" },
    { id: "wiring", label: "Wiring", description: "Electrical wiring and connections" },
    { id: "wiringIpv", label: "Wiring IPV", description: "In-process verification for wiring" },
    { id: "boxBuild", label: "Box Build", description: "Enclosure assembly" },
    { id: "crossWire", label: "Cross Wire", description: "Cross-wiring and interconnects" },
    { id: "test", label: "Test", description: "Testing and quality checks" },
    { id: "pwrCheck", label: "PWR Check", description: "Power verification" },
    { id: "biq", label: "BIQ", description: "Built-in quality processes" },
    { id: "greenChange", label: "Green Change", description: "ECO and change implementation" },
];

const SKILL_LEVELS = [
    { value: 0, label: "None", color: "bg-muted text-muted-foreground" },
    { value: 1, label: "Trainee", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    { value: 2, label: "Basic", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    { value: 3, label: "Proficient", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { value: 4, label: "Expert", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
];

const SHIFT_TABS = [
    { id: "1st", label: "1st Shift" },
    { id: "2nd", label: "2nd Shift" },
];

// ============================================================================
// Sub-Components
// ============================================================================

function SkillBadge({ level }: { level: number }) {
    const config = SKILL_LEVELS[level] ?? SKILL_LEVELS[0];
    return (
        <Badge variant="outline" className={cn("text-[10px] font-medium", config.color)}>
            {config.label}
        </Badge>
    );
}

function SkillLevelSelector({
    value,
    onChange,
    disabled,
}: {
    value: number;
    onChange: (level: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex gap-1">
            {SKILL_LEVELS.map((level) => (
                <button
                    key={level.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(level.value)}
                    className={cn(
                        "h-6 w-6 rounded-full text-[10px] font-semibold transition-all",
                        "hover:ring-2 hover:ring-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        value === level.value
                            ? "ring-2 ring-primary bg-primary text-primary-foreground"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                    title={level.label}
                >
                    {level.value}
                </button>
            ))}
        </div>
    );
}

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

function SkeletonRows({ count = 6 }: { count?: number }) {
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
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
            ))}
        </>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserAccessManager({
    managerBadge,
    managerShift = "1st",
    roleLabel = "Manager",
}: UserAccessManagerProps) {
    const { toast } = useToast();

    // State
    const [activeShift, setActiveShift] = useState(managerShift);
    const [users, setUsers] = useState<UserWithSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string>("fullName");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [selectedUser, setSelectedUser] = useState<UserWithSettings | null>(null);
    const [saving, setSaving] = useState<Set<string>>(new Set());

    // Skills management
    const [skills, setSkills] = useState(DEFAULT_SKILLS);
    const [newSkillDialog, setNewSkillDialog] = useState(false);
    const [newSkillId, setNewSkillId] = useState("");
    const [newSkillLabel, setNewSkillLabel] = useState("");
    const [newSkillDescription, setNewSkillDescription] = useState("");
    const [deleteSkillDialog, setDeleteSkillDialog] = useState<string | null>(null);

    // Fetch users
    const fetchUsers = useCallback(async (shift: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/users/team?shift=${shift}`);
            if (res.ok) {
                const data = await res.json();
                const members: TeamMember[] = data.members ?? [];
                // Initialize with settings as null - will load on expand
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

    // Update user skill level
    const handleUpdateSkill = useCallback(async (badge: string, skillId: string, level: number) => {
        setSaving(prev => new Set(prev).add(`${badge}-skill-${skillId}`));

        try {
            // Get current skills
            const user = users.find(u => u.badge === badge);
            const currentSkills = { ...(user?.skills ?? {}) };

            if (level === 0) {
                delete currentSkills[skillId];
            } else {
                currentSkills[skillId] = level;
            }

            const res = await fetch(`/api/users/${badge}/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skills: currentSkills }),
            });

            if (res.ok) {
                const { profile } = await res.json();
                setUsers(prev => prev.map(u =>
                    u.badge === badge ? { ...u, skills: profile.skills } : u
                ));

                // Update selected user if it's the same
                if (selectedUser?.badge === badge) {
                    setSelectedUser(prev => prev ? { ...prev, skills: profile.skills } : null);
                }
            } else {
                throw new Error("Failed to update");
            }
        } catch {
            toast({
                title: "Update failed",
                description: "Could not update skill level",
                duration: 3000,
            });
        } finally {
            setSaving(prev => {
                const next = new Set(prev);
                next.delete(`${badge}-skill-${skillId}`);
                return next;
            });
        }
    }, [users, selectedUser, toast]);

    // Add new skill
    const handleAddSkill = useCallback(() => {
        if (!newSkillId.trim() || !newSkillLabel.trim()) {
            toast({ title: "Please fill in skill ID and label", duration: 2000 });
            return;
        }

        const id = newSkillId.trim().replace(/\s+/g, "").toLowerCase();
        if (skills.some(s => s.id === id)) {
            toast({ title: "Skill ID already exists", duration: 2000 });
            return;
        }

        setSkills(prev => [...prev, {
            id,
            label: newSkillLabel.trim(),
            description: newSkillDescription.trim() || newSkillLabel.trim(),
        }]);

        setNewSkillDialog(false);
        setNewSkillId("");
        setNewSkillLabel("");
        setNewSkillDescription("");

        toast({ title: "Skill added", description: `${newSkillLabel.trim()} is now available`, duration: 2000 });
    }, [newSkillId, newSkillLabel, newSkillDescription, skills, toast]);

    // Delete skill
    const handleDeleteSkill = useCallback((skillId: string) => {
        setSkills(prev => prev.filter(s => s.id !== skillId));
        setDeleteSkillDialog(null);
        toast({ title: "Skill removed", duration: 2000 });
    }, [toast]);

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

        // Search
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(u =>
                u.fullName.toLowerCase().includes(q) ||
                u.badge.includes(q) ||
                u.role.toLowerCase().includes(q)
            );
        }

        // Sort
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
                case "skillCount":
                    av = Object.keys(a.skills ?? {}).length;
                    bv = Object.keys(b.skills ?? {}).length;
                    break;
            }

            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    }, [users, search, sortKey, sortDir]);

    // Select user for detail panel
    const handleSelectUser = useCallback((user: UserWithSettings) => {
        setSelectedUser(user);
        if (!user.settings && !user.settingsLoading) {
            loadUserSettings(user.badge);
        }
    }, [loadUserSettings]);

    return (
        <div className="flex h-full gap-4">
            {/* Main Content */}
            <div className="flex-1 space-y-4 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <UserCog className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">User Access & Skills</h2>
                            <p className="text-xs text-muted-foreground">
                                Manage permissions and skill assignments
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

                {/* Search & Actions */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, badge, or role..."
                            className="pl-9 h-9"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNewSkillDialog(true)}
                        className="gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Skill
                    </Button>
                </div>

                {/* Users Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-320px)]">
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
                                    <TableHead className="text-center w-24">Schedule</TableHead>
                                    <TableHead className="text-center w-24">User Mgmt</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort("skillCount")}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            Skills
                                            <SortIcon active={sortKey === "skillCount"} dir={sortDir} />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <SkeletonRows />
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No users found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => {
                                        const color = getAvatarColor(user.badge);
                                        const skillCount = Object.keys(user.skills ?? {}).length;
                                        const isSelected = selectedUser?.badge === user.badge;

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
                                                <TableCell>
                                                    {skillCount > 0 ? (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {skillCount} skill{skillCount !== 1 ? "s" : ""}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">None</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className={cn(
                                                        "h-4 w-4 text-muted-foreground transition-transform",
                                                        isSelected && "rotate-90"
                                                    )} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</span>
                    <span>{skills.length} skills available</span>
                </div>
            </div>

            {/* Skills Management Side Panel */}
            <AnimatePresence mode="wait">
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-80 shrink-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className={cn(
                                            "text-xs font-semibold",
                                            getAvatarColor(selectedUser.badge).bg,
                                            getAvatarColor(selectedUser.badge).text
                                        )}>
                                            {getAvatarInitials(selectedUser.fullName, selectedUser.preferredName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-sm">{selectedUser.fullName}</p>
                                        <p className="text-xs text-muted-foreground">Badge #{selectedUser.badge}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setSelectedUser(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Skills List */}
                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold text-sm">Skills Assignment</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Set proficiency levels for each skill (0-4)
                            </p>

                            <div className="space-y-2 mt-3">
                                {skills.map((skill) => {
                                    const currentLevel = (selectedUser.skills as Record<string, number>)?.[skill.id] ?? 0;
                                    const isSaving = saving.has(`${selectedUser.badge}-skill-${skill.id}`);

                                    return (
                                        <div
                                            key={skill.id}
                                            className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1 mr-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-medium truncate">{skill.label}</p>
                                                    {isSaving && (
                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                    {skill.description}
                                                </p>
                                            </div>
                                            <SkillLevelSelector
                                                value={currentLevel}
                                                onChange={(level) => handleUpdateSkill(selectedUser.badge, skill.id, level)}
                                                disabled={isSaving}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Skill Summary */}
                        <div className="p-4 border-t border-border bg-muted/30">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Total Skills</span>
                                <span className="font-semibold">
                                    {Object.values(selectedUser.skills ?? {}).filter(v => v > 0).length} / {skills.length}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Skill Dialog */}
            <Dialog open={newSkillDialog} onOpenChange={setNewSkillDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Skill</DialogTitle>
                        <DialogDescription>
                            Create a new skill that can be assigned to users.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Skill ID</Label>
                            <Input
                                value={newSkillId}
                                onChange={(e) => setNewSkillId(e.target.value)}
                                placeholder="e.g. soldering"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Unique identifier (lowercase, no spaces)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input
                                value={newSkillLabel}
                                onChange={(e) => setNewSkillLabel(e.target.value)}
                                placeholder="e.g. Soldering"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={newSkillDescription}
                                onChange={(e) => setNewSkillDescription(e.target.value)}
                                placeholder="e.g. SMD and through-hole soldering"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewSkillDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddSkill}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add Skill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Skill Confirmation */}
            <Dialog open={!!deleteSkillDialog} onOpenChange={() => setDeleteSkillDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Skill</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this skill? This will not affect existing user skill assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteSkillDialog(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteSkillDialog && handleDeleteSkill(deleteSkillDialog)}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
