"use client";

import { PartSearchPicker } from "@/components/parts/part-search-picker";
import { PartStackSelector } from "@/components/parts/part-stack-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { HardwareContent } from "@/types/training";
import type { PartRecord } from "@/types/parts-library";
import { cn } from "@/lib/utils";

interface HardwareEditorProps {
    content: HardwareContent;
    onChange: (content: HardwareContent) => void;
    disabled?: boolean;
}

export function HardwareEditor({ content, onChange, disabled }: HardwareEditorProps) {
    const addHardwareFromPart = (part: PartRecord) => {
        if (content.items.some((item) => item.partNumber === part.partNumber)) return;

        const newItem = {
            id: `hardware-${Date.now()}`,
            name: part.description?.trim() || part.partNumber,
            partNumber: part.partNumber,
            quantity: 1,
            specification: "",
            notes: "",
        };
        onChange({ ...content, items: [...content.items, newItem] });
    };

    const addItem = () => {
        const newItem = {
            id: `hardware-${Date.now()}`,
            name: "",
            quantity: 1,
        };
        onChange({ ...content, items: [...content.items, newItem] });
    };

    const updateItem = (id: string, updates: Partial<HardwareContent["items"][0]>) => {
        onChange({
            ...content,
            items: content.items.map(item =>
                item.id === id ? { ...item, ...updates } : item
            ),
        });
    };

    const removeItem = (id: string) => {
        onChange({
            ...content,
            items: content.items.filter(item => item.id !== id),
        });
    };

    return (
        <div className="space-y-4">
            {!disabled ? (
                <>
                    <PartStackSelector
                        value={content.stackIds ?? []}
                        onChange={(stackIds) => onChange({ ...content, stackIds })}
                        label="Hardware Stacks"
                        useCase="terminal-hardware"
                    />
                    <div className="space-y-2">
                        <Label>Add Parts to Hardware List</Label>
                        <PartSearchPicker
                            onSelect={addHardwareFromPart}
                            selectedPartNumbers={content.items.map((item) => item.partNumber ?? "").filter(Boolean)}
                            placeholder="Search hardware parts..."
                        />
                    </div>
                </>
            ) : null}

            {content.items.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">No hardware items added yet</p>
                    {!disabled && (
                        <Button type="button" variant="outline" size="sm" onClick={addItem}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Hardware
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                    {content.items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                            className={cn(
                                "flex items-start gap-3 p-3 border rounded-lg bg-muted/30",
                                disabled && "opacity-60"
                            )}
                        >
                            <div className="flex items-center h-9 cursor-move text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                            </div>
                            
                            <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-12">
                                <div className="space-y-1 md:col-span-4">
                                    <Label className="text-xs">Item Name</Label>
                                    <Input
                                        value={item.name}
                                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                        placeholder="e.g., M4 Bolt"
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="space-y-1 md:col-span-3">
                                    <Label className="text-xs">Part Number</Label>
                                    <Input
                                        value={item.partNumber || ""}
                                        onChange={(e) => updateItem(item.id, { partNumber: e.target.value })}
                                        placeholder="Optional"
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">Qty</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.quantity || 1}
                                        onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="space-y-1 md:col-span-3">
                                    <Label className="text-xs">Specification</Label>
                                    <Input
                                        value={item.specification || ""}
                                        onChange={(e) => updateItem(item.id, { specification: e.target.value })}
                                        placeholder="e.g., 10mm x 25mm"
                                        disabled={disabled}
                                    />
                                    {item.specification ? (
                                        <Badge variant="outline" className="text-[10px]">Spec added</Badge>
                                    ) : null}
                                </div>
                            </div>
                            
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeItem(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
            )}
            
            {!disabled && content.items.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Hardware
                </Button>
            )}
        </div>
    );
}
