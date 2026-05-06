import {
    DetailSectionCard,
    SkeletonMetricGrid,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import {
    SWS_ACCESSORY_HINTS,
    SWS_BLOCKERS,
    SWS_DESCRIPTION,
    SWS_METRICS,
    SWS_REVIEW_REQUIREMENTS,
} from "./sws-fixtures";

type SWSOverviewCardsProps = BaseStatefulProps<{
    metrics: typeof SWS_METRICS;
    description: typeof SWS_DESCRIPTION;
    accessoryHints: typeof SWS_ACCESSORY_HINTS;
    reviewRequirements: typeof SWS_REVIEW_REQUIREMENTS;
    blockers: typeof SWS_BLOCKERS;
}>;

const DEFAULT_DATA = {
    metrics: SWS_METRICS,
    description: SWS_DESCRIPTION,
    accessoryHints: SWS_ACCESSORY_HINTS,
    reviewRequirements: SWS_REVIEW_REQUIREMENTS,
    blockers: SWS_BLOCKERS,
};

export function SWSOverviewCards({ mode = "default", data = DEFAULT_DATA, className }: SWSOverviewCardsProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.75fr)]">
                <div className="space-y-4">
                    {mode === "skeleton" ? (
                        <SkeletonMetricGrid count={4} className="sm:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-none" />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                            {data.metrics.map((item) => (
                                <div key={item.label} className="rounded-xl border border-border bg-card/60 p-4">
                                    <p className="mb-2 text-xs text-muted-foreground">{item.label}</p>
                                    <div className="mb-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
                                    <p className="text-xs text-muted-foreground">{item.note}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <DetailSectionCard title="Description" mode={mode}>
                        {mode === "skeleton" ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full max-w-[95%]" />
                                <Skeleton className="h-4 w-full max-w-[88%]" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {data.description.map((line) => (
                                    <p key={line} className="text-sm text-muted-foreground">{line}</p>
                                ))}
                            </div>
                        )}
                    </DetailSectionCard>

                    <DetailSectionCard title="Accessory Hardware" description="Hints and required accessories">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                                        <Skeleton className="h-3.5 flex-1 max-w-[90%]" />
                                    </div>
                                ))
                                : data.accessoryHints.map((item) => (
                                    <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                                        <span className="text-sm text-foreground">{item}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>

                <div className="space-y-4">
                    <DetailSectionCard title="Review Requirements">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex gap-3">
                                        <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                                        <Skeleton className="h-4 flex-1 max-w-[90%]" />
                                    </div>
                                ))
                                : data.reviewRequirements.map((item) => (
                                    <div key={item} className="flex gap-3">
                                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                                        <span className="text-sm text-foreground">{item}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>

                    <DetailSectionCard title="Blockers">
                        <div className="space-y-2">
                            {mode === "skeleton"
                                ? Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="flex gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <Skeleton className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" />
                                        <Skeleton className="h-4 flex-1 max-w-[90%]" />
                                    </div>
                                ))
                                : data.blockers.map((item) => (
                                    <div key={item} className="flex gap-3 rounded-xl border border-border bg-background/70 p-3">
                                        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                                        <span className="text-sm text-foreground">{item}</span>
                                    </div>
                                ))}
                        </div>
                    </DetailSectionCard>
                </div>
            </div>
        </div>
    );
}