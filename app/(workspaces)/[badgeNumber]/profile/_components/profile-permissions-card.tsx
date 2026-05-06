import {
    DetailSectionCard,
    SkeletonDefinitionListCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import { PROFILE_PERMISSIONS, PROFILE_SKILL_CHIPS } from "./profile-fixtures";

type ProfilePermissionsCardProps = BaseStatefulProps<{
    permissions: typeof PROFILE_PERMISSIONS;
    skills: typeof PROFILE_SKILL_CHIPS;
}>;

const DEFAULT_DATA = {
    permissions: PROFILE_PERMISSIONS,
    skills: PROFILE_SKILL_CHIPS,
};

export function ProfilePermissionsCard({ mode = "default", data = DEFAULT_DATA, className }: ProfilePermissionsCardProps) {
    return (
        <div className={className}>
            <div className="space-y-4">
                {mode === "skeleton" ? (
                    <SkeletonDefinitionListCard rows={5} />
                ) : (
                    <DetailSectionCard title="Permissions" description="Access and role-based capabilities">
                        <div className="space-y-3">
                            {data.permissions.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-3">
                                    <span className="text-sm text-foreground">{item.label}</span>
                                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </DetailSectionCard>
                )}

                <DetailSectionCard title="Skills + LWC" description="Current skill tags and workspace capabilities">
                    {mode === "skeleton" ? (
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-6 rounded-full bg-accent animate-pulse" style={{ width: `${44 + (i * 9) % 40}px` }} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {data.skills.map((item) => (
                                <span key={item} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}
                </DetailSectionCard>
            </div>
        </div>
    );
}