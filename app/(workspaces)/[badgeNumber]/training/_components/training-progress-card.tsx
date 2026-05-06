import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type TrainingProgressCardProps = BaseStatefulProps<Array<{ label: string; value: string }>>;

export function TrainingProgressCard({ mode = "default", data = [] }: TrainingProgressCardProps) {
    return (
        <DetailSectionCard title="Progress Signals" description="Simple progress and readiness indicators for this training module.">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))
                    : data.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between rounded-xl border border-border bg-background/80 px-3 py-3">
                            <span className="text-sm text-foreground">{entry.label}</span>
                            <span className="text-sm font-medium text-muted-foreground">{entry.value}</span>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}
