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
    <div className={cn("space-y-1.5 sm:space-y-2 md:space-y-3", className)}>
      {/* Row 1: Search + View toggle — always side by side, compact on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:h-3.5 sm:w-3.5 md:left-3 md:h-4 md:w-4" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-lg border-border bg-card pl-7 text-[11px] sm:h-9 sm:rounded-xl sm:pl-8 sm:text-xs md:h-10 md:rounded-2xl md:pl-9 md:text-sm"
          />
        </div>
        <WorkspaceCollectionViewToggle
          value={view}
          onValueChange={onViewChange}
        />
      </div>
      {/* Row 2: Filters - horizontal scroll on mobile */}
      {filters.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none sm:pb-1">
          <WorkspaceCollectionFilters
            filters={filters}
            values={filterValues}
            onValueChange={onFilterChange}
            className="flex-nowrap gap-1.5 sm:gap-2"
          />
        </div>
      )}
    </div>
  );
}
