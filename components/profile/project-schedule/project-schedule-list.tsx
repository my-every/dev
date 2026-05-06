"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    ProjectScheduleColumn,
    ProjectScheduleGroup,
    ProjectScheduleRow,
} from "@/lib/project-schedule/types";

interface ProjectScheduleListProps {
    groups: ProjectScheduleGroup[];
    columns: ProjectScheduleColumn[];
    className?: string;
}

const ALL_FILTER = "all";
const ALL_COLUMNS = "all_columns";

function getCellValue(row: ProjectScheduleRow, columnKey: string): string {
    const value = row[columnKey];
    return value === undefined || value === null ? "" : String(value);
}

function getFirstValue(row: ProjectScheduleRow, keys: string[]): string {
    for (const key of keys) {
        const value = getCellValue(row, key).trim();
        if (value) {
            return value;
        }
    }
    return "";
}

function buildRowLabel(row: ProjectScheduleRow): string {
    const pd = getFirstValue(row, ["pd", "project", "project_number", "project_no"]);
    const projectName = getFirstValue(row, ["project_name", "name", "projectname"]);
    const unit = getFirstValue(row, ["unit", "unit_number"]);

    const parts = [
        pd ? `PD ${pd}` : "",
        projectName,
        unit ? `Unit ${unit}` : "",
    ].filter(Boolean);

    return parts.join(" | ");
}

export function ProjectScheduleList({ groups, columns, className }: ProjectScheduleListProps) {
    const filterColumns = useMemo(
        () => columns.filter((column) => column.filterable !== false),
        [columns],
    );

    const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>(ALL_COLUMNS);
    const [selectedFilterValue, setSelectedFilterValue] = useState<string>(ALL_FILTER);
    const [searchTerm, setSearchTerm] = useState<string>("");

    const filterOptions = useMemo(() => {
        const options = new Map<string, string[]>();
        for (const column of filterColumns) {
            const values = new Set<string>();
            for (const group of groups) {
                for (const row of group.rows) {
                    const value = getCellValue(row, column.key);
                    if (value) {
                        values.add(value);
                    }
                }
            }
            options.set(column.key, Array.from(values).sort((left, right) => left.localeCompare(right)));
        }
        return options;
    }, [filterColumns, groups]);

    const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            groups.flatMap((group, groupIndex) =>
                group.rows.map((row, rowIndex) => [`${group.id}-${groupIndex}-${row.id}-${rowIndex}`, true]),
            ),
        ),
    );

    const selectedFilterOptions = useMemo(() => {
        if (selectedFilterColumn === ALL_COLUMNS) {
            return [];
        }
        return filterOptions.get(selectedFilterColumn) ?? [];
    }, [filterOptions, selectedFilterColumn]);

    const filteredGroups = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return groups
            .map((group) => {
                const rows = group.rows.filter((row) => {
                    const matchesColumnFilter = selectedFilterColumn === ALL_COLUMNS
                        || selectedFilterValue === ALL_FILTER
                        || getCellValue(row, selectedFilterColumn) === selectedFilterValue;

                    if (!matchesColumnFilter) {
                        return false;
                    }

                    if (!normalizedSearch) {
                        return true;
                    }

                    const haystack = columns
                        .map((column) => `${column.label} ${getCellValue(row, column.key)}`)
                        .join(" ")
                        .toLowerCase();
                    return haystack.includes(normalizedSearch);
                },
                );
                return {
                    ...group,
                    rows,
                };
            })
            .filter((group) => group.rows.length > 0);
    }, [columns, groups, searchTerm, selectedFilterColumn, selectedFilterValue]);

    const filteredRows = useMemo(
        () => filteredGroups.flatMap((group, groupIndex) =>
            group.rows.map((row, rowIndex) => ({
                itemId: `${group.id}-${groupIndex}-${row.id}-${rowIndex}`,
                groupLabel: group.projectLabel,
                row,
            })),
        ),
        [filteredGroups],
    );

    return (
        <div className={className}>
            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Search</p>
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search any schedule field"
                    />
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Filter Column</p>
                    <Select
                        value={selectedFilterColumn}
                        onValueChange={(value) => {
                            setSelectedFilterColumn(value);
                            setSelectedFilterValue(ALL_FILTER);
                        }}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="All columns" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_COLUMNS}>All columns</SelectItem>
                            {filterColumns.map((column) => (
                                <SelectItem key={column.key} value={column.key}>
                                    {column.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Filter Value</p>
                    <Select
                        value={selectedFilterValue}
                        onValueChange={setSelectedFilterValue}
                        disabled={selectedFilterColumn === ALL_COLUMNS}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="All values" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_FILTER}>All values</SelectItem>
                            {selectedFilterOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-3">
                {filteredRows.map((item) => {
                    const isOpen = openMap[item.itemId] ?? true;
                    const title = buildRowLabel(item.row) || item.row.id;

                    return (
                        <Collapsible
                            key={item.itemId}
                            open={isOpen}
                            onOpenChange={(isNextOpen) => {
                                setOpenMap((previous) => ({
                                    ...previous,
                                    [item.itemId]: isNextOpen,
                                }));
                            }}
                            className="rounded-lg border border-border"
                        >
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="h-auto w-full justify-between rounded-b-none px-3 py-2">
                                    <span className="flex items-center gap-2 text-left text-sm font-semibold">
                                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        {title}
                                    </span>
                                    <Badge variant="secondary" className="max-w-[160px] truncate">{item.groupLabel}</Badge>
                                </Button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <div className="space-y-2 px-2 pb-2">
                                    <div className="rounded-md border border-border bg-card p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold">{title}</p>
                                            <Badge variant="outline" className="text-[10px]">{item.row.id}</Badge>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {columns.map((column) => {
                                                const value = getCellValue(item.row, column.key);
                                                if (!value) {
                                                    return null;
                                                }
                                                return (
                                                    <div key={`${item.row.id}-${column.key}`} className="rounded border border-border/60 bg-muted/30 px-2 py-1.5">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{column.label}</p>
                                                        <p className="mt-0.5 text-xs break-words">{value}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}

                {filteredRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No project schedule rows match the selected filters.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
