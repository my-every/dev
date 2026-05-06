"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Layers, Plus, Search } from "lucide-react";

import { PartStackEditorDialog } from "@/components/parts/part-stack-editor-dialog";
import { PartStacksDialog } from "@/components/parts/part-stacks-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PartStack, PartStackUseCase } from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

interface PartStackSelectorProps {
    value: string[];
    onChange: (next: string[]) => void;
    label?: string;
    useCase?: PartStackUseCase;
    allowMultiple?: boolean;
}

export function PartStackSelector({
    value,
    onChange,
    label = "Reusable Stacks",
    useCase,
    allowMultiple = true,
}: PartStackSelectorProps) {
    const [query, setQuery] = useState("");
    const { data, mutate } = useSWR<{ stacks: PartStack[] }>(
        `/api/parts/stacks${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ""}`,
        fetcher,
        { revalidateOnFocus: false },
    );

    const stacks = useMemo(() => {
        const all = data?.stacks ?? [];
        if (!useCase) return all;
        return all.filter((stack) => (stack.useCases ?? []).includes(useCase));
    }, [data?.stacks, useCase]);

    const selectedStacks = stacks.filter((stack) => value.includes(stack.id));

    const toggleStack = (stackId: string) => {
        if (allowMultiple) {
            onChange(value.includes(stackId) ? value.filter((id) => id !== stackId) : [...value, stackId]);
            return;
        }
        onChange(value.includes(stackId) ? [] : [stackId]);
    };

    return (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Label className="text-sm font-semibold">{label}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Link a reusable stack so the same kit can be reused across terminals, hardware, and training content.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <PartStacksDialog
                        trigger={
                            <Button type="button" variant="outline" size="sm">
                                <Layers className="mr-2 h-4 w-4" />
                                Browse
                            </Button>
                        }
                    />
                    <PartStackEditorDialog
                        defaultUseCase={useCase}
                        onSaved={() => void mutate()}
                        trigger={
                            <Button type="button" variant="outline" size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                New Stack
                            </Button>
                        }
                    />
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search stacks..."
                    className="pl-9"
                />
            </div>

            {selectedStacks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {selectedStacks.map((stack) => (
                        <Badge key={stack.id} variant="secondary" className="gap-2">
                            <Layers className="h-3.5 w-3.5" />
                            {stack.name}
                        </Badge>
                    ))}
                </div>
            ) : null}

            <div className="rounded-xl border bg-background">
                <ScrollArea className="max-h-56">
                    <div className="divide-y">
                        {stacks.map((stack) => {
                            const selected = value.includes(stack.id);
                            return (
                                <button
                                    key={stack.id}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
                                    onClick={() => toggleStack(stack.id)}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{stack.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {(stack.useCases ?? []).join(", ")} • {stack.items.length} items
                                        </p>
                                    </div>
                                    <Badge variant={selected ? "default" : "outline"}>
                                        {selected ? "Selected" : "Select"}
                                    </Badge>
                                </button>
                            );
                        })}
                        {stacks.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No stacks found yet.
                            </div>
                        ) : null}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
