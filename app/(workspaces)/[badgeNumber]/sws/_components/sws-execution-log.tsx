import {
    DetailSectionCard,
    SkeletonDefinitionListCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";

import { SWS_EXECUTION_CONFIG, SWS_EXECUTION_LOG } from "./sws-fixtures";

type SWSExecutionLogProps = BaseStatefulProps<{
    logs: typeof SWS_EXECUTION_LOG;
    config: typeof SWS_EXECUTION_CONFIG;
}>;

const DEFAULT_DATA = {
    logs: SWS_EXECUTION_LOG,
    config: SWS_EXECUTION_CONFIG,
};

export function SWSExecutionLog({ mode = "default", data = DEFAULT_DATA, className }: SWSExecutionLogProps) {
    return (
        <div className={className}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.75fr)]">
                <DetailSectionCard
                    title="Execution Log"
                    description="Recent runs and validation output"
                    action={mode === "skeleton" ? <Skeleton className="h-8 w-24 rounded-full" /> : <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">Recent</span>}
                >
                    <div className="space-y-4">
                        {mode === "skeleton"
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-44" />
                                        <Skeleton className="h-3 w-full max-w-[90%]" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                            ))
                            : data.logs.map((item) => (
                                <div key={`${item.title}-${item.timestamp}`} className="flex gap-3">
                                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/60" />
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                                        <div className="text-sm text-muted-foreground">{item.detail}</div>
                                        <div className="text-xs text-muted-foreground">{item.timestamp}</div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </DetailSectionCard>

                {mode === "skeleton" ? (
                    <SkeletonDefinitionListCard rows={4} />
                ) : (
                    <DetailSectionCard title="Execution Config">
                        <div className="space-y-3">
                            {data.config.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-muted-foreground">{item.label}</span>
                                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </DetailSectionCard>
                )}
            </div>
        </div>
    );
}