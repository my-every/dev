import {
    DetailSectionCard,
    SkeletonEntityList,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { SWS_RELATIONS } from "./sws-fixtures";

type SWSOperationsListProps = BaseStatefulProps<typeof SWS_RELATIONS>;

export function SWSOperationsList({ mode = "default", data = SWS_RELATIONS, className }: SWSOperationsListProps) {
    return (
        <DetailSectionCard
            className={className}
            title="Linked Targets"
            description="Stages, part numbers, training modules, and stacks"
            action={mode === "skeleton" ? (
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            ) : (
                <div className="flex gap-2">
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">Linked</span>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">Filtered</span>
                </div>
            )}
        >
            {mode === "skeleton" ? (
                <SkeletonEntityList count={6} />
            ) : (
                <div className="space-y-3">
                    {data.map((item) => (
                        <div key={`${item.title}-${item.kind}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                                R
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="text-sm font-medium text-foreground">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.detail}</div>
                            </div>
                            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.kind}</span>
                        </div>
                    ))}
                </div>
            )}
        </DetailSectionCard>
    );
}