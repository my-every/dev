"use client";

import { useState } from "react";
import useSWR from "swr";
import {
    FileText,
    Plus,
    Copy,
    Check,
    Loader2,
    ChevronRight,
    Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type {
    InstallationTemplate,
    DetailsTemplate,
    InstallationStep,
    PartCategory,
} from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ============================================================================
// INSTALLATION TEMPLATE PICKER
// ============================================================================

interface InstallationTemplatePickerProps {
    category: PartCategory;
    type?: string;
    currentSteps?: InstallationStep[];
    onApplyTemplate: (steps: InstallationStep[], templateId: string) => void;
    onSaveAsTemplate?: (steps: InstallationStep[]) => void;
    trigger?: React.ReactNode;
}

export function InstallationTemplatePicker({
    category,
    type,
    currentSteps,
    onApplyTemplate,
    onSaveAsTemplate,
    trigger,
}: InstallationTemplatePickerProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"pick" | "save">("pick");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateDescription, setNewTemplateDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    const { data, mutate } = useSWR<{ templates: InstallationTemplate[] }>(
        `/api/parts/templates?type=installation&category=${category}${type ? `&partType=${type}` : ""}`,
        fetcher
    );
    
    const templates = data?.templates ?? [];
    
    const handleApply = (template: InstallationTemplate) => {
        onApplyTemplate(template.steps, template.id);
        setOpen(false);
    };
    
    const handleSaveAsTemplate = async () => {
        if (!currentSteps || currentSteps.length === 0 || !newTemplateName.trim()) return;
        
        setIsSaving(true);
        try {
            const template: Partial<InstallationTemplate> = {
                name: newTemplateName.trim(),
                description: newTemplateDescription.trim() || undefined,
                category,
                type: type || undefined,
                steps: currentSteps,
            };
            
            const res = await fetch("/api/parts/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "installation", template }),
            });
            
            if (res.ok) {
                mutate();
                setNewTemplateName("");
                setNewTemplateDescription("");
                setMode("pick");
                setOpen(false);
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Templates
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Installation Templates</DialogTitle>
                    <DialogDescription>
                        Apply a template or save current steps as a reusable template
                    </DialogDescription>
                </DialogHeader>
                
                {mode === "pick" ? (
                    <>
                        <ScrollArea className="max-h-[300px]">
                            {templates.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No templates available for this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleApply(template)}
                                            className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{template.name}</p>
                                                    {template.description && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {template.steps.length} steps
                                                        </Badge>
                                                        {template.type && (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {template.type}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            {currentSteps && currentSteps.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setMode("save")}
                                    className="w-full sm:w-auto"
                                >
                                    <Save className="h-4 w-4 mr-1" />
                                    Save Current as Template
                                </Button>
                            )}
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="e.g., Standard Relay Installation"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Textarea
                                    value={newTemplateDescription}
                                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                                    placeholder="Brief description of when to use this template..."
                                    rows={2}
                                />
                            </div>
                            
                            <div className="p-3 rounded-lg bg-muted/50">
                                <p className="text-sm font-medium">
                                    {currentSteps?.length} steps will be saved
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This template can be applied to other {category} parts
                                </p>
                            </div>
                        </div>
                        
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setMode("pick")}>
                                Back
                            </Button>
                            <Button
                                onClick={handleSaveAsTemplate}
                                disabled={!newTemplateName.trim() || isSaving}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                )}
                                Save Template
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// DETAILS TEMPLATE PICKER
// ============================================================================

interface DetailsTemplatePickerProps {
    category: PartCategory;
    type?: string;
    currentValues?: Record<string, unknown>;
    schemaId?: string;
    onApplyTemplate: (values: Record<string, unknown>, templateId: string) => void;
    trigger?: React.ReactNode;
}

export function DetailsTemplatePicker({
    category,
    type,
    currentValues,
    schemaId,
    onApplyTemplate,
    trigger,
}: DetailsTemplatePickerProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"pick" | "save">("pick");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateDescription, setNewTemplateDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    const { data, mutate } = useSWR<{ templates: DetailsTemplate[] }>(
        `/api/parts/templates?type=details&category=${category}${type ? `&partType=${type}` : ""}`,
        fetcher
    );
    
    const templates = data?.templates ?? [];
    
    const handleApply = (template: DetailsTemplate) => {
        onApplyTemplate(template.values, template.id);
        setOpen(false);
    };
    
    const handleSaveAsTemplate = async () => {
        if (!currentValues || !newTemplateName.trim()) return;
        
        setIsSaving(true);
        try {
            const template: Partial<DetailsTemplate> = {
                name: newTemplateName.trim(),
                description: newTemplateDescription.trim() || undefined,
                category,
                type: type || undefined,
                schemaId: schemaId || "default",
                values: currentValues,
            };
            
            const res = await fetch("/api/parts/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "details", template }),
            });
            
            if (res.ok) {
                mutate();
                setNewTemplateName("");
                setNewTemplateDescription("");
                setMode("pick");
                setOpen(false);
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    const valueCount = currentValues ? Object.keys(currentValues).filter(k => currentValues[k] != null && currentValues[k] !== "").length : 0;
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Templates
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Details Templates</DialogTitle>
                    <DialogDescription>
                        Apply pre-filled values or save current values as a template
                    </DialogDescription>
                </DialogHeader>
                
                {mode === "pick" ? (
                    <>
                        <ScrollArea className="max-h-[300px]">
                            {templates.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No templates available for this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleApply(template)}
                                            className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{template.name}</p>
                                                    {template.description && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {Object.keys(template.values).length} fields
                                                        </Badge>
                                                        {template.type && (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {template.type}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            {valueCount > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setMode("save")}
                                    className="w-full sm:w-auto"
                                >
                                    <Save className="h-4 w-4 mr-1" />
                                    Save Current as Template
                                </Button>
                            )}
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="e.g., 24V DC Relay Specs"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Textarea
                                    value={newTemplateDescription}
                                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                                    placeholder="Brief description of when to use this template..."
                                    rows={2}
                                />
                            </div>
                            
                            <div className="p-3 rounded-lg bg-muted/50">
                                <p className="text-sm font-medium">
                                    {valueCount} field values will be saved
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This template can be applied to other {category} parts
                                </p>
                            </div>
                        </div>
                        
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setMode("pick")}>
                                Back
                            </Button>
                            <Button
                                onClick={handleSaveAsTemplate}
                                disabled={!newTemplateName.trim() || isSaving}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                )}
                                Save Template
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
