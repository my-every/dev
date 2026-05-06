import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  WorkspaceCollectionFilters,
  type WorkspaceCollectionFilterDefinition,
  type WorkspaceCollectionFilterValue,
} from "./workspace-collection-filters";
import {
  WorkspaceCollectionViewToggle,
  type WorkspaceCollectionDisplayView,
} from "./workspace-collection-view-toggle";

type WorkspaceCollectionToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: WorkspaceCollectionFilterDefinition[];
  filterValues: Record<string, WorkspaceCollectionFilterValue>;
  onFilterChange: (filterId: string, value: WorkspaceCollectionFilterValue) => void;
  view: WorkspaceCollectionDisplayView;
  onViewChange: (value: WorkspaceCollectionDisplayView) => void;
  className?: string;
};

export function WorkspaceCollectionToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  filterValues,
  onFilterChange,
  view,
  onViewChange,
  className,
}: WorkspaceCollectionToolbarProps) {
  return (
    <div className={cn("space-y-2 sm:space-y-3", className)}>
      {/* Row 1: Search + View toggle — stacks on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-xl border-border bg-card pl-8 text-xs sm:h-10 sm:rounded-2xl sm:pl-9 sm:text-sm"
          />
        </div>
        <WorkspaceCollectionViewToggle
          value={view}
          onValueChange={onViewChange}
        />
      </div>
      {/* Row 2: Filters - responsive grid */}
      {filters.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
          <WorkspaceCollectionFilters
            filters={filters}
            values={filterValues}
            onValueChange={onFilterChange}
            className="flex-nowrap"
          />
        </div>
      )}
    </div>
  );
}
