import { Route } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

import { SWS_SUBHEADER } from "./sws-fixtures";

type SWSSubheaderProps = BaseStatefulProps<typeof SWS_SUBHEADER>;

export function SWSSubheader({ mode = "default", data = SWS_SUBHEADER, className }: SWSSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("flex flex-wrap items-center gap-3 border-b border-border bg-card/40 px-3 py-3 sm:px-4 lg:px-5", className)}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                        <Route className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3.5 w-48 max-w-[50vw]" />
                            <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                        <Skeleton className="h-5 w-64 max-w-[70vw]" />
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-3 border-b border-border bg-card/40 px-3 py-3 sm:px-4 lg:px-5", className)}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                    <Route className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">{data.id}</span>
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{data.status}</span>
                    </div>
                    <div className="truncate text-base font-medium text-foreground">{data.title}</div>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.kind}</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.version}</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.groupCount}</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.taskCount}</span>
            </div>
        </div>
    );
}