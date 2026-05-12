"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceCollectionGrid } from "./workspace-collection-grid";
import { WorkspaceCollectionKanban, type KanbanColumnDefinition } from "./workspace-collection-kanban";
import { WorkspaceCollectionList } from "./workspace-collection-list";
import { WorkspaceCollectionToolbar } from "./workspace-collection-toolbar";
import {
    WORKSPACE_COLLECTION_ALL_VALUE,
    getDefaultWorkspaceCollectionFilterValue,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionFilterValue,
} from "./workspace-collection-filters";
import type { WorkspaceCollectionDisplayView } from "./workspace-collection-view-toggle";
import type { ViewMode } from "./workspace-view-mode";

export type WorkspaceCollectionItem = {
    id: string;
    category?: string;
    title: string;
    subtitle?: string;
    description?: string;
    badge?: string;
    showCount?: string | number;
    status?: string;
    color?: string;
    progress?: number;
    progressLabel?: string;
    metadata?: Array<{ label: string; value: string }>;
    thumbnail?: ReactNode;
    avatar?: ReactNode;
    icon?: ReactNode;
    href?: string;
    searchText?: string;
    filterValues?: Record<string, WorkspaceCollectionFilterValue>;
};

export type WorkspaceCollectionRenderItemProps = {
    item: WorkspaceCollectionItem;
    selected: boolean;
    onSelect?: (item: WorkspaceCollectionItem) => void;
};

type WorkspaceCollectionViewProps = {
    items: WorkspaceCollectionItem[];
    mode?: ViewMode;
    title?: string;
    view?: WorkspaceCollectionDisplayView;
    defaultView?: WorkspaceCollectionDisplayView;
    searchPlaceholder?: string;
    filters?: WorkspaceCollectionFilterDefinition[];
    detailMode?: "aside" | "modal" | "route";
    selectedItemId?: string | null;
    onSelect?: (item: WorkspaceCollectionItem) => void;
    renderCard?: (props: WorkspaceCollectionRenderItemProps) => ReactNode;
    renderRow?: (props: WorkspaceCollectionRenderItemProps) => ReactNode;
    className?: string;
    /** Ordered column definitions for the kanban view. Columns appear in this
     *  order; empty columns are omitted. Items not matching any definition
     *  collect into a trailing column. */
    kanbanColumnDefinitions?: KanbanColumnDefinition[];
};

export function WorkspaceCollectionView({
    items,
    mode = "default",
    title,
    view,
    defaultView = "grid",
    searchPlaceholder = "Search...",
    filters = [],
    detailMode = "aside",
    selectedItemId,
    onSelect,
    renderCard,
    renderRow,
    className,
    kanbanColumnDefinitions,
}: WorkspaceCollectionViewProps) {
    const [searchValue, setSearchValue] = useState("");
    const [internalView, setInternalView] = useState<WorkspaceCollectionDisplayView>(view ?? defaultView);
    const [filterValues, setFilterValues] = useState<Record<string, WorkspaceCollectionFilterValue>>(
        Object.fromEntries(filters.map((filter) => [filter.id, getDefaultWorkspaceCollectionFilterValue(filter)]))
    );

    useEffect(() => {
        if (view) {
            setInternalView(view);
        }
    }, [view]);

    const filteredItems = useMemo(() => {
        let nextItems = items;

        if (searchValue.trim()) {
            const query = searchValue.trim().toLowerCase();
            nextItems = nextItems.filter((item) => {
                const haystack = [
                    item.title,
                    item.subtitle,
                    item.description,
                    item.badge,
                    item.searchText,
                    ...(item.metadata?.map((entry) => `${entry.label} ${entry.value}`) ?? []),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(query);
            });
        }

        filters.forEach((filter) => {
            const activeValue = filterValues[filter.id];
            if (isInactiveWorkspaceCollectionFilterValue(filter, activeValue)) {
                return;
            }

            nextItems = nextItems.filter((item) => {
                const value = item.filterValues?.[filter.id];
                return matchesWorkspaceCollectionFilterValue(filter, activeValue, value);
            });
        });

        return nextItems;
    }, [filterValues, filters, items, searchValue]);

    return (
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
        <WorkspaceCollectionToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder={searchPlaceholder}
            filters={filters}
            filterValues={filterValues}
            onFilterChange={(filterId, value) =>
                setFilterValues((current) => ({ ...current, [filterId]: value }))
            }
            view={internalView}
            onViewChange={setInternalView}
        />

        {internalView === "grid" ? (
            <WorkspaceCollectionGrid
                items={filteredItems}
                selectedItemId={selectedItemId}
                onSelect={onSelect}
                renderCard={renderCard}
                mode={mode}
            />
        ) : internalView === "kanban" ? (
            <WorkspaceCollectionKanban
                items={filteredItems}
                selectedItemId={selectedItemId}
                onSelect={onSelect}
                renderCard={renderCard}
                mode={mode}
                columnDefinitions={kanbanColumnDefinitions}
            />
        ) : (
            <WorkspaceCollectionList
                items={filteredItems}
                selectedItemId={selectedItemId}
                onSelect={onSelect}
                renderRow={renderRow}
                mode={mode}
            />
        )}
    </div>
    );
}

function isInactiveWorkspaceCollectionFilterValue(
    filter: WorkspaceCollectionFilterDefinition,
    value: WorkspaceCollectionFilterValue
) {
    switch (filter.type) {
        case "multi-select":
            return !Array.isArray(value) || value.length === 0;
        case "checkbox":
            return value !== true;
        case "rating":
            return typeof value !== "number" || Number.isNaN(value);
        case "choice":
            return value === undefined || value === null || value === "" || value === WORKSPACE_COLLECTION_ALL_VALUE;
        case "custom":
            return value === undefined || value === null;
        case "select":
        default:
            return value === undefined || value === null || value === "" || value === WORKSPACE_COLLECTION_ALL_VALUE;
    }
}

function matchesWorkspaceCollectionFilterValue(
    filter: WorkspaceCollectionFilterDefinition,
    activeValue: WorkspaceCollectionFilterValue,
    itemValue: WorkspaceCollectionFilterValue
) {
    switch (filter.type) {
        case "multi-select": {
            const selectedValues = Array.isArray(activeValue)
                ? activeValue.filter((entry): entry is string => typeof entry === "string")
                : [];
            const itemValues = Array.isArray(itemValue)
                ? itemValue.filter((entry): entry is string => typeof entry === "string")
                : typeof itemValue === "string"
                    ? [itemValue]
                    : [];

            if (filter.matchMode === "every") {
                return selectedValues.every((value) => itemValues.includes(value));
            }

            return selectedValues.some((value) => itemValues.includes(value));
        }
        case "checkbox":
            return itemValue === true;
        case "rating": {
            const threshold = typeof activeValue === "number" ? activeValue : Number.NaN;
            const comparableValue =
                typeof itemValue === "number"
                    ? itemValue
                    : typeof itemValue === "string"
                        ? Number(itemValue)
                        : Number.NaN;
            return !Number.isNaN(comparableValue) && comparableValue >= threshold;
        }
        case "choice":
        case "select":
        case "custom":
        default:
            if (Array.isArray(itemValue)) {
                return itemValue.includes(activeValue as never);
            }
            return itemValue === activeValue;
    }
}
