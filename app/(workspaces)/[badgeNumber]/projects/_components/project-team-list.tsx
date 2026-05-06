import { DetailSectionCard, SkeletonEntityList } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PROJECT_COVERAGE, PROJECT_TEAM } from "./project-fixtures";
import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type ProjectTeamListProps = BaseStatefulProps<{
    members: typeof PROJECT_TEAM;
    coverage: typeof PROJECT_COVERAGE;
}>;

const DEFAULT_DATA = {
    members: PROJECT_TEAM,
    coverage: PROJECT_COVERAGE,
};

export function ProjectTeamList({ mode = "default", data = DEFAULT_DATA, className }: ProjectTeamListProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
                <DetailSectionCard
                    title="Team Members"
                    description="Assigned roles, membership, and availability"
                    action={mode === "skeleton" ? <Skeleton className="h-9 w-32 rounded-xl" /> : <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Manage team</span>}
                >
                    {mode === "skeleton" ? (
                        <SkeletonEntityList count={6} />
                    ) : (
                        <div className="space-y-3">
                            {data.members.map((member) => (
                                <div key={member.name} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-sm font-medium text-muted-foreground">
                                        {member.name.split(" ")[0].slice(0, 1)}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="truncate text-sm font-medium text-foreground">{member.name}</div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{member.role}</span>
                                            <span className="h-1 w-1 rounded-full bg-border" />
                                            <span>{member.shift}</span>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                                        {member.availability}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </DetailSectionCard>

                <DetailSectionCard title="Coverage" description="Role distribution and schedule overlap">
                    <div className="space-y-3">
                        {mode === "skeleton"
                            ? Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <Skeleton className="h-3.5 w-24" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <Skeleton className="h-full rounded-full" style={{ width: `${42 + (i * 11) % 45}%` }} />
                                    </div>
                                </div>
                            ))
                            : data.coverage.map((item) => (
                                <div key={item.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm text-foreground">{item.label}</div>
                                        <div className="text-xs text-muted-foreground">{item.value}</div>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-foreground/60" style={{ width: item.width }} />
                                    </div>
                                </div>
                            ))}
                    </div>
                </DetailSectionCard>
            </div>
        </div>
    );
}