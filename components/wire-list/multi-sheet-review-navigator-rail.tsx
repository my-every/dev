"use client";

import { CheckCircle2, LogIn, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MultiSheetNavigationItem } from "@/components/wire-list/multi-sheet-review-types";

interface MultiSheetReviewNavigatorRailProps {
  items: MultiSheetNavigationItem[];
  isAuthenticated: boolean;
  userLabel?: string | null;
  exportReadyHref?: string | null;
  showDesktop: boolean;
  isCollapsed?: boolean;
  onSelect: (slug: string) => void;
  onOpenLogin: () => void;
  onToggleCollapse?: () => void;
}

export function MultiSheetReviewNavigatorRail({
  items,
  isAuthenticated,
  userLabel,
  exportReadyHref,
  showDesktop,
  isCollapsed = false,
  onSelect,
  onOpenLogin,
  onToggleCollapse,
}: MultiSheetReviewNavigatorRailProps) {
  if (!showDesktop) {
    return (
      <div className="border-b bg-background/95 px-3 py-2 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Review Navigator</div>
            <div className="truncate text-xs font-semibold">
              {items.filter((item) => item.isApproved).length}/{items.length} sheets reviewed
            </div>
          </div>
          {!isAuthenticated ? (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-2" onClick={onOpenLogin}>
              <LogIn className="h-3.5 w-3.5" />
              Badge
            </Button>
          ) : (
            <Badge variant="secondary" className="max-w-40 truncate">
              {userLabel}
            </Badge>
          )}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" data-tour="multi-sheet-navigator">
          {items.map((item, index) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => onSelect(item.slug)}
              className={cn(
                "flex min-w-42 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                item.isActive ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  item.isApproved ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background text-muted-foreground",
                )}
              >
                {item.isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.rowCount} rows</span>
                {item.wasEditedAfterApproval ? (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                    Edited after approval
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className={cn(
      "hidden min-h-0 shrink-0 border-r bg-muted/10 xl:flex transition-[width] duration-200",
      isCollapsed ? "w-20" : "w-80"
    )}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b bg-background/95 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Review Navigator</div>
              <div className={cn("mt-1 truncate text-sm font-semibold", isCollapsed && "hidden")}>
                {items.filter((item) => item.isApproved).length}/{items.length} sheets reviewed
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={items.length > 0 && items.every((item) => item.isApproved) ? "default" : "secondary"}
                className={cn(isCollapsed && "hidden")}
              >
                {items.length > 0 && items.every((item) => item.isApproved) ? "Ready" : "In Review"}
              </Badge>
              {onToggleCollapse ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={onToggleCollapse}
                  aria-label={isCollapsed ? "Expand review navigator" : "Collapse review navigator"}
                >
                  {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="border-b bg-amber-50 px-4 py-3 text-amber-950">
            {isCollapsed ? (
              <Button type="button" size="icon-sm" className="w-full" onClick={onOpenLogin}>
                <LogIn className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <div className="text-sm font-semibold">Sign in to track review activity</div>
                <p className="mt-1 text-xs text-amber-800">
                  Badge login lets approvals and exports be associated with the current user.
                </p>
                <Button type="button" size="sm" className="mt-3 w-full gap-2" onClick={onOpenLogin}>
                  <LogIn className="h-4 w-4" />
                  Sign in with Badge
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="border-b bg-emerald-50 px-4 py-3 text-emerald-950">
            {isCollapsed ? (
              <Badge variant="secondary" className="w-full justify-center truncate">
                {userLabel}
              </Badge>
            ) : (
              <>
                <div className="text-sm font-semibold">Tracking as {userLabel}</div>
                <p className="mt-1 text-xs text-emerald-800">
                  Sheet approvals and combined exports will be captured in this session.
                </p>
              </>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3" data-tour="multi-sheet-navigator">
          <div className="space-y-1">
            {items.map((item, index) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => onSelect(item.slug)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                  isCollapsed && "justify-center px-2",
                  item.isActive ? "border-primary/40 bg-primary/10" : "border-transparent bg-background/70 hover:border-border hover:bg-background",
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    item.isApproved ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {item.isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn("min-w-0 flex-1", isCollapsed && "hidden")}>
                  <span className="flex items-center gap-2">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                    {item.wasEditedAfterApproval ? (
                      <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                        Edited
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.rowCount} rows{item.pageTitle ? ` · ${item.pageTitle}` : ""}
                  </span>
                  {item.reviewLabel ? (
                    <span className="mt-1 block truncate text-[11px] text-emerald-700">{item.reviewLabel}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>

        {exportReadyHref ? (
          <div className="border-t bg-background/95 p-3">
            <a
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border bg-card px-3 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-muted/30",
                isCollapsed && "justify-center px-2"
              )}
              href={exportReadyHref}
              title={isCollapsed ? "Combined Export Ready" : undefined}
            >
              <span className={cn("truncate", isCollapsed && "hidden")}>Combined Export Ready</span>
              <Badge variant="secondary">XLSX</Badge>
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
