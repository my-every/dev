"use client";

import { useState, useCallback } from "react";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { OPERATION_CODES } from "@/types/d380-operation-codes";
import type { LogOperationTimeParams } from "@/lib/persistence/operation-time-storage";

interface OperationTimeLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    sheetSlug?: string;
    onLog: (params: LogOperationTimeParams) => Promise<void>;
}

export function OperationTimeLogDialog({
    open,
    onOpenChange,
    projectId,
    sheetSlug,
    onLog,
}: OperationTimeLogDialogProps) {
    const [opCode, setOpCode] = useState("");
    const [badge, setBadge] = useState("");
    const [minutes, setMinutes] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!opCode || !badge || !minutes) return;
        setSaving(true);
        try {
            const now = new Date().toISOString();
            await onLog({
                opCode,
                badgeNumber: badge.trim(),
                sheetSlug,
                startedAt: now,
                endedAt: now,
                actualMinutes: Number(minutes),
                note: note.trim() || undefined,
            });
            // Reset
            setOpCode("");
            setBadge("");
            setMinutes("");
            setNote("");
        } finally {
            setSaving(false);
        }
    }, [opCode, badge, minutes, note, sheetSlug, onLog]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Log Operation Time
                    </DialogTitle>
                    <DialogDescription>
                        Record time spent on a manufacturing operation.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Operation Code</Label>
                        <Select value={opCode} onValueChange={setOpCode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select operation..." />
                            </SelectTrigger>
                            <SelectContent>
                                {OPERATION_CODES.map((op) => (
                                    <SelectItem key={op.code} value={op.code}>
                                        <span className="font-mono mr-2">{op.code}</span>
                                        {op.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="badge">Badge Number</Label>
                        <Input
                            id="badge"
                            value={badge}
                            onChange={(e) => setBadge(e.target.value)}
                            placeholder="e.g. 12345"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="minutes">Minutes</Label>
                        <Input
                            id="minutes"
                            type="number"
                            min={1}
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            placeholder="e.g. 60"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Note (optional)</Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Additional details..."
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
                        disabled={!opCode || !badge || !minutes || saving}
                    >
                        {saving ? "Logging…" : "Log Time"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
