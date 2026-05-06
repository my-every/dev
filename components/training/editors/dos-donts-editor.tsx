"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, CheckCircle2, XCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { DosAndDontsContent } from "@/types/training";
import { cn } from "@/lib/utils";

interface DosAndDontsEditorProps {
    content: DosAndDontsContent;
    onChange: (content: DosAndDontsContent) => void;
    disabled?: boolean;
}

export function DosAndDontsEditor({ content, onChange, disabled }: DosAndDontsEditorProps) {
    const addDo = () => {
        const newDo = {
            id: `do-${Date.now()}`,
            text: "",
            priority: "medium" as const,
        };
        onChange({ ...content, dos: [...content.dos, newDo] });
    };

    const addDont = () => {
        const newDont = {
            id: `dont-${Date.now()}`,
            text: "",
            severity: "warning" as const,
        };
        onChange({ ...content, donts: [...content.donts, newDont] });
    };

    const updateDo = (id: string, updates: Partial<DosAndDontsContent["dos"][0]>) => {
        onChange({
            ...content,
            dos: content.dos.map(d => d.id === id ? { ...d, ...updates } : d),
        });
    };

    const updateDont = (id: string, updates: Partial<DosAndDontsContent["donts"][0]>) => {
        onChange({
            ...content,
            donts: content.donts.map(d => d.id === id ? { ...d, ...updates } : d),
        });
    };

    const removeDo = (id: string) => {
        onChange({ ...content, dos: content.dos.filter(d => d.id !== id) });
    };

    const removeDont = (id: string) => {
        onChange({ ...content, donts: content.donts.filter(d => d.id !== id) });
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            {/* Do's Column */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <Label className="text-base font-semibold text-green-700">Do&apos;s</Label>
                    <Badge variant="secondary" className="text-[10px]">{content.dos.length}</Badge>
                </div>
                
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                    {content.dos.map((item, index) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                            className={cn(
                                "flex items-start gap-2 p-3 border border-green-200 bg-green-50 rounded-lg",
                                disabled && "opacity-60"
                            )}
                        >
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-green-700" />
                                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-100/70">
                                        {item.priority || "medium"}
                                    </Badge>
                                </div>
                                <Input
                                    value={item.text}
                                    onChange={(e) => updateDo(item.id, { text: e.target.value })}
                                    placeholder="Enter a best practice..."
                                    disabled={disabled}
                                    className="border-green-300 focus-visible:ring-green-500"
                                />
                                <Select
                                    value={item.priority || "medium"}
                                    onValueChange={(value: "high" | "medium" | "low") =>
                                        updateDo(item.id, { priority: value })
                                    }
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="high">High Priority</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low Priority</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeDo(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
                
                {!disabled && (
                    <Button type="button" variant="outline" size="sm" onClick={addDo} className="w-full border-green-300 text-green-700 hover:bg-green-50">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Do
                    </Button>
                )}
            </div>

            {/* Don'ts Column */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <Label className="text-base font-semibold text-red-700">Don&apos;ts</Label>
                    <Badge variant="secondary" className="text-[10px]">{content.donts.length}</Badge>
                </div>
                
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                    {content.donts.map((item, index) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.02 }}
                            className={cn(
                                "flex items-start gap-2 p-3 border border-red-200 bg-red-50 rounded-lg",
                                disabled && "opacity-60"
                            )}
                        >
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-3.5 w-3.5 text-red-700" />
                                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-100/70">
                                        {item.severity || "warning"}
                                    </Badge>
                                </div>
                                <Input
                                    value={item.text}
                                    onChange={(e) => updateDont(item.id, { text: e.target.value })}
                                    placeholder="Enter something to avoid..."
                                    disabled={disabled}
                                    className="border-red-300 focus-visible:ring-red-500"
                                />
                                <Select
                                    value={item.severity || "warning"}
                                    onValueChange={(value: "critical" | "warning" | "info") =>
                                        updateDont(item.id, { severity: value })
                                    }
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        <SelectItem value="warning">Warning</SelectItem>
                                        <SelectItem value="info">Info</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeDont(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
                
                {!disabled && (
                    <Button type="button" variant="outline" size="sm" onClick={addDont} className="w-full border-red-300 text-red-700 hover:bg-red-50">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Don&apos;t
                    </Button>
                )}
            </div>
        </div>
    );
}
