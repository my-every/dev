"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X,
    ArrowRight,
    Users,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import { useToast } from "@/hooks/use-toast";
import { CompactStepper, type GuidedStep } from "@/components/ui/guided-stepper";

// ============================================================================
// Types
// ============================================================================

interface Assignment {
    id: string;
    projectId: string;
    projectName: string;
    pdNumber: string;
    stage: string;
    status: "pending" | "in_progress" | "blocked";
    assignedAt: string;
}

interface AvailableUser {
    badge: string;
    name: string;
    role: string;
    currentLoad: number; // Number of active assignments
    skillMatch: number; // 0-100 skill match percentage
    isAvailable: boolean;
}

interface TaskReassignmentAsideProps {
    user: {
        badge: string;
        name: string;
    };
    assignments: Assignment[];
    onClose: () => void;
    onReassign: (data: {
        assignmentIds: string[];
        targetBadge: string;
        reason: string;
    }) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS: GuidedStep[] = [
    { id: "select", label: "Select Tasks", icon: CheckCircle2 },
    { id: "target", label: "Choose User", icon: User },
    { id: "confirm", label: "Confirm", icon: RefreshCw },
];

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_AVAILABLE_USERS: AvailableUser[] = [
    { badge: "68511", name: "Albert AJ Destura", role: "Assembler", currentLoad: 2, skillMatch: 95, isAvailable: true },
    { badge: "70061", name: "Adrian Leal", role: "Assembler", currentLoad: 3, skillMatch: 88, isAvailable: true },
    { badge: "75788", name: "Alejandra Orejel-Barron", role: "Assembler", currentLoad: 1, skillMatch: 92, isAvailable: true },
    { badge: "41052", name: "Alfonso Ramos", role: "Team Lead", currentLoad: 4, skillMatch: 78, isAvailable: false },
    { badge: "22334", name: "Maria Santos", role: "Assembler", currentLoad: 0, skillMatch: 85, isAvailable: true },
];

// ============================================================================
// Sub Components
// ============================================================================

function AssignmentCheckbox({
    assignment,
    checked,
    onCheckedChange,
}: {
    assignment: Assignment;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const statusColor = {
        pending: "bg-amber-500",
        in_progress: "bg-blue-500",
        blocked: "bg-red-500",
    }[assignment.status];

    return (
        <label
            className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
        >
            <Checkbox
                checked={checked}
                onCheckedChange={onCheckedChange}
                className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{assignment.pdNumber}</span>
                    <Badge variant="outline" className="text-[10px]">
                        {assignment.stage}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {assignment.projectName}
                </p>
            </div>
            <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", statusColor)} />
        </label>
    );
}

function UserOption({
    user,
    selected,
    onSelect,
}: {
    user: AvailableUser;
    selected: boolean;
    onSelect: () => void;
}) {
    const initials = getAvatarInitials(user.name);
    const avatarColor = getAvatarColor(user.badge);

    return (
        <label
            className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border",
                !user.isAvailable && "opacity-50 cursor-not-allowed"
            )}
        >
            <RadioGroupItem value={user.badge} disabled={!user.isAvailable} />
            <Avatar className="h-8 w-8">
                <AvatarFallback className={cn("text-xs", avatarColor)}>
                    {initials}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{user.name}</span>
                    {!user.isAvailable && (
                        <Badge variant="secondary" className="text-[10px]">
                            Unavailable
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{user.role}</span>
                    <span>•</span>
                    <span>{user.currentLoad} active</span>
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div className={cn(
                    "text-sm font-medium",
                    user.skillMatch >= 90 ? "text-emerald-600" :
                    user.skillMatch >= 75 ? "text-amber-600" : "text-muted-foreground"
                )}>
                    {user.skillMatch}%
                </div>
                <div className="text-[10px] text-muted-foreground">match</div>
            </div>
        </label>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskReassignmentAside({
    user,
    assignments,
    onClose,
    onReassign,
}: TaskReassignmentAsideProps) {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState("select");
    const [reassigning, setReassigning] = useState(false);

    // Form state
    const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
    const [targetUser, setTargetUser] = useState<string>("");
    const [reason, setReason] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Available users
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);

    // Load available users when moving to target step
    useEffect(() => {
        if (currentStep === "target" && availableUsers.length === 0) {
            setLoadingUsers(true);
            // Simulate API call
            setTimeout(() => {
                setAvailableUsers(MOCK_AVAILABLE_USERS.filter((u) => u.badge !== user.badge));
                setLoadingUsers(false);
            }, 300);
        }
    }, [currentStep, availableUsers.length, user.badge]);

    // Filter users by search
    const filteredUsers = useMemo(() => {
        if (!searchQuery) return availableUsers;
        const search = searchQuery.toLowerCase();
        return availableUsers.filter(
            (u) => u.name.toLowerCase().includes(search) || u.badge.includes(search)
        );
    }, [availableUsers, searchQuery]);

    // Get selected target user object
    const selectedTargetUser = useMemo(() => {
        return availableUsers.find((u) => u.badge === targetUser);
    }, [availableUsers, targetUser]);

    const toggleAssignment = (id: string) => {
        setSelectedAssignments((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedAssignments(new Set(assignments.map((a) => a.id)));
    };

    const canProceed = () => {
        if (currentStep === "select") return selectedAssignments.size > 0;
        if (currentStep === "target") return !!targetUser;
        return true;
    };

    const goNext = () => {
        const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
        if (stepIndex < STEPS.length - 1) {
            setCurrentStep(STEPS[stepIndex + 1].id);
        }
    };

    const goPrev = () => {
        const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
        if (stepIndex > 0) {
            setCurrentStep(STEPS[stepIndex - 1].id);
        }
    };

    const handleReassign = async () => {
        if (!targetUser || selectedAssignments.size === 0) return;

        setReassigning(true);
        try {
            await onReassign({
                assignmentIds: Array.from(selectedAssignments),
                targetBadge: targetUser,
                reason,
            });
            toast({
                title: "Tasks reassigned",
                description: `${selectedAssignments.size} task(s) reassigned to ${selectedTargetUser?.name}`,
            });
            onClose();
        } catch {
            toast({
                title: "Reassignment failed",
                description: "There was an error reassigning tasks. Please try again.",
                variant: "destructive",
            });
        } finally {
            setReassigning(false);
        }
    };

    const initials = getAvatarInitials(user.name);
    const avatarColor = getAvatarColor(user.badge);

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarFallback className={cn("font-semibold", avatarColor)}>
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-semibold">Reassign Tasks</h3>
                        <p className="text-xs text-muted-foreground">
                            From {user.name}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Stepper */}
            <div className="border-b px-4 py-3">
                <CompactStepper steps={STEPS} currentStepId={currentStep} />
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4 py-4">
                {currentStep === "select" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Select tasks to reassign</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={selectAll}
                                className="h-7 text-xs"
                            >
                                Select All
                            </Button>
                        </div>

                        {assignments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p className="text-sm font-medium">No assignments</p>
                                <p className="text-xs text-muted-foreground">
                                    This user has no active assignments
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignments.map((assignment) => (
                                    <AssignmentCheckbox
                                        key={assignment.id}
                                        assignment={assignment}
                                        checked={selectedAssignments.has(assignment.id)}
                                        onCheckedChange={() => toggleAssignment(assignment.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === "target" && (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {loadingUsers ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                                        <Skeleton className="h-4 w-4 rounded-full" />
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <div className="flex-1">
                                            <Skeleton className="h-4 w-32 mb-1" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p className="text-sm font-medium">No users found</p>
                            </div>
                        ) : (
                            <RadioGroup value={targetUser} onValueChange={setTargetUser}>
                                <div className="space-y-2">
                                    {filteredUsers.map((u) => (
                                        <UserOption
                                            key={u.badge}
                                            user={u}
                                            selected={targetUser === u.badge}
                                            onSelect={() => u.isAvailable && setTargetUser(u.badge)}
                                        />
                                    ))}
                                </div>
                            </RadioGroup>
                        )}
                    </div>
                )}

                {currentStep === "confirm" && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className={cn("text-xs", avatarColor)}>
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                {selectedTargetUser && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className={cn("text-xs", getAvatarColor(selectedTargetUser.badge))}>
                                            {getAvatarInitials(selectedTargetUser.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-medium">
                                        {selectedTargetUser?.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        #{selectedTargetUser?.badge}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <p className="text-xs text-muted-foreground mb-1">
                                    Tasks to reassign ({selectedAssignments.size})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(selectedAssignments).map((id) => {
                                        const assignment = assignments.find((a) => a.id === id);
                                        return assignment ? (
                                            <Badge key={id} variant="secondary" className="text-[10px]">
                                                {assignment.pdNumber}
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason for reassignment</Label>
                            <Textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Add context for this reassignment..."
                                rows={3}
                            />
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-4 py-3">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={currentStep === "select" ? onClose : goPrev}
                    >
                        {currentStep === "select" ? "Cancel" : "Back"}
                    </Button>

                    {currentStep === "confirm" ? (
                        <Button
                            onClick={handleReassign}
                            disabled={reassigning}
                        >
                            {reassigning ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    Reassigning...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-1.5" />
                                    Reassign Tasks
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={goNext}
                            disabled={!canProceed()}
                        >
                            Continue
                            <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
