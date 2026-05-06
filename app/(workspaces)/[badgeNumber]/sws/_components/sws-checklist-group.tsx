import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { SWS_CHECKLIST_GROUPS, type SWSChecklistGroupItem } from "./sws-fixtures";

type SWSChecklistGroupProps = BaseStatefulProps<SWSChecklistGroupItem>;

export function SWSChecklistGroup({ mode = "default", data, className }: SWSChecklistGroupProps) {
    const group = data ?? SWS_CHECKLIST_GROUPS[0];

    return (
        <DetailSectionCard className={className}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {mode === "skeleton" ? (
                        <Skeleton className="h-9 w-9 rounded-xl" />
                    ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground">
                            {group.title.slice(0, 1)}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        {mode === "skeleton" ? (
                            <>
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-32" />
                            </>
                        ) : (
                            <>
                                <div className="text-sm font-medium text-foreground">{group.title}</div>
                                <div className="text-xs text-muted-foreground">{group.note}</div>
                            </>
                        )}
                    </div>
                </div>
                {mode === "skeleton" ? (
                    <Skeleton className="h-6 w-16 rounded-full" />
                ) : (
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{group.count}</span>
                )}
            </div>
            <div className="space-y-2">
                {mode === "skeleton"
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
                            <Skeleton className="h-4 flex-1 max-w-[80%]" />
                            {i === 0 ? <Skeleton className="h-5 w-16 shrink-0 rounded-full" /> : null}
                        </div>
                    ))
                    : group.items.map((item) => (
                        <div key={item.title} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-card text-[10px] text-muted-foreground">S</div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm text-foreground">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.note}</div>
                            </div>
                            {item.status ? <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{item.status}</span> : null}
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}