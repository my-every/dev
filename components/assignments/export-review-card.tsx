"use client";

import { useState, useCallback } from "react";
import {
    FileCheck,
    FileX,
    FileSearch,
    CheckCircle2,
    XCircle,
    Clock,
    MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
    ExportReviewEntry,
    ExportReviewStatus,
} from "@/types/d380-assignment-sws";

// ============================================================================
// Props
// ============================================================================

interface ExportReviewCardProps {
    exportType: ExportReviewEntry["exportType"];
    review?: ExportReviewEntry;
    onUpdate: (review: ExportReviewEntry) => void;
    onRemove: () => void;
}

// ============================================================================
// Status config
// ============================================================================

const STATUS_CONFIG: Record<
    ExportReviewStatus,
    { label: string; icon: React.ElementType; className: string; bgClassName: string }
> = {
    pending: {
        label: "Pending",
        icon: Clock,
        className: "text-amber-600",
        bgClassName: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50",
    },
    approved: {
        label: "Approved",
        icon: CheckCircle2,
        className: "text-emerald-600",
        bgClassName: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50",
    },
    rejected: {
        label: "Rejected",
        icon: XCircle,
        className: "text-red-600",
        bgClassName: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50",
    },
    revised: {
        label: "Revised",
        icon: FileSearch,
        className: "text-blue-600",
        bgClassName: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50",
    },
};

const EXPORT_LABELS: Record<ExportReviewEntry["exportType"], { label: string; icon: React.ElementType }> = {
    wire_list: { label: "Wire List Export", icon: FileCheck },
    branding_list: { label: "Branding List Export", icon: FileX },
};

// ============================================================================
// Component
// ============================================================================

export function ExportReviewCard({
    exportType,
    review,
    onUpdate,
    onRemove,
}: ExportReviewCardProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const exportConfig = EXPORT_LABELS[exportType];
    const ExportIcon = exportConfig.icon;

    if (!review) {
        return (
            <div className="rounded-lg border border-dashed border-border/50 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ExportIcon className="h-3.5 w-3.5" />
                    {exportConfig.label}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDialogOpen(true)}
                >
                    Review
                </Button>
                <ExportReviewDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    exportType={exportType}
                    onSubmit={(entry) => {
                        onUpdate(entry);
                        setDialogOpen(false);
                    }}
                />
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[review.status];
    const StatusIcon = statusCfg.icon;

    return (
        <div
            className={cn(
                "rounded-lg border p-3 space-y-2",
                statusCfg.bgClassName,
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ExportIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{exportConfig.label}</span>
                </div>
                <Badge
                    variant="outline"
                    className={cn("text-[10px] gap-1", statusCfg.className)}
                >
                    <StatusIcon className="h-3 w-3" />
                    {statusCfg.label}
                </Badge>
            </div>

            <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>
                    Reviewed by <span className="font-mono font-medium">{review.reviewedBy}</span>
                </p>
                <p>{new Date(review.reviewedAt).toLocaleString()}</p>
                {review.comment && (
                    <div className="flex items-start gap-1.5 mt-1 pt-1 border-t border-border/30">
                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                        <p className="italic">{review.comment}</p>
                    </div>
                )}
            </div>

            <div className="flex gap-1.5 pt-1">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setDialogOpen(true)}
                >
                    Update
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                    onClick={onRemove}
                >
                    Remove
                </Button>
            </div>

            <ExportReviewDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                exportType={exportType}
                existing={review}
                onSubmit={(entry) => {
                    onUpdate(entry);
                    setDialogOpen(false);
                }}
            />
        </div>
    );
}

// ============================================================================
// Review Dialog
// ============================================================================

function ExportReviewDialog({
    open,
    onOpenChange,
    exportType,
    existing,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exportType: ExportReviewEntry["exportType"];
    existing?: ExportReviewEntry;
    onSubmit: (entry: ExportReviewEntry) => void;
}) {
    const [status, setStatus] = useState<ExportReviewStatus>(
        existing?.status ?? "approved",
    );
    const [reviewedBy, setReviewedBy] = useState(existing?.reviewedBy ?? "");
    const [comment, setComment] = useState(existing?.comment ?? "");

    const handleSubmit = useCallback(() => {
        if (!reviewedBy.trim()) return;
        onSubmit({
            exportType,
            status,
            reviewedBy: reviewedBy.trim(),
            reviewedAt: new Date().toISOString(),
            comment: comment.trim() || undefined,
        });
    }, [exportType, status, reviewedBy, comment, onSubmit]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Review {exportType === "wire_list" ? "Wire List" : "Branding List"}
                    </DialogTitle>
                    <DialogDescription>
                        Set the review status for this export.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex gap-2">
                        {(["approved", "rejected", "revised", "pending"] as ExportReviewStatus[]).map(
                            (s) => {
                                const cfg = STATUS_CONFIG[s];
                                return (
                                    <Button
                                        key={s}
                                        variant={status === s ? "default" : "outline"}
                                        size="sm"
                                        className="gap-1 text-xs flex-1"
                                        onClick={() => setStatus(s)}
                                    >
                                        <cfg.icon className="h-3.5 w-3.5" />
                                        {cfg.label}
                                    </Button>
                                );
                            },
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reviewedBy" className="text-xs">
                            Reviewed By (Badge)
                        </Label>
                        <Input
                            id="reviewedBy"
                            value={reviewedBy}
                            onChange={(e) => setReviewedBy(e.target.value)}
                            placeholder="e.g. 12345"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="comment" className="text-xs">
                            Comment (optional)
                        </Label>
                        <Textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Notes about the review..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!reviewedBy.trim()}
                    >
                        Submit Review
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
