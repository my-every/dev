"use client";

import { useState, useCallback, useMemo } from "react";
import {
    User,
    Briefcase,
    Shield,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Loader2,
    UserPlus,
    Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { GuidedStepper, type GuidedStep } from "@/components/ui/guided-stepper";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/d380-user-session";
import { USER_ROLE_LABELS } from "@/types/d380-user-session";

// ============================================================================
// Types
// ============================================================================

export interface NewUserData {
    // Basic info
    legalName: string;
    preferredName: string;
    email: string;
    // Employment
    badge: string;
    role: UserRole;
    currentShift: string;
    primaryLwc: string;
    hireDate: string;
    // Permissions preset
    permissionPreset: string;
}

interface UserCreateStepperProps {
    onClose: () => void;
    onComplete: (data: NewUserData) => Promise<void>;
    defaultShift?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS: GuidedStep[] = [
    { id: "basic", label: "Basic Info", icon: User },
    { id: "employment", label: "Employment", icon: Briefcase },
    { id: "permissions", label: "Permissions", icon: Shield },
    { id: "review", label: "Review", icon: CheckCircle2 },
];

const LWC_OPTIONS = [
    { value: "NEW FLEX", label: "New Flex" },
    { value: "RELAY", label: "Relay" },
    { value: "SS LX", label: "SS LX" },
    { value: "LRGS", label: "LRGS" },
    { value: "HRGS", label: "HRGS" },
];

const SHIFT_OPTIONS = [
    { value: "1st", label: "1st Shift" },
    { value: "2nd", label: "2nd Shift" },
];

const PERMISSION_PRESETS = [
    {
        id: "viewer",
        label: "Viewer",
        description: "Can view data but cannot make changes",
        features: ["View projects", "View schedules", "View own profile"],
    },
    {
        id: "team_member",
        label: "Team Member",
        description: "Standard permissions for production workers",
        features: ["All Viewer permissions", "Update assignments", "Log time entries"],
    },
    {
        id: "team_lead",
        label: "Team Lead",
        description: "Can manage team assignments and view reports",
        features: ["All Team Member permissions", "Assign users", "View team stats", "Edit skills"],
    },
    {
        id: "supervisor",
        label: "Supervisor",
        description: "Full management access for supervisors",
        features: ["All Team Lead permissions", "Manage permissions", "Create users", "Full project access"],
    },
];

// ============================================================================
// Step Components
// ============================================================================

function BasicInfoStep({
    data,
    onChange,
    errors,
}: {
    data: Partial<NewUserData>;
    onChange: (field: keyof NewUserData, value: string) => void;
    errors: Record<string, string>;
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="legalName">
                    Legal Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="legalName"
                    value={data.legalName || ""}
                    onChange={(e) => onChange("legalName", e.target.value)}
                    placeholder="Enter full legal name"
                    className={errors.legalName ? "border-destructive" : ""}
                />
                {errors.legalName && (
                    <p className="text-xs text-destructive">{errors.legalName}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="preferredName">Preferred Name</Label>
                <Input
                    id="preferredName"
                    value={data.preferredName || ""}
                    onChange={(e) => onChange("preferredName", e.target.value)}
                    placeholder="Display name (optional)"
                />
                <p className="text-xs text-muted-foreground">
                    Leave blank to use legal name as display name.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                    id="email"
                    type="email"
                    value={data.email || ""}
                    onChange={(e) => onChange("email", e.target.value)}
                    placeholder="email@company.com"
                    className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                )}
            </div>
        </div>
    );
}

function EmploymentStep({
    data,
    onChange,
    errors,
}: {
    data: Partial<NewUserData>;
    onChange: (field: keyof NewUserData, value: string) => void;
    errors: Record<string, string>;
}) {
    const generateBadge = () => {
        const random = Math.floor(10000 + Math.random() * 90000).toString();
        onChange("badge", random);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="badge">
                    Badge Number <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                    <Input
                        id="badge"
                        value={data.badge || ""}
                        onChange={(e) => onChange("badge", e.target.value)}
                        placeholder="5-digit badge"
                        className={cn("flex-1", errors.badge && "border-destructive")}
                        maxLength={5}
                    />
                    <Button type="button" variant="outline" onClick={generateBadge}>
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Generate
                    </Button>
                </div>
                {errors.badge && (
                    <p className="text-xs text-destructive">{errors.badge}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="role">
                    Role <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={data.role || ""}
                    onValueChange={(v) => onChange("role", v)}
                >
                    <SelectTrigger id="role" className={errors.role ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.role && (
                    <p className="text-xs text-destructive">{errors.role}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="shift">
                        Shift <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={data.currentShift || ""}
                        onValueChange={(v) => onChange("currentShift", v)}
                    >
                        <SelectTrigger id="shift">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {SHIFT_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="lwc">Primary LWC</Label>
                    <Select
                        value={data.primaryLwc || ""}
                        onValueChange={(v) => onChange("primaryLwc", v)}
                    >
                        <SelectTrigger id="lwc">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            {LWC_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="hireDate">Start Date</Label>
                <Input
                    id="hireDate"
                    type="date"
                    value={data.hireDate || ""}
                    onChange={(e) => onChange("hireDate", e.target.value)}
                />
            </div>
        </div>
    );
}

function PermissionsStep({
    data,
    onChange,
}: {
    data: Partial<NewUserData>;
    onChange: (field: keyof NewUserData, value: string) => void;
}) {
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Select a permission preset. You can customize individual permissions after creation.
            </p>

            <RadioGroup
                value={data.permissionPreset || ""}
                onValueChange={(v) => onChange("permissionPreset", v)}
                className="space-y-2"
            >
                {PERMISSION_PRESETS.map((preset) => (
                    <label
                        key={preset.id}
                        className={cn(
                            "flex cursor-pointer rounded-lg border p-3 transition-all",
                            data.permissionPreset === preset.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        <RadioGroupItem value={preset.id} className="mt-1" />
                        <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{preset.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {preset.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {preset.features.map((f) => (
                                    <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {f}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </label>
                ))}
            </RadioGroup>
        </div>
    );
}

function ReviewStep({ data }: { data: Partial<NewUserData> }) {
    const selectedPreset = PERMISSION_PRESETS.find((p) => p.id === data.permissionPreset);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Legal Name</span>
                        <span className="font-medium">{data.legalName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Preferred Name</span>
                        <span className="font-medium">{data.preferredName || data.legalName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{data.email || "—"}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Badge Number</span>
                        <Badge variant="outline">#{data.badge || "—"}</Badge>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <span className="font-medium">
                            {data.role ? USER_ROLE_LABELS[data.role as UserRole] : "—"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Shift</span>
                        <span className="font-medium">{data.currentShift || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">LWC</span>
                        <span className="font-medium">{data.primaryLwc || "—"}</span>
                    </div>
                    {data.hireDate && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Start Date</span>
                            <span className="font-medium">{data.hireDate}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedPreset ? (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="h-4 w-4 text-primary" />
                                <span className="font-medium">{selectedPreset.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {selectedPreset.description}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No preset selected</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserCreateStepper({
    onClose,
    onComplete,
    defaultShift = "1st",
}: UserCreateStepperProps) {
    const { toast } = useToast();
    const [currentStepId, setCurrentStepId] = useState("basic");
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [data, setData] = useState<Partial<NewUserData>>({
        currentShift: defaultShift,
        permissionPreset: "team_member",
    });

    const currentStepIndex = STEPS.findIndex((s) => s.id === currentStepId);
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === STEPS.length - 1;

    const updateField = useCallback((field: keyof NewUserData, value: string) => {
        setData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user types
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
            if (!data.legalName?.trim()) {
                newErrors.legalName = "Legal name is required";
            }
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                newErrors.email = "Invalid email format";
            }
        }

        if (stepId === "employment") {
            if (!data.badge?.trim()) {
                newErrors.badge = "Badge number is required";
            } else if (!/^\d{5}$/.test(data.badge)) {
                newErrors.badge = "Badge must be 5 digits";
            }
            if (!data.role) {
                newErrors.role = "Role is required";
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

    const handleCreate = async () => {
        if (!validateStep(currentStepId)) return;

        setCreating(true);
        try {
            await onComplete(data as NewUserData);
            toast({
                title: "User created",
                description: `${data.preferredName || data.legalName} has been created successfully.`,
            });
            onClose();
        } catch {
            toast({
                title: "Failed to create user",
                description: "There was an error creating the user. Please try again.",
                variant: "destructive",
            });
        } finally {
            setCreating(false);
        }
    };

    const completedSteps = useMemo(() => {
        const completed: string[] = [];
        for (let i = 0; i < currentStepIndex; i++) {
            completed.push(STEPS[i].id);
        }
        return completed;
    }, [currentStepIndex]);

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Create New User</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Follow the steps to add a new team member
                </p>
            </div>

            {/* Stepper */}
            <div className="border-b px-4 py-3">
                <GuidedStepper
                    steps={STEPS}
                    currentStepId={currentStepId}
                    completedSteps={completedSteps}
                    allowNavigation
                    onStepClick={(id) => {
                        const targetIndex = STEPS.findIndex((s) => s.id === id);
                        if (targetIndex <= currentStepIndex) {
                            setCurrentStepId(id);
                        }
                    }}
                />
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4 py-4">
                {currentStepId === "basic" && (
                    <BasicInfoStep data={data} onChange={updateField} errors={errors} />
                )}
                {currentStepId === "employment" && (
                    <EmploymentStep data={data} onChange={updateField} errors={errors} />
                )}
                {currentStepId === "permissions" && (
                    <PermissionsStep data={data} onChange={updateField} />
                )}
                {currentStepId === "review" && <ReviewStep data={data} />}
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-4 py-3">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={isFirstStep ? onClose : goPrev}
                    >
                        {isFirstStep ? (
                            "Cancel"
                        ) : (
                            <>
                                <ArrowLeft className="mr-1.5 h-4 w-4" />
                                Back
                            </>
                        )}
                    </Button>

                    {isLastStep ? (
                        <Button onClick={handleCreate} disabled={creating}>
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create User
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={goNext}>
                            Continue
                            <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
