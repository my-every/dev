"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import {
    DetailSectionCard,
    WorkspaceSectionTabs,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import {
    UserAssignmentList,
    UserDetailSidePanelNav,
    UserDetailSubheader,
    UserIdentityCard,
    UserTrainingProgress,
} from "@/app/(workspaces)/[badgeNumber]/users/_components";
import { activityService } from "@/lib/services/activity-service";
import type { ActivityEntry } from "@/types/activity";
import type { UserSettings, DashboardAccess, GranularPermissions } from "@/types/user-settings";
import { PERMISSION_LABELS } from "@/types/user-settings";
import type { ShareUserProfile } from "@/lib/profile/share-profile-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProfileHeader } from "@/components/profile/profile-header";

type WorkspaceUserRecord = {
    badge: string;
    fullName: string;
    preferredName?: string | null;
    role: string;
    shift?: string | null;
    primaryLwc?: string | null;
    email?: string | null;
    phone?: string | null;
    bio?: string | null;
    department?: string | null;
    title?: string | null;
    location?: string | null;
    skills?: Record<string, number> | null;
};

type ProfileWorkspaceDetailProps = {
    badgeNumber: string;
    targetBadge: string;
    backHref: string;
    title: string;
    subtitle: string;
};

type LoadState = "loading" | "ready" | "error";

const DASHBOARD_ACCESS_KEYS: Array<keyof DashboardAccess> = [
    "projectSchedule",
    "userAccess",
    "catalogAccess",
];

const GRANULAR_PERMISSION_KEYS: Array<keyof GranularPermissions> = [
    "canViewUsers",
    "canEditUsers",
    "canViewProjects",
    "canEditProjects",
    "canAssignUsers",
    "canGrantPermissions",
];

