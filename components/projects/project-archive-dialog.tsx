"use client";

import { useState } from "react";
import {
    Archive,
    AlertTriangle,
    Users,
    FolderArchive,
    Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface Assignment {
    id: string;
    userName: string;
    userBadge: string;
    stage: string;
    status: string;
}

interface ProjectArchiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: {
        id: string;
        name: string;
        pdNumber: string;
        activeAssignments: Assignment[];
    };
    onArchive: (data: { reason: string; notes: string; reassignTasks: boolean }) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const ARCHIVE_REASONS = [
    { value: "completed", label: "Project Completed" },
    { value: "cancelled", label: "Project Cancelled" },
    { value: "on_hold", label: "Put On Hold" },
    { value: "superseded", label: "Superseded by New Revision" },
    { value: "other", label: "Other" },
];

// ============================================================================
// Component
// ============================================================================

export function ProjectArchiveDialog({
    open,
    onOpenChange,
    project,
    onArchive,
}: ProjectArchiveDialogProps) {
    const [archiving, setArchiving] = useState(false);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [acknowledgeAssignments, setAcknowledgeAssignments] = useState(false);
    const [reassignTasks, setReassignTasks] = useState(false);

    const hasActiveAssignments = project.activeAssignments.length > 0;
    const canArchive = reason && (!hasActiveAssignments || acknowledgeAssignments);

    const handleArchive = async () => {
        if (!canArchive) return;

        setArchiving(true);
        try {
            await onArchive({ reason, notes, reassignTasks });
            onOpenChange(false);
            // Reset form
            setReason("");
            setNotes("");
            setAcknowledgeAssignments(false);
            setReassignTasks(false);
        } catch (error) {
            // Handle error
        } finally {
            setArchiving(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            // Reset form on close
            setReason("");
            setNotes("");
            setAcknowledgeAssignments(false);
            setReassignTasks(false);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                            <FolderArchive className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle>Archive Project</DialogTitle>
                            <DialogDescription className="text-xs">
                                {project.name} ({project.pdNumber})
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Warning for active assignments */}
                    {hasActiveAssignments && (
                        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/5">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-600">Active Assignments</AlertTitle>
                            <AlertDescription className="text-amber-600/80">
                                This project has {project.activeAssignments.length} active{" "}
                                {project.activeAssignments.length === 1 ? "assignment" : "assignments"}.
                                Archiving will affect these users.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Active assignments list */}
                    {hasActiveAssignments && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Affected Assignments</span>
                            </div>
                            <ScrollArea className="max-h-[120px]">
                                <div className="space-y-1.5">
                                    {project.activeAssignments.map((assignment) => (
                                        <div
                                            key={assignment.id}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{assignment.userName}</span>
                                                <span className="text-muted-foreground">#{assignment.userBadge}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {assignment.stage}
                                                </Badge>
                                                <Badge
                                                    variant={assignment.status === "in_progress" ? "default" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {assignment.status === "in_progress" ? "In Progress" : assignment.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            <div className="mt-3 space-y-2 border-t pt-3">
                                <div className="flex items-start gap-2">
                                    <Checkbox
                                        id="acknowledge"
                                        checked={acknowledgeAssignments}
                                        onCheckedChange={(c) => setAcknowledgeAssignments(c === true)}
                                    />
                                    <label htmlFor="acknowledge" className="text-xs text-muted-foreground cursor-pointer">
                                        I understand that archiving will mark these assignments as cancelled
                                    </label>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Checkbox
                                        id="reassign"
                                        checked={reassignTasks}
                                        onCheckedChange={(c) => setReassignTasks(c === true)}
                                        disabled={!acknowledgeAssignments}
                                    />
                                    <label
                                        htmlFor="reassign"
                                        className={cn(
                                            "text-xs cursor-pointer",
                                            !acknowledgeAssignments && "text-muted-foreground/50"
                                        )}
                                    >
                                        Attempt to reassign tasks to other available users
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Archive reason */}
                    <div className="space-y-2">
                        <Label htmlFor="reason">
                            Reason for archiving <span className="text-destructive">*</span>
                        </Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="reason">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {ARCHIVE_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Additional notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Additional Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any additional context or notes..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleArchive}
                        disabled={!canArchive || archiving}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {archiving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                Archiving...
                            </>
                        ) : (
                            <>
                                <Archive className="h-4 w-4 mr-1.5" />
                                Archive Project
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
