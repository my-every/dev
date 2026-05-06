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
                "group relative flex h-full flex-col gap-2.5 rounded-xl border bg-card/60 p-3 text-left transition-colors sm:gap-3 sm:p-3.5",
                selected
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-border hover:bg-accent/50 hover:border-border/80",
                className
            )}
        >
            {/* Hover arrow button */}
            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
            </div>

            <div className="flex items-start gap-2.5">
                {item.thumbnail ? (
                    <div className="shrink-0">{item.thumbnail}</div>
                ) : item.icon ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                        {item.icon}
                    </div>
                ) : null}
                <WorkspaceCollectionColumn item={{ ...item, badge: undefined }} variant="card" />
            </div>
            {item.metadata?.length ? (
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {item.metadata.slice(0, 4).map((entry) => (
                        <div key={`${item.id}-${entry.label}`} className="space-y-0.5 rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
                            <div className="text-[9px] uppercase tracking-[0.12em]">{entry.label}</div>
                            <div className="truncate text-[10px] font-medium text-foreground">{entry.value}</div>
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
