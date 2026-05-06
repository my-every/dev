import { DetailSectionCard, SkeletonEntityList } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PROJECT_ASSIGNMENTS } from "./project-fixtures";
import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type ProjectAssignmentsListProps = BaseStatefulProps<typeof PROJECT_ASSIGNMENTS>;

export function ProjectAssignmentsList({ mode = "default", data = PROJECT_ASSIGNMENTS, className }: ProjectAssignmentsListProps) {
    return (
        <DetailSectionCard
            className={className}
            title="Assignments"
            description="Work assignments mapped to units and members"
            action={mode === "skeleton" ? <Skeleton className="h-9 w-40 rounded-xl" /> : <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Filters</span>}
        >
            {mode === "skeleton" ? (
                <SkeletonEntityList count={7} />
            ) : (
                <div className="space-y-3">
                    {data.map((assignment) => (
                        <div key={`${assignment.title}-${assignment.unit}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                                {assignment.unit.replace("Unit ", "U")}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="truncate text-sm font-medium text-foreground">{assignment.title}</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{assignment.unit}</span>
                                    <span className="h-1 w-1 rounded-full bg-border" />
                                    <span>{assignment.member}</span>
                                </div>
                            </div>
                            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                                {assignment.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </DetailSectionCard>
    );
}