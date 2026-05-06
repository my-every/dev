import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";

import {
    WorkspaceCollectionView,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionItem,
    type WorkspaceCollectionTab,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import type { WorkspaceUserRecord } from "./users-types";
import { getUserResponsibilityLabel, getUserTitleLabel } from "./users-display";

type UsersDirectoryCollectionProps = {
    users: WorkspaceUserRecord[];
    mode?: ViewMode;
    selectedUserBadge?: string | null;
    onSelectUser?: (user: WorkspaceUserRecord) => void;
};

const FILTER_DEFS: WorkspaceCollectionFilterDefinition[] = [
    { id: "role", label: "Role / Responsibility", options: [] },
    { id: "access", label: "Access", options: [] },
    { id: "skill", label: "Skill", options: [] },
    { id: "status", label: "Status", options: [] },
];

function determineStatus(user: WorkspaceUserRecord): string {
    if (!user.lastLoginAt) {
        return "offline";
    }

    const age = Date.now() - new Date(user.lastLoginAt).getTime();
    const hours = age / (1000 * 60 * 60);
    return hours <= 24 ? "active" : "idle";
}

export function UsersDirectoryCollection({
    users,
    mode = "default",
    selectedUserBadge,
    onSelectUser,
}: UsersDirectoryCollectionProps) {
    const shiftTabs = buildShiftTabs(users);
    const filterDefinitions = buildFilterDefinitions(users);

    const items: WorkspaceCollectionItem[] = users.map((user) => {
        const avatar = getAvatarColor(user.badge);
        const skillKeys = Object.keys(user.skills ?? {});
        return {
            id: user.badge,
            title: user.preferredName || user.fullName,
            subtitle: `${user.badge} • ${user.shift ?? "Unknown shift"}`,
            description: getUserTitleLabel(user),
            badge: getUserResponsibilityLabel(user.role),
            thumbnail: (
                <Avatar className="h-10 w-10">
                    <AvatarFallback className={`${avatar.bg} ${avatar.text}`}>
                        {getAvatarInitials(user.fullName, user.preferredName)}
                    </AvatarFallback>
                </Avatar>
            ),
            metadata: [
                { label: "Role / Responsibility", value: getUserResponsibilityLabel(user.role) },
                { label: "Shift", value: user.shift ?? "—" },
                { label: "Skill", value: skillKeys[0] ? getUserResponsibilityLabel(skillKeys[0]) : "—" },
                { label: "Location", value: user.location ?? user.primaryLwc ?? "—" },
            ],
            searchText: [
                user.badge,
                user.fullName,
                user.preferredName,
                user.role,
                user.shift,
                user.primaryLwc,
                user.location,
                skillKeys.join(" "),
            ]
                .filter(Boolean)
                .join(" "),
            filterValues: {
                tab: user.shift ?? "unknown",
                role: user.role || "unknown",
                access: user.role || "unknown",
                skill: skillKeys[0] ?? "none",
                status: determineStatus(user),
            },
        };
    });

    return (
        <WorkspaceCollectionView
            items={items}
            mode={mode}
            tabs={shiftTabs}
            defaultTabId={shiftTabs[0]?.id ?? "all"}
            filters={filterDefinitions.length ? filterDefinitions : FILTER_DEFS}
            searchPlaceholder="Search by name, badge, responsibility, skill, or shift..."
            selectedItemId={selectedUserBadge}
            onSelect={(item) => {
                const match = users.find((user) => user.badge === item.id);
                if (match) {
                    onSelectUser?.(match);
                }
            }}
        />
    );
}

function buildShiftTabs(users: WorkspaceUserRecord[]): WorkspaceCollectionTab[] {
    const counts = new Map<string, number>();
    users.forEach((user) => {
        const shift = user.shift ?? "unknown";
        counts.set(shift, (counts.get(shift) ?? 0) + 1);
    });

    return [
        { id: "all", label: "All", count: users.length },
        ...Array.from(counts.entries()).map(([shift, count]) => ({
            id: shift,
            label: `${shift} Shift`,
            count,
        })),
    ];
}

function buildFilterDefinitions(users: WorkspaceUserRecord[]): WorkspaceCollectionFilterDefinition[] {
    const roles = new Set<string>();
    const skills = new Set<string>();
    const statuses = new Set<string>();

    users.forEach((user) => {
        roles.add(user.role || "unknown");
        statuses.add(determineStatus(user));
        Object.keys(user.skills ?? {}).forEach((skill) => skills.add(skill));
    });

    return [
        {
            id: "role",
            label: "Role / Responsibility",
            options: Array.from(roles).sort().map((role) => ({ value: role, label: getUserResponsibilityLabel(role) })),
        },
        {
            id: "access",
            label: "Access",
            options: Array.from(roles).sort().map((role) => ({ value: role, label: getUserResponsibilityLabel(role) })),
        },
        {
            id: "skill",
            label: "Skill",
            options: Array.from(skills).sort().map((skill) => ({ value: skill, label: getUserResponsibilityLabel(skill) })),
        },
        {
            id: "status",
            label: "Status",
            options: Array.from(statuses).sort().map((status) => ({ value: status, label: getUserResponsibilityLabel(status) })),
        },
    ];
}
