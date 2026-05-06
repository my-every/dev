import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { BaseStatefulProps } from "./workspace-view-mode";

export type WorkspaceDetailSubheaderMetadataItem = {
    label: ReactNode;
    value: ReactNode;
};

type WorkspaceDetailSubheaderProps = BaseStatefulProps & {
    title?: ReactNode;
    description?: ReactNode;
    metadata?: WorkspaceDetailSubheaderMetadataItem[];
    actions?: ReactNode;
};

export function WorkspaceDetailSubheader({
    mode = "default",
    title,
    description,
    metadata = [],
    actions,
    className,
}: WorkspaceDetailSubheaderProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("border-b border-border bg-card/40 px-3 py-3 sm:px-4 lg:px-5", className)}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-40 max-w-[75%]" />
                        <Skeleton className="h-3.5 w-72 max-w-[95%]" />
                        <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="rounded-xl border border-border bg-background/70 px-3 py-2.5">
                                    <Skeleton className="mb-2 h-3 w-20" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Skeleton className="h-8 w-24 rounded-xl" />
                        <Skeleton className="h-8 w-20 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("border-b border-border bg-card/40 px-3 py-3 sm:px-4 lg:px-5", className)}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                    {title ? <div className="truncate text-base font-medium text-foreground sm:text-lg">{title}</div> : null}
                    {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
                    {metadata.length > 0 ? (
                        <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                            {metadata.map((item, index) => (
                                <div key={index} className="rounded-xl border border-border bg-background/70 px-3 py-2.5">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                                    <div className="text-sm font-medium text-foreground">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
        </div>
    );
}