export function ProfileWorkspaceDetail({
    badgeNumber,
    targetBadge,
    backHref,
    title,
    subtitle,
}: ProfileWorkspaceDetailProps) {
    const router = useRouter();
    const [mode, setMode] = useState<ViewMode>("skeleton");
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ShareUserProfile | null>(null);
    const [profileDraft, setProfileDraft] = useState<ShareUserProfile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [activity, setActivity] = useState<ActivityEntry[]>([]);
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [commentDraft, setCommentDraft] = useState("");
    const [relatedIdsDraft, setRelatedIdsDraft] = useState("");
    const [saveState, setSaveState] = useState<LoadState>("loading");
    const [isNewProfile, setIsNewProfile] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function loadProfileWorkspace() {
            setMode("skeleton");
            setSaveState("loading");
            setError(null);

            try {
                const teamResponses = await Promise.all([
                    fetch("/api/users/team?shift=1st", { cache: "no-store" }),
                    fetch("/api/users/team?shift=2nd", { cache: "no-store" }),
                ]);
                const teamPayloads = await Promise.all(
                    teamResponses.map(async (response) => {
                        if (!response.ok) return [];
                        const payload = (await response.json()) as { members?: WorkspaceUserRecord[] };
                        return payload.members ?? [];
                    }),
                );
                const teamMember = teamPayloads.flat().find((member) => member.badge === targetBadge) ?? null;

                const profileResponse = await fetch(`/api/users/${encodeURIComponent(targetBadge)}/profile`, { cache: "no-store" });
                let resolvedProfile: ShareUserProfile | null = null;
                let shift = teamMember?.shift || "1st";

                if (profileResponse.status === 404) {
                    resolvedProfile = buildDraftProfile(targetBadge, shift, teamMember);
                    if (!mounted) return;
                    setIsNewProfile(true);
                    setProfile(null);
                    setProfileDraft(resolvedProfile);
                    setSettings(null);
                    setActivity([]);
                    setSelectedActivityId(null);
                    setRelatedIdsDraft("");
                    setError("This profile has not been created yet. You can create it from this route.");
                    setMode("dynamic");
                    setSaveState("ready");
                    return;
                }

                if (!profileResponse.ok) {
                    throw new Error("Failed to load the profile.");
                }

                const profilePayload = (await profileResponse.json()) as { profile?: ShareUserProfile };
                resolvedProfile = profilePayload.profile ?? null;
                if (!resolvedProfile) {
                    throw new Error("Profile not found.");
                }

                shift = resolvedProfile.shift || teamMember?.shift || "1st";
                const [settingsResponse, activityEntries] = await Promise.all([
                    fetch(`/api/users/${encodeURIComponent(targetBadge)}/settings?shift=${encodeURIComponent(shift)}`, { cache: "no-store" }),
                    activityService.getActivity(targetBadge, shift, { limit: 12 }),
                ]);

                const settingsPayload = settingsResponse.ok
                    ? ((await settingsResponse.json()) as { settings?: UserSettings })
                    : { settings: null };

                if (!mounted) return;

                setProfile(resolvedProfile);
                setProfileDraft(resolvedProfile);
                setSettings(settingsPayload.settings ?? null);
                setActivity(activityEntries);
                setSelectedActivityId(activityEntries[0]?.id ?? null);
                setRelatedIdsDraft(activityEntries[0]?.relatedActivityIds?.join(", ") ?? "");
                setIsNewProfile(false);
                setError(null);
                setMode("dynamic");
                setSaveState("ready");
            } catch (loadError) {
                if (!mounted) return;
                setError(loadError instanceof Error ? loadError.message : "Failed to load profile workspace.");
                setMode("default");
                setSaveState("error");
            }
        }

        void loadProfileWorkspace();
        return () => {
            mounted = false;
        };
    }, [targetBadge]);

    const selectedActivity = useMemo(
        () => activity.find((entry) => entry.id === selectedActivityId) ?? activity[0] ?? null,
        [activity, selectedActivityId],
    );

    useEffect(() => {
        setRelatedIdsDraft(selectedActivity?.relatedActivityIds?.join(", ") ?? "");
    }, [selectedActivity?.id]);

    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Profile",
                items: [
                    {
                        id: "profile-root",
                        label: title,
                        href: `/${badgeNumber}/profile`,
                        keywords: ["profile", badgeNumber, targetBadge],
                    },
                    {
                        id: "profile-detail",
                        label: profileDraft?.preferredName || profileDraft?.fullName || targetBadge,
                        href: `/${badgeNumber}/profile/${encodeURIComponent(targetBadge)}`,
                        keywords: [
                            targetBadge,
                            profileDraft?.fullName ?? "",
                            profileDraft?.role ?? "",
                            profileDraft?.primaryLwc ?? "",
                        ],
                    },
                ],
            },
        ],
        [badgeNumber, profileDraft?.fullName, profileDraft?.preferredName, profileDraft?.primaryLwc, profileDraft?.role, targetBadge, title],
    );

    const assignmentData = useMemo(
        () => buildAssignmentRows(profile),
        [profile],
    );
    const trainingData = useMemo(
        () => buildTrainingRows(profile),
        [profile],
    );

    const sections: DetailSectionConfig[] = [
        {
            id: "overview",
            label: "Overview",
            renderNav: (viewMode) => <ProfileDetailNavItem mode={viewMode} label="Overview" eyebrow="Identity" />,
            renderPanel: (viewMode) => (
                <div className="space-y-4">
                    <UserIdentityCard
                        mode={viewMode}
                        data={
                            profileDraft
                                ? {
                                      badge: profileDraft.badge,
                                      email: profileDraft.email,
                                      phone: profileDraft.phone,
                                      location: profileDraft.location ?? profileDraft.primaryLwc,
                                      department: profileDraft.department,
                                      title: profileDraft.title,
                                      bio: profileDraft.bio,
                                  }
                                : undefined
                        }
                    />
                    <ProfileEditorCard
                        mode={viewMode}
                        profile={profileDraft}
                        isNewProfile={isNewProfile}
                        allowDelete={targetBadge !== badgeNumber && !isNewProfile}
                        onChange={setProfileDraft}
                        onSave={async () => {
                            if (!profileDraft) return;
                            setSaveState("loading");
                            const response = await fetch(`/api/users/${encodeURIComponent(targetBadge)}/profile`, {
                                method: isNewProfile ? "POST" : "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(profileDraft),
                            });
                            if (!response.ok) {
                                setSaveState("error");
                                return;
                            }
                            const payload = (await response.json()) as { profile?: ShareUserProfile };
                            const nextProfile = payload.profile ?? profileDraft;
                            setProfile(nextProfile);
                            setProfileDraft(nextProfile);
                            const settingsResponse = await fetch(
                                `/api/users/${encodeURIComponent(targetBadge)}/settings?shift=${encodeURIComponent(nextProfile.shift || "1st")}`,
                                { cache: "no-store" },
                            );
                            if (settingsResponse.ok) {
                                const settingsPayload = (await settingsResponse.json()) as { settings?: UserSettings };
                                setSettings(settingsPayload.settings ?? null);
                            }
                            setIsNewProfile(false);
                            setError(null);
                            setSaveState("ready");
                        }}
                        onDelete={async () => {
                            setSaveState("loading");
                            const response = await fetch(`/api/users/${encodeURIComponent(targetBadge)}/profile`, {
                                method: "DELETE",
                            });
                            if (!response.ok) {
                                setSaveState("error");
                                return;
                            }
                            router.push(backHref);
                        }}
                    />
                </div>
            ),
        },
        {
            id: "assignments",
            label: "Assignments",
            renderNav: (viewMode) => <ProfileDetailNavItem mode={viewMode} label="Assignments" eyebrow="Work" />,
            renderPanel: (viewMode) => <UserAssignmentList mode={viewMode} data={assignmentData} />,
        },
        {
            id: "training",
            label: "Training",
            renderNav: (viewMode) => <ProfileDetailNavItem mode={viewMode} label="Training" eyebrow="Skills" />,
            renderPanel: (viewMode) => <UserTrainingProgress mode={viewMode} data={trainingData} />,
        },
        {
            id: "activity",
            label: "Activity",
            renderNav: (viewMode) => <ProfileDetailNavItem mode={viewMode} label="Activity" eyebrow="Timeline" />,
            renderPanel: (viewMode) => (
                <ProfileActivityCard
                    mode={viewMode}
                    badgeNumber={badgeNumber}
                    targetBadge={targetBadge}
                    shift={profile?.shift ?? "1st"}
                    activity={activity}
                    selectedActivityId={selectedActivityId}
                    onSelectActivity={setSelectedActivityId}
                    commentDraft={commentDraft}
                    onCommentDraftChange={setCommentDraft}
                    relatedIdsDraft={relatedIdsDraft}
                    onRelatedIdsDraftChange={setRelatedIdsDraft}
                    onActivityChange={setActivity}
                />
            ),
        },
        {
            id: "permissions",
            label: "Permissions",
            renderNav: (viewMode) => <ProfileDetailNavItem mode={viewMode} label="Permissions" eyebrow="Access" />,
            renderPanel: (viewMode) => (
                <ProfilePermissionsEditorCard
                    mode={viewMode}
                    settings={settings}
                    performedBy={badgeNumber}
                    onSettingsChange={setSettings}
                />
            ),
        },
    ];

    return (
        <PageContent
            title={title}
            subtitle={subtitle}
            variant="compact"
            showPanel={true}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search profile workspace"
            sidePanel={
                <UserDetailSidePanelNav
                    sections={sections}
                    mode={mode}
                    backHref={backHref}
                    eyebrow="Profile"
                    title="Profile detail"
                    subtitle={targetBadge}
                    summary={
                        <div className="-mx-3 -my-3">
                            <ProfileHeader
                                badgeNumber={targetBadge}
                                compact
                                isEditable={false}
                                layout="vertical"
                                className="bg-transparent"
                            />
                        </div>
                    }
                />
            }
            subHeader={
                mode === "skeleton" ? (
                    <UserDetailSubheader
                        mode={mode}
                        data={{
                            name: profileDraft?.preferredName || profileDraft?.fullName || targetBadge,
                            badge: targetBadge,
                            role: profileDraft?.role ? normalizeLabel(profileDraft.role) : "Unknown role",
                            shift: profileDraft?.shift,
                            department: profileDraft?.department,
                            email: profileDraft?.email,
                            location: profileDraft?.location ?? profileDraft?.primaryLwc,
                        }}
                    />
                ) : (
                    <ProfileHeader
                        badgeNumber={targetBadge}
                        isEditable={false}
                        className="border-b border-border bg-card/40"
                    />
                )
            }
        >
            <div className="space-y-4 p-4 sm:p-5 lg:p-6">
                {error ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
                ) : null}
                <WorkspaceSectionTabs sections={sections} mode={mode} />
            </div>
        </PageContent>
    );
}

