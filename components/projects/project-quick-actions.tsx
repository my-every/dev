"use client";

import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProjectQuickActionItem<ActionId extends string = string> {
  id: ActionId;
  label: string;
  icon: LucideIcon;
}

interface ProjectQuickActionsProps<ActionId extends string = string> {
  actions: Array<ProjectQuickActionItem<ActionId>>;
  onAction: (actionId: ActionId) => void;
  eventCount?: number;
  title?: string;
  description?: string;
  className?: string;
}

export function ProjectQuickActions<ActionId extends string = string>({
  actions,
  onAction,
  eventCount,
  title = "Quick Actions",
  description = "Jump directly into the next project tab instead of hunting through the aside.",
  className,
}: ProjectQuickActionsProps<ActionId>) {
  return (
    <div className={cn("rounded-lg gap-3 border border-border/50 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-[12px]  uppercase tracking-wider text-foreground">{title}</h4>
           
        </div>
 
      </div>

      <div className="flex flex-wrap gap-2.5 items-center bg-accent/20  border-dashed border-border/50 justify-around rounded-2xl p-2.5">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              className="h-24 w-22  flex flex-col justify-center gap-2 bg-background rounded-xl border-0 p-2 text-center hover:bg-background/90s"
              onClick={() => onAction(action.id)}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
