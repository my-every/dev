"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages";

export function StageSelectorCell({
  currentStage,
  onSave,
}: {
  currentStage: string;
  onSave: (newStage: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState(currentStage);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Keep selectedStage in sync when the prop updates (e.g., after API save)
  useEffect(() => {
    setSelectedStage(currentStage);
  }, [currentStage]);

  const isPending = !currentStage || currentStage === "STAGE_PENDING";
  const displayStage = isPending ? "Pending" : currentStage.replace(/[_-]+/g, " ");
  const stageOptions = ASSIGNMENT_STAGES.map((s) => s.id);
  const hasChanged = selectedStage !== currentStage;

  const handleSave = useCallback(async () => {
    if (!hasChanged) { setIsOpen(false); return; }
    if (!isPending && !showConfirmation) { setShowConfirmation(true); return; }
    setIsSaving(true);
    try {
      await onSave(selectedStage);
      setIsOpen(false);
      setShowConfirmation(false);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanged, isPending, onSave, selectedStage, showConfirmation]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) { setSelectedStage(currentStage); setShowConfirmation(false); }
    },
    [currentStage],
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:ring-2 hover:ring-primary/20",
            isPending
              ? "bg-muted/60 text-muted-foreground"
              : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
          )}
        >
          {displayStage}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[300] w-72 p-0" align="start" sideOffset={4}>
        <div className="border-b border-border px-3 py-2">
          <h4 className="text-sm font-semibold text-foreground">Change Stage</h4>
          <p className="text-xs text-muted-foreground">Select the current production stage</p>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2">
          {showConfirmation ? (
            <div className="space-y-3 p-2">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Confirm Stage Change
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This will overwrite from{" "}
                    <span className="font-semibold">{displayStage}</span> to{" "}
                    <span className="font-semibold">
                      {selectedStage.replace(/[_-]+/g, " ")}
                    </span>
                    .
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSaving}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  Confirm Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {stageOptions.map((stage) => {
                const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === stage);
                const isSelected = selectedStage === stage;
                const isCurrent = currentStage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setSelectedStage(stage)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">
                          {stageDef?.shortLabel ?? stage}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {stageDef?.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!showConfirmation && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!hasChanged || isSaving}
            >
              {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
              Save Stage
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
