"use client";

import { useState, useCallback } from "react";
import {
    X,
    Loader2,
    User,
    Briefcase,
    Shield,
    Save,
    AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import type { UserRole } from "@/types/d380-user-session";
import { USER_ROLE_LABELS } from "@/types/d380-user-session";

// ============================================================================
// Types
// ============================================================================

export interface UserEditData {
    badge: string;
    legalName: string;
    preferredName: string;
    email: string | null;
    role: UserRole;
    primaryLwc: string;
    currentShift: string;
    hireDate?: string;
    isActive: boolean;
}

interface UserEditAsideProps {
    user: UserEditData;
    onClose: () => void;
    onSave: (data: Partial<UserEditData>) => Promise<void>;
    onDeactivate?: (reason: string) => Promise<void>;
    canEditProfile?: boolean;
    canEditEmployment?: boolean;
    canDeactivate?: boolean;
}

// ============================================================================
// LWC Options
// ============================================================================

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

// ============================================================================
// Component
// ============================================================================

export function UserEditAside({
    user,
    onClose,
    onSave,
    onDeactivate,
    canEditProfile = true,
    canEditEmployment = false,
    canDeactivate = false,
}: UserEditAsideProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("profile");
    const [saving, setSaving] = useState(false);
    const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
    const [deactivateReason, setDeactivateReason] = useState("");

    // Form state
    const [formData, setFormData] = useState<Partial<UserEditData>>({
        legalName: user.legalName,
        preferredName: user.preferredName,
        email: user.email,
        role: user.role,
        primaryLwc: user.primaryLwc,
        currentShift: user.currentShift,
        hireDate: user.hireDate,
    });

    const [hasChanges, setHasChanges] = useState(false);

    const updateField = useCallback(<K extends keyof UserEditData>(
        field: K,
        value: UserEditData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    }, []);

    const handleSave = async () => {
        if (!hasChanges) return;

        setSaving(true);
        try {
            await onSave(formData);
            toast({
                title: "Changes saved",
                description: "User profile has been updated successfully.",
            });
            setHasChanges(false);
        } catch {
            toast({
                title: "Failed to save",
                description: "There was an error saving changes. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!onDeactivate || !deactivateReason) return;

        setSaving(true);
        try {
            await onDeactivate(deactivateReason);
            toast({
                title: "User deactivated",
                description: `${user.preferredName || user.legalName} has been deactivated.`,
            });
            setShowDeactivateDialog(false);
            onClose();
        } catch {
            toast({
                title: "Failed to deactivate",
                description: "There was an error deactivating the user.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const initials = getAvatarInitials(user.legalName);
    const avatarColor = getAvatarColor(user.badge);

    return (
        <>
            <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                            <AvatarFallback className={cn("font-semibold", avatarColor)}>
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold">{user.preferredName || user.legalName}</h3>
                            <p className="text-sm text-muted-foreground">Badge #{user.badge}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
                        <TabsTrigger value="profile" className="gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            Profile
                        </TabsTrigger>
                        <TabsTrigger value="employment" className="gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            Work
                        </TabsTrigger>
                        <TabsTrigger value="status" className="gap-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            Status
                        </TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1 px-4">
                        {/* Profile Tab */}
                        <TabsContent value="profile" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="legalName">Legal Name</Label>
                                <Input
                                    id="legalName"
                                    value={formData.legalName || ""}
                                    onChange={(e) => updateField("legalName", e.target.value)}
                                    disabled={!canEditProfile}
                                    placeholder="Full legal name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="preferredName">Preferred Name</Label>
                                <Input
                                    id="preferredName"
                                    value={formData.preferredName || ""}
                                    onChange={(e) => updateField("preferredName", e.target.value)}
                                    disabled={!canEditProfile}
                                    placeholder="Display name"
                                />
                                <p className="text-xs text-muted-foreground">
                                    This is how the user will appear throughout the app.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => updateField("email", e.target.value || null)}
                                    disabled={!canEditProfile}
                                    placeholder="email@company.com"
                                />
                            </div>
                        </TabsContent>

                        {/* Employment Tab */}
                        <TabsContent value="employment" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Badge Number</Label>
                                <Input value={user.badge} disabled />
                                <p className="text-xs text-muted-foreground">
                                    Badge numbers cannot be changed after creation.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(v) => updateField("role", v as UserRole)}
                                    disabled={!canEditEmployment}
                                >
                                    <SelectTrigger id="role">
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
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shift">Shift</Label>
                                <Select
                                    value={formData.currentShift}
                                    onValueChange={(v) => updateField("currentShift", v)}
                                    disabled={!canEditEmployment}
                                >
                                    <SelectTrigger id="shift">
                                        <SelectValue placeholder="Select shift" />
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
                                    value={formData.primaryLwc}
                                    onValueChange={(v) => updateField("primaryLwc", v)}
                                    disabled={!canEditEmployment}
                                >
                                    <SelectTrigger id="lwc">
                                        <SelectValue placeholder="Select LWC" />
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

                            <div className="space-y-2">
                                <Label htmlFor="hireDate">Start Date</Label>
                                <Input
                                    id="hireDate"
                                    type="date"
                                    value={formData.hireDate || ""}
                                    onChange={(e) => updateField("hireDate", e.target.value)}
                                    disabled={!canEditEmployment}
                                />
                            </div>
                        </TabsContent>

                        {/* Status Tab */}
                        <TabsContent value="status" className="mt-4 space-y-4">
                            <div className="rounded-lg border p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">Account Status</h4>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            {user.isActive ? "This account is active" : "This account is deactivated"}
                                        </p>
                                    </div>
                                    <Badge variant={user.isActive ? "default" : "secondary"}>
                                        {user.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>

                            {canDeactivate && user.isActive && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-medium text-destructive">Deactivate Account</h4>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Deactivating this account will prevent the user from logging in
                                                and remove them from active assignments.
                                            </p>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="mt-3"
                                                onClick={() => setShowDeactivateDialog(true)}
                                            >
                                                Deactivate User
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!user.isActive && canDeactivate && (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-emerald-600">Reactivate Account</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Reactivating will restore the user&apos;s ability to log in.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-3 border-emerald-500 text-emerald-600 hover:bg-emerald-500/10"
                                            onClick={() => {
                                                // Handle reactivation
                                            }}
                                        >
                                            Reactivate User
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                {/* Footer */}
                <div className="border-t px-4 py-3">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Deactivate Confirmation Dialog */}
            <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate User Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to deactivate the account for{" "}
                            <span className="font-medium text-foreground">
                                {user.preferredName || user.legalName}
                            </span>
                            . This action can be reversed later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2 py-2">
                        <Label htmlFor="deactivateReason">Reason for deactivation</Label>
                        <Select value={deactivateReason} onValueChange={setDeactivateReason}>
                            <SelectTrigger id="deactivateReason">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="resignation">Resignation</SelectItem>
                                <SelectItem value="termination">Termination</SelectItem>
                                <SelectItem value="leave">Leave of Absence</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeactivate}
                            disabled={!deactivateReason || saving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {saving ? "Deactivating..." : "Deactivate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
