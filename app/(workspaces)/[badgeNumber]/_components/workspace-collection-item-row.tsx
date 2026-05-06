import Link from "next/link";

import { cn } from "@/lib/utils";

import { WorkspaceCollectionColumn } from "./workspace-collection-column";
import type { WorkspaceCollectionItem } from "./workspace-collection-view";

type WorkspaceCollectionItemRowProps = {
    item: WorkspaceCollectionItem;
    selected?: boolean;
    onSelect?: (item: WorkspaceCollectionItem) => void;
    className?: string;
};

export function WorkspaceCollectionItemRow({
    item,
    selected = false,
    onSelect,
    className,
}: WorkspaceCollectionItemRowProps) {
    const content = (
        <div
            className={cn(
                "flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3",
                selected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-accent/50",
                className
            )}
        >
            {item.thumbnail ? (
                <div className="shrink-0">{item.thumbnail}</div>
            ) : item.icon ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground sm:h-10 sm:w-10 sm:rounded-2xl">
                    {item.icon}
                </div>
            ) : null}
            <WorkspaceCollectionColumn item={item} variant="row" />
            {item.metadata?.length ? (
                <div className="hidden items-center gap-1.5 md:flex lg:gap-2">
                    {item.metadata.slice(0, 3).map((entry) => (
                        <div key={`${item.id}-${entry.label}`} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground lg:px-2.5 lg:py-1 lg:text-[11px]">
                            <span className="uppercase tracking-[0.12em]">{entry.label}</span>
                            <span className="ml-1 text-foreground">{entry.value}</span>
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
        <button type="button" className="block w-full" onClick={() => onSelect?.(item)}>
            {content}
        </button>
    );
}
