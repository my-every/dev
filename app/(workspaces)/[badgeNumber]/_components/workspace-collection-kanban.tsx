import Link from "next/link";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { WorkspaceCollectionColumn } from "./workspace-collection-column";
import type { WorkspaceCollectionItem, WorkspaceCollectionRenderItemProps } from "./workspace-collection-view";

export type KanbanColumnDefinition = {
  id: string;
  label: string;
};

type WorkspaceCollectionKanbanProps = {
  items: WorkspaceCollectionItem[];
  selectedItemId?: string | null;
  onSelect?: (item: WorkspaceCollectionItem) => void;
  renderCard?: (props: WorkspaceCollectionRenderItemProps) => ReactNode;
  mode?: "skeleton" | "default" | "dynamic";
  /** Optional ordered column definitions. When provided, columns appear in
   *  this order (empty columns are omitted). Items whose category does not
   *  match any definition are collected into a trailing "Other" column. */
  columnDefinitions?: KanbanColumnDefinition[];
};

type KanbanColumn = {
  id: string;
  label: string;
  items: WorkspaceCollectionItem[];
};

export function WorkspaceCollectionKanban({
  items,
  selectedItemId,
  onSelect,
  renderCard,
  mode = "default",
  columnDefinitions,
}: WorkspaceCollectionKanbanProps) {
  if (mode === "skeleton") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, columnIndex) => (
          <div key={columnIndex} className="space-y-2 rounded-2xl border border-border bg-card/40 p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div key={cardIndex} className="rounded-xl border border-border bg-card/70 p-3">
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const columns = buildKanbanColumns(items, columnDefinitions);

  return (
    <div className="grid gap-3 h-full sm:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => (
        <section key={column.id} className="min-h-0 space-y-2 rounded-2xl border border-border bg-card/35 p-2.5 sm:p-3">
          <header className="flex items-center justify-between border-b border-border/70 pb-2">
            <h3 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{column.label}</h3>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {column.items.length}
            </span>
          </header>

          <div className="space-y-2 flex flex-col gap-1">
            {column.items.map((item) =>
              renderCard ? (
                <div key={item.id}>{renderCard({ item, selected: selectedItemId === item.id, onSelect })}</div>
              ) : (
                <WorkspaceCollectionKanbanItem
                  key={item.id}
                  item={item}
                  selected={selectedItemId === item.id}
                  onSelect={onSelect}
                />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function WorkspaceCollectionKanbanItem({
  item,
  selected,
  onSelect,
}: {
  item: WorkspaceCollectionItem;
  selected: boolean;
  onSelect?: (item: WorkspaceCollectionItem) => void;
}) {
  const content = (
    <div
      className={cn(
        "rounded-xl border bg-card/80 p-3 text-left transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/50"
      )}
    >
      <div className="flex items-start gap-2.5">
        {item.thumbnail ? (
          <div className="shrink-0">{item.thumbnail}</div>
        ) : item.icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            {item.icon}
          </div>
        ) : null}
        <WorkspaceCollectionColumn item={item} variant="card" />
      </div>

      {item.metadata?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.metadata.slice(0, 2).map((entry) => (
            <div
              key={`${item.id}-${entry.label}`}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
            >
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

function buildKanbanColumns(
  items: WorkspaceCollectionItem[],
  columnDefinitions?: KanbanColumnDefinition[],
): KanbanColumn[] {
  // Build a lookup map of all items by their derived column id
  const dynamicMap = new Map<string, KanbanColumn>();
  items.forEach((item) => {
    const label = item.category || item.status || item.badge || "Uncategorized";
    const id = label.toLowerCase().replace(/\s+/g, "-");
    const existing = dynamicMap.get(id);
    if (existing) {
      existing.items.push(item);
    } else {
      dynamicMap.set(id, { id, label, items: [item] });
    }
  });

  if (!columnDefinitions?.length) {
    // No order prescribed — return insertion order (original behaviour)
    return Array.from(dynamicMap.values());
  }

  // Build columns in the prescribed order, omitting empty ones
  const orderedColumns: KanbanColumn[] = [];
  const coveredIds = new Set<string>();

  for (const def of columnDefinitions) {
    const col = dynamicMap.get(def.id);
    if (col && col.items.length > 0) {
      // Use the definition's label for consistent display
      orderedColumns.push({ ...col, label: def.label });
      coveredIds.add(def.id);
    }
  }

  // Append any columns whose items didn't match a defined column
  for (const col of dynamicMap.values()) {
    if (!coveredIds.has(col.id) && col.items.length > 0) {
      orderedColumns.push(col);
    }
  }

  return orderedColumns;
}
