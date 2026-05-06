"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ArrowDown, ArrowUp, Layers, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { PartSearchPicker } from "@/components/parts/part-search-picker";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { PartCategory, PartRecord, PartStack, PartStackItem, PartStackUseCase } from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

const STACK_USE_CASES: PartStackUseCase[] = [
    "terminal-hardware",
    "training-module",
    "device-kit",
    "install-kit",
    "accessory-kit",
    "custom",
];

function createEmptyStack(): PartStack {
    const now = new Date().toISOString();
    return {
        id: `stack-${Date.now()}`,
        name: "",
        description: "",
        category: "mixed",
        type: "mixed",
        useCases: ["custom"],
        tags: [],
        items: [],
        source: "manual",
        createdAt: now,
        updatedAt: now,
    };
}

function createStackItem(part: PartRecord, sortOrder: number): PartStackItem {
    return {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        partNumber: part.partNumber,
        category: part.category,
        type: part.type,
        quantity: 1,
        sortOrder,
        role: "optional",
        notes: "",
        config: {},
    };
}

interface PartStackEditorDialogProps {
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialStackId?: string | null;
    defaultUseCase?: PartStackUseCase;
    onSaved?: (stack: PartStack) => void;
}

export function PartStackEditorDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
    initialStackId,
    defaultUseCase,
    onSaved,
}: PartStackEditorDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [stack, setStack] = useState<PartStack>(createEmptyStack());
    const [isSaving, setIsSaving] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;

    const { data: stackPayload, isLoading } = useSWR<{ stack: PartStack }>(
        open && initialStackId ? `/api/parts/stacks/${encodeURIComponent(initialStackId)}` : null,
        fetcher,
        { revalidateOnFocus: false },
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        if (stackPayload?.stack) {
            setStack(stackPayload.stack);
            return;
        }

        const empty = createEmptyStack();
        if (defaultUseCase) {
            empty.useCases = [defaultUseCase];
        }
        setStack(empty);
    }, [defaultUseCase, open, stackPayload?.stack]);

    const selectedPartNumbers = useMemo(() => stack.items.map((item) => item.partNumber), [stack.items]);

    const addPart = (part: PartRecord) => {
        if (selectedPartNumbers.includes(part.partNumber)) {
            return;
        }

        setStack((current) => ({
            ...current,
            category: current.category === "mixed" ? part.category : current.category,
            type: current.type === "mixed" ? part.type : current.type,
            items: [...current.items, createStackItem(part, current.items.length)],
        }));
    };

    const updateItem = (itemId: string, patch: Partial<PartStackItem>) => {
        setStack((current) => ({
            ...current,
            items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        }));
    };

    const reorderItem = (itemId: string, direction: -1 | 1) => {
        setStack((current) => {
            const index = current.items.findIndex((item) => item.id === itemId);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= current.items.length) {
                return current;
            }

            const nextItems = [...current.items];
            const [moved] = nextItems.splice(index, 1);
            nextItems.splice(nextIndex, 0, moved);
            return {
                ...current,
                items: nextItems.map((item, idx) => ({ ...item, sortOrder: idx })),
            };
        });
    };

    const removeItem = (itemId: string) => {
        setStack((current) => ({
            ...current,
            items: current.items
                .filter((item) => item.id !== itemId)
                .map((item, index) => ({ ...item, sortOrder: index })),
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const method = initialStackId ? "PUT" : "POST";
            const endpoint = initialStackId
                ? `/api/parts/stacks/${encodeURIComponent(initialStackId)}`
                : "/api/parts/stacks";
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(stack),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || "Failed to save stack");
            }
            onSaved?.(payload.stack);
            setOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
            <DialogContent className="max-w-5xl p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        {initialStackId ? "Edit Stack" : "Create Stack"}
                    </DialogTitle>
                    <DialogDescription>
                        Build reusable grouped part configurations for hardware kits, training modules, and terminal accessories.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading stack...
                    </div>
                ) : (
                    <div className="grid gap-0 md:grid-cols-[360px_minmax(0,1fr)]">
                        <div className="border-r p-5">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Stack Name</Label>
                                    <Input
                                        value={stack.name}
                                        onChange={(event) => setStack({ ...stack, name: event.target.value })}
                                        placeholder="Terminal hardware kit"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        value={stack.description ?? ""}
                                        onChange={(event) => setStack({ ...stack, description: event.target.value })}
                                        placeholder="Reusable bundle of parts for terminal installation and training."
                                        rows={3}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Select
                                            value={String(stack.category ?? "mixed")}
                                            onValueChange={(value) =>
                                                setStack({ ...stack, category: value as PartCategory | "mixed" })
                                            }
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mixed">Mixed</SelectItem>
                                                <SelectItem value="devices">Devices</SelectItem>
                                                <SelectItem value="terminals">Terminals</SelectItem>
                                                <SelectItem value="wiring">Wiring</SelectItem>
                                                <SelectItem value="hardware">Hardware</SelectItem>
                                                <SelectItem value="tools">Tools</SelectItem>
                                                <SelectItem value="consumables">Consumables</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Use Case</Label>
                                        <Select
                                            value={stack.useCases?.[0] ?? "custom"}
                                            onValueChange={(value) => setStack({ ...stack, useCases: [value as PartStackUseCase] })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {STACK_USE_CASES.map((useCase) => (
                                                    <SelectItem key={useCase} value={useCase}>
                                                        {useCase.replace(/-/g, " ")}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tags</Label>
                                    <Input
                                        value={(stack.tags ?? []).join(", ")}
                                        onChange={(event) =>
                                            setStack({
                                                ...stack,
                                                tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                                            })
                                        }
                                        placeholder="terminal, ac-separation, install"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Add Parts</Label>
                                    <PartSearchPicker
                                        onSelect={addPart}
                                        selectedPartNumbers={selectedPartNumbers}
                                        category={stack.category && stack.category !== "mixed" ? stack.category : undefined}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold">Stack Items</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Resort items in the order they should be configured, trained, or installed.
                                    </p>
                                </div>
                                <Badge variant="secondary">{stack.items.length} items</Badge>
                            </div>

                            {stack.items.length === 0 ? (
                                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    Search and add parts to start building this stack.
                                </div>
                            ) : (
                                <ScrollArea className="h-[520px] pr-3">
                                    <div className="space-y-3">
                                        {stack.items.map((item, index) => (
                                            <div key={item.id} className="rounded-xl border bg-muted/20 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="font-mono text-[10px]">
                                                                {item.partNumber}
                                                            </Badge>
                                                            {item.role ? (
                                                                <Badge variant="secondary" className="text-[10px] capitalize">
                                                                    {item.role}
                                                                </Badge>
                                                            ) : null}
                                                        </div>

                                                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Quantity</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={item.quantity ?? 1}
                                                                    onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Role</Label>
                                                                <Select
                                                                    value={item.role ?? "optional"}
                                                                    onValueChange={(value) => updateItem(item.id, { role: value as PartStackItem["role"] })}
                                                                >
                                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="primary">Primary</SelectItem>
                                                                        <SelectItem value="hardware">Hardware</SelectItem>
                                                                        <SelectItem value="accessory">Accessory</SelectItem>
                                                                        <SelectItem value="training">Training</SelectItem>
                                                                        <SelectItem value="terminal">Terminal</SelectItem>
                                                                        <SelectItem value="optional">Optional</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1 md:col-span-2">
                                                                <Label className="text-xs">Notes</Label>
                                                                <Input
                                                                    value={item.notes ?? ""}
                                                                    onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                                                                    placeholder="Spacer required near AC wires"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <Button type="button" size="icon" variant="ghost" onClick={() => reorderItem(item.id, -1)} disabled={index === 0}>
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button type="button" size="icon" variant="ghost" onClick={() => reorderItem(item.id, 1)} disabled={index === stack.items.length - 1}>
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                        <Button type="button" size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="border-t px-6 py-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                    <Button onClick={() => void handleSave()} disabled={isSaving || !stack.name.trim()}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Stack
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
