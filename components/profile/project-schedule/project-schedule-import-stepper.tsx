"use client";

import { cn } from "@/lib/utils";

export interface ProjectScheduleImportStep {
    id: string;
    label: string;
}

interface ProjectScheduleImportStepperProps {
    steps: ProjectScheduleImportStep[];
    activeStepId?: string;
    className?: string;
}

export function ProjectScheduleImportStepper({
    steps,
    activeStepId,
    className,
}: ProjectScheduleImportStepperProps) {
    if (steps.length === 0) {
        return null;
    }

    const activeIndex = activeStepId
        ? Math.max(steps.findIndex((step) => step.id === activeStepId), 0)
        : steps.length - 1;

    return (
        <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {steps.map((step, index) => {
                    const isComplete = index < activeIndex;
                    const isActive = index === activeIndex;

                    return (
                        <div key={step.id} className="flex items-center gap-2">
                            <div className="flex flex-col items-center gap-1">
                                <div
                                    className={cn(
                                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                                        isComplete && "border-emerald-500 bg-emerald-500 text-white",
                                        isActive && "border-primary bg-primary text-primary-foreground",
                                        !isComplete && !isActive && "border-muted-foreground/40 text-muted-foreground",
                                    )}
                                >
                                    {index + 1}
                                </div>
                                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{step.label}</span>
                            </div>

                            {index < steps.length - 1 ? (
                                <span
                                    className={cn(
                                        "mt-[-14px] block h-[2px] w-6 rounded-full",
                                        index < activeIndex ? "bg-emerald-500" : "bg-border",
                                    )}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
