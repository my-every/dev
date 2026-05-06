"use client";

import { useState } from "react";
import useSWR from "swr";
import { PartSearchPicker } from "@/components/parts/part-search-picker";
import { PartStackSelector } from "@/components/parts/part-stack-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, GripVertical, Search, Loader2, Wrench } from "lucide-react";
import type { ToolsContent } from "@/types/training";
import type { PartRecord } from "@/types/parts-library";
import { cn } from "@/lib/utils";

interface ToolsEditorProps {
    content: ToolsContent;
    onChange: (content: ToolsContent) => void;
    disabled?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function ToolsEditor({ content, onChange, disabled }: ToolsEditorProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const { data: searchResults } = useSWR(
        searchQuery.length >= 2 ? `/api/parts?query=${encodeURIComponent(searchQuery)}&limit=10` : null,
        fetcher
    );

    const addTool = () => {
        const newTool = {
            id: `tool-${Date.now()}`,
            name: "",
            quantity: 1,
            optional: false,
        };
        onChange({ ...content, tools: [...content.tools, newTool] });
    };

    const updateTool = (id: string, updates: Partial<ToolsContent["tools"][0]>) => {
        onChange({
            ...content,
            tools: content.tools.map(tool =>
                tool.id === id ? { ...tool, ...updates } : tool
            ),
        });
    };

    const addToolFromPart = (part: { partNumber: string; description?: string }) => {
        if (content.tools.some(tool => tool.partNumber === part.partNumber)) return;

        const inferredName = part.description?.trim() || `Tool ${part.partNumber}`;
        const newTool = {
            id: `tool-${Date.now()}`,
            name: inferredName,
            partNumber: part.partNumber,
            quantity: 1,
            optional: false,
        };

        onChange({ ...content, tools: [...content.tools, newTool] });
        setSearchQuery("");
    };

    const addToolFromPicker = (part: PartRecord) => {
        addToolFromPart(part);
    };

    const removeTool = (id: string) => {
        onChange({
            ...content,
            tools: content.tools.filter(tool => tool.id !== id),
        });
    };

    return (
        <div className="space-y-4">
            {!disabled ? (
                <PartStackSelector
                    value={content.stackIds ?? []}
                    onChange={(stackIds) => onChange({ ...content, stackIds })}
                    label="Tool / Training Stacks"
                    useCase="training-module"
                />
            ) : null}

            {!disabled && (
                <div className="space-y-2">
                    <Label>Search Tools</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by part number or description..."
                            className="pl-9"
                        />
                    </div>

                    {searchQuery.length >= 2 && (
                        <div className="border rounded-lg max-h-48 overflow-y-auto">
                            {!searchResults ? (
                                <div className="p-4 text-center">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                </div>
                            ) : searchResults.parts?.length > 0 ? (
                                <div className="divide-y">
                                    {searchResults.parts.map((part: { partNumber: string; description?: string }) => (
                                        <button
                                            key={part.partNumber}
                                            type="button"
                                            className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between"
                                            onClick={() => addToolFromPart(part)}
                                        >
                                            <div>
                                                <span className="font-mono text-sm">{part.partNumber}</span>
                                                {part.description && (
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {part.description}
                                                    </span>
                                                )}
                                            </div>
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No parts found
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!disabled ? (
                <div className="space-y-2">
                    <Label>Quick Add from Parts</Label>
                    <PartSearchPicker
                        onSelect={addToolFromPicker}
                        selectedPartNumbers={content.tools.map((tool) => tool.partNumber ?? "").filter(Boolean)}
                        placeholder="Search tools or training parts..."
                    />
                </div>
            ) : null}

            {content.tools.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                    <Wrench className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">No tools added yet</p>
                    {!disabled && (
                        <Button type="button" variant="outline" size="sm" onClick={addTool}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Tool
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                    {content.tools.map((tool, index) => (
                        <motion.div
                            key={tool.id}
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
                                <div className="space-y-1 md:col-span-5">
                                    <Label className="text-xs">Tool Name</Label>
                                    <Input
                                        value={tool.name}
                                        onChange={(e) => updateTool(tool.id, { name: e.target.value })}
                                        placeholder="e.g., Phillips Screwdriver"
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="space-y-1 md:col-span-3">
                                    <Label className="text-xs">Part Number</Label>
                                    <Input
                                        value={tool.partNumber || ""}
                                        onChange={(e) => updateTool(tool.id, { partNumber: e.target.value })}
                                        placeholder="Optional"
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">Qty</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={tool.quantity || 1}
                                        onChange={(e) => updateTool(tool.id, { quantity: parseInt(e.target.value) || 1 })}
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div className="flex items-end gap-2 md:col-span-2">
                                    <div className="flex items-center gap-2 h-9">
                                        <Checkbox
                                            id={`optional-${tool.id}`}
                                            checked={tool.optional}
                                            onCheckedChange={(checked) => updateTool(tool.id, { optional: !!checked })}
                                            disabled={disabled}
                                        />
                                        <Label htmlFor={`optional-${tool.id}`} className="text-xs">
                                            Optional
                                        </Label>
                                        {tool.optional && (
                                            <Badge variant="outline" className="text-[10px]">Optional</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeTool(tool.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
            )}
            
            {!disabled && content.tools.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={addTool}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Tool
                </Button>
            )}
        </div>
    );
}
