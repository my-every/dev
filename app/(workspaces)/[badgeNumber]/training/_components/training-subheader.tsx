import { BookOpen, GraduationCap } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type TrainingSubheaderData = {
    headline: string;
    subline: string;
    totalModules: number;
    categorySummary: string;
};

type TrainingSubheaderProps = BaseStatefulProps<TrainingSubheaderData>;

export function TrainingSubheader({ mode = "default", data, className }: TrainingSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-52" />
                        <Skeleton className="h-3.5 w-72" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-10 w-28 rounded-2xl" />
                        <Skeleton className="h-10 w-32 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-1.5">
                    <div className="text-lg font-medium text-foreground">{data?.headline ?? "Training workspace"}</div>
                    <div className="text-sm text-muted-foreground">{data?.subline ?? "Browse training modules and inspect details."}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{data?.totalModules ?? 0}</span>
                        <span className="text-muted-foreground">modules</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{data?.categorySummary ?? "No categories"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
