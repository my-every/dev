import { Mail, MapPin } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type UserDetailSubheaderData = {
    name: string;
    badge: string;
    role: string;
    shift?: string | null;
    department?: string | null;
    email?: string | null;
    location?: string | null;
};

type UserDetailSubheaderProps = BaseStatefulProps<UserDetailSubheaderData>;

export function UserDetailSubheader({ mode = "default", data, className }: UserDetailSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
            <div className="space-y-3">
                <div>
                    <div className="text-lg font-medium text-foreground">{data?.name ?? "User"}</div>
                    <div className="text-sm text-muted-foreground">Badge {data?.badge ?? "—"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {data?.role ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.role}</span> : null}
                    {data?.shift ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.shift} Shift</span> : null}
                    {data?.department ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.department}</span> : null}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {data?.email ? (
                        <span className="inline-flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {data.email}
                        </span>
                    ) : null}
                
                </div>
            </div>
        </div>
    );
}
