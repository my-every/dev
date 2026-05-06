"use client";

import { use, useEffect, useMemo, useState } from "react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { activityService } from "@/lib/services/activity-service";
import type { ActivityEntry } from "@/types/activity";

import {
    UserActivityTimeline,
    UserAssignmentList,
    UserDetailSidePanelNav,
    UserDetailSubheader,
    UserIdentityCard,
    UserPermissionsDetailCard,
    UserTrainingProgress,
    type WorkspaceUserRecord,
    type WorkspaceUserSettingsRecord,
} from "../_components";
import { getUserResponsibilityLabel, getUserTitleLabel } from "../_components";
import {
    WorkspaceSectionTabs,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";

type UserDetailsPageProps = {
    params: Promise<{
        badgeNumber: string;
        userId: string;
    }>;
};

export default function UserDetailsPage({ params: paramsPromise }: UserDetailsPageProps) {
    const params = use(paramsPromise);
    const [user, setUser] = useState<WorkspaceUserRecord | null>(null);
    const [settings, setSettings] = useState<WorkspaceUserSettingsRecord | null>(null);
    const [activity, setActivity] = useState<ActivityEntry[]>([]);
    const [mode, setMode] = useState<ViewMode>("skeleton");

    useEffect(() => {
        let mounted = true;

        async function loadUser() {
            setMode("skeleton");

            const teamResponses = await Promise.all([
                fetch("/api/users/team?shift=1st", { cache: "no-store" }),
                fetch("/api/users/team?shift=2nd", { cache: "no-store" }),
            ]);

            const teamPayloads = await Promise.all(
                teamResponses.map(async (response) => {
                    if (!response.ok) {
                        return [];
                    }
                    const payload = (await response.json()) as { members?: WorkspaceUserRecord[] };
                    return payload.members ?? [];
                })
            );

            const foundUser = teamPayloads.flat().find((member) => member.badge === params.userId) ?? null;
            if (!mounted) {
                return;
            }

            setUser(foundUser);

            if (foundUser?.shift) {
                const [profileResponse, settingsResponse] = await Promise.all([
                    fetch(`/api/users/${encodeURIComponent(foundUser.badge)}/profile`, { cache: "no-store" }),
                    fetch(`/api/users/${encodeURIComponent(foundUser.badge)}/settings?shift=${encodeURIComponent(foundUser.shift)}`, { cache: "no-store" }),
                ]);

                const [, settingsPayload] = await Promise.all([
                    profileResponse.ok ? profileResponse.json() : Promise.resolve(null),
                    settingsResponse.ok ? settingsResponse.json() : Promise.resolve(null),
                ]);

                if (mounted) {
                    setSettings((settingsPayload as { settings?: WorkspaceUserSettingsRecord } | null)?.settings ?? null);
                }

                try {
                    const entries = await activityService.getActivity(foundUser.badge, foundUser.shift, { limit: 8 });
                    if (mounted) {
                        setActivity(entries);
                    }
                } catch {
                    if (mounted) {
                        setActivity([]);
                    }
                }
            } else if (mounted) {
                setSettings(null);
                setActivity([]);
            }

            if (mounted) {
                setMode("dynamic");
            }
        }

        void loadUser();

        return () => {
            mounted = false;
        };
    }, [params.userId]);

    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Users",
                items: [
                    {
                        id: "users-root",
                        label: "Users Workspace",
                        href: `/${params.badgeNumber}/users`,
                        keywords: ["users", "directory", "team"],
                    },
                    {
                        id: "user-detail",
                        label: user?.preferredName || user?.fullName || params.userId,
                        href: `/${params.badgeNumber}/users/${params.userId}`,
                        keywords: [params.userId, user?.fullName ?? "", user?.role ?? ""],
                    },
                ],
            },
        ],
        [params.badgeNumber, params.userId, user?.fullName, user?.preferredName, user?.role]
    );

    const permissionEntries = useMemo(
        () =>
            Object.entries(settings?.permissions ?? {})
                .map(([key, value]) => ({ label: normalizeLabel(key), value: value ? "Enabled" : "Disabled" }))
                .slice(0, 10),
        [settings?.permissions]
    );

    const assignments = useMemo(
        () => [
            { label: "Primary role / responsibility", value: user?.role ? getUserResponsibilityLabel(user.role) : "Not assigned" },
            { label: "Primary LWC", value: user?.primaryLwc ?? "No LWC assigned" },
            { label: "Shift", value: user?.shift ? `${user.shift} Shift` : "No shift assigned" },
        ],
        [user?.primaryLwc, user?.role, user?.shift]
    );

    const training = useMemo(
        () =>
            Object.entries(user?.skills ?? {})
                .sort((left, right) => Number(right[1]) - Number(left[1]))
                .slice(0, 6)
                .map(([label, value]) => ({ label: normalizeLabel(label), value: `Level ${value}` })),
        [user?.skills]
    );

    const timeline = useMemo(
        () =>
            activity.map((entry) => ({
                label: normalizeLabel(entry.action),
                value: entry.metadata?.comment || entry.metadata?.stage || entry.timestamp,
            })),
        [activity]
    );

    const sections: DetailSectionConfig[] = [
        {
            id: "overview",
            label: "Overview",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Overview" eyebrow="Identity" />,
            renderPanel: (viewMode) => (
                <UserIdentityCard
                    mode={viewMode}
                    data={{
                        badge: user?.badge ?? params.userId,
                        email: user?.email,
                        phone: user?.phone,
                        location: user?.location ?? user?.primaryLwc,
                        badge: user?.badge,
                        role: user?.role,
                        fullName: user?.fullName,
                        preferredName: user?.preferredName,
                        title: getUserTitleLabel({ title: user?.title ?? null, role: user?.role ?? null }),
                        bio: user?.bio,
                    }}
                />
            ),
        },
        {
            id: "permissions",
            label: "Permissions",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Permissions" eyebrow="Access" />,
            renderPanel: (viewMode) => <UserPermissionsDetailCard mode={viewMode} data={permissionEntries} />,
        },
        {
            id: "assignments",
            label: "Assignments",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Assignments" eyebrow="Roster" />,
            renderPanel: (viewMode) => <UserAssignmentList mode={viewMode} data={assignments} />,
        },
        {
            id: "training",
            label: "Training",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Training" eyebrow="Skills" />,
            renderPanel: (viewMode) => <UserTrainingProgress mode={viewMode} data={training} />,
        },
        {
            id: "activity",
            label: "Activity",
            renderNav: (viewMode) => <DetailNavItem mode={viewMode} label="Activity" eyebrow="Timeline" />,
            renderPanel: (viewMode) => <UserActivityTimeline mode={viewMode} data={timeline} />,
        },
    ];

    return (
        <PageContent
            title="User Details"
            subtitle={`Badge ${params.userId}`}
            variant="compact"
            showPanel={true}
            showAside={false}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search this user workspace"
            sidePanel={
                <UserDetailSidePanelNav
                    sections={sections}
                    mode={mode}
                    backHref={`/${params.badgeNumber}/users`}
                />
            }
            subHeader={
                <UserDetailSubheader
                    mode={mode}
                    data={{
                        name: user?.preferredName || user?.fullName || params.userId,
                        badge: user?.badge ?? params.userId,
                        role: user?.role ? getUserResponsibilityLabel(user.role) : "Unknown responsibility",
                        shift: user?.shift,
                        department: user?.department,
                        email: user?.email,
                        location: user?.location ?? user?.primaryLwc,
                    }}
                />
            }
        >
            <div className="p-4 sm:p-5 lg:p-6">
                <WorkspaceSectionTabs sections={sections} mode={mode} />
            </div>
        </PageContent>
    );
}

function DetailNavItem({
    label,
    eyebrow,
    mode,
}: {
    label: string;
    eyebrow: string;
    mode: ViewMode;
}) {
    if (mode === "skeleton") {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-3.5 w-24 rounded bg-muted" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
                {label.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
                <div className="truncate text-sm font-medium text-foreground">{label}</div>
            </div>
        </div>
    );
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