function ProfileEditorCard({
    mode,
    profile,
    isNewProfile,
    allowDelete,
    onChange,
    onSave,
    onDelete,
}: {
    mode: ViewMode;
    profile: ShareUserProfile | null;
    isNewProfile: boolean;
    allowDelete: boolean;
    onChange: (next: ShareUserProfile | null) => void;
    onSave: () => Promise<void>;
    onDelete: () => Promise<void>;
}) {
    if (mode === "skeleton") {
        return (
            <DetailSectionCard title="Profile Fields" description="Editable identity, contact, and summary fields.">
                <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-11 w-full rounded-xl" />
                    ))}
                </div>
            </DetailSectionCard>
        );
    }

    return (
        <DetailSectionCard
            title={isNewProfile ? "Create Profile" : "Profile Fields"}
            description={isNewProfile ? "Create the initial share-backed profile record for this badge." : "Update the share-backed profile record for this badge."}
            action={
                <div className="flex items-center gap-2">
                    {allowDelete ? (
                        <Button size="sm" variant="outline" onClick={() => void onDelete()}>
                            Delete Profile
                        </Button>
                    ) : null}
                    <Button size="sm" onClick={() => void onSave()}>{isNewProfile ? "Create Profile" : "Save Profile"}</Button>
                </div>
            }
        >
            <div className="grid gap-3 md:grid-cols-2">
                <InputField label="Full Name" value={profile?.fullName ?? ""} onChange={(value) => onChange(profile ? { ...profile, fullName: value } : profile)} />
                <InputField label="Preferred Name" value={profile?.preferredName ?? ""} onChange={(value) => onChange(profile ? { ...profile, preferredName: value || null } : profile)} />
                <InputField label="Title" value={profile?.title ?? ""} onChange={(value) => onChange(profile ? { ...profile, title: value || null } : profile)} />
                <InputField label="Department" value={profile?.department ?? ""} onChange={(value) => onChange(profile ? { ...profile, department: value || null } : profile)} />
                <InputField label="Email" value={profile?.email ?? ""} onChange={(value) => onChange(profile ? { ...profile, email: value || null } : profile)} />
                <InputField label="Phone" value={profile?.phone ?? ""} onChange={(value) => onChange(profile ? { ...profile, phone: value || null } : profile)} />
                <InputField label="Location" value={profile?.location ?? ""} onChange={(value) => onChange(profile ? { ...profile, location: value || null } : profile)} />
                <InputField label="Primary LWC" value={profile?.primaryLwc ?? ""} onChange={(value) => onChange(profile ? { ...profile, primaryLwc: value } : profile)} />
            </div>
            <div className="mt-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bio</div>
                <Textarea value={profile?.bio ?? ""} onChange={(event) => onChange(profile ? { ...profile, bio: event.target.value || null } : profile)} className="min-h-28" />
            </div>
        </DetailSectionCard>
    );
}

