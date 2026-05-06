"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Package,
    Cpu,
    Zap,
    Wrench,
    CircuitBoard,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PartCatalogRecord, PartCategory } from "@/types/d380-catalog";

interface CatalogBrowserViewProps {
    entries: PartCatalogRecord[];
    isLoading: boolean;
    selectedPartNumber: string | null;
    onSelect: (entry: PartCatalogRecord) => void;
}

const CATEGORY_ICONS: Partial<Record<PartCategory, React.ElementType>> = {
    "Terminal Blocks & Accessories": Zap,
    "Ring Terminals": Zap,
    "Fork Terminals": Zap,
    "Control Relays": Cpu,
    "Relay Sockets": Cpu,
    "Timing Relays": Cpu,
    "Protection Relays": Cpu,
    "Circuit Protection": Zap,
    "DIN Rail & Mounting": Wrench,
    "Wire Management": Zap,
    "Cable Management": Zap,
    "PLC Control Platform": CircuitBoard,
    "PLC Rack Hardware": CircuitBoard,
    "PLC Communication Modules": CircuitBoard,
    "Control Power": Package,
    "Power Conversion": Package,
};

const CATEGORY_COLORS: Partial<Record<PartCategory, string>> = {
    "Terminal Blocks & Accessories": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    "Control Relays": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    "Circuit Protection": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
    "Wire Management": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    "PLC Control Platform": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

export function CatalogBrowserView({
    entries,
    isLoading,
    selectedPartNumber,
    onSelect,
}: CatalogBrowserViewProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Package className="h-12 w-12 text-muted-foreground/40" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold">No parts found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Add parts manually or import from a CSV file.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
                {entries.map((entry, index) => {
                    const Icon = CATEGORY_ICONS[entry.category] ?? Package;
                    const isSelected = entry.partNumber === selectedPartNumber;
                    const colorClass =
                        CATEGORY_COLORS[entry.category] ??
                        "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700";

                    return (
                        <motion.div
                            key={entry.partNumber}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.02 }}
                        >
                            <Card
                                className={cn(
                                    "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
                                    isSelected && "ring-2 ring-primary ring-offset-1",
                                )}
                                onClick={() => onSelect(entry)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                "rounded-lg p-2 shrink-0 border",
                                                colorClass,
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-mono text-sm font-semibold truncate">
                                                {entry.partNumber}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                {entry.description}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] px-1.5 h-5"
                                                >
                                                    {entry.category}
                                                </Badge>
                                                {entry.manufacturer && (
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {entry.manufacturer}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
