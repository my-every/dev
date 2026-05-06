"use client";

import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProjectScheduleDetailsShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  metricBadges?: ReactNode;
  leftPane: ReactNode;
  rightPane: ReactNode;
  contentClassName?: string;
  frameClassName?: string;
  headerClassName?: string;
  leftPaneClassName?: string;
  rightPaneClassName?: string;
}

export function ProjectScheduleDetailsShell({
  open,
  onOpenChange,
  title,
  description,
  metricBadges,
  leftPane,
  rightPane,
  contentClassName,
  frameClassName,
  headerClassName,
  leftPaneClassName,
  rightPaneClassName,
}: ProjectScheduleDetailsShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("overflow-hidden p-0", contentClassName)}
        showCloseButton
      >
        <div className={cn("flex h-full min-h-0 flex-col", frameClassName)}>
          <DialogHeader className={cn("border-b px-6 py-4", headerClassName)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </div>
              {metricBadges ? (
                <div className="flex flex-wrap items-center gap-2">{metricBadges}</div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1.6fr_0.9fr]">
            <div className={cn("min-h-0 overflow-y-auto border-r px-5 py-4", leftPaneClassName)}>
              {leftPane}
            </div>
            <div className={cn("min-h-0 overflow-y-auto px-4 py-4", rightPaneClassName)}>
              {rightPane}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectScheduleDetailsShellMetric({
  children,
  variant = "dot",
  className,
}: {
  children: ReactNode;
  variant?: "solid" | "dot";
  className?: string;
}) {
  return (
    <Badge variant={variant} className={className}>
      {children}
    </Badge>
  );
}
