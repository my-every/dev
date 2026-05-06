"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getWireImagePath } from "@/lib/wire-images";

interface WireImageHoverCellProps {
  wireId?: string | null;
  gaugeSize?: string | null;
  className?: string;
}

export function WireImageHoverCell({
  wireId,
  gaugeSize,
  className = "",
}: WireImageHoverCellProps) {
  const displayWireId = (wireId || "").trim();
  const displayGaugeSize = (gaugeSize || "").trim();
  const imagePath = getWireImagePath(displayWireId, displayGaugeSize);

  if (!displayWireId) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (!imagePath) {
    return <span className={className}>{displayWireId}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={[
            "cursor-help border-b-2 border-dashed border-muted-foreground/80 hover:border-primary",
            className,
          ].join(" ")}
        >
          {displayWireId}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="border border-foreground/10 bg-background p-2 shadow-lg">
        <div className="flex flex-col items-center gap-1.5">
          <img src={imagePath} alt={`Wire: ${displayWireId}`} className="max-h-37.5 max-w-55 rounded object-contain" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-medium text-foreground">{displayWireId}</span>
            {displayGaugeSize && <span className="text-[10px] text-muted-foreground">{displayGaugeSize}</span>}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}