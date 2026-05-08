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
          "border-b border-border px-3 py-3 flex flex-col sm:px-4",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-36 max-w-[90%]" />
                <Skeleton className="h-3 w-48 max-w-[95%]" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-lg" />
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
        "border-b border-border px-3 py-3 flex  flex-col sm:px-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          {returnUrl ? (
            <Link
              href={returnUrl}
              aria-label={returnLabel}
              className="group relative inline-flex h-8 w-10 gap-2 text-sm shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground transition-all duration-80 border hover:bg-muted hover:text-foreground active:bg-muted/60 focus-visible:ring-1 focus-visible:ring-[#6B97FF]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}

          <div className="min-w-0 flex-1 flex-col items-start gap-1">
            {eyebrow ? (
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <D380Logo size="sm" />
              {title ? (
                <div className="truncate text-md font-semibold text-foreground sm:text-base">
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
