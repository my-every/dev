import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import { WorkspaceCollectionItemRow } from "./workspace-collection-item-row";
import type { WorkspaceCollectionItem, WorkspaceCollectionRenderItemProps } from "./workspace-collection-view";

type WorkspaceCollectionListProps = {
    items: WorkspaceCollectionItem[];
    selectedItemId?: string | null;
    onSelect?: (item: WorkspaceCollectionItem) => void;
    renderRow?: (props: WorkspaceCollectionRenderItemProps) => ReactNode;
    mode?: "skeleton" | "default" | "dynamic";
};

export function WorkspaceCollectionList({
    items,
    selectedItemId,
    onSelect,
    renderRow,
    mode = "default",
}: WorkspaceCollectionListProps) {
    if (mode === "skeleton") {
        return (
            <div className="space-y-2 sm:space-y-3">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border bg-card/60 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <Skeleton className="h-8 w-8 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl" />
                            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                                <Skeleton className="h-3.5 w-28 sm:h-4 sm:w-36" />
                                <Skeleton className="h-3 w-20 sm:w-24" />
                            </div>
                            <Skeleton className="h-5 w-12 rounded-full sm:h-6 sm:w-16" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2 flex flex-col flex-1 gap-0.5 sm:space-y-3">
            {items.map((item) =>
                renderRow ? (
                    <div key={item.id}>
                        {renderRow({ item, selected: selectedItemId === item.id, onSelect })}
                    </div>
                ) : (
                    <WorkspaceCollectionItemRow
                        key={item.id}
                        item={item}
                        selected={selectedItemId === item.id}
                        onSelect={onSelect}
                    />
                )
            )}
        </div>
    );
}
