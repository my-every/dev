import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { WorkspaceCollectionColumn } from "./workspace-collection-column";
import type { WorkspaceCollectionItem } from "./workspace-collection-view";

type WorkspaceCollectionItemCardProps = {
    item: WorkspaceCollectionItem;
    selected?: boolean;
    onSelect?: (item: WorkspaceCollectionItem) => void;
    className?: string;
};

export function WorkspaceCollectionItemCard({
    item,
    selected = false,
    onSelect,
    className,
}: WorkspaceCollectionItemCardProps) {
    const content = (
        <div
            className={cn(
                "group relative flex h-full w-full flex-col gap-2 rounded-lg border bg-card/60 p-2.5 text-left transition-colors sm:gap-3 sm:rounded-xl sm:p-3.5",
                selected
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-border hover:bg-accent/50 hover:border-border/80",
                className
            )}
        >
            {/* Hover arrow button */}
            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 sm:right-2 sm:top-2 sm:h-6 sm:w-6">
                <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground sm:h-3 sm:w-3" />
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5">
                {item.thumbnail ? (
                    <div className="shrink-0">{item.thumbnail}</div>
                ) : item.icon ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground sm:h-9 sm:w-9 sm:rounded-xl">
                        {item.icon}
                    </div>
                ) : null}
                <WorkspaceCollectionColumn item={{ ...item, badge: undefined }} variant="card" />
            </div>
            {item.metadata?.length ? (
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {item.metadata.slice(0, 4).map((entry) => (
                        <div key={`${item.id}-${entry.label}`} className="min-w-0 space-y-0.5 rounded-md border border-border/60 bg-background/70 px-1.5 py-1 sm:rounded-lg sm:px-2 sm:py-1.5">
                            <div className="truncate text-[8px] uppercase tracking-[0.12em] sm:text-[9px]">{entry.label}</div>
                            <div className="truncate text-[9px] font-medium text-foreground sm:text-[10px]">{entry.value}</div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );

    if (item.href && !onSelect) {
        return <Link href={item.href}>{content}</Link>;
    }

    return (
        <button type="button" className="block h-full w-full" onClick={() => onSelect?.(item)}>
            {content}
        </button>
    );
}
