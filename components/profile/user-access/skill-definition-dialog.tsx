"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Trash2,
    ArrowRight,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    BookOpen,
    ListOrdered,
    FileText,
    GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CompactStepper, type GuidedStep } from "@/components/ui/guided-stepper";
import { cn } from "@/lib/utils";
import type { SkillDefinition } from "@/types/skill-definition";

// ============================================================================
// Types
// ============================================================================

interface SkillDefinitionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    skill: SkillDefinition | null;
    onSave: (data: Partial<SkillDefinition>) => void;
}

interface SkillLevel {
    level: number;
    name: string;
    description?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS: GuidedStep[] = [
    { id: "basic", label: "Basic Info", icon: BookOpen },
    { id: "levels", label: "Levels", icon: ListOrdered },
    { id: "review", label: "Review", icon: CheckCircle2 },
];

const SKILL_CATEGORIES = [
    { value: "production", label: "Production" },
    { value: "quality", label: "Quality" },
    { value: "leadership", label: "Leadership" },
    { value: "safety", label: "Safety" },
];

const DEFAULT_LEVELS: SkillLevel[] = [
    { level: 0, name: "Not Trained", description: "No training or experience" },
    { level: 1, name: "Beginner", description: "Basic understanding, requires supervision" },
    { level: 2, name: "Intermediate", description: "Can work independently on standard tasks" },
    { level: 3, name: "Advanced", description: "Handles complex tasks, can mentor others" },
    { level: 4, name: "Expert", description: "Subject matter expert, can train others" },
];

// ============================================================================
// Step Components
// ============================================================================

function BasicInfoStep({
    data,
    onChange,
    errors,
}: {
    data: Partial<SkillDefinition>;
    onChange: (field: keyof SkillDefinition, value: string) => void;
    errors: Record<string, string>;
}) {
    return (
        <div className="space-y-4 py-2">
            <div className="space-y-2">
                <Label htmlFor="name">
                    Skill Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="name"
                    value={data.name || ""}
                    onChange={(e) => onChange("name", e.target.value)}
                    placeholder="e.g., Wiring"
                    className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="category">
                    Category <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={data.category || ""}
                    onValueChange={(v) => onChange("category", v)}
                >
                    <SelectTrigger id="category" className={errors.category ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                        {SKILL_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.category && (
                    <p className="text-xs text-destructive">{errors.category}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    value={data.description || ""}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="Brief description of this skill..."
                    rows={3}
                />
            </div>
        </div>
    );
}

function LevelsStep({
    levels,
    onLevelsChange,
}: {
    levels: SkillLevel[];
    onLevelsChange: (levels: SkillLevel[]) => void;
}) {
    const updateLevel = (index: number, field: keyof SkillLevel, value: string | number) => {
        const updated = [...levels];
        updated[index] = { ...updated[index], [field]: value };
        onLevelsChange(updated);
    };

    const addLevel = () => {
        const newLevel: SkillLevel = {
            level: levels.length,
            name: `Level ${levels.length}`,
        };
        onLevelsChange([...levels, newLevel]);
    };

    const removeLevel = (index: number) => {
        if (levels.length <= 2) return; // Minimum 2 levels
        const updated = levels.filter((_, i) => i !== index);
        // Re-number levels
        updated.forEach((l, i) => {
            l.level = i;
        });
        onLevelsChange(updated);
    };

    const resetToDefault = () => {
        onLevelsChange([...DEFAULT_LEVELS]);
    };

    return (
        <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Proficiency Levels</p>
                    <p className="text-xs text-muted-foreground">
                        Define the levels for this skill (min 2, max 10)
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetToDefault}>
                    Reset to Default
                </Button>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {levels.map((level, index) => (
                    <div
                        key={index}
                        className="flex items-start gap-2 rounded-lg border bg-card p-2.5"
                    >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                            {level.level}
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <Input
                                value={level.name}
                                onChange={(e) => updateLevel(index, "name", e.target.value)}
                                placeholder="Level name"
                                className="h-8 text-sm"
                            />
                            <Input
                                value={level.description || ""}
                                onChange={(e) => updateLevel(index, "description", e.target.value)}
                                placeholder="Description (optional)"
                                className="h-7 text-xs"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLevel(index)}
                            disabled={levels.length <= 2}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
            </div>

            {levels.length < 10 && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={addLevel}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Level
                </Button>
            )}
        </div>
    );
}

function ReviewStep({
    data,
    levels,
}: {
    data: Partial<SkillDefinition>;
    levels: SkillLevel[];
}) {
    const categoryLabel = SKILL_CATEGORIES.find((c) => c.value === data.category)?.label || data.category;

    return (
        <div className="space-y-4 py-2">
            <Card>
                <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="font-medium">{data.name || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Category</span>
                        <Badge variant="outline" className="capitalize">
                            {categoryLabel}
                        </Badge>
                    </div>
                    {data.description && (
                        <div>
                            <span className="text-sm text-muted-foreground">Description</span>
                            <p className="text-sm mt-0.5">{data.description}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Proficiency Levels ({levels.length})
                    </p>
                    <div className="space-y-1.5">
                        {levels.map((level) => (
                            <div
                                key={level.level}
                                className="flex items-center gap-2 text-sm"
                            >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                                    {level.level}
                                </div>
                                <span className="font-medium">{level.name}</span>
                                {level.description && (
                                    <span className="text-muted-foreground text-xs">
                                        — {level.description}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function SkillDefinitionDialog({
    open,
    onOpenChange,
    skill,
    onSave,
}: SkillDefinitionDialogProps) {
    const isEditing = !!skill;
    const [currentStepId, setCurrentStepId] = useState("basic");
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [data, setData] = useState<Partial<SkillDefinition>>({});
    const [levels, setLevels] = useState<SkillLevel[]>([...DEFAULT_LEVELS]);

    // Reset form when dialog opens/closes or skill changes
    useEffect(() => {
        if (open) {
            if (skill) {
                setData({
                    name: skill.name,
                    category: skill.category,
                    description: skill.description,
                });
                setLevels(skill.levels);
            } else {
                setData({});
                setLevels([...DEFAULT_LEVELS]);
            }
            setCurrentStepId("basic");
            setErrors({});
        }
    }, [open, skill]);

    const currentStepIndex = STEPS.findIndex((s) => s.id === currentStepId);
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === STEPS.length - 1;

    const updateField = useCallback((field: keyof SkillDefinition, value: string) => {
        setData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    }, [errors]);

    const validateStep = useCallback((stepId: string): boolean => {
        const newErrors: Record<string, string> = {};

        if (stepId === "basic") {
            if (!data.name?.trim()) {
                newErrors.name = "Skill name is required";
            }
            if (!data.category) {
                newErrors.category = "Category is required";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [data]);

    const goNext = useCallback(() => {
        if (!validateStep(currentStepId)) return;

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < STEPS.length) {
            setCurrentStepId(STEPS[nextIndex].id);
        }
    }, [currentStepId, currentStepIndex, validateStep]);

    const goPrev = useCallback(() => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStepId(STEPS[prevIndex].id);
        }
    }, [currentStepIndex]);

    const handleSave = async () => {
        if (!validateStep(currentStepId)) return;

        setSaving(true);
        // Simulate API call
        await new Promise((r) => setTimeout(r, 300));
        onSave({ ...data, levels });
        setSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Edit Skill Definition" : "Create Skill Definition"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update the skill settings and proficiency levels."
                            : "Define a new skill with proficiency levels."}
                    </DialogDescription>
                </DialogHeader>

                {/* Stepper */}
                <div className="py-2 border-b">
                    <CompactStepper steps={STEPS} currentStepId={currentStepId} />
                </div>

                {/* Content */}
                <div className="min-h-[280px]">
                    {currentStepId === "basic" && (
                        <BasicInfoStep data={data} onChange={updateField} errors={errors} />
                    )}
                    {currentStepId === "levels" && (
                        <LevelsStep levels={levels} onLevelsChange={setLevels} />
                    )}
                    {currentStepId === "review" && (
                        <ReviewStep data={data} levels={levels} />
                    )}
                </div>

                <DialogFooter className="flex-row justify-between sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={isFirstStep ? () => onOpenChange(false) : goPrev}
                    >
                        {isFirstStep ? (
                            "Cancel"
                        ) : (
                            <>
                                <ArrowLeft className="h-4 w-4 mr-1.5" />
                                Back
                            </>
                        )}
                    </Button>

                    {isLastStep ? (
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                    {isEditing ? "Save Changes" : "Create Skill"}
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={goNext}>
                            Continue
                            <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
