import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type UserTrainingProgressProps = BaseStatefulProps<Array<{ label: string; value: string }>>;

export function UserTrainingProgress({ mode = "default", data = [] }: UserTrainingProgressProps) {
    return (
        <DetailSectionCard title="Training" description="Current training and skill-development signals for this user.">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="mt-2 h-3 w-36" />
                        </div>
                    ))
                    : data.map((entry) => (
                        <div key={entry.label} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <div className="text-sm font-medium text-foreground">{entry.label}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{entry.value}</div>
                        </div>
                    ))}
            </div>
        </DetailSectionCard>
    );
}