function ProfilePermissionsEditorCard({
    mode,
    settings,
    performedBy,
    onSettingsChange,
}: {
    mode: ViewMode;
    settings: UserSettings | null;
    performedBy: string;
    onSettingsChange: (next: UserSettings | null) => void;
}) {
    const shift = settings?.shift ?? "1st";

    const updateAccess = async (key: keyof DashboardAccess, enabled: boolean) => {
        if (!settings) return;
        const response = await fetch(`/api/users/${encodeURIComponent(settings.badge)}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shift, action: "update-access", key, enabled, performedBy }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { settings?: UserSettings };
        onSettingsChange(payload.settings ?? settings);
    };

    const updatePermission = async (key: keyof GranularPermissions, enabled: boolean) => {
        if (!settings) return;
        const response = await fetch(`/api/users/${encodeURIComponent(settings.badge)}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shift, action: "update-permission", key, enabled, performedBy }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { settings?: UserSettings };
        onSettingsChange(payload.settings ?? settings);
    };

    return (
        <DetailSectionCard title="Permissions" description="Update dashboard access and core granular permissions.">
            {mode === "skeleton" ? (
                <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-xl" />)}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dashboard Access</div>
                        {DASHBOARD_ACCESS_KEYS.map((key) => (
                            <SwitchRow
                                key={key}
                                label={normalizeLabel(key)}
                                description={`Allow ${normalizeLabel(key)} access`}
                                checked={Boolean(settings?.dashboardAccess?.[key])}
                                onCheckedChange={(checked) => void updateAccess(key, checked)}
                            />
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Granular Permissions</div>
                        {GRANULAR_PERMISSION_KEYS.map((key) => (
                            <SwitchRow
                                key={key}
                                label={PERMISSION_LABELS[key].label}
                                description={PERMISSION_LABELS[key].description}
                                checked={Boolean(settings?.permissions?.[key])}
                                onCheckedChange={(checked) => void updatePermission(key, checked)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </DetailSectionCard>
    );
}

function ProfileActivityCard({
    mode,
    badgeNumber,
    targetBadge,
    shift,
    activity,
    selectedActivityId,
    onSelectActivity,
    commentDraft,
    onCommentDraftChange,
    relatedIdsDraft,
    onRelatedIdsDraftChange,
    onActivityChange,
}: {
    mode: ViewMode;
    badgeNumber: string;
    targetBadge: string;
    shift: string;
    activity: ActivityEntry[];
    selectedActivityId: string | null;
    onSelectActivity: (id: string | null) => void;
    commentDraft: string;
    onCommentDraftChange: (value: string) => void;
    relatedIdsDraft: string;
    onRelatedIdsDraftChange: (value: string) => void;
    onActivityChange: (entries: ActivityEntry[]) => void;
}) {
    const selectedActivity = activity.find((entry) => entry.id === selectedActivityId) ?? activity[0] ?? null;

    const refresh = async () => {
        const next = await activityService.getActivity(targetBadge, shift, { limit: 12 });
        onActivityChange(next);
        onSelectActivity(next[0]?.id ?? null);
    };

    return (
        <DetailSectionCard title="Activity" description="Review activity, add threaded comments, and link related items.">
            {mode === "skeleton" ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-3">
                        {activity.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => onSelectActivity(entry.id)}
                                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                    selectedActivity?.id === entry.id ? "border-primary/50 bg-primary/5" : "border-border bg-background/80 hover:bg-accent/40"
                                }`}
                            >
                                <div className="text-sm font-medium text-foreground">{normalizeLabel(entry.action)}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.comment || entry.stage || new Date(entry.timestamp).toLocaleString()}</div>
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        {selectedActivity ? (
                            <>
                                <div className="rounded-xl border border-border bg-background/80 px-3 py-3">
                                    <div className="text-sm font-medium text-foreground">{normalizeLabel(selectedActivity.action)}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{selectedActivity.comment || "No comment on this activity."}</div>
                                </div>
                                <div className="rounded-xl border border-border bg-background/80 px-3 py-3">
                                    <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Threaded Comments</div>
                                    <div className="space-y-2">
                                        {(selectedActivity.comments ?? []).map((comment) => (
                                            <div key={comment.id} className="rounded-lg border border-border bg-card px-3 py-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-medium text-foreground">{comment.author}</div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={async () => {
                                                            await fetch(`/api/activity/${encodeURIComponent(targetBadge)}/details`, {
                                                                method: "DELETE",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({
                                                                    activityId: selectedActivity.id,
                                                                    shift,
                                                                    commentId: comment.id,
                                                                    requester: badgeNumber,
                                                                }),
                                                            });
                                                            await refresh();
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground">{comment.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <Textarea value={commentDraft} onChange={(event) => onCommentDraftChange(event.target.value)} className="mt-3 min-h-24" placeholder="Add a threaded comment..." />
                                    <Button
                                        size="sm"
                                        className="mt-3"
                                        onClick={async () => {
                                            if (!commentDraft.trim()) return;
                                            await activityService.addThreadComment(targetBadge, shift, selectedActivity.id, commentDraft.trim(), badgeNumber);
                                            onCommentDraftChange("");
                                            await refresh();
                                        }}
                                    >
                                        Add Comment
                                    </Button>
                                </div>
                                <div className="rounded-xl border border-border bg-background/80 px-3 py-3">
                                    <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Related Activity IDs</div>
                                    <Textarea value={relatedIdsDraft} onChange={(event) => onRelatedIdsDraftChange(event.target.value)} className="min-h-24" placeholder="Comma separated related activity ids" />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-3"
                                        onClick={async () => {
                                            await activityService.linkRelatedActivities(
                                                targetBadge,
                                                shift,
                                                selectedActivity.id,
                                                relatedIdsDraft.split(",").map((value) => value.trim()).filter(Boolean),
                                            );
                                            await refresh();
                                        }}
                                    >
                                        Save Related Links
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                                No activity entries available yet.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DetailSectionCard>
    );
}

function ProfileDetailNavItem({
    mode,
    label,
    eyebrow,
}: {
    mode: ViewMode;
    label: string;
    eyebrow: string;
}) {
    if (mode === "skeleton") {
        return <Skeleton className="h-16 w-full rounded-xl" />;
    }

    return (
        <div className="rounded-xl border border-border bg-background/70 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
            <div className="mt-1 text-sm font-medium text-foreground">{label}</div>
        </div>
    );
}

function SwitchRow({
    label,
    description,
    checked,
    onCheckedChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/80 px-3 py-3">
            <div>
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

function InputField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <Input value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function buildAssignmentRows(profile: ShareUserProfile | null): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [];
    rows.push({ label: "Primary Role", value: profile?.role ? normalizeLabel(profile.role) : "Unknown role" });
    rows.push({ label: "Primary LWC", value: profile?.primaryLwc ?? "No LWC assigned" });
    rows.push({ label: "Availability", value: profile?.boardAvailability?.status ?? "Unknown" });

    for (const assignment of profile?.activeAssignments ?? []) {
        const record = assignment as Record<string, unknown>;
        rows.push({
            label: `${record.sheetName ?? record.assignmentId ?? "Assignment"}`,
            value: `${record.stage ?? "Stage unknown"}${record.projectId ? ` • ${record.projectId}` : ""}`,
        });
    }

    return rows;
}

function buildTrainingRows(profile: ShareUserProfile | null): Array<{ label: string; value: string }> {
    return Object.entries(profile?.skills ?? {})
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 10)
        .map(([key, value]) => ({
            label: normalizeLabel(key),
            value: `Level ${value}`,
        }));
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildDraftProfile(
    badge: string,
    shift: string,
    member: WorkspaceUserRecord | null,
): ShareUserProfile {
    const now = new Date().toISOString();
    return {
        badge,
        fullName: member?.fullName ?? "",
        preferredName: member?.preferredName ?? null,
        initials: null,
        role: member?.role ?? "assembler",
        shift,
        primaryLwc: member?.primaryLwc ?? "NEW_FLEX",
        email: member?.email ?? null,
        phone: member?.phone ?? null,
        avatarPath: null,
        coverImagePath: null,
        coverImagePositionY: 50,
        bio: member?.bio ?? null,
        department: member?.department ?? null,
        title: member?.title ?? null,
        location: member?.location ?? null,
        hireDate: null,
        yearsExperience: 0,
        skills: member?.skills ?? {},
        activeAssignments: [],
        assignmentCompetency: null,
        boardAvailability: null,
        preferences: {
            theme: "system",
            notifications: {
                stageComplete: true,
                assignmentBlocked: true,
                handoffRequired: true,
                shiftReminders: true,
            },
            dashboardLayout: "compact",
            defaultViews: {
                projectBoard: "kanban",
                workAreaBoard: "floor",
            },
        },
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
    };
}
