"use client";

import { useState } from "react";
import {
    Plus,
    X,
    ChevronUp,
    ChevronDown,
    Upload,
    ThumbsUp,
    ThumbsDown,
    AlertTriangle,
    Clock,
    Wrench,
    GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { InstallationStep, DoOrDont, PartImage } from "@/types/parts-library";

interface InstallationStepsEditorProps {
    steps: InstallationStep[];
    onChange: (steps: InstallationStep[]) => void;
    disabled?: boolean;
}

export function InstallationStepsEditor({
    steps,
    onChange,
    disabled = false,
}: InstallationStepsEditorProps) {
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
    
    const toggleStep = (index: number) => {
        const next = new Set(expandedSteps);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        setExpandedSteps(next);
    };
    
    const addStep = () => {
        const newStep: InstallationStep = {
            step: steps.length + 1,
            title: '',
            description: '',
            dosAndDonts: [],
        };
        onChange([...steps, newStep]);
        setExpandedSteps(new Set([...expandedSteps, steps.length]));
    };
    
    const removeStep = (index: number) => {
        const updated = steps.filter((_, i) => i !== index).map((s, i) => ({
            ...s,
            step: i + 1,
        }));
        onChange(updated);
    };
    
    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= steps.length) return;
        
        const updated = [...steps];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        // Renumber steps
        onChange(updated.map((s, i) => ({ ...s, step: i + 1 })));
    };
    
    const updateStep = (index: number, updates: Partial<InstallationStep>) => {
        const updated = [...steps];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Installation Steps</Label>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addStep}
                    disabled={disabled}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                </Button>
            </div>
            
            {steps.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                    <p className="text-sm">No installation steps defined.</p>
                    <p className="text-xs mt-1">Add steps to guide users through the installation process.</p>
                </div>
            )}
            
            <div className="space-y-3">
                {steps.map((step, index) => (
                    <Collapsible
                        key={index}
                        open={expandedSteps.has(index)}
                        onOpenChange={() => toggleStep(index)}
                    >
                        <Card>
                            <CardHeader className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveStep(index, 'up');
                                            }}
                                            disabled={disabled || index === 0}
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveStep(index, 'down');
                                            }}
                                            disabled={disabled || index === steps.length - 1}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <Badge variant="secondary" className="shrink-0">
                                        Step {step.step}
                                    </Badge>
                                    
                                    <CollapsibleTrigger asChild>
                                        <button className="flex-1 text-left text-sm font-medium truncate hover:text-primary transition-colors">
                                            {step.title || 'Untitled Step'}
                                        </button>
                                    </CollapsibleTrigger>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                        {step.estimatedTime && (
                                            <Badge variant="outline" className="gap-1 text-xs">
                                                <Clock className="h-3 w-3" />
                                                {step.estimatedTime}m
                                            </Badge>
                                        )}
                                        {(step.dosAndDonts?.length ?? 0) > 0 && (
                                            <Badge variant="outline" className="text-xs">
                                                {step.dosAndDonts?.length} tips
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeStep(index);
                                            }}
                                            disabled={disabled}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            
                            <CollapsibleContent>
                                <CardContent className="pt-0 space-y-4">
                                    <Separator />
                                    
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Step Title</Label>
                                            <Input
                                                value={step.title}
                                                onChange={(e) => updateStep(index, { title: e.target.value })}
                                                placeholder="e.g., Mount the relay to DIN rail"
                                                disabled={disabled}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Estimated Time (minutes)</Label>
                                            <Input
                                                type="number"
                                                value={step.estimatedTime ?? ''}
                                                onChange={(e) => updateStep(index, {
                                                    estimatedTime: e.target.valueAsNumber || undefined
                                                })}
                                                placeholder="e.g., 5"
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs">Description</Label>
                                        <Textarea
                                            value={step.description}
                                            onChange={(e) => updateStep(index, { description: e.target.value })}
                                            placeholder="Detailed instructions for this step..."
                                            disabled={disabled}
                                            rows={3}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs">Step Image</Label>
                                        <StepImageUpload
                                            image={step.image}
                                            onChange={(image) => updateStep(index, { image })}
                                            disabled={disabled}
                                        />
                                    </div>
                                    
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Required Tools</Label>
                                            <ToolsList
                                                tools={step.requiredTools ?? []}
                                                onChange={(requiredTools) => updateStep(index, { requiredTools })}
                                                disabled={disabled}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Safety Warnings</Label>
                                            <WarningsList
                                                warnings={step.warnings ?? []}
                                                onChange={(warnings) => updateStep(index, { warnings })}
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs">Dos and Don&apos;ts</Label>
                                        <DosDontsEditor
                                            items={step.dosAndDonts ?? []}
                                            onChange={(dosAndDonts) => updateStep(index, { dosAndDonts })}
                                            disabled={disabled}
                                        />
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// STEP IMAGE UPLOAD
// ============================================================================

