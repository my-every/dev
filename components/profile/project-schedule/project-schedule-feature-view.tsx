"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type {
    ProjectScheduleDocument,
} from "@/lib/project-schedule/types";
import { ProjectScheduleUpload } from "./project-schedule-upload";
import {
    ProjectScheduleList,
} from "./project-schedule-list";
import {
    ProjectScheduleImportStepper,
    type ProjectScheduleImportStep,
} from "./project-schedule-import-stepper";

const IMPORT_STEPS: ProjectScheduleImportStep[] = [
    { id: "uploaded", label: "Upload" },
    { id: "validated", label: "Validate" },
    { id: "normalized", label: "Normalize" },
    { id: "loaded", label: "Loaded" },
];

interface ProjectScheduleFeatureViewProps {
    roleLabel: string;
}

const EMPTY_SCHEDULE: ProjectScheduleDocument = {
    columns: [],
    groups: [],
    importedAt: "",
};

export function ProjectScheduleFeatureView({ roleLabel }: ProjectScheduleFeatureViewProps) {
    const [schedule, setSchedule] = useState<ProjectScheduleDocument>(EMPTY_SCHEDULE);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadSchedule = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/schedule/project-schedule", { cache: "no-store" });
            const payload = await response.json().catch(() => ({ error: "Failed to load project schedule" })) as {
                error?: string;
                columns?: ProjectScheduleDocument["columns"];
                groups?: ProjectScheduleDocument["groups"];
                importedAt?: string;
                sourceFile?: string;
            };

            if (!response.ok) {
                throw new Error(payload.error || "Failed to load project schedule");
            }

            setSchedule({
                columns: payload.columns ?? [],
                groups: payload.groups ?? [],
                importedAt: payload.importedAt ?? "",
                sourceFile: payload.sourceFile,
            });
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : "Failed to load project schedule");
            setSchedule(EMPTY_SCHEDULE);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSchedule();
    }, [loadSchedule]);

    useEffect(() => {
        const handleUpdated = () => {
            void loadSchedule();
        };

        window.addEventListener("project-schedule:updated", handleUpdated);
        return () => {
            window.removeEventListener("project-schedule:updated", handleUpdated);
        };
    }, [loadSchedule]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold">Project Schedule</h2>
                    <p className="text-sm text-muted-foreground">
                        Imported schedule rows grouped by project and filtered by available columns.
                    </p>
                </div>
                <Badge variant="outline">{roleLabel}</Badge>
            </div>

            {schedule.importedAt ? (
                <p className="text-xs text-muted-foreground">
                    Last import: {new Date(schedule.importedAt).toLocaleString()}
                    {schedule.sourceFile ? ` (${schedule.sourceFile})` : ""}
                </p>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {isLoading ? (
                <div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                    Loading project schedule...
                </div>
            ) : (
                <ProjectScheduleList groups={schedule.groups} columns={schedule.columns} />
            )}
        </div>
    );
}

export function ProjectScheduleImportStatusPanel() {
    return (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule Import</p>
            <ProjectScheduleImportStepper steps={IMPORT_STEPS} activeStepId="loaded" />
            <ProjectScheduleUpload />
        </div>
    );
}
