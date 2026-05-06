import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type TrainingInstallStepsCardProps = BaseStatefulProps<Array<{ label: string; value: string }>>;

export function TrainingInstallStepsCard({ mode = "default", data = [] }: TrainingInstallStepsCardProps) {
    return (
        <DetailSectionCard title="Install Steps" description="High-level install-link view for this module's linked part numbers.">
            <div className="space-y-3">
                {mode === "skeleton"
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-2 h-3 w-40" />
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
