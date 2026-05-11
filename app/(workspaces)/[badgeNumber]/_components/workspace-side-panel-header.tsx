import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { D380Logo } from "@/components/projects/layout/logo";

import type { BaseStatefulProps } from "./workspace-view-mode";

type WorkspaceSidePanelHeaderProps = BaseStatefulProps & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  returnUrl?: string;
  returnLabel?: string;
};

export function WorkspaceSidePanelHeader({
  mode = "default",
  title,
  eyebrow,

  actions,
  returnUrl,
  returnLabel = "Back",
  className,
}: WorkspaceSidePanelHeaderProps) {


  if (mode === "skeleton") {
    return (
      <div
        className={cn(
          "border-b border-border px-2.5 py-2.5 flex flex-col sm:px-4 sm:py-3",
          className,
        )}
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-md sm:h-8 sm:w-8 sm:rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                <Skeleton className="h-2.5 w-16 sm:h-3 sm:w-20" />
                <Skeleton className="h-4 w-28 max-w-[90%] sm:h-5 sm:w-36" />
                <Skeleton className="h-2.5 w-40 max-w-[95%] sm:h-3 sm:w-48" />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-5 w-12 rounded-full sm:h-6 sm:w-16" />
                <Skeleton className="h-7 w-7 rounded-md sm:h-8 sm:w-8 sm:rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b border-border px-2.5 py-2.5 flex flex-col sm:px-4 sm:py-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          {returnUrl ? (
            <Link
              href={returnUrl}
              aria-label={returnLabel}
              className="group relative inline-flex h-7 w-8 gap-2 text-sm shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground transition-all duration-80 border hover:bg-muted hover:text-foreground active:bg-muted/60 focus-visible:ring-1 focus-visible:ring-[#6B97FF] sm:h-8 sm:w-10 sm:rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1 flex-col items-start gap-0.5 sm:gap-1">
            {eyebrow ? (
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <D380Logo size="sm" />
              {title ? (
                <div className="truncate text-sm font-semibold text-foreground sm:text-base">
                  {title}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
