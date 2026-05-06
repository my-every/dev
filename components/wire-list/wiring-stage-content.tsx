"use client";

/**
 * Wiring Stage Content
 *
 * Bridges the assignment page's stage system with WiringExecutionMode.
 * Fetches wire list document data and renders the wiring execution UI
 * when the WIRING stage is active on the assignment detail page.
 *
 * Wire list sections from the print document become collapsible execution
 * sections in the wiring execution flow, matching the build-up pattern.
 */

import { Loader2, AlertCircle, Cable, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWiringDocument } from "@/hooks/use-wiring-document";
import { WiringExecutionMode } from "@/components/wire-list/wiring-execution-mode";

interface WiringStageContentProps {
    projectId: string;
    sheetSlug: string;
    sheetName: string;
    swsType: string;
    badge: string;
    shift: string;
    onClose?: () => void;
}

export function WiringStageContent({
    projectId,
    sheetSlug,
    sheetName,
    swsType,
    badge,
    shift,
    onClose,
}: WiringStageContentProps) {
    const { data, rowMap, isLoading, error, reload } = useWiringDocument(projectId, sheetSlug);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading wire list data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-8 space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to load wiring data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <div className="flex justify-center">
                    <Button variant="outline" onClick={reload} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (!data || data.processedLocationGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Cable className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">No Wire Data</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        This sheet has no wire list data available for wiring execution.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <WiringExecutionMode
            projectId={projectId}
            sheetSlug={sheetSlug}
            sheetName={sheetName}
            swsType={swsType}
            badge={badge}
            shift={shift}
            locationGroups={data.processedLocationGroups}
            settings={data.settings}
            rowMap={rowMap}
            onClose={onClose}
        />
    );
}
