"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface WorkflowTimelineStep {
  number: string;
  tag: string;
  heading: string;
  description: string;
  progress?: number;
  progressLabel?: string;
}

interface WorkflowTimelineProps {
  steps: WorkflowTimelineStep[];
  className?: string;
}

const SM_GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

export function WorkflowTimeline({ steps, className }: WorkflowTimelineProps) {
  const cols = SM_GRID_COLS[steps.length] ?? "sm:grid-cols-3";

  return (
    <div className={cn("flex gap-4 sm:flex-col", className)}>
      {/* Dots + connecting line */}
      <div className="relative">
        {/* Background track */}
        <div className={cn("grid h-full w-4 justify-center gap-10 sm:h-4 sm:w-auto sm:items-center", cols)}>
          <div className="absolute inset-0 left-1/2 w-px -translate-x-1/2 bg-border sm:inset-auto sm:left-auto sm:h-px sm:w-full sm:translate-x-0" />
          {steps.map((step) => (
            <span key={step.number} className="relative top-3 size-2 shrink-0 rounded-full bg-border sm:top-0 sm:justify-self-center" />
          ))}
        </div>
        {/* Animated primary overlay */}
        <div className={cn("animate-workflow-reveal absolute inset-0 grid h-full w-4 justify-center gap-10 sm:h-4 sm:w-auto sm:items-center", cols)}>
          <div className="absolute inset-0 left-1/2 w-px -translate-x-1/2 bg-primary sm:inset-auto sm:left-auto sm:h-px sm:w-full sm:translate-x-0" />
          {steps.map((step) => (
            <span key={step.number} className="relative top-3 size-2 shrink-0 rounded-full bg-primary sm:top-0 sm:justify-self-center" />
          ))}
        </div>
      </div>

      {/* Step cards */}
      <div className={cn("grid gap-10", cols)}>
        {steps.map((step) => (
          <div key={step.number} className="flex h-full flex-col justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex h-8 w-fit items-center gap-px overflow-hidden rounded-md border border-border bg-border text-sm font-medium">
                <span className="grid h-full place-items-center bg-background px-2">{step.number}</span>
                <span className="grid h-full place-items-center bg-background px-2">{step.tag}</span>
              </div>
              <h3 className="mt-5 font-medium">{step.heading}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </div>
            {step.progress !== undefined && (
              <div>
                <div className="flex items-center gap-2">
                  <Progress value={step.progress} className="h-1 flex-1" />
                  <span className="w-8 text-right text-xs text-muted-foreground">{step.progress}%</span>
                </div>
                {step.progressLabel && (
                  <p className="mt-1 text-xs text-muted-foreground">{step.progressLabel}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes workflow-reveal-mobile {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0% 0 0 0); }
        }
        @keyframes workflow-reveal-desktop {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0% 0 0); }
        }
        .animate-workflow-reveal {
          animation: workflow-reveal-mobile 5s linear;
        }
        @media (min-width: 640px) {
          .animate-workflow-reveal {
            animation: workflow-reveal-desktop 5s linear;
          }
        }
      `}</style>
    </div>
  );
}
