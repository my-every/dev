"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  FolderTree,
  Link2,
  Radar,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  WorkspaceSidePanelHeader,
  type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import type {
  WorkspaceTrainingCategory,
  WorkspaceTrainingRecord,
} from "./training-types";

type TrainingSidePanelNavData = {
  modules: WorkspaceTrainingRecord[];
  categories: WorkspaceTrainingCategory[];
  selectedTrainingId?: string | null;
  onSelectTraining?: (module: WorkspaceTrainingRecord) => void;
};

type TrainingSidePanelNavProps =
  BaseStatefulProps<TrainingSidePanelNavData>;

type TrainingTab = "published" | "draft" | "archived";
type FilterMode = "all" | "category" | "type" | "operations";

const FILTER_MODES: Array<{
  id: FilterMode;
  label: string;
  icon: typeof BookOpen;
}> = [
  { id: "all", label: "All", icon: BookOpen },
  { id: "category", label: "Category", icon: FolderTree },
  { id: "type", label: "Type", icon: Link2 },
  { id: "operations", label: "Operations", icon: Radar },
];

export function TrainingSidePanelNav({
  mode = "default",
  data,
  className,
}: TrainingSidePanelNavProps) {
  const [activeTab, setActiveTab] = useState<TrainingTab>("published");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchValue, setSearchValue] = useState("");

  const modules = data?.modules ?? [];
  const categories = data?.categories ?? [];

  const moduleBuckets = useMemo(() => {
    const published = modules.filter((module) => module.status === "published");
    const draft = modules.filter((module) => module.status === "draft");
    const archived = modules.filter((module) => module.status === "archived");

    return {
      published: published.sort(sortModules),
      draft: draft.sort(sortModules),
      archived: archived.sort(sortModules),
    };
  }, [modules]);

  const visibleModules = moduleBuckets[activeTab];
  const filteredModules = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return visibleModules;
    }

    return visibleModules.filter((module) =>
      [
        module.id,
        module.name,
        module.category,
        module.type,
        module.visibility,
        ...module.tags,
        ...module.partNumbers,
        ...(module.swsTemplateIds ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchValue, visibleModules]);

  const groupedModules = useMemo(() => {
    if (filterMode === "all") {
      return [
        {
          id: activeTab,
          label: normalizeLabel(activeTab),
          modules: filteredModules,
        },
      ];
    }

    const buckets = new Map<string, WorkspaceTrainingRecord[]>();
    filteredModules.forEach((module) => {
      const key =
        filterMode === "category"
          ? getCategoryLabel(module.category, categories)
          : filterMode === "type"
            ? normalizeLabel(module.type || "Unassigned")
            : module.swsTemplateIds?.length
              ? `${module.swsTemplateIds.length} linked`
              : "No operations";
      const bucket = buckets.get(key) ?? [];
      bucket.push(module);
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, bucket]) => ({
        id: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        modules: bucket.sort(sortModules),
      }));
  }, [activeTab, categories, filterMode, filteredModules]);

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      <WorkspaceSidePanelHeader
        mode={mode}
        eyebrow="Training workspace"
        title="Training Modules"
        subtitle="Filter statuses, search modules, and group the library before opening a training detail aside."
        status={mode === "skeleton" ? "Loading" : `${filteredModules.length} visible`}
      />

      <div className="border-b border-border px-3 py-3 flex flex-col">
        {mode === "skeleton" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-9 rounded-xl" />
              <Skeleton className="h-9 rounded-xl" />
              <Skeleton className="h-9 rounded-xl" />
            </div>
            <Skeleton className="h-10 rounded-2xl" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {(
                [
                  ["published", "Published"],
                  ["draft", "Draft"],
                  ["archived", "Archived"],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs transition-colors sm:px-3 sm:text-sm",
                    activeTab === tabId
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:px-2 sm:text-[11px]">
                      {moduleBuckets[tabId].length}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search module, category, tag, part..."
                className="h-10 rounded-2xl border-border bg-card pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {FILTER_MODES.map((filter) => {
                const Icon = filter.icon;
                return (
                  <Button
                    key={filter.id}
                    type="button"
                    variant={filterMode === filter.id ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-2 text-xs sm:h-8 sm:px-3"
                    onClick={() => setFilterMode(filter.id)}
                  >
                    <Icon className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                    <span className="truncate">{filter.label}</span>
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
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-background/70 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))
            : groupedModules.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {group.label}
                    </div>
                    <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {group.modules.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.modules.map((module) => (
                      <button
                        key={`${group.id}-${module.id}`}
                        type="button"
                        onClick={() => data?.onSelectTraining?.(module)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                          data?.selectedTrainingId === module.id
                            ? "border-primary/60 bg-primary/10"
                            : "border-border bg-background/70 hover:bg-accent",
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-xs font-medium text-muted-foreground">
                          {module.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {module.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {module.id} •{" "}
                            {getCategoryLabel(module.category, categories)}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {normalizeLabel(module.type || "Unassigned")} •{" "}
                            {module.partNumbers.length} parts
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

          {!filteredModules.length && mode !== "skeleton" ? (
            <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No training modules matched the current tab and search filters.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function sortModules(
  left: WorkspaceTrainingRecord,
  right: WorkspaceTrainingRecord,
) {
  return left.name.localeCompare(right.name);
}

function getCategoryLabel(
  categoryId: string | undefined,
  categories: WorkspaceTrainingCategory[],
) {
  const match = categories.find((category) => category.id === categoryId);
  return normalizeLabel(match?.label || categoryId || "Uncategorized");
}

function normalizeLabel(value: string) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
