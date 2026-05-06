"use client";

import { useState } from "react";
import { Rocket, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useProjectInitialize } from "@/hooks/use-project-initialize";
import { InitializePipelineResultCard } from "@/components/projects/initialize-pipeline-result-card";

// ============================================================================
// Props
// ============================================================================

interface ProjectInitializeButtonProps {
    projectId: string;
    /** Called after the pipeline completes successfully. */
    onComplete?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ProjectInitializeButton({
    projectId,
    onComplete,
}: ProjectInitializeButtonProps) {
    const { result, isRunning, error, initialize } =
        useProjectInitialize({ projectId });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [resultOpen, setResultOpen] = useState(false);

    const handleInitialize = async () => {
        setConfirmOpen(false);
        try {
            await initialize();
            setResultOpen(true);
            onComplete?.();
        } catch {
            // error is surfaced via the hook's error state
        }
    };

    return (
        <>
            <Button
                onClick={() => setConfirmOpen(true)}
                disabled={isRunning}
                className="gap-2"
            >
                {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Rocket className="h-4 w-4" />
                )}
                {isRunning ? "Initializing…" : "Initialize Pipeline"}
            </Button>

            {error && !isRunning && (
                <p className="text-xs text-destructive mt-1">
                    {error.message}
                </p>
            )}

            {/* Confirmation dialog */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Initialize Project Pipeline?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will map all imported sheets to assignments, detect SWS types,
                            estimate stage hours, and generate the initial assignment breakdowns.
                            Existing mappings will not be overwritten.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleInitialize}>
                            Initialize
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Result dialog */}
            {result && (
                <InitializePipelineResultCard
                    open={resultOpen}
                    onOpenChange={setResultOpen}
                    result={result}
                />
            )}
        </>
    );
}
