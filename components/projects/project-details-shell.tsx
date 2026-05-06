"use client";

import type { ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";
import type { ProjectTabId } from "@/components/projects/tabs/project-tab-types";

interface ProjectDetailsShellProps {
  project: ProjectManifest;
  projectColor: string;
  status?: string | null;
  activeTab: ProjectTabId;
  tabs: Array<{ id: ProjectTabId; label: string }>;
  onTabChange: (tabId: ProjectTabId) => void;
  children: ReactNode;
  headerSlot?: ReactNode;
  mode?: "aside" | "modal" | "page";
}

export function ProjectDetailsShell({
  project,
  projectColor,
  status,
  activeTab,
  tabs,
  onTabChange,
  children,
  headerSlot,
  mode = "aside",
}: ProjectDetailsShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn("shrink-0", mode === "aside" ? "px-4 pb-2 pt-4" : "px-5 pb-3 pt-5")}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex shrink-0 items-center justify-center rounded-md p-2 shadow-sm"
            style={{
              backgroundColor: `${projectColor}15`,
              border: `1px solid ${projectColor}30`,
            }}
          >
            <FileSpreadsheet className="h-5 w-5" style={{ color: projectColor }} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
          <p className="truncate text-md text-muted-foreground">
              {project.pdNumber ? <span className="font-mono">{project.pdNumber}</span> : null}
              {project.pdNumber && project.unitNumber ? " / " : null}
              {project.unitNumber ? <span>Unit {project.unitNumber}</span> : null}
              {!project.pdNumber && !project.unitNumber ? project.filename : null}
            </p>
            <h3 className="truncate text-lg font-semibold">{project.name}</h3>
      
          </div>
       
        </div>
        {headerSlot ? <div className="mt-3">{headerSlot}</div> : null}
      </div>

      <div className={cn("shrink-0", mode === "aside" ? "px-3 pt-1" : "px-4 pt-1")}>
        <AnimatedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tabId) => onTabChange(tabId as ProjectTabId)}
          variant="pill"
          layoutId={`project-details-shell-${mode}-tabs`}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className={cn(mode === "aside" ? "px-4 pb-4 pt-3" : "px-5 pb-5 pt-4")}>{children}</div>
      </ScrollArea>
    </div>
  );
}

export function ProjectDetailsStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
  > = {
    legals_pending: {
      label: "Legals Pending",
      variant: "outline",
      className: "border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-950/30",
    },
    brandlist: {
      label: "BrandList",
      variant: "outline",
      className: "border-orange-300 bg-orange-50 text-orange-600 dark:bg-orange-950/30",
    },
    branding: {
      label: "Branding",
      variant: "outline",
      className: "border-purple-300 bg-purple-50 text-purple-600 dark:bg-purple-950/30",
    },
    kitting: {
      label: "Kitting",
      variant: "outline",
      className: "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30",
    },
    active: {
      label: "Active",
      variant: "outline",
      className: "border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
    },
    blocked: { label: "Blocked", variant: "destructive" },
    completed: {
      label: "Completed",
      variant: "outline",
      className: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30",
    },
    shipped: { label: "Shipped", variant: "secondary" },
  };
  const c = config[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={c.variant} className={cn("h-5 shrink-0 px-1.5 text-[10px]", c.className)}>
      {c.label}
    </Badge>
  );
}
