"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, GripVertical, CheckSquare } from "lucide-react";
import type { ChecklistContent } from "@/types/training";
import { cn } from "@/lib/utils";

interface ChecklistEditorProps {
    content: ChecklistContent;
    onChange: (content: ChecklistContent) => void;
    disabled?: boolean;
}

export function ChecklistEditor({ content, onChange, disabled }: ChecklistEditorProps) {
    const addItem = () => {
        const newItem = {
            id: `check-${Date.now()}`,
            text: "",
            order: content.items.length,
            required: true,
        };
        onChange({ ...content, items: [...content.items, newItem] });
    };

    const updateItem = (id: string, updates: Partial<ChecklistContent["items"][0]>) => {
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
            {content.items.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                    <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">No checklist items yet</p>
                    {!disabled && (
                        <Button type="button" variant="outline" size="sm" onClick={addItem}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Item
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                    {content.items
                        .sort((a, b) => a.order - b.order)
                        .map((item, index) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                                className={cn(
                                    "flex items-center gap-2 p-3 border rounded-lg bg-muted/30 md:gap-3",
                                    disabled && "opacity-60"
                                )}
                            >
                                <div className="flex items-center cursor-move text-muted-foreground">
                                    <GripVertical className="h-4 w-4" />
                                </div>
                                
                                <span className="text-sm font-medium text-muted-foreground w-6">
                                    {index + 1}.
                                </span>
                                
                                <div className="flex-1">
                                    <Input
                                        value={item.text}
                                        onChange={(e) => updateItem(item.id, { text: e.target.value })}
                                        placeholder="Enter checklist item..."
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id={`required-${item.id}`}
                                        checked={item.required}
                                        onCheckedChange={(checked) => updateItem(item.id, { required: !!checked })}
                                        disabled={disabled}
                                    />
                                    <Label htmlFor={`required-${item.id}`} className="text-xs text-muted-foreground">
                                        Required
                                    </Label>
                                    <Badge variant="outline" className="text-[10px]">Step {index + 1}</Badge>
                                </div>
                                
                                {!disabled && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                    Add Item
                </Button>
            )}
        </div>
    );
}
