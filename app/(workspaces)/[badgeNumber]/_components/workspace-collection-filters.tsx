import type { ReactNode } from "react";
import { Check, ChevronDown, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type WorkspaceCollectionFilterOption = {
    value: string;
    label: string;
};

export const WORKSPACE_COLLECTION_ALL_VALUE = "all";

export type WorkspaceCollectionFilterValue =
    | string
    | string[]
    | boolean
    | number
    | [number, number]
    | null
    | undefined;

type WorkspaceCollectionBaseFilterDefinition = {
    id: string;
    label: string;
    className?: string;
    defaultValue?: WorkspaceCollectionFilterValue;
};

export type WorkspaceCollectionSelectFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type?: "select";
    options: WorkspaceCollectionFilterOption[];
    placeholder?: string;
    allLabel?: string;
};

export type WorkspaceCollectionMultiSelectFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type: "multi-select";
    options: WorkspaceCollectionFilterOption[];
    placeholder?: string;
    emptyLabel?: string;
    matchMode?: "some" | "every";
};

export type WorkspaceCollectionCheckboxFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type: "checkbox";
    description?: string;
};

export type WorkspaceCollectionChoiceFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type: "choice";
    options: WorkspaceCollectionFilterOption[];
    allowEmpty?: boolean;
    emptyLabel?: string;
};

export type WorkspaceCollectionRatingFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type: "rating";
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    formatValue?: (value: number) => string;
};

export type WorkspaceCollectionCustomFilterDefinition = WorkspaceCollectionBaseFilterDefinition & {
    type: "custom";
    render: (props: {
        filter: WorkspaceCollectionCustomFilterDefinition;
        value: WorkspaceCollectionFilterValue;
        onValueChange: (value: WorkspaceCollectionFilterValue) => void;
    }) => ReactNode;
};

export type WorkspaceCollectionFilterDefinition =
    | WorkspaceCollectionSelectFilterDefinition
    | WorkspaceCollectionMultiSelectFilterDefinition
    | WorkspaceCollectionCheckboxFilterDefinition
    | WorkspaceCollectionChoiceFilterDefinition
    | WorkspaceCollectionRatingFilterDefinition
    | WorkspaceCollectionCustomFilterDefinition;

export function getDefaultWorkspaceCollectionFilterValue(
    filter: WorkspaceCollectionFilterDefinition
): WorkspaceCollectionFilterValue {
    if (filter.defaultValue !== undefined) {
        return filter.defaultValue;
    }

    switch (filter.type) {
        case "multi-select":
            return [];
        case "checkbox":
            return false;
        case "rating":
        case "choice":
        case "custom":
            return undefined;
        case "select":
        default:
            return WORKSPACE_COLLECTION_ALL_VALUE;
    }
}

type WorkspaceCollectionFiltersProps = {
    filters: WorkspaceCollectionFilterDefinition[];
    values: Record<string, WorkspaceCollectionFilterValue>;
    onValueChange: (filterId: string, value: WorkspaceCollectionFilterValue) => void;
    className?: string;
};

export function WorkspaceCollectionFilters({
    filters,
    values,
    onValueChange,
    className,
}: WorkspaceCollectionFiltersProps) {
    if (filters.length === 0) {
        return null;
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {filters.map((filter) => (
                <WorkspaceCollectionFilterControl
                    key={filter.id}
                    filter={filter}
                    value={values[filter.id]}
                    onValueChange={(value) => onValueChange(filter.id, value)}
                />
            ))}
        </div>
    );
}

