"use client";

import { useState } from "react";
import { Plus, X, Upload, GripVertical } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { DetailFieldSchema } from "@/types/parts-library";

interface DynamicDetailFieldProps {
    field: DetailFieldSchema;
    value: unknown;
    onChange: (value: unknown) => void;
    disabled?: boolean;
}

export function DynamicDetailField({
    field,
    value,
    onChange,
    disabled = false,
}: DynamicDetailFieldProps) {
    const renderField = () => {
        switch (field.type) {
            case 'text':
                return (
                    <Input
                        id={field.key}
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                    />
                );
                
            case 'textarea':
                return (
                    <Textarea
                        id={field.key}
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        rows={3}
                    />
                );
                
            case 'number':
                return (
                    <Input
                        id={field.key}
                        type="number"
                        value={(value as number) ?? ''}
                        onChange={(e) => onChange(e.target.valueAsNumber || undefined)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        min={field.validation?.min}
                        max={field.validation?.max}
                    />
                );
                
            case 'boolean':
                return (
                    <Switch
                        id={field.key}
                        checked={(value as boolean) ?? false}
                        onCheckedChange={onChange}
                        disabled={disabled}
                    />
                );
                
            case 'select':
                return (
                    <Select
                        value={(value as string) ?? ''}
                        onValueChange={onChange}
                        disabled={disabled}
                    >
                        <SelectTrigger id={field.key}>
                            <SelectValue placeholder={field.placeholder ?? 'Select...'} />
                        </SelectTrigger>
                        <SelectContent>
                            {field.options?.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
                
            case 'multi-select':
                return (
                    <MultiSelectField
                        field={field}
                        value={(value as string[]) ?? []}
                        onChange={onChange}
                        disabled={disabled}
                    />
                );
                
            case 'image':
                return (
                    <ImageUploadField
                        value={value as { src: string; alt?: string } | undefined}
                        onChange={onChange}
                        disabled={disabled}
                    />
                );
                
            case 'image-list':
                return (
                    <ImageListField
                        value={(value as { src: string; alt?: string }[]) ?? []}
                        onChange={onChange}
                        disabled={disabled}
                    />
                );
                
            case 'key-value-list':
                return (
                    <KeyValueListField
                        value={(value as { key: string; value: string }[]) ?? []}
                        onChange={onChange}
                        disabled={disabled}
                    />
                );
                
            case 'url':
                return (
                    <Input
                        id={field.key}
                        type="url"
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder ?? 'https://...'}
                        disabled={disabled}
                    />
                );
                
            default:
                return (
                    <Input
                        id={field.key}
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                    />
                );
        }
    };
    
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={field.key} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
            </div>
            {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            {renderField()}
        </div>
    );
}

// ============================================================================
// MULTI-SELECT FIELD
// ============================================================================

function MultiSelectField({
    field,
    value,
    onChange,
    disabled,
}: {
    field: DetailFieldSchema;
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
}) {
    const toggleOption = (optValue: string) => {
        if (value.includes(optValue)) {
            onChange(value.filter((v) => v !== optValue));
        } else {
            onChange([...value, optValue]);
        }
    };
    
    return (
        <div className="flex flex-wrap gap-2">
            {field.options?.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                    <Badge
                        key={opt.value}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => !disabled && toggleOption(opt.value)}
                    >
                        {opt.label}
                    </Badge>
                );
            })}
        </div>
    );
}

// ============================================================================
// IMAGE UPLOAD FIELD
// ============================================================================

function ImageUploadField({
    value,
    onChange,
    disabled,
}: {
    value?: { src: string; alt?: string };
    onChange: (value: { src: string; alt?: string } | undefined) => void;
    disabled?: boolean;
}) {
    const [urlInput, setUrlInput] = useState(value?.src ?? '');
    
    const handleSet = () => {
        if (urlInput.trim()) {
            onChange({ src: urlInput.trim(), alt: '' });
        }
    };
    
    const handleClear = () => {
        setUrlInput('');
        onChange(undefined);
    };
    
    if (value?.src) {
        return (
            <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                <img
                    src={value.src}
                    alt={value.alt ?? ''}
                    className="h-12 w-12 object-contain rounded"
                />
                <span className="flex-1 text-sm truncate text-muted-foreground">
                    {value.src}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleClear}
                    disabled={disabled}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }
    
    return (
        <div className="flex gap-2">
            <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter image URL..."
                disabled={disabled}
                className="flex-1"
            />
            <Button
                variant="outline"
                size="icon"
                onClick={handleSet}
                disabled={disabled || !urlInput.trim()}
            >
                <Upload className="h-4 w-4" />
            </Button>
        </div>
    );
}

// ============================================================================
// IMAGE LIST FIELD
// ============================================================================

function ImageListField({
    value,
    onChange,
    disabled,
}: {
    value: { src: string; alt?: string }[];
    onChange: (value: { src: string; alt?: string }[]) => void;
    disabled?: boolean;
}) {
    const [newUrl, setNewUrl] = useState('');
    
    const addImage = () => {
        if (newUrl.trim()) {
            onChange([...value, { src: newUrl.trim(), alt: '' }]);
            setNewUrl('');
        }
    };
    
    const removeImage = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };
    
    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {value.map((img, i) => (
                        <div key={i} className="relative group">
                            <img
                                src={img.src}
                                alt={img.alt ?? ''}
                                className="h-16 w-full object-contain rounded border bg-muted/30"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeImage(i)}
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="Add image URL..."
                    disabled={disabled}
                    className="flex-1"
                />
                <Button
                    variant="outline"
                    size="icon"
                    onClick={addImage}
                    disabled={disabled || !newUrl.trim()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// KEY-VALUE LIST FIELD
// ============================================================================

function KeyValueListField({
    value,
    onChange,
    disabled,
}: {
    value: { key: string; value: string }[];
    onChange: (value: { key: string; value: string }[]) => void;
    disabled?: boolean;
}) {
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    
    const addItem = () => {
        if (newKey.trim() && newValue.trim()) {
            onChange([...value, { key: newKey.trim(), value: newValue.trim() }]);
            setNewKey('');
            setNewValue('');
        }
    };
    
    const removeItem = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };
    
    const updateItem = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...value];
        updated[index] = { ...updated[index], [field]: val };
        onChange(updated);
    };
    
    return (
        <div className="space-y-2">
            {value.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Input
                        value={item.key}
                        onChange={(e) => updateItem(i, 'key', e.target.value)}
                        placeholder="Key"
                        disabled={disabled}
                        className="flex-1"
                    />
                    <Input
                        value={item.value}
                        onChange={(e) => updateItem(i, 'value', e.target.value)}
                        placeholder="Value"
                        disabled={disabled}
                        className="flex-1"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(i)}
                        disabled={disabled}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <div className="flex items-center gap-2">
                <div className="w-4" /> {/* Spacer for grip */}
                <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="New key"
                    disabled={disabled}
                    className="flex-1"
                />
                <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="New value"
                    disabled={disabled}
                    className="flex-1"
                />
                <Button
                    variant="outline"
                    size="icon"
                    onClick={addItem}
                    disabled={disabled || !newKey.trim() || !newValue.trim()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
