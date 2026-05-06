"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Loader2,
    X,
    Plus,
    Trash2,
    Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { TeamMember } from "./user-detail-aside";

// ============================================================================
// Types
// ============================================================================

interface UserSkillsPanelProps {
    selectedUser: TeamMember | null;
    onClose: () => void;
    onSkillUpdate?: (badge: string, skills: Record<string, number>) => void;
}

interface Skill {
    id: string;
    label: string;
    description: string;
}

// ============================================================================
// Skill Definitions
// ============================================================================

const DEFAULT_SKILLS: Skill[] = [
    { id: "brandList", label: "Brand List", description: "Cable and component labeling" },
    { id: "branding", label: "Branding", description: "Product marking and identification" },
    { id: "buildUp", label: "Build Up", description: "Initial assembly and structure" },
    { id: "wiring", label: "Wiring", description: "Electrical wiring and connections" },
    { id: "wiringIpv", label: "Wiring IPV", description: "In-process verification for wiring" },
    { id: "boxBuild", label: "Box Build", description: "Enclosure assembly" },
    { id: "crossWire", label: "Cross Wire", description: "Cross-wiring and interconnects" },
    { id: "test", label: "Test", description: "Testing and quality checks" },
    { id: "pwrCheck", label: "PWR Check", description: "Power verification" },
    { id: "biq", label: "BIQ", description: "Built-in quality processes" },
    { id: "greenChange", label: "Green Change", description: "ECO and change implementation" },
];

