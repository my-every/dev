"use client";

import { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    Loader2,
    FileJson,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Settings2,
} from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { 
    PartCategory, 
    DetailSchema, 
    DetailFieldSchema, 
    DetailFieldType,
    DetailFieldGroup 
} from "@/types/parts-library";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const FIELD_TYPES: { value: DetailFieldType; label: string; description: string }[] = [
    { value: 'text', label: 'Text', description: 'Single line text input' },
    { value: 'textarea', label: 'Textarea', description: 'Multi-line text input' },
    { value: 'number', label: 'Number', description: 'Numeric input' },
    { value: 'boolean', label: 'Boolean', description: 'Yes/No toggle' },
    { value: 'select', label: 'Select', description: 'Dropdown selection' },
    { value: 'multi-select', label: 'Multi-Select', description: 'Multiple selections' },
    { value: 'url', label: 'URL', description: 'Web link' },
    { value: 'image', label: 'Image', description: 'Single image upload' },
    { value: 'image-list', label: 'Image List', description: 'Multiple images' },
    { value: 'key-value-list', label: 'Key-Value List', description: 'List of key-value pairs' },
];

interface SchemaEditorDialogProps {
    category: PartCategory;
    type: string;
    trigger?: React.ReactNode;
    onSchemaChange?: () => void;
}

