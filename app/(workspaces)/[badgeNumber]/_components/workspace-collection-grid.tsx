import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import { WorkspaceCollectionItemCard } from "./workspace-collection-item-card";
import type { WorkspaceCollectionItem, WorkspaceCollectionRenderItemProps } from "./workspace-collection-view";

type WorkspaceCollectionGridProps = {
    items: WorkspaceCollectionItem[];
    selectedItemId?: string | null;
    onSelect?: (item: WorkspaceCollectionItem) => void;
    renderCard?: (props: WorkspaceCollectionRenderItemProps) => ReactNode;
    mode?: "skeleton" | "default" | "dynamic";
};

export function WorkspaceCollectionGrid({
    items,
    selectedItemId,
    onSelect,
    renderCard,
    mode = "default",
}: WorkspaceCollectionGridProps) {
    if (mode === "skeleton") {
        return (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border bg-card/60 p-3 sm:rounded-2xl sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <Skeleton className="h-8 w-8 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl" />
                            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                                <Skeleton className="h-3.5 w-24 sm:h-4 sm:w-32" />
                                <Skeleton className="h-3 w-20 sm:w-24" />
                                <Skeleton className="h-3 w-28 sm:w-40" />
                            </div>
                        </div>
                        <div className="mt-3 grid gap-1.5 sm:mt-4 sm:gap-2 sm:grid-cols-2">
                            <Skeleton className="h-10 rounded-lg sm:h-12 sm:rounded-xl" />
                            <Skeleton className="h-10 rounded-lg sm:h-12 sm:rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid w-full max-w-full grid-cols-1 gap-2 overflow-hidden sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            {items.map((item) =>
                renderCard ? (
                    <div key={item.id} className="min-w-0 max-w-full overflow-hidden">
                        {renderCard({ item, selected: selectedItemId === item.id, onSelect })}
                    </div>
                ) : (
                    <WorkspaceCollectionItemCard
                        key={item.id}
                        item={item}
                        selected={selectedItemId === item.id}
                        onSelect={onSelect}
                        className="min-w-0 max-w-full"
                    />
                )
            )}
        </div>
    );
}