const SKILL_LEVELS = [
    { value: 0, label: "None", color: "bg-muted text-muted-foreground" },
    { value: 1, label: "Trainee", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    { value: 2, label: "Basic", color: "bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300" },
    { value: 3, label: "Proficient", color: "bg-amber-300 text-amber-900 dark:bg-amber-700/50 dark:text-amber-200" },
    { value: 4, label: "Expert", color: "bg-amber-400 text-amber-950 dark:bg-amber-600/60 dark:text-amber-100" },
];

// ============================================================================
// Sub-Components
// ============================================================================

function SkillLevelSelector({
    value,
    onChange,
    disabled,
}: {
    value: number;
    onChange: (level: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex gap-1">
            {SKILL_LEVELS.map((level) => (
                <button
                    key={level.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(level.value)}
                    className={cn(
                        "h-7 w-7 rounded-full text-xs font-semibold transition-all",
                        "hover:ring-2 hover:ring-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        value === level.value
                            ? level.color
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                    title={level.label}
                >
                    {level.value}
                </button>
            ))}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserSkillsPanel({
    selectedUser,
    onClose,
    onSkillUpdate,
}: UserSkillsPanelProps) {
    const { toast } = useToast();

    // Skills management state
    const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS);
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [localSkills, setLocalSkills] = useState<Record<string, number>>({});

    // Dialog state
    const [newSkillDialog, setNewSkillDialog] = useState(false);
    const [newSkillId, setNewSkillId] = useState("");
    const [newSkillLabel, setNewSkillLabel] = useState("");
    const [newSkillDescription, setNewSkillDescription] = useState("");
    const [deleteSkillDialog, setDeleteSkillDialog] = useState<string | null>(null);

    // Sync local skills when user changes
    const userSkills = selectedUser?.skills as Record<string, number> | undefined;

    // Update user skill level
    const handleUpdateSkill = useCallback(async (skillId: string, level: number) => {
        if (!selectedUser) return;

        const saveKey = `${selectedUser.badge}-skill-${skillId}`;
        setSaving(prev => new Set(prev).add(saveKey));

        // Optimistic update
        const currentSkills = { ...(userSkills ?? {}), ...localSkills };
        const newSkills = { ...currentSkills };

        if (level === 0) {
            delete newSkills[skillId];
        } else {
            newSkills[skillId] = level;
        }
        setLocalSkills(newSkills);

        try {
            const res = await fetch(`/api/users/${selectedUser.badge}/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skills: newSkills }),
            });

            if (res.ok) {
                const { profile } = await res.json();
                onSkillUpdate?.(selectedUser.badge, profile.skills);
                setLocalSkills({});
            } else {
                throw new Error("Failed to update");
            }
        } catch {
            // Revert optimistic update
            setLocalSkills({});
            toast({
                title: "Update failed",
                description: "Could not update skill level",
                duration: 3000,
            });
        } finally {
            setSaving(prev => {
                const next = new Set(prev);
                next.delete(saveKey);
                return next;
            });
        }
    }, [selectedUser, userSkills, localSkills, onSkillUpdate, toast]);

    // Add new skill
    const handleAddSkill = useCallback(() => {
        if (!newSkillId.trim() || !newSkillLabel.trim()) {
            toast({ title: "Please fill in skill ID and label", duration: 2000 });
            return;
        }

        const id = newSkillId.trim().replace(/\s+/g, "").toLowerCase();
        if (skills.some(s => s.id === id)) {
            toast({ title: "Skill ID already exists", duration: 2000 });
            return;
        }

        setSkills(prev => [...prev, {
            id,
            label: newSkillLabel.trim(),
            description: newSkillDescription.trim() || newSkillLabel.trim(),
        }]);

        setNewSkillDialog(false);
        setNewSkillId("");
        setNewSkillLabel("");
        setNewSkillDescription("");

        toast({ title: "Skill added", description: `${newSkillLabel.trim()} is now available`, duration: 2000 });
    }, [newSkillId, newSkillLabel, newSkillDescription, skills, toast]);

    // Delete skill
    const handleDeleteSkill = useCallback((skillId: string) => {
        setSkills(prev => prev.filter(s => s.id !== skillId));
        setDeleteSkillDialog(null);
        toast({ title: "Skill removed", duration: 2000 });
    }, [toast]);

    // Get current skill level (with optimistic updates)
    const getSkillLevel = (skillId: string): number => {
        if (localSkills[skillId] !== undefined) return localSkills[skillId];
        return (userSkills?.[skillId] ?? 0);
    };

    if (!selectedUser) return null;

    const color = getAvatarColor(selectedUser.badge);
    const totalSkills = Object.values({ ...userSkills, ...localSkills }).filter(v => v > 0).length;

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="h-full flex flex-col"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className={cn(
                                        "text-sm font-semibold",
                                        color.bg,
                                        color.text
                                    )}>
                                        {getAvatarInitials(selectedUser.fullName, selectedUser.preferredName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{selectedUser.fullName}</p>
                                    <p className="text-xs text-muted-foreground">Badge #{selectedUser.badge}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Skills Header */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold">Skills Assignment</h3>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setNewSkillDialog(true)}
                                className="h-7 gap-1 text-xs"
                            >
                                <Plus className="h-3 w-3" />
                                Add
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Set proficiency levels for each skill (0-4)
                        </p>
                    </div>

                    {/* Skills List */}
                    <div className="flex-1 overflow-auto p-4 space-y-2">
                        {skills.map((skill) => {
                            const currentLevel = getSkillLevel(skill.id);
                            const isSaving = saving.has(`${selectedUser.badge}-skill-${skill.id}`);

                            return (
                                <div
                                    key={skill.id}
                                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1 mr-3">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{skill.label}</p>
                                            {isSaving && (
                                                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {skill.description}
                                        </p>
                                    </div>
                                    <SkillLevelSelector
                                        value={currentLevel}
                                        onChange={(level) => handleUpdateSkill(skill.id, level)}
                                        disabled={isSaving}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Skill Summary */}
                    <div className="p-4 border-t border-border bg-muted/30">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Skills</span>
                            <span className="font-semibold">
                                {totalSkills} / {skills.length}
                            </span>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Add Skill Dialog */}
            <Dialog open={newSkillDialog} onOpenChange={setNewSkillDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Skill</DialogTitle>
                        <DialogDescription>
                            Create a new skill that can be assigned to users.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Skill ID</Label>
                            <Input
                                value={newSkillId}
                                onChange={(e) => setNewSkillId(e.target.value)}
                                placeholder="e.g. soldering"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Unique identifier (lowercase, no spaces)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input
                                value={newSkillLabel}
                                onChange={(e) => setNewSkillLabel(e.target.value)}
                                placeholder="e.g. Soldering"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={newSkillDescription}
                                onChange={(e) => setNewSkillDescription(e.target.value)}
                                placeholder="e.g. SMD and through-hole soldering"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewSkillDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddSkill}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add Skill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Skill Confirmation */}
            <Dialog open={!!deleteSkillDialog} onOpenChange={() => setDeleteSkillDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Skill</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this skill? This will not affect existing user skill assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteSkillDialog(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteSkillDialog && handleDeleteSkill(deleteSkillDialog)}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
