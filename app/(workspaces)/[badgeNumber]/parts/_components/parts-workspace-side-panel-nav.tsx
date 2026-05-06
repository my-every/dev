"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
    WorkspaceSidePanelHeader,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { WorkspacePartRecord } from "./parts-types";
import { normalizePartLabel } from "./parts-types";

type PartsWorkspaceSidePanelNavData = {
    parts: WorkspacePartRecord[];
    selectedPartNumber?: string | null;
    onSelectPart?: (part: WorkspacePartRecord) => void;
};

type PartsWorkspaceSidePanelNavProps = BaseStatefulProps<PartsWorkspaceSidePanelNavData>;

const ALL_CATEGORIES = "All";

export function PartsWorkspaceSidePanelNav({
    mode = "default",
    data,
    className,
}: PartsWorkspaceSidePanelNavProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
    const [searchValue, setSearchValue] = useState("");

    const parts = data?.parts ?? [];
    const selectedPartNumber = data?.selectedPartNumber ?? null;

    /** Sorted unique category options */
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const entry of parts) {
            set.add(entry.part.category);
        }
        return Array.from(set).sort();
    }, [parts]);

    const filteredParts = useMemo(() => {
        let result = parts;

        if (selectedCategory !== ALL_CATEGORIES) {
            result = result.filter((e) => e.part.category === selectedCategory);
        }

        const query = searchValue.trim().toLowerCase();
        if (query) {
            result = result.filter((entry) =>
                [
                    entry.part.partNumber,
                    entry.title,
                    entry.part.description,
                    entry.part.manufacturer,
                    entry.part.manufacturerPartNumber,
                    entry.part.category,
                    entry.part.type,
                    entry.part.source,
                    entry.part.tags?.join(" "),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query),
            );
        }

        return result;
    }, [parts, selectedCategory, searchValue]);

    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow="Parts workspace"
                title="Parts Library"
                subtitle="Browse and filter part records."
                status={mode === "skeleton" ? "Loading" : `${filteredParts.length} parts`}
            />

            {/* ── Controls ── */}
            <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5">
                {mode === "skeleton" ? (
                    <>
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-9 w-full rounded-xl" />
                    </>
                ) : (
                    <>
                        {/* Search */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder="Search part number, title…"
                                className="h-9 rounded-xl border-border bg-card pl-8 text-xs"
                            />
                        </div>

                        {/* Category dropdown */}
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="h-9 w-full rounded-xl border-border bg-card text-xs">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem key={ALL_CATEGORIES} value={ALL_CATEGORIES}>
                                    All Categories
                                </SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {normalizePartLabel(cat)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </>
                )}
            </div>

            {/* ── List ── */}
            <ScrollArea className="flex-1 min-w-0">
                <div className="space-y-1 px-3 py-2.5 min-w-0 w-full overflow-hidden">
                    {mode === "skeleton"
                        ? Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/70 p-2.5">
                                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                      <Skeleton className="h-3.5 w-28" />
                                      <Skeleton className="h-3 w-20" />
                                  </div>
                              </div>
                          ))
                        : filteredParts.map((entry, idx) => (
                              <button
                                  key={`${entry.part.partNumber}-${idx}`}
                                  type="button"
                                  onClick={() => data?.onSelectPart?.(entry)}
                                  className={cn(
                                      "flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-colors",
                                      selectedPartNumber === entry.part.partNumber
                                          ? "border-primary/50 bg-primary/8 shadow-sm"
                                          : "border-transparent hover:border-border/70 hover:bg-accent/60",
                                  )}
                              >
                                  {entry.primaryImageUrl ? (
                                      <img
                                          src={entry.primaryImageUrl}
                                          alt={entry.title}
                                          className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
                                      />
                                  ) : (
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                                          {entry.part.partNumber.slice(0, 2)}
                                      </div>
                                  )}
                                  <div className="min-w-0 flex-1 overflow-hidden">
                                      <div className="truncate text-xs font-medium text-foreground">
                                          {entry.title}
                                      </div>
                                      <div className="truncate text-[11px] text-muted-foreground">
                                          {entry.part.partNumber}
                                          <span className="mx-1 opacity-40">·</span>
                                          {normalizePartLabel(entry.part.type)}
                                      </div>
                                  </div>
                              </button>
                          ))}

                    {!filteredParts.length && mode !== "skeleton" ? (
                        <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                            No parts match the current filters.
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}
