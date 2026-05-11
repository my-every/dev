import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { WorkspaceCollectionItem } from "./workspace-collection-view";

type WorkspaceCollectionColumnProps = {
    item: Pick<
        WorkspaceCollectionItem,
        | "category"
        | "title"
        | "subtitle"
        | "description"
        | "badge"
        | "showCount"
        | "status"
        | "color"
        | "progress"
        | "progressLabel"
    >;
    variant?: "card" | "row";
    className?: string;
};

export function WorkspaceCollectionColumn({
    item,
    variant = "card",
    className,
}: WorkspaceCollectionColumnProps) {
    const progressValue =
        typeof item.progress === "number"
            ? Math.max(0, Math.min(100, item.progress))
            : null;
    const statusDotStyle = item.color ? { backgroundColor: item.color } : undefined;
    const progressStyle = item.color
        ? ({ "--workspace-collection-progress": item.color } as React.CSSProperties)
        : undefined;

    if (variant === "row") {
        return (
            <div className={cn("min-w-0 flex-1", className)}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                        {item.category ? (
                            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                {item.category}
                            </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                            {item.showCount !== undefined && item.showCount !== null ? (
                                <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] tabular-nums">
                                    {item.showCount}
                                </Badge>
                            ) : null}
                            {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
                            {item.status ? (
                                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                                    <span
                                        className="h-1.5 w-1.5 rounded-full bg-primary"
                                        style={statusDotStyle}
                                    />
                                    <span className="truncate text-foreground">{item.status}</span>
                                </div>
                            ) : null}
                        </div>
                        {item.subtitle ? (
                            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                        ) : null}
                        {item.description ? (
                            <div className="line-clamp-1 text-xs text-muted-foreground">{item.description}</div>
                        ) : null}
                    </div>
                </div>

                {progressValue !== null ? (
                    <div className="mt-2 flex items-center gap-2" style={progressStyle}>
                        <Progress
                            value={progressValue}
                            className="h-1.5 flex-1 bg-muted **:data-[slot=progress-indicator]:bg-(--workspace-collection-progress)"
                        />
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                            {item.progressLabel ?? `${Math.round(progressValue)}%`}
                        </span>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={cn("min-w-0 flex-1 space-y-1.5 sm:space-y-2", className)}>
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 space-y-0.5 sm:space-y-1">
                    {item.category ? (
                        <div className="truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                            {item.category}
                        </div>
                    ) : null}
                    {item.subtitle ? (
                        <div className="truncate text-[10px] text-muted-foreground sm:text-xs">{item.subtitle}</div>
                    ) : null}
                    <div className="truncate text-xs font-semibold text-foreground sm:text-sm">{item.title}</div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
                    {item.showCount !== undefined && item.showCount !== null ? (
                        <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[9px] tabular-nums sm:h-5 sm:px-2 sm:text-[10px]">
                            {item.showCount}
                        </Badge>
                    ) : null}
                    {item.badge ? <Badge variant="outline" className="text-[9px] sm:text-xs">{item.badge}</Badge> : null}
                    {item.status ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] text-muted-foreground sm:px-2.5 sm:py-1 sm:text-[11px]">
                            <span className="h-1 w-1 rounded-full bg-primary sm:h-1.5 sm:w-1.5" style={statusDotStyle} />
                            <span className="truncate text-foreground">{item.status}</span>
                        </div>
                    ) : null}
                </div>
            </div>

            {item.description ? (
                <p className="line-clamp-2 text-[10px] text-muted-foreground sm:text-xs">{item.description}</p>
            ) : null}

            {progressValue !== null ? (
                <div className="space-y-1 sm:space-y-1.5" style={progressStyle}>
                    <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground sm:text-[11px]">
                        <span>Progress</span>
                        <span>{item.progressLabel ?? `${Math.round(progressValue)}%`}</span>
                    </div>
                    <Progress
                        value={progressValue}
                        className="h-1 bg-muted sm:h-1.5 **:data-[slot=progress-indicator]:bg-(--workspace-collection-progress)"
                    />
                </div>
            ) : null}
        </div>
    );
}
