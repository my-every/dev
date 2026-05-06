import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

type TrainingOverviewCardData = {
    id: string;
    description?: string | null;
    visibility?: string | null;
    type?: string | null;
    totalEstimatedMinutes?: number | null;
};

type TrainingOverviewCardProps = BaseStatefulProps<TrainingOverviewCardData>;

export function TrainingOverviewCard({ mode = "default", data }: TrainingOverviewCardProps) {
    return (
        <DetailSectionCard title="Overview" description="Primary module metadata and high-level summary.">
            <div className="grid gap-3 md:grid-cols-2">
                {mode === "skeleton"
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="mt-2 h-4 w-32" />
                        </div>
                    ))
                    : [
                        ["Module ID", data?.id ?? "—"],
                        ["Visibility", data?.visibility ?? "—"],
                        ["Type", data?.type ?? "—"],
                        ["Minutes", data?.totalEstimatedMinutes ? `${data.totalEstimatedMinutes}` : "—"],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-border bg-background/80 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
                            <div className="mt-1 text-sm text-foreground">{value}</div>
                        </div>
                    ))}
            </div>
            {mode === "dynamic" && data?.description ? (
                <div className="mt-4 rounded-xl border border-border bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                    {data.description}
                </div>
            ) : null}
        </DetailSectionCard>
    );
}