function WorkspaceCollectionFilterControl({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    switch (filter.type) {
        case "multi-select":
            return (
                <WorkspaceCollectionMultiSelectFilter
                    filter={filter}
                    value={value}
                    onValueChange={onValueChange}
                />
            );
        case "checkbox":
            return (
                <WorkspaceCollectionCheckboxFilter
                    filter={filter}
                    value={value}
                    onValueChange={onValueChange}
                />
            );
        case "choice":
            return (
                <WorkspaceCollectionChoiceFilter
                    filter={filter}
                    value={value}
                    onValueChange={onValueChange}
                />
            );
        case "rating":
            return (
                <WorkspaceCollectionRatingFilter
                    filter={filter}
                    value={value}
                    onValueChange={onValueChange}
                />
            );
        case "custom":
            return filter.render({ filter, value, onValueChange });
        case "select":
        default:
            return (
                <WorkspaceCollectionSelectFilter
                    filter={filter}
                    value={value}
                    onValueChange={onValueChange}
                />
            );
    }
}

function WorkspaceCollectionSelectFilter({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionSelectFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    const selectedValue = typeof value === "string" ? value : WORKSPACE_COLLECTION_ALL_VALUE;

    return (
        <Select value={selectedValue} onValueChange={onValueChange}>
            <SelectTrigger className={cn("h-9 w-[120px] shrink-0 rounded-lg border-border bg-card text-xs sm:w-[140px]", filter.className)}>
                <SelectValue placeholder={filter.placeholder ?? filter.label} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem key={WORKSPACE_COLLECTION_ALL_VALUE} value={WORKSPACE_COLLECTION_ALL_VALUE} index={0}>
                    {filter.allLabel ?? `All ${filter.label}`}
                </SelectItem>
                {filter.options.map((option, index) => (
                    <SelectItem key={option.value} value={option.value} index={index + 1}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function WorkspaceCollectionMultiSelectFilter({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionMultiSelectFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    const selectedValues = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    const selectedLabels = filter.options
        .filter((option) => selectedValues.includes(option.value))
        .map((option) => option.label);
    const summary =
        selectedLabels.length === 0
            ? filter.emptyLabel ?? filter.label
            : selectedLabels.length <= 2
                ? selectedLabels.join(", ")
                : `${selectedLabels.length} selected`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 min-w-42.5 justify-between rounded-lg border-border bg-card text-xs font-normal", filter.className)}
                >
                    <span className="truncate">{summary}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2 p-2">
                <div className="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">{filter.placeholder ?? filter.label}</div>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                    {filter.options.map((option) => {
                        const checked = selectedValues.includes(option.value);

                        return (
                            <button
                                key={option.value}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={() => {
                                    const nextValue = checked
                                        ? selectedValues.filter((entry) => entry !== option.value)
                                        : [...selectedValues, option.value];
                                    onValueChange(nextValue);
                                }}
                            >
                                <Checkbox checked={checked} />
                                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end border-t border-border px-1 pt-2">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onValueChange([])}>
                        Clear
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function WorkspaceCollectionCheckboxFilter({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionCheckboxFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    const checked = value === true;

    return (
        <button
            type="button"
            className={cn(
                "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs transition-colors hover:bg-accent",
                checked && "border-primary/40 bg-accent",
                filter.className,
            )}
            onClick={() => onValueChange(!checked)}
        >
            <Checkbox checked={checked} />
            <span>{filter.label}</span>
        </button>
    );
}

function WorkspaceCollectionChoiceFilter({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionChoiceFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    const selectedValue = typeof value === "string" ? value : "";

    return (
        <ToggleGroup
            type="single"
            value={selectedValue || WORKSPACE_COLLECTION_ALL_VALUE}
            variant="outline"
            size="sm"
            className={cn("rounded-lg border border-border bg-card", filter.className)}
            onValueChange={(nextValue) => {
                if (!nextValue || nextValue === WORKSPACE_COLLECTION_ALL_VALUE) {
                    onValueChange(undefined);
                    return;
                }
                onValueChange(nextValue);
            }}
        >
            {filter.allowEmpty ? (
                <ToggleGroupItem value={WORKSPACE_COLLECTION_ALL_VALUE} className="px-3 text-xs">
                    {filter.emptyLabel ?? "All"}
                </ToggleGroupItem>
            ) : null}
            {filter.options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="px-3 text-xs">
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

function WorkspaceCollectionRatingFilter({
    filter,
    value,
    onValueChange,
}: {
    filter: WorkspaceCollectionRatingFilterDefinition;
    value: WorkspaceCollectionFilterValue;
    onValueChange: (value: WorkspaceCollectionFilterValue) => void;
}) {
    const min = filter.min ?? 1;
    const max = filter.max ?? 5;
    const step = filter.step ?? 1;
    const selectedValue = typeof value === "number" ? value : undefined;
    const summary = selectedValue
        ? filter.formatValue?.(selectedValue) ?? `${selectedValue}+`
        : filter.placeholder ?? filter.label;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 min-w-35 justify-between rounded-lg border-border bg-card text-xs font-normal", filter.className)}
                >
                    <span className="flex items-center gap-2 truncate">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {summary}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{filter.label}</span>
                    <button
                        type="button"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => onValueChange(undefined)}
                    >
                        Clear
                    </button>
                </div>
                <Slider
                    value={selectedValue ?? min}
                    min={min}
                    max={max}
                    step={step}
                    showValue
                    formatValue={(nextValue) => filter.formatValue?.(nextValue) ?? `${nextValue}`}
                    onChange={(nextValue) => onValueChange(Array.isArray(nextValue) ? nextValue[0] : nextValue)}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
            </PopoverContent>
        </Popover>
    );
}
