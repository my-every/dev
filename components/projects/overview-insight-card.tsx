"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OverviewInsightState = "loading" | "success" | "warning" | "idle";

export interface OverviewInsightCardProps {
  title: string;
  description?: string;
  statusLabel?: string;
  state?: OverviewInsightState;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

function StateBadge({ state }: { state: OverviewInsightState }) {
  if (state === "loading") {
    return (
   
      <Badge variant="dot" size="sm" className="h-5 gap-1 px-2 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading
      </Badge>
      
    );
  }

  if (state === "success") {
    return (
      <Badge variant="dot" color="emerald" size="sm" className="h-5 gap-1 px-2 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (state === "warning") {
    return (
      <Badge variant="dot" color="amber" size="sm" className="h-5 gap-1 px-2 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        Warning
      </Badge>
    );
  }

  return null;
}

export function OverviewInsightCard({
  title,
  description,
  statusLabel,
  state = "idle",
  actionLabel,
  onAction,
  className,
  children,
  footer,
}: OverviewInsightCardProps) {
  return (
    <section className={cn("flex  max-w-lg flex-col rounded-2xl border border-border/60 bg-card/50 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {statusLabel ? <Badge variant="solid" size="sm" className="h-5 px-2 text-[10px]">{statusLabel}</Badge> : null}
          <StateBadge state={state} />
          {actionLabel && onAction ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 min-h-0">{children}</div>
      {footer ? <div className="mt-3 flex items-center justify-start border-t border-border/50 pt-3">{footer}</div> : null}
    </section>
  );
}
