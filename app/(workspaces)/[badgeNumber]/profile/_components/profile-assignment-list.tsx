import {
    DetailSectionCard,
    SkeletonEntityList,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PROFILE_ASSIGNMENTS } from "./profile-fixtures";

type ProfileAssignmentListProps = BaseStatefulProps<typeof PROFILE_ASSIGNMENTS>;

export function ProfileAssignmentList({ mode = "default", data = PROFILE_ASSIGNMENTS, className }: ProfileAssignmentListProps) {
    return (
        <DetailSectionCard
            className={className}
            title="Assignments"
            description="Current and historical work assignments"
            action={mode === "skeleton" ? <Skeleton className="h-9 w-36 rounded-xl" /> : <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Assignment filters</span>}
        >
            {mode === "skeleton" ? (
                <SkeletonEntityList count={6} />
            ) : (
                <div className="space-y-3">
                    {data.map((item) => (
                        <div key={`${item.title}-${item.location}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                                AS
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.location}</div>
                            </div>
                            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </DetailSectionCard>
    );
}