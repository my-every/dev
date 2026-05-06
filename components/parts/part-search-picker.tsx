"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";
import type { PartRecord, PartsSearchResult } from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

interface PartSearchPickerProps {
    onSelect: (part: PartRecord) => void;
    selectedPartNumbers?: string[];
    placeholder?: string;
    category?: string;
}

export function PartSearchPicker({
    onSelect,
    selectedPartNumbers = [],
    placeholder = "Search by part number or description...",
    category,
}: PartSearchPickerProps) {
    const [query, setQuery] = useState("");

    const searchUrl = useMemo(() => {
        if (query.trim().length < 2) return null;
        const params = new URLSearchParams({
            query: query.trim(),
            limit: "12",
        });
        if (category && category !== "all") {
            params.set("category", category);
        }
        return `/api/parts?${params.toString()}`;
    }, [category, query]);

    const { data, isLoading } = useSWR<PartsSearchResult>(searchUrl, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    });

    const parts = data?.parts ?? [];

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={placeholder}
                    className="pl-9"
                />
            </div>

            {query.trim().length >= 2 ? (
                <div className="rounded-xl border bg-background">
                    <ScrollArea className="max-h-72">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching parts...
                            </div>
                        ) : parts.length > 0 ? (
                            <div className="divide-y">
                                {parts.map((part) => {
                                    const isSelected = selectedPartNumbers.includes(part.partNumber);
                                    return (
                                        <button
                                            key={part.partNumber}
                                            type="button"
                                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
                                            onClick={() => onSelect(part)}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm">{part.partNumber}</span>
                                                    {part.category ? (
                                                        <Badge variant="outline" className="text-[10px] capitalize">
                                                            {part.category}
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {getPartDisplayTitle(part)}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant={isSelected ? "secondary" : "ghost"}
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                <Plus className="mr-1 h-4 w-4" />
                                                {isSelected ? "Added" : "Add"}
                                            </Button>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No parts found.
                            </div>
                        )}
                    </ScrollArea>
                </div>
            ) : null}
        </div>
    );
}
