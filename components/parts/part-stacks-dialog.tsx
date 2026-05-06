"use client";

import type { ReactNode } from "react";
import { Layers } from "lucide-react";

import { PartStacksWorkspace } from "@/components/parts/part-stacks-workspace";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface PartStacksDialogProps {
    trigger: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function PartStacksDialog({ trigger, open, onOpenChange }: PartStacksDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Part Stacks
                    </DialogTitle>
                    <DialogDescription>
                        Build and reuse grouped stacks for hardware kits, training modules, and terminal accessories.
                    </DialogDescription>
                </DialogHeader>

                <PartStacksWorkspace embedded onRequestClose={() => onOpenChange?.(false)} />
            </DialogContent>
        </Dialog>
    );
}
