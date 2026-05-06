import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { SWS_TASKS } from "./sws-fixtures";

type SWSTaskListProps = BaseStatefulProps<typeof SWS_TASKS>;

export function SWSTaskList({ mode = "default", data = SWS_TASKS, className }: SWSTaskListProps) {
    return (
        <DetailSectionCard
            className={className}
            title="All Tasks"
            description="Flat list of every task across all groups"
            action={mode === "skeleton" ? <Skeleton className="h-9 w-40 rounded-xl" /> : <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Task filters</span>}
        >
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-48 max-w-[65%]" />
                                    {i % 3 === 0 ? <Skeleton className="h-5 w-16 rounded-full" /> : null}
                                </div>
                                <Skeleton className="h-3 w-full max-w-[85%]" />
                            </div>
                            <Skeleton className="h-7 w-7 shrink-0 rounded-xl" />
                        </div>
                    ))
                    : data.map((item) => (
                        <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
                                T
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                                    {item.status ? <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{item.status}</span> : null}
                                </div>
                                <div className="text-xs text-muted-foreground">{item.detail}</div>
                            </div>
                            <div className="h-7 w-7 shrink-0 rounded-xl border border-border bg-card" />
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}