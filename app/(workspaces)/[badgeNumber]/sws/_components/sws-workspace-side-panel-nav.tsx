"use client";

import { useMemo, useState } from "react";
import { ClipboardList, FileText, Filter, GitBranch, Search } from "lucide-react";
import Link from "next/link";

import { WorkspaceSidePanelHeader, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { WorkspaceSwsTemplateRecord } from "./sws-types";
import { normalizeStageLabel } from "./sws-types";

type TabId = "active" | "draft" | "archived";
type FilterMode = "all" | "stage" | "kind";

type SWSWorkspaceSidePanelNavData = {
    badgeNumber: string;
    records: WorkspaceSwsTemplateRecord[];
};

type Props = BaseStatefulProps<SWSWorkspaceSidePanelNavData>;

const FILTERS: Array<{ id: FilterMode; label: string; icon: typeof ClipboardList }> = [
    { id: "all", label: "All", icon: ClipboardList },
    { id: "stage", label: "Stage", icon: GitBranch },
    { id: "kind", label: "Kind", icon: Filter },
];

export function SWSWorkspaceSidePanelNav({ mode = "default", data, className }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>("active");
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [searchValue, setSearchValue] = useState("");

    const records = data?.records ?? [];
    const badgeNumber = data?.badgeNumber ?? "";
    const recordsByTab = useMemo(
        () => ({
            active: records.filter((record) => record.template.status === "active" || record.template.status === "deprecated"),
            draft: records.filter((record) => record.template.status === "draft"),
            archived: records.filter((record) => record.template.status === "archived"),
        }),
        [records],
    );

    const visibleRecords = recordsByTab[activeTab];
    const searchedRecords = useMemo(() => {
        const query = searchValue.trim().toLowerCase();
        if (!query) {
            return visibleRecords;
        }

        return visibleRecords.filter((record) =>
            [
                record.template.id,
                record.template.name,
                record.template.description,
                record.template.kind,
                record.template.status,
                record.stageLabels.join(" "),
                record.template.tags.join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query),
        );
    }, [searchValue, visibleRecords]);

    const groups = useMemo(() => {
        if (filterMode === "all") {
            return [{ id: activeTab, label: normalizeStageLabel(activeTab), records: searchedRecords }];
        }

        const buckets = new Map<string, WorkspaceSwsTemplateRecord[]>();
        searchedRecords.forEach((record) => {
            const keys =
                filterMode === "kind"
                    ? [record.template.kind]
                    : record.stageLabels.length > 0
                      ? record.stageLabels
                      : ["Unlinked"];
            keys.forEach((key) => {
                const bucket = buckets.get(key) ?? [];
                bucket.push(record);
                buckets.set(key, bucket);
            });
        });

        return Array.from(buckets.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([label, grouped]) => ({
                id: label.toLowerCase().replace(/\s+/g, "-"),
                label,
                records: grouped,
            }));
    }, [activeTab, filterMode, searchedRecords]);

    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow="SWS"
                title="Template Navigator"
                subtitle="Filter statuses, search templates, and inspect a checklist record before opening the full route."
                status={mode === "skeleton" ? "Loading" : `${searchedRecords.length} visible`}
            />

            <div className="border-b border-border px-2.5 py-2.5 flex flex-col sm:px-3 sm:py-3">
                {mode === "skeleton" ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <Skeleton className="h-9 rounded-xl" />
                            <Skeleton className="h-9 rounded-xl" />
                            <Skeleton className="h-9 rounded-xl" />
                        </div>
                        <Skeleton className="h-10 rounded-2xl" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-14 rounded-full" />
                            <Skeleton className="h-8 w-14 rounded-full" />
                            <Skeleton className="h-8 w-14 rounded-full" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-1.5">
                            {([
                                ["active", "Active"],
                                ["draft", "Draft"],
                                ["archived", "Archived"],
                            ] as const).map(([tabId, label]) => (
                                <button
                                    key={tabId}
                                    type="button"
                                    onClick={() => setActiveTab(tabId)}
                                    className={cn(
                                        "rounded-xl border px-2 py-2 text-xs transition-colors",
                                        activeTab === tabId
                                            ? "border-primary/60 bg-primary/10 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:bg-accent",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="truncate">{label}</span>
                                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            {recordsByTab[tabId].length}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
                            <Input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Search templates..."
                                className="h-9 rounded-xl border-border bg-card pl-8 text-xs sm:h-10 sm:rounded-2xl sm:pl-9 sm:text-sm"
                            />
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {FILTERS.map((filter) => {
                                const Icon = filter.icon;
                                return (
                                    <Button
                                        key={filter.id}
                                        type="button"
                                        variant={filterMode === filter.id ? "default" : "outline"}
                                        size="sm"
                                        className="h-6 rounded-full px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs"
                                        onClick={() => setFilterMode(filter.id)}
                                    >
                                        <Icon className="mr-0.5 h-2.5 w-2.5 sm:mr-1 sm:h-3 sm:w-3" />
                                        <span>{filter.label}</span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-4 px-3 py-3">
                    {mode === "skeleton"
                        ? Array.from({ length: 5 }).map((_, index) => (
                              <div key={index} className="rounded-2xl border border-border bg-background/70 p-3">
                                  <div className="flex items-center gap-3">
                                      <Skeleton className="h-10 w-10 rounded-2xl" />
                                      <div className="min-w-0 flex-1 space-y-2">
                                          <Skeleton className="h-4 w-32" />
                                          <Skeleton className="h-3 w-20" />
                                      </div>
                                  </div>
                              </div>
                          ))
                        : groups.map((group) => (
                              <div key={group.id} className="space-y-2">
                                  <div className="flex items-center justify-between px-1">
                                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{group.label}</div>
                                      <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{group.records.length}</div>
                                  </div>
                                  <div className="space-y-2">
                                      {group.records.map((record) => {
                                          const normalizedId = record.template.id
                                              .replace(/[_-]+/g, " ")
                                              .toLowerCase()
                                              .replace(/\b\w/g, (c) => c.toUpperCase());
                                          return (
                                              <Link
                                                  key={`${group.id}-${record.id}`}
                                                  href={`/${badgeNumber}/sws/${encodeURIComponent(record.id)}`}
                                                  className={cn(
                                                      "block w-full rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-accent/50",
                                                      "border-border bg-background/70",
                                                  )}
                                              >
                                                  <div className="flex items-start justify-between gap-3">
                                                      <div className="flex min-w-0 items-start gap-2">
                                                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                                                          <div className="min-w-0">
                                                              <div className="truncate text-[11px] text-muted-foreground">{normalizedId}</div>
                                                              <div className="truncate text-sm font-medium text-foreground">{record.template.name}</div>
                                                              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                                  {record.template.description || "Reusable checklist template"}
                                                              </div>
                                                          </div>
                                                      </div>
                                                      <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                                                          {record.summary.taskCount}
                                                      </span>
                                                  </div>
                                                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                                                          {record.template.kind}
                                                      </span>
                                                      {record.stageLabels.slice(0, 2).map((stage) => (
                                                          <span key={stage} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                                                              {stage}
                                                          </span>
                                                      ))}
                                                  </div>
                                              </Link>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                </div>
            </ScrollArea>
        </div>
    );
}
