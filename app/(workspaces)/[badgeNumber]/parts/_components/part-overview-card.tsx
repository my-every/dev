import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { PART_ELECTRICAL_PROPERTIES, PART_OVERVIEW } from "./part-fixtures";

type PartOverviewCardProps = BaseStatefulProps<{
    overview: typeof PART_OVERVIEW;
    properties: typeof PART_ELECTRICAL_PROPERTIES;
}>;

const DEFAULT_DATA = {
    overview: PART_OVERVIEW,
    properties: PART_ELECTRICAL_PROPERTIES,
};

export function PartOverviewCard({ mode = "default", data = DEFAULT_DATA, className }: PartOverviewCardProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.75fr)]">
                <div className="space-y-4">
                    <DetailSectionCard>
                        {mode === "skeleton" ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-5 w-28" />
                                        <Skeleton className="h-4 w-64 max-w-full" />
                                        <Skeleton className="h-3 w-48 max-w-full" />
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            <Skeleton className="h-5 w-28 rounded-full" />
                                            <Skeleton className="h-5 w-20 rounded-full" />
                                            <Skeleton className="h-5 w-24 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="rounded-xl border border-border bg-background/70 p-3">
                                            <Skeleton className="mb-1.5 h-3 w-20" />
                                            <Skeleton className="h-5 w-24" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xl font-semibold text-muted-foreground">
                                        {data.overview.partNumber.slice(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="text-lg font-semibold text-foreground">{data.overview.partNumber}</div>
                                        <div className="text-sm text-foreground">{data.overview.description}</div>
                                        <div className="text-xs text-muted-foreground">{data.overview.note}</div>
                                        
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {data.overview.summary.map((item) => (
                                        <div key={item.label} className="rounded-xl border border-border bg-background/70 p-3">
                                            <p className="mb-1.5 text-xs text-muted-foreground">{item.label}</p>
                                            <div className="text-sm font-medium text-foreground">{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DetailSectionCard>

                    <DetailSectionCard title="Electrical Properties" description="Wire gauges, ratings, and connection specs">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2.5">
                                        <Skeleton className="h-3.5 w-32" />
                                        <Skeleton className="h-3.5 w-20" />
                                    </div>
                                ))
                                : data.properties.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2.5">
                                        <span className="text-sm text-foreground">{item.label}</span>
                                        <span className="text-xs text-muted-foreground">{item.value}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>
            </div>
        </div>
    );
}