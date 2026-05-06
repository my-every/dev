import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

import { PROFILE_SUBHEADER } from "./profile-fixtures";

type ProfileSubheaderProps = BaseStatefulProps<typeof PROFILE_SUBHEADER>;

export function ProfileSubheader({ mode = "default", data = PROFILE_SUBHEADER, className }: ProfileSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40", className)}>
                <div className="relative h-20 overflow-hidden bg-muted">
                    <Skeleton className="h-full w-full rounded-none" />
                </div>
                <div className="flex flex-wrap items-end gap-3 px-3 pb-3 pt-2 sm:px-4 lg:px-5">
                    <div className="-mt-8 shrink-0">
                        <Skeleton className="h-16 w-16 rounded-2xl border-4 border-background shadow-sm" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 pb-0.5">
                        <Skeleton className="h-5 w-40" />
                        <div className="flex flex-wrap items-center gap-2">
                            <Skeleton className="h-3.5 w-16" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-24 rounded-full" />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pb-0.5">
                        <div className="flex items-center gap-1.5">
                            <Skeleton className="h-2.5 w-2.5 rounded-full" />
                            <Skeleton className="h-3.5 w-14" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("border-b border-border bg-card/40", className)}>
            <div className="relative h-20 overflow-hidden bg-muted" />
            <div className="flex flex-wrap items-end gap-3 px-3 pb-3 pt-2 sm:px-4 lg:px-5">
                <div className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-card text-lg font-semibold text-muted-foreground shadow-sm">
                    {data.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 pb-0.5">
                    <div className="text-lg font-medium text-foreground">{data.name}</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">#{data.badge}</span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.role}</span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.shift}</span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.department}</span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">{data.status}</span>
                </div>
            </div>
        </div>
    );
}