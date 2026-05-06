"use client";

import { useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Search, Loader2, Cpu } from "lucide-react";
import type { RelatedDevicesContent } from "@/types/training";
import { cn } from "@/lib/utils";

interface RelatedDevicesEditorProps {
    content: RelatedDevicesContent;
    onChange: (content: RelatedDevicesContent) => void;
    disabled?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function RelatedDevicesEditor({ content, onChange, disabled }: RelatedDevicesEditorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const { data: searchResults } = useSWR(
        searchQuery.length >= 2 ? `/api/parts?query=${encodeURIComponent(searchQuery)}&limit=10` : null,
        fetcher
    );

    const addDevice = (partNumber: string, name?: string, description?: string) => {
        if (content.devices.some(d => d.partNumber === partNumber)) return;
        
        const newDevice = {
            id: `device-${Date.now()}`,
            partNumber,
            name,
            description,
        };
        onChange({ ...content, devices: [...content.devices, newDevice] });
        setSearchQuery("");
    };

    const removeDevice = (id: string) => {
        onChange({
            ...content,
            devices: content.devices.filter(d => d.id !== id),
        });
    };

    return (
        <div className="space-y-4">
            {/* Search Input */}
            {!disabled && (
                <div className="space-y-2">
                    <Label>Search Parts</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by part number or description..."
                            className="pl-9"
                        />
                    </div>
                    
                    {/* Search Results */}
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
                                            onClick={() => addDevice(part.partNumber, undefined, part.description)}
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

            {/* Selected Devices */}
            <div className="space-y-2">
                <Label>Selected Devices ({content.devices.length})</Label>
                
                {content.devices.length === 0 ? (
                    <div className="text-center py-8 border border-dashed rounded-lg">
                        <Cpu className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No devices added yet</p>
                        {!disabled && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Search for parts above to add them
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <AnimatePresence initial={false}>
                        {content.devices.map((device, index) => (
                            <motion.div
                                key={device.id}
                                layout
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                            >
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "gap-2 py-1.5 px-3",
                                        disabled && "opacity-60"
                                    )}
                                >
                                    <Cpu className="h-3 w-3" />
                                    <span className="font-mono">{device.partNumber}</span>
                                    {device.description && (
                                        <span className="text-muted-foreground text-xs max-w-32 truncate">
                                            {device.description}
                                        </span>
                                    )}
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={() => removeDevice(device.id)}
                                            className="ml-1 hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </Badge>
                            </motion.div>
                        ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