export function SchemaEditorDialog({
    category,
    type,
    trigger,
    onSchemaChange,
}: SchemaEditorDialogProps) {
    const [open, setOpen] = useState(false);
    const [schema, setSchema] = useState<DetailSchema | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());
    
    const { data, mutate: mutateSchema } = useSWR<{ schema: DetailSchema }>(
        open ? `/api/parts/${category}/${type}?schema=true` : null,
        fetcher
    );
    
    useEffect(() => {
        if (data?.schema) {
            setSchema(data.schema);
        } else if (open && !data?.schema) {
            // Create default schema
            setSchema({
                version: 1,
                id: `${category}-${type}-schema`,
                name: `${type.replace(/-/g, ' ')} Details`,
                description: `Detail fields for ${type.replace(/-/g, ' ')} parts`,
                groups: [],
                fields: [],
            });
        }
    }, [data, open, category, type]);
    
    const toggleField = (index: number) => {
        const next = new Set(expandedFields);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        setExpandedFields(next);
    };
    
    const addField = () => {
        if (!schema) return;
        
        const newField: DetailFieldSchema = {
            key: `field_${schema.fields.length + 1}`,
            label: 'New Field',
            type: 'text',
            order: schema.fields.length,
        };
        
        setSchema({
            ...schema,
            fields: [...schema.fields, newField],
        });
        setExpandedFields(new Set([...expandedFields, schema.fields.length]));
    };
    
    const updateField = (index: number, updates: Partial<DetailFieldSchema>) => {
        if (!schema) return;
        
        const fields = [...schema.fields];
        fields[index] = { ...fields[index], ...updates };
        setSchema({ ...schema, fields });
    };
    
    const removeField = (index: number) => {
        if (!schema) return;
        
        const fields = schema.fields.filter((_, i) => i !== index);
        setSchema({ ...schema, fields });
    };
    
    const moveField = (index: number, direction: 'up' | 'down') => {
        if (!schema) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= schema.fields.length) return;
        
        const fields = [...schema.fields];
        [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
        // Update order
        fields.forEach((f, i) => f.order = i);
        setSchema({ ...schema, fields });
    };
    
    const handleSave = async () => {
        if (!schema) return;
        
        setIsSaving(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/parts/${category}/${type}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema }),
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save schema');
            }
            
            await mutateSchema();
            onSchemaChange?.();
            setOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save schema');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm">
                        <FileJson className="h-4 w-4 mr-2" />
                        Edit Schema
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" />
                        Detail Schema Editor
                    </DialogTitle>
                    <DialogDescription>
                        Define custom detail fields for {type.replace(/-/g, ' ')} parts in the {category} category.
                    </DialogDescription>
                </DialogHeader>
                
                {schema && (
                    <div className="flex-1 overflow-hidden flex flex-col py-4">
                        {/* Schema Metadata */}
                        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                            <div className="space-y-2">
                                <Label htmlFor="schemaName">Schema Name</Label>
                                <Input
                                    id="schemaName"
                                    value={schema.name}
                                    onChange={(e) => setSchema({ ...schema, name: e.target.value })}
                                    placeholder="e.g., Relay Details"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="schemaDesc">Description</Label>
                                <Input
                                    id="schemaDesc"
                                    value={schema.description ?? ''}
                                    onChange={(e) => setSchema({ ...schema, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>
                        
                        {/* Fields */}
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <Label className="text-sm font-medium">
                                Fields ({schema.fields.length})
                            </Label>
                            <Button variant="outline" size="sm" onClick={addField}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Field
                            </Button>
                        </div>
                        
                        <ScrollArea className="flex-1 border rounded-lg">
                            {schema.fields.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-8">
                                    <Settings2 className="h-10 w-10 mb-3 opacity-50" />
                                    <p className="text-sm">No fields defined yet.</p>
                                    <p className="text-xs mt-1">Add fields to capture custom details for parts.</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {schema.fields.map((field, index) => (
                                        <Collapsible
                                            key={index}
                                            open={expandedFields.has(index)}
                                            onOpenChange={() => toggleField(index)}
                                        >
                                            <Card>
                                                <CardHeader className="py-2 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveField(index, 'up');
                                                                }}
                                                                disabled={index === 0}
                                                            >
                                                                <ChevronUp className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveField(index, 'down');
                                                                }}
                                                                disabled={index === schema.fields.length - 1}
                                                            >
                                                                <ChevronDown className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        
                                                        <CollapsibleTrigger asChild>
                                                            <button className="flex-1 flex items-center gap-2 text-left">
                                                                <span className="font-medium text-sm">{field.label}</span>
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {field.type}
                                                                </Badge>
                                                                {field.required && (
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        Required
                                                                    </Badge>
                                                                )}
                                                            </button>
                                                        </CollapsibleTrigger>
                                                        
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                                            onClick={() => removeField(index)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CollapsibleContent>
                                                    <CardContent className="py-3 px-3 border-t space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs">Field Key</Label>
                                                                <Input
                                                                    value={field.key}
                                                                    onChange={(e) => updateField(index, { key: e.target.value })}
                                                                    placeholder="field_key"
                                                                    className="h-8 text-sm font-mono"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs">Label</Label>
                                                                <Input
                                                                    value={field.label}
                                                                    onChange={(e) => updateField(index, { label: e.target.value })}
                                                                    placeholder="Display Label"
                                                                    className="h-8 text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs">Field Type</Label>
                                                                <Select
                                                                    value={field.type}
                                                                    onValueChange={(v) => updateField(index, { type: v as DetailFieldType })}
                                                                >
                                                                    <SelectTrigger className="h-8 text-sm">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {FIELD_TYPES.map((ft) => (
                                                                            <SelectItem key={ft.value} value={ft.value}>
                                                                                {ft.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs">Placeholder</Label>
                                                                <Input
                                                                    value={field.placeholder ?? ''}
                                                                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                                                                    placeholder="Placeholder text"
                                                                    className="h-8 text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs">Description</Label>
                                                            <Input
                                                                value={field.description ?? ''}
                                                                onChange={(e) => updateField(index, { description: e.target.value })}
                                                                placeholder="Help text for this field"
                                                                className="h-8 text-sm"
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs">Required Field</Label>
                                                            <Switch
                                                                checked={field.required ?? false}
                                                                onCheckedChange={(checked) => updateField(index, { required: checked })}
                                                            />
                                                        </div>
                                                        
                                                        {/* Options for select/multi-select */}
                                                        {(field.type === 'select' || field.type === 'multi-select') && (
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs">Options (one per line: value|label)</Label>
                                                                <Textarea
                                                                    value={field.options?.map(o => `${o.value}|${o.label}`).join('\n') ?? ''}
                                                                    onChange={(e) => {
                                                                        const options = e.target.value.split('\n')
                                                                            .filter(line => line.trim())
                                                                            .map(line => {
                                                                                const [value, label] = line.split('|');
                                                                                return { value: value.trim(), label: (label || value).trim() };
                                                                            });
                                                                        updateField(index, { options });
                                                                    }}
                                                                    placeholder="option1|Option 1&#10;option2|Option 2"
                                                                    className="text-sm font-mono min-h-[80px]"
                                                                />
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        
                        {error && (
                            <p className="text-sm text-destructive mt-3 shrink-0">{error}</p>
                        )}
                    </div>
                )}
                
                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Schema
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
