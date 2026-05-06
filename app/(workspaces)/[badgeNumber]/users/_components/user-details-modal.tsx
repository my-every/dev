"use client";

/**
 * User Details Modal
 *
 * Full-featured modal for viewing and editing user details.
 * Opens when a user card is clicked in the directory.
 * 
 * Features:
 * - Scrollspy navigation for section jumping
 * - Two-column layout (labels left, inputs right)
 * - Dynamic API data loading
 * - Editable fields with inline save
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
    User,
    Shield,
    Award,
    Settings,
    Briefcase,
    MapPin,
    Phone,
    Mail,
    Calendar,
    Clock,
    Save,
    X,
    Check,
    ChevronRight,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { WorkspaceUserRecord } from "./users-types";
import { getUserResponsibilityLabel, getUserTitleLabel } from "./users-display";
import {
    PERMISSION_GROUPS,
    PERMISSION_LABELS,
    type GranularPermissions,
    type DashboardAccess,
    type UserSettings,
} from "@/types/user-settings";
import { USER_ROLE_LABELS, type UserRole } from "@/types/d380-user-session";

// ============================================================================
// Types
// ============================================================================

export interface UserDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: WorkspaceUserRecord | null;
    onSave?: (badge: string, updates: Partial<WorkspaceUserRecord>) => Promise<void>;
    onSaveSettings?: (badge: string, settings: Partial<UserSettings>) => Promise<void>;
}

type SectionId = "profile" | "work" | "skills" | "permissions" | "settings";

interface Section {
    id: SectionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "work", label: "Work Info", icon: Briefcase },
    { id: "skills", label: "Skills", icon: Award },
    { id: "permissions", label: "Permissions", icon: Shield },
    { id: "settings", label: "Settings", icon: Settings },
];

// Role options for select
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: "ASSEMBLER", label: "Assembler" },
    { value: "BRANDER", label: "Brander" },
    { value: "QA", label: "Quality Assurance" },
    { value: "TEAM_LEAD", label: "Team Lead" },
    { value: "SUPERVISOR", label: "Supervisor" },
    { value: "MANAGER", label: "Manager" },
    { value: "DEVELOPER", label: "Developer" },
];

const SHIFT_OPTIONS = [
    { value: "1st", label: "1st Shift" },
    { value: "2nd", label: "2nd Shift" },
    { value: "3rd", label: "3rd Shift" },
];

const LOCATION_OPTIONS = [
    { value: "NEW_FLEX", label: "New Flex" },
    { value: "MAIN_PLANT", label: "Main Plant" },
    { value: "BUILDING_B", label: "Building B" },
    { value: "WAREHOUSE", label: "Warehouse" },
];

const SKILL_DEFINITIONS = [
    { key: "brandList", label: "Brand List" },
    { key: "branding", label: "Branding" },
    { key: "buildUp", label: "Build Up" },
    { key: "wiring", label: "Wiring" },
    { key: "wiringIpv", label: "Wiring IPV" },
    { key: "boxBuild", label: "Box Build" },
    { key: "crossWire", label: "Cross Wire" },
    { key: "test", label: "Test" },
    { key: "pwrCheck", label: "Power Check" },
    { key: "biq", label: "BIQ" },
    { key: "greenChange", label: "Green Change" },
];

// ============================================================================
// Component
// ============================================================================

export function UserDetailsModal({
    open,
    onOpenChange,
    user,
    onSave,
    onSaveSettings,
}: UserDetailsModalProps) {
    const [activeSection, setActiveSection] = useState<SectionId>("profile");
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState<Partial<WorkspaceUserRecord>>({});
    const [skillsData, setSkillsData] = useState<Record<string, number>>({});
    const [permissionsData, setPermissionsData] = useState<GranularPermissions | null>(null);
    const [dashboardAccess, setDashboardAccess] = useState<DashboardAccess | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    
    const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
        profile: null,
        work: null,
        skills: null,
        permissions: null,
        settings: null,
    });
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Load user settings when modal opens
    useEffect(() => {
        if (!open || !user?.badge) {
            setUserSettings(null);
            return;
        }

        let cancelled = false;
        setLoadingSettings(true);

        fetch(`/api/users/${user.badge}/settings?shift=${encodeURIComponent(user.shift ?? "1st")}`, { cache: "no-store" })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (!cancelled && data?.settings) {
                    setUserSettings(data.settings);
                    setPermissionsData(data.settings.permissions ?? null);
                    setDashboardAccess(data.settings.dashboardAccess ?? null);
                    setSelectedPreset(data.settings.permissionGroupId ?? null);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoadingSettings(false);
            });

        return () => { cancelled = true; };
    }, [open, user?.badge]);

    // Reset form when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                preferredName: user.preferredName,
                email: user.email,
                phone: user.phone,
                bio: user.bio,
                location: user.location,
                department: user.department,
                title: user.title,
                role: user.role,
                shift: user.shift,
                primaryLwc: user.primaryLwc,
            });
            setSkillsData(user.skills ?? {});
        }
    }, [user]);

    // Scrollspy logic — re-attach whenever the modal opens so the ref is populated
    useEffect(() => {
        if (!open) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const containerTop = container.getBoundingClientRect().top;
            let current: SectionId = "profile";

            for (const section of SECTIONS) {
                const el = sectionRefs.current[section.id];
                if (el) {
                    // Positive when section top is above (or within 100px of) the container top
                    const elTop = el.getBoundingClientRect().top - containerTop;
                    if (elTop <= 100) {
                        current = section.id;
                    }
                }
            }

            setActiveSection(current);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [open]);

    const scrollToSection = useCallback((sectionId: SectionId) => {
        const el = sectionRefs.current[sectionId];
        const container = scrollContainerRef.current;
        if (el && container) {
            const elTop = el.getBoundingClientRect().top;
            const containerTop = container.getBoundingClientRect().top;
            container.scrollTo({
                top: container.scrollTop + elTop - containerTop - 20,
                behavior: "smooth",
            });
        }
    }, []);

    const handleFieldChange = useCallback((field: keyof WorkspaceUserRecord, value: string | null) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleSkillChange = useCallback((skillKey: string, value: number) => {
        setSkillsData((prev) => ({ ...prev, [skillKey]: value }));
    }, []);

    const handlePermissionToggle = useCallback((key: keyof GranularPermissions) => {
        setPermissionsData((prev) => prev ? { ...prev, [key]: !prev[key] } : null);
        setSelectedPreset(null); // Clear preset when manually changing
    }, []);

    const handleDashboardAccessToggle = useCallback((key: keyof DashboardAccess) => {
        setDashboardAccess((prev) => prev ? { ...prev, [key]: !prev[key] } : null);
        setSelectedPreset(null);
    }, []);

    const handlePresetChange = useCallback((presetId: string) => {
        const preset = PERMISSION_GROUPS.find((g) => g.id === presetId);
        if (preset) {
            setPermissionsData({ ...preset.permissions });
            setDashboardAccess({ ...preset.dashboardAccess });
            setSelectedPreset(presetId);
        }
    }, []);

    const handleSave = useCallback(async () => {
        if (!user?.badge) return;

        setIsSaving(true);
        setSaveError(null);
        try {
            // 1. Save profile + skills directly via API
            const profileRes = await fetch(`/api/users/${user.badge}/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, skills: skillsData }),
            });
            if (!profileRes.ok) {
                const errBody = await profileRes.json().catch(() => ({}));
                throw new Error((errBody as { error?: string })?.error ?? "Failed to save profile");
            }

            // 2. Save permissions + dashboard access directly via API
            if (permissionsData !== null || dashboardAccess !== null) {
                const settingsRes = await fetch(`/api/users/${user.badge}/settings`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        shift: user.shift ?? "1st",
                        ...(permissionsData !== null && { permissions: permissionsData }),
                        ...(dashboardAccess !== null && { dashboardAccess }),
                        ...(selectedPreset !== null && { permissionGroupId: selectedPreset }),
                    }),
                });
                if (!settingsRes.ok) {
                    const errBody = await settingsRes.json().catch(() => ({}));
                    throw new Error((errBody as { error?: string })?.error ?? "Failed to save settings");
                }
            }

            // 3. Notify parent for optimistic list sync (optional callbacks)
            if (onSave) {
                await onSave(user.badge, { ...formData, skills: skillsData });
            }
            if (onSaveSettings && (permissionsData !== null || dashboardAccess !== null)) {
                await onSaveSettings(user.badge, {
                    permissions: permissionsData ?? undefined,
                    dashboardAccess: dashboardAccess ?? undefined,
                    permissionGroupId: selectedPreset,
                });
            }

            setIsEditing(false);
        } catch (err) {
            console.error("[UserDetailsModal] Failed to save user:", err);
            setSaveError(err instanceof Error ? err.message : "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    }, [user, formData, skillsData, permissionsData, dashboardAccess, selectedPreset, onSave, onSaveSettings]);

    const handleOpenChange = useCallback((nextOpen: boolean) => {
        if (!nextOpen) {
            setIsEditing(false);
            setSaveError(null);
            setActiveSection("profile");
        }
        onOpenChange(nextOpen);
    }, [onOpenChange]);

    if (!user) return null;

    const avatarStyle = getAvatarColor(user.badge);
    const initials = getAvatarInitials(user.fullName, user.preferredName);
    const displayName = user.preferredName || user.fullName;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="!max-w-[900px] w-full max-h-[85vh] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden sm:!max-w-[900px]"
                showCloseButton
            >
                {/* Header */}
                <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b shrink-0">
                    <Avatar className="h-14 w-14 shrink-0">
                        <AvatarFallback className={cn("text-lg font-semibold", avatarStyle.bg, avatarStyle.text)}>
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-lg font-semibold truncate">
                            {displayName}
                        </DialogTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="font-mono text-xs">{user.badge}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {getUserResponsibilityLabel(user.role)}
                            </Badge>
                            {user.shift && (
                                <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-xs">{user.shift} Shift</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                            <>
                                {saveError && (
                                    <div className="flex items-center gap-1.5 text-xs text-destructive max-w-[200px]">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{saveError}</span>
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setIsEditing(false); setSaveError(null); }}
                                    disabled={isSaving}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setIsEditing(true); setSaveError(null); }}
                            >
                                Edit
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content with scrollspy sidebar */}
                <div className="flex flex-1 min-h-0">
                    {/* Scrollspy Navigation */}
                    <nav className="w-48 shrink-0 border-r bg-muted/30 p-3 space-y-1">
                        {SECTIONS.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => scrollToSection(section.id)}
                                    className={cn(
                                        "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                                        isActive
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{section.label}</span>
                                    {isActive && (
                                        <ChevronRight className="h-3 w-3 ml-auto shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Main Content */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto p-6 space-y-8"
                    >
                        {/* Profile Section */}
                        <section
                            ref={(el) => { sectionRefs.current.profile = el; }}
                            id="section-profile"
                        >
                            <SectionHeader
                                icon={User}
                                title="Profile Information"
                                description="Basic identity and contact details"
                            />
                            <div className="mt-4 space-y-4">
                                <FormRow label="Preferred Name" icon={User}>
                                    {isEditing ? (
                                        <Input
                                            value={formData.preferredName ?? ""}
                                            onChange={(e) => handleFieldChange("preferredName", e.target.value)}
                                            placeholder="Enter preferred name"
                                        />
                                    ) : (
                                        <DisplayValue value={user.preferredName} />
                                    )}
                                </FormRow>

                                <FormRow label="Email" icon={Mail}>
                                    {isEditing ? (
                                        <Input
                                            type="email"
                                            value={formData.email ?? ""}
                                            onChange={(e) => handleFieldChange("email", e.target.value)}
                                            placeholder="Enter email address"
                                        />
                                    ) : (
                                        <DisplayValue value={user.email} />
                                    )}
                                </FormRow>

                                <FormRow label="Phone" icon={Phone}>
                                    {isEditing ? (
                                        <Input
                                            type="tel"
                                            value={formData.phone ?? ""}
                                            onChange={(e) => handleFieldChange("phone", e.target.value)}
                                            placeholder="Enter phone number"
                                        />
                                    ) : (
                                        <DisplayValue value={user.phone} />
                                    )}
                                </FormRow>

                                <FormRow label="Bio" icon={User}>
                                    {isEditing ? (
                                        <Textarea
                                            value={formData.bio ?? ""}
                                            onChange={(e) => handleFieldChange("bio", e.target.value)}
                                            placeholder="Enter bio"
                                            rows={3}
                                        />
                                    ) : (
                                        <DisplayValue value={user.bio} />
                                    )}
                                </FormRow>
                            </div>
                        </section>

                        {/* Work Info Section */}
                        <section
                            ref={(el) => { sectionRefs.current.work = el; }}
                            id="section-work"
                        >
                            <SectionHeader
                                icon={Briefcase}
                                title="Work Information"
                                description="Role, shift, and location details"
                            />
                            <div className="mt-4 space-y-4">
                                <FormRow label="Role" icon={Shield}>
                                    {isEditing ? (
                                        <Select
                                            value={formData.role ?? ""}
                                            onValueChange={(v) => handleFieldChange("role", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLE_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <DisplayValue value={getUserResponsibilityLabel(user.role)} />
                                    )}
                                </FormRow>

                                <FormRow label="Shift" icon={Clock}>
                                    {isEditing ? (
                                        <Select
                                            value={formData.shift ?? ""}
                                            onValueChange={(v) => handleFieldChange("shift", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select shift" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SHIFT_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <DisplayValue value={user.shift ? `${user.shift} Shift` : null} />
                                    )}
                                </FormRow>

                                <FormRow label="Location" icon={MapPin}>
                                    {isEditing ? (
                                        <Select
                                            value={formData.location ?? ""}
                                            onValueChange={(v) => handleFieldChange("location", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LOCATION_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <DisplayValue value={user.location ?? user.primaryLwc} />
                                    )}
                                </FormRow>

                                <FormRow label="Department" icon={Briefcase}>
                                    {isEditing ? (
                                        <Input
                                            value={formData.department ?? ""}
                                            onChange={(e) => handleFieldChange("department", e.target.value)}
                                            placeholder="Enter department"
                                        />
                                    ) : (
                                        <DisplayValue value={user.department} />
                                    )}
                                </FormRow>

                                <FormRow label="Job Title" icon={Briefcase}>
                                    {isEditing ? (
                                        <Input
                                            value={formData.title ?? ""}
                                            onChange={(e) => handleFieldChange("title", e.target.value)}
                                            placeholder="Enter job title"
                                        />
                                    ) : (
                                        <DisplayValue value={getUserTitleLabel(user)} />
                                    )}
                                </FormRow>

                                <FormRow label="Hire Date" icon={Calendar}>
                                    <DisplayValue value={user.hireDate} />
                                </FormRow>

                                <FormRow label="Years Experience" icon={Award}>
                                    <DisplayValue value={user.yearsExperience?.toString()} />
                                </FormRow>
                            </div>
                        </section>

                        {/* Skills Section */}
                        <section
                            ref={(el) => { sectionRefs.current.skills = el; }}
                            id="section-skills"
                        >
                            <SectionHeader
                                icon={Award}
                                title="Skills & Competencies"
                                description="Proficiency levels for each skill area (0-4 scale)"
                            />
                            <div className="mt-4 space-y-4">
                                {SKILL_DEFINITIONS.map((skill) => {
                                    const value = skillsData[skill.key] ?? 0;
                                    return (
                                        <FormRow key={skill.key} label={skill.label} icon={Award}>
                                            {isEditing ? (
                                                <div className="flex items-center gap-4">
                                                    <Slider
                                                        value={[value]}
                                                        onValueChange={([v]) => handleSkillChange(skill.key, v)}
                                                        min={0}
                                                        max={4}
                                                        step={1}
                                                        className="flex-1"
                                                    />
                                                    <span className="w-8 text-center font-mono text-sm">
                                                        {value}
                                                    </span>
                                                </div>
                                            ) : (
                                                <SkillLevelDisplay level={value} />
                                            )}
                                        </FormRow>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Permissions Section */}
                        <section
                            ref={(el) => { sectionRefs.current.permissions = el; }}
                            id="section-permissions"
                        >
                            <SectionHeader
                                icon={Shield}
                                title="Permissions"
                                description="Access control and feature permissions"
                            />

                            {loadingSettings ? (
                                <div className="mt-4 flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="mt-4 space-y-6">
                                    {/* Permission Preset */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Permission Preset
                                        </Label>
                                        {isEditing ? (
                                            <Select
                                                value={selectedPreset ?? ""}
                                                onValueChange={handlePresetChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a preset or customize" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PERMISSION_GROUPS.map((group) => (
                                                        <SelectItem key={group.id} value={group.id}>
                                                            <div className="flex flex-col">
                                                                <span>{group.label}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {group.description}
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <DisplayValue
                                                value={PERMISSION_GROUPS.find((g) => g.id === selectedPreset)?.label ?? "Custom"}
                                            />
                                        )}
                                    </div>

                                    {/* Dashboard Access */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Dashboard Access
                                        </Label>
                                        <div className="space-y-2">
                                            {dashboardAccess && (
                                                <>
                                                    <PermissionToggle
                                                        label="Project Schedule"
                                                        description="Can access the project schedule view"
                                                        enabled={dashboardAccess.projectSchedule}
                                                        onChange={() => handleDashboardAccessToggle("projectSchedule")}
                                                        editing={isEditing}
                                                    />
                                                    <PermissionToggle
                                                        label="User Access"
                                                        description="Can access user management view"
                                                        enabled={dashboardAccess.userAccess}
                                                        onChange={() => handleDashboardAccessToggle("userAccess")}
                                                        editing={isEditing}
                                                    />
                                                    <PermissionToggle
                                                        label="Catalog Access"
                                                        description="Can access the catalog management view"
                                                        enabled={dashboardAccess.catalogAccess}
                                                        onChange={() => handleDashboardAccessToggle("catalogAccess")}
                                                        editing={isEditing}
                                                    />
                                                    <PermissionToggle
                                                        label="Branding Access"
                                                        description="Can access the branding workspace"
                                                        enabled={dashboardAccess.brandingAccess}
                                                        onChange={() => handleDashboardAccessToggle("brandingAccess")}
                                                        editing={isEditing}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Granular Permissions */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Granular Permissions
                                        </Label>
                                        <div className="space-y-2">
                                            {permissionsData && Object.entries(PERMISSION_LABELS).map(([key, meta]) => (
                                                <PermissionToggle
                                                    key={key}
                                                    label={meta.label}
                                                    description={meta.description}
                                                    enabled={permissionsData[key as keyof GranularPermissions]}
                                                    onChange={() => handlePermissionToggle(key as keyof GranularPermissions)}
                                                    editing={isEditing}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Settings Section */}
                        <section
                            ref={(el) => { sectionRefs.current.settings = el; }}
                            id="section-settings"
                        >
                            <SectionHeader
                                icon={Settings}
                                title="Account Settings"
                                description="Account status and activity information"
                            />
                            <div className="mt-4 space-y-4">
                                <FormRow label="Last Login" icon={Clock}>
                                    <DisplayValue
                                        value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null}
                                    />
                                </FormRow>

                                <FormRow label="Created" icon={Calendar}>
                                    <DisplayValue
                                        value={user.createdAt ? new Date(user.createdAt).toLocaleString() : null}
                                    />
                                </FormRow>

                                <FormRow label="Last Updated" icon={Clock}>
                                    <DisplayValue
                                        value={user.updatedAt ? new Date(user.updatedAt).toLocaleString() : null}
                                    />
                                </FormRow>
                            </div>
                        </section>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

function SectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3 pb-3 border-b">
            <div className="p-2 rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function FormRow({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
            <div className="flex items-center gap-2 py-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label className="text-sm text-muted-foreground">{label}</Label>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function DisplayValue({ value }: { value: string | number | null | undefined }) {
    if (value === null || value === undefined || value === "") {
        return (
            <span className="text-sm text-muted-foreground/50 italic py-2 block">
                Not set
            </span>
        );
    }
    return <span className="text-sm text-foreground py-2 block">{value}</span>;
}

function SkillLevelDisplay({ level }: { level: number }) {
    const labels = ["None", "Trainee", "Basic", "Proficient", "Expert"];
    const colors = [
        "bg-muted",
        "bg-amber-500/20 text-amber-700",
        "bg-blue-500/20 text-blue-700",
        "bg-emerald-500/20 text-emerald-700",
        "bg-purple-500/20 text-purple-700",
    ];

    return (
        <div className="flex items-center gap-2 py-2">
            <div className="flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-4 h-1.5 rounded-full transition-colors",
                            i <= level ? colors[level] : "bg-muted"
                        )}
                    />
                ))}
            </div>
            <Badge variant="secondary" className={cn("text-[10px] h-5", colors[level])}>
                {labels[level]}
            </Badge>
        </div>
    );
}

function PermissionToggle({
    label,
    description,
    enabled,
    onChange,
    editing,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onChange: () => void;
    editing: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-background/50">
            <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground truncate">{description}</div>
            </div>
            {editing ? (
                <Switch checked={enabled} onCheckedChange={onChange} />
            ) : (
                <Badge
                    variant={enabled ? "default" : "secondary"}
                    className={cn(
                        "text-[10px] h-5",
                        enabled ? "bg-emerald-500/10 text-emerald-600" : ""
                    )}
                >
                    {enabled ? "Enabled" : "Disabled"}
                </Badge>
            )}
        </div>
    );
}