function StepImageUpload({
    image,
    onChange,
    disabled,
}: {
    image?: PartImage;
    onChange: (image?: PartImage) => void;
    disabled?: boolean;
}) {
    const [url, setUrl] = useState(image?.src ?? '');
    
    const handleSet = () => {
        if (url.trim()) {
            onChange({ src: url.trim(), alt: '' });
        }
    };
    
    const handleClear = () => {
        setUrl('');
        onChange(undefined);
    };
    
    if (image?.src) {
        return (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <img
                    src={image.src}
                    alt={image.alt ?? ''}
                    className="h-20 w-20 object-contain rounded"
                />
                <div className="flex-1 space-y-1">
                    <Input
                        value={image.caption ?? ''}
                        onChange={(e) => onChange({ ...image, caption: e.target.value })}
                        placeholder="Image caption..."
                        disabled={disabled}
                        className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground truncate">{image.src}</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
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
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter image URL..."
                disabled={disabled}
                className="flex-1"
            />
            <Button
                variant="outline"
                onClick={handleSet}
                disabled={disabled || !url.trim()}
            >
                <Upload className="h-4 w-4 mr-1" />
                Set
            </Button>
        </div>
    );
}

// ============================================================================
// TOOLS LIST
// ============================================================================

function ToolsList({
    tools,
    onChange,
    disabled,
}: {
    tools: string[];
    onChange: (tools: string[]) => void;
    disabled?: boolean;
}) {
    const [newTool, setNewTool] = useState('');
    
    const addTool = () => {
        if (newTool.trim() && !tools.includes(newTool.trim())) {
            onChange([...tools, newTool.trim()]);
            setNewTool('');
        }
    };
    
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {tools.map((tool, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        <Wrench className="h-3 w-3" />
                        {tool}
                        <button
                            onClick={() => onChange(tools.filter((_, idx) => idx !== i))}
                            disabled={disabled}
                            className="ml-1 hover:text-destructive"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    placeholder="Add tool..."
                    disabled={disabled}
                    className="text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addTool}
                    disabled={disabled || !newTool.trim()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// WARNINGS LIST
// ============================================================================

function WarningsList({
    warnings,
    onChange,
    disabled,
}: {
    warnings: string[];
    onChange: (warnings: string[]) => void;
    disabled?: boolean;
}) {
    const [newWarning, setNewWarning] = useState('');
    
    const addWarning = () => {
        if (newWarning.trim()) {
            onChange([...warnings, newWarning.trim()]);
            setNewWarning('');
        }
    };
    
    return (
        <div className="space-y-2">
            {warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="flex-1 text-sm">{warning}</span>
                    <button
                        onClick={() => onChange(warnings.filter((_, idx) => idx !== i))}
                        disabled={disabled}
                        className="text-destructive hover:text-destructive/80"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
            <div className="flex gap-2">
                <Input
                    value={newWarning}
                    onChange={(e) => setNewWarning(e.target.value)}
                    placeholder="Add safety warning..."
                    disabled={disabled}
                    className="text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWarning())}
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addWarning}
                    disabled={disabled || !newWarning.trim()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// DOS AND DONTS EDITOR
// ============================================================================

function DosDontsEditor({
    items,
    onChange,
    disabled,
}: {
    items: DoOrDont[];
    onChange: (items: DoOrDont[]) => void;
    disabled?: boolean;
}) {
    const addItem = (type: 'do' | 'dont') => {
        const newItem: DoOrDont = {
            id: `${type}-${Date.now()}`,
            type,
            description: '',
        };
        onChange([...items, newItem]);
    };
    
    const updateItem = (id: string, updates: Partial<DoOrDont>) => {
        onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
    };
    
    const removeItem = (id: string) => {
        onChange(items.filter(item => item.id !== id));
    };
    
    const dos = items.filter(i => i.type === 'do');
    const donts = items.filter(i => i.type === 'dont');
    
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Dos */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5 text-green-600">
                        <ThumbsUp className="h-4 w-4" />
                        Do
                    </Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-green-600 hover:text-green-600"
                        onClick={() => addItem('do')}
                        disabled={disabled}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                    </Button>
                </div>
                <div className="space-y-2">
                    {dos.map((item) => (
                        <DosDontItem
                            key={item.id}
                            item={item}
                            onUpdate={(updates) => updateItem(item.id, updates)}
                            onRemove={() => removeItem(item.id)}
                            disabled={disabled}
                        />
                    ))}
                    {dos.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                            No dos defined
                        </p>
                    )}
                </div>
            </div>
            
            {/* Don'ts */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5 text-red-600">
                        <ThumbsDown className="h-4 w-4" />
                        Don&apos;t
                    </Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:text-red-600"
                        onClick={() => addItem('dont')}
                        disabled={disabled}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                    </Button>
                </div>
                <div className="space-y-2">
                    {donts.map((item) => (
                        <DosDontItem
                            key={item.id}
                            item={item}
                            onUpdate={(updates) => updateItem(item.id, updates)}
                            onRemove={() => removeItem(item.id)}
                            disabled={disabled}
                        />
                    ))}
                    {donts.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                            No don&apos;ts defined
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// DOS/DONT ITEM
// ============================================================================

function DosDontItem({
    item,
    onUpdate,
    onRemove,
    disabled,
}: {
    item: DoOrDont;
    onUpdate: (updates: Partial<DoOrDont>) => void;
    onRemove: () => void;
    disabled?: boolean;
}) {
    const [imageUrl, setImageUrl] = useState(item.image?.src ?? '');
    
    const handleSetImage = () => {
        if (imageUrl.trim()) {
            onUpdate({ image: { src: imageUrl.trim(), alt: '' } });
        }
    };
    
    const handleClearImage = () => {
        setImageUrl('');
        onUpdate({ image: undefined });
    };
    
    const bgColor = item.type === 'do' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20';
    
    return (
        <div className={`rounded-lg border p-3 space-y-2 ${bgColor}`}>
            <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab mt-0.5" />
                <Textarea
                    value={item.description}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    placeholder={item.type === 'do' ? 'What to do...' : 'What not to do...'}
                    disabled={disabled}
                    rows={2}
                    className="flex-1 text-sm resize-none"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                    disabled={disabled}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
            
            {item.image?.src ? (
                <div className="flex items-center gap-2 pl-6">
                    <img
                        src={item.image.src}
                        alt=""
                        className="h-12 w-12 object-contain rounded"
                    />
                    <span className="flex-1 text-xs text-muted-foreground truncate">
                        {item.image.src}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleClearImage}
                        disabled={disabled}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2 pl-6">
                    <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Optional image URL..."
                        disabled={disabled}
                        className="flex-1 text-xs h-8"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={handleSetImage}
                        disabled={disabled || !imageUrl.trim()}
                    >
                        <Upload className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}
