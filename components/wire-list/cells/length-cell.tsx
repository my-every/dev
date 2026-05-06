"use client";

/**
 * Length Cell Component
 * 
 * Displays the estimated wire length for a row.
 * Shows the formatted length value with optional confidence indicator.
 */

import type { RowEstimatedLength, EstimateConfidence } from "@/lib/wire-length/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LengthCellProps {
  /** Estimated length data */
  estimatedLength?: RowEstimatedLength | null;
  /** Show confidence indicator */
  showConfidence?: boolean;
}

/**
 * Get confidence indicator styling.
 */
function getConfidenceStyles(confidence: EstimateConfidence): string {
  switch (confidence) {
    case "high":
      return "text-foreground";
    case "medium":
      return "text-foreground/80";
    case "low":
      return "text-muted-foreground italic";
  }
}

/**
 * Get confidence label for tooltip.
 */
function getConfidenceLabel(confidence: EstimateConfidence): string {
  switch (confidence) {
    case "high":
      return "High confidence estimate";
    case "medium":
      return "Medium confidence estimate";
    case "low":
      return "Low confidence estimate - verify";
  }
}

export function LengthCell({
  estimatedLength,
  showConfidence = false,
}: LengthCellProps) {
  // No estimate available
  if (!estimatedLength) {
    return (
      <span className="text-muted-foreground">
        —
      </span>
    );
  }

  const content = (
    <span className={cn(
      "font-mono text-sm tabular-nums",
      getConfidenceStyles(estimatedLength.confidence)
    )}>
      {estimatedLength.display}
    </span>
  );

  // Show tooltip with confidence info if enabled
  if (showConfidence) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                {getConfidenceLabel(estimatedLength.confidence)}
              </span>
              {estimatedLength.notes && estimatedLength.notes.length > 0 && (
                <span className="text-muted-foreground">
                  {estimatedLength.notes.join(", ")}
                </span>
              )}
              <span className="text-muted-foreground">
                Raw: {estimatedLength.rawInches.toFixed(2)}"
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/**
 * Format length for export (cut-list, etc.).
 */
export function formatLengthForExport(
  estimatedLength?: RowEstimatedLength | null
): string {
  if (!estimatedLength) {
    return "";
  }
  return estimatedLength.roundedInches.toString();
}
