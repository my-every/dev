"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";

export interface GuidedStep {
    id: string;
    label: string;
    description?: string;
    icon?: React.ElementType;
}

interface GuidedStepperProps {
    steps: GuidedStep[];
    currentStepId: string;
    onStepClick?: (stepId: string) => void;
    orientation?: "horizontal" | "vertical";
    allowNavigation?: boolean;
    completedSteps?: string[];
    className?: string;
}

export function GuidedStepper({
    steps,
    currentStepId,
    onStepClick,
    orientation = "horizontal",
    allowNavigation = false,
    completedSteps = [],
    className,
}: GuidedStepperProps) {
    const currentIndex = steps.findIndex((s) => s.id === currentStepId);

    const getStepState = (stepId: string, index: number) => {
        if (completedSteps.includes(stepId)) return "complete";
        if (index < currentIndex) return "complete";
        if (stepId === currentStepId) return "active";
        return "pending";
    };

    const handleStepClick = (stepId: string, index: number) => {
        if (!allowNavigation || !onStepClick) return;
        // Can only navigate to completed steps or the next step
        if (index <= currentIndex || completedSteps.includes(stepId)) {
            onStepClick(stepId);
        }
    };

    if (orientation === "vertical") {
        return (
            <div className={cn("flex flex-col gap-0", className)}>
                {steps.map((step, index) => {
                    const state = getStepState(step.id, index);
                    const isLast = index === steps.length - 1;
                    const Icon = step.icon;
                    const canNavigate = allowNavigation && (index <= currentIndex || completedSteps.includes(step.id));

                    return (
                        <div key={step.id} className="flex gap-3">
                            {/* Step indicator column */}
                            <div className="flex flex-col items-center">
                                <button
                                    type="button"
                                    onClick={() => handleStepClick(step.id, index)}
                                    disabled={!canNavigate}
                                    className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                        state === "complete" && "border-emerald-500 bg-emerald-500 text-white",
                                        state === "active" && "border-primary bg-primary text-primary-foreground",
                                        state === "pending" && "border-muted-foreground/30 bg-background text-muted-foreground",
                                        canNavigate && "cursor-pointer hover:opacity-80",
                                        !canNavigate && "cursor-default"
                                    )}
                                >
                                    {state === "complete" ? (
                                        <Check className="h-4 w-4" />
                                    ) : Icon ? (
                                        <Icon className="h-4 w-4" />
                                    ) : (
                                        <span className="text-xs font-semibold">{index + 1}</span>
                                    )}
                                </button>
                                {!isLast && (
                                    <div
                                        className={cn(
                                            "w-0.5 flex-1 min-h-8",
                                            state === "complete" ? "bg-emerald-500" : "bg-border"
                                        )}
                                    />
                                )}
                            </div>

                            {/* Step content column */}
                            <div className={cn("pb-6", isLast && "pb-0")}>
                                <button
                                    type="button"
                                    onClick={() => handleStepClick(step.id, index)}
                                    disabled={!canNavigate}
                                    className={cn(
                                        "text-left",
                                        canNavigate && "cursor-pointer hover:opacity-80",
                                        !canNavigate && "cursor-default"
                                    )}
                                >
                                    <p
                                        className={cn(
                                            "text-sm font-medium",
                                            state === "active" && "text-foreground",
                                            state === "complete" && "text-foreground",
                                            state === "pending" && "text-muted-foreground"
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    {step.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {step.description}
                                        </p>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Horizontal orientation
    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-start justify-between">
                {steps.map((step, index) => {
                    const state = getStepState(step.id, index);
                    const isLast = index === steps.length - 1;
                    const Icon = step.icon;
                    const canNavigate = allowNavigation && (index <= currentIndex || completedSteps.includes(step.id));

                    return (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleStepClick(step.id, index)}
                                    disabled={!canNavigate}
                                    className={cn(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                        state === "complete" && "border-emerald-500 bg-emerald-500 text-white",
                                        state === "active" && "border-primary bg-primary text-primary-foreground",
                                        state === "pending" && "border-muted-foreground/30 bg-background text-muted-foreground",
                                        canNavigate && "cursor-pointer hover:opacity-80",
                                        !canNavigate && "cursor-default"
                                    )}
                                >
                                    {state === "complete" ? (
                                        <Check className="h-5 w-5" />
                                    ) : Icon ? (
                                        <Icon className="h-5 w-5" />
                                    ) : (
                                        <span className="text-sm font-semibold">{index + 1}</span>
                                    )}
                                </button>
                                <div className="text-center max-w-[100px]">
                                    <p
                                        className={cn(
                                            "text-xs font-medium",
                                            state === "active" && "text-foreground",
                                            state === "complete" && "text-foreground",
                                            state === "pending" && "text-muted-foreground"
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                </div>
                            </div>

                            {!isLast && (
                                <div className="flex-1 flex items-center pt-5 px-2">
                                    <div
                                        className={cn(
                                            "h-0.5 w-full rounded-full",
                                            state === "complete" ? "bg-emerald-500" : "bg-border"
                                        )}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

/** Compact inline stepper for asides and dialogs */
export function CompactStepper({
    steps,
    currentStepId,
    className,
}: {
    steps: GuidedStep[];
    currentStepId: string;
    className?: string;
}) {
    const currentIndex = steps.findIndex((s) => s.id === currentStepId);

    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            {steps.map((step, index) => {
                const isComplete = index < currentIndex;
                const isActive = step.id === currentStepId;

                return (
                    <React.Fragment key={step.id}>
                        <div
                            className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                                isComplete && "bg-emerald-500 text-white",
                                isActive && "bg-primary text-primary-foreground",
                                !isComplete && !isActive && "bg-muted text-muted-foreground"
                            )}
                        >
                            {isComplete ? <Check className="h-3 w-3" /> : index + 1}
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "h-0.5 w-4 rounded-full",
                                    isComplete ? "bg-emerald-500" : "bg-border"
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
