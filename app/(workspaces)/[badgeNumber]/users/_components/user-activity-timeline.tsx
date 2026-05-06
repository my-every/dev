import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type UserActivityTimelineProps = BaseStatefulProps<Array<{ label: string; value: string }>>;

export function UserActivityTimeline({ mode = "default", data = [] }: UserActivityTimelineProps) {
    return (
        <DetailSectionCard title="Activity" description="Recent user activity captured from the live activity service.">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex gap-3 rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                        </div>
                    ))
                    : data.map((entry, index) => (
                        <div key={`${entry.label}-${index}`} className="flex gap-3 rounded-xl border border-border bg-background/80 px-3 py-3">
                            <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-foreground">{entry.label}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.value}</div>
                            </div>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}
