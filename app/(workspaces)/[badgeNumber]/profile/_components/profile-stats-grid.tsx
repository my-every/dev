import {
    DetailSectionCard,
    SkeletonMetricGrid,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import {
    PROFILE_CURRENT_ASSIGNMENT,
    PROFILE_PERFORMANCE,
    PROFILE_PERSONAL_INFO,
    PROFILE_SKILLS,
    PROFILE_STATS,
} from "./profile-fixtures";

type ProfileStatsGridProps = BaseStatefulProps<{
    stats: typeof PROFILE_STATS;
    skills: typeof PROFILE_SKILLS;
    personalInfo: typeof PROFILE_PERSONAL_INFO;
    currentAssignment: typeof PROFILE_CURRENT_ASSIGNMENT;
    performance: typeof PROFILE_PERFORMANCE;
}>;

const DEFAULT_DATA = {
    stats: PROFILE_STATS,
    skills: PROFILE_SKILLS,
    personalInfo: PROFILE_PERSONAL_INFO,
    currentAssignment: PROFILE_CURRENT_ASSIGNMENT,
    performance: PROFILE_PERFORMANCE,
};

export function ProfileStatsGrid({ mode = "default", data = DEFAULT_DATA, className }: ProfileStatsGridProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.75fr)]">
                <div className="space-y-4">
                    {mode === "skeleton" ? (
                        <SkeletonMetricGrid count={3} className="xl:grid-cols-3" />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-3">
                            {data.stats.map((item) => (
                                <div key={item.label} className="rounded-xl border border-border bg-card/60 p-4">
                                    <p className="mb-3 text-xs text-muted-foreground">{item.label}</p>
                                    <div className="mb-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
                                    <p className="text-xs text-muted-foreground">{item.note}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <DetailSectionCard title="Skill Progress" description="Certifications and training completion">
                        <div className="space-y-3">
                            {mode === "skeleton"
                                ? Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Skeleton className="h-3.5 w-32" />
                                            <Skeleton className="h-3 w-10" />
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                            <Skeleton className="h-full rounded-full" style={{ width: `${38 + (i * 12) % 58}%` }} />
                                        </div>
                                    </div>
                                ))
                                : data.skills.map((item) => (
                                    <div key={item.label} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-foreground">{item.label}</span>
                                            <span className="text-xs text-muted-foreground">{item.value}</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                            <div className="h-full rounded-full bg-foreground/60" style={{ width: item.width }} />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>

                    <DetailSectionCard title="Personal Info">
                        <div className="space-y-3">
                            {mode === "skeleton"
                                ? ["Email", "Location", "Title", "Department", "Joined"].map((label) => (
                                    <div key={label} className="flex items-center gap-4">
                                        <p className="w-24 shrink-0 text-xs text-muted-foreground">{label}</p>
                                        <Skeleton className="h-4 flex-1 max-w-[60%]" />
                                    </div>
                                ))
                                : data.personalInfo.map((item) => (
                                    <div key={item.label} className="flex items-center gap-4">
                                        <p className="w-24 shrink-0 text-xs text-muted-foreground">{item.label}</p>
                                        <p className="text-sm text-foreground">{item.value}</p>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>

                <div className="space-y-4">
                    <DetailSectionCard title="Current Assignment">
                        {mode === "skeleton" ? (
                            <div className="rounded-xl border border-border bg-background/70 p-4">
                                <div className="mb-3 flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-xl" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-full max-w-[90%]" />
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <Skeleton className="h-full w-3/5 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border bg-background/70 p-4">
                                <div className="mb-3 flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                                        AS
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">{data.currentAssignment.title}</div>
                                        <div className="text-xs text-muted-foreground">{data.currentAssignment.detail}</div>
                                    </div>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-foreground/60" style={{ width: data.currentAssignment.width }} />
                                </div>
                            </div>
                        )}
                    </DetailSectionCard>

                    <DetailSectionCard title="Performance" description="Role-based metrics and indicators">
                        <div className="space-y-3">
                            {mode === "skeleton"
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <Skeleton className="h-3.5 w-32" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                ))
                                : data.performance.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-foreground">{item.label}</span>
                                        <span className="text-xs text-muted-foreground">{item.value}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>
            </div>
        </div>
    );
}