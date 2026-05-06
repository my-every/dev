import { BookOpen, Link2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type TrainingDetailSubheaderData = {
    name: string;
    category?: string | null;
    difficulty?: string | null;
    status?: string | null;
    partCount: number;
    stageCount: number;
};

type TrainingDetailSubheaderProps = BaseStatefulProps<TrainingDetailSubheaderData>;

export function TrainingDetailSubheader({ mode = "default", data, className }: TrainingDetailSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40 px-3 py-4 sm:px-4 lg:px-5", className)}>
                <div className="space-y-2">
                    <Skeleton className="h-6 w-56" />
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
                    <div className="text-lg font-medium text-foreground">{data?.name ?? "Training Module"}</div>
                    <div className="text-sm text-muted-foreground">{data?.category ?? "Uncategorized"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {data?.difficulty ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.difficulty}</span> : null}
                    {data?.status ? <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.status}</span> : null}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" /> {data?.stageCount ?? 0} stages</span>
                    <span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4" /> {data?.partCount ?? 0} part numbers</span>
                </div>
            </div>
        </div>
    );
}
