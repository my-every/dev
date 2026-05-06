import { ShieldCheck, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type UsersSubheaderData = {
    headline: string;
    subline: string;
    totalUsers: number;
    shiftSummary: string;
};

type UsersSubheaderProps = BaseStatefulProps<UsersSubheaderData>;

export function UsersSubheader({ mode = "default", data, className }: UsersSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3.5 w-64" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-10 w-28 rounded-2xl" />
                        <Skeleton className="h-10 w-28 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-1.5">
                    <div className="text-lg font-medium text-foreground">{data?.headline ?? "Users workspace"}</div>
                    <div className="text-sm text-muted-foreground">{data?.subline ?? "Browse the live team directory and access context."}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{data?.totalUsers ?? 0}</span>
                        <span className="text-muted-foreground">team members</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{data?.shiftSummary ?? "Mixed shifts"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
