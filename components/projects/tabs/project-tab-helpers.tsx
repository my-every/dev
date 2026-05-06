"use client";

import type { ReactNode, ElementType } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Layers,
  Lock,
  Tag,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EmptyTabState({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="rounded-full bg-muted/60 p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="max-w-52 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function StatItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 p-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" style={color ? { color } : undefined} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground bg-muted/20">{label}</span>
      {children}
    </div>
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatMinutesToDays(minutes: number): string {
  if (minutes === 0) return "—";
  const totalHours = minutes / 60;
  const days = Math.floor(totalHours / 8);
  const remainHours = Math.round(totalHours - days * 8);
  if (days === 0) return `${remainHours}h`;
  if (remainHours === 0) return `${days}d`;
  return `${days}d ${remainHours}h`;
}

const PROJECT_STATUS_DISPLAY: Record<
  string,
  {
    label: string;
    description: string;
    icon: ElementType;
    className: string;
    bgClassName: string;
  }
> = {
  legals_pending: {
    label: "Legals Pending",
    description: "Awaiting UCP wire list and layout PDF upload",
    icon: Upload,
    className: "text-amber-600 dark:text-amber-400",
    bgClassName: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50",
  },
  brandlist: {
    label: "BrandList",
    description: "Working on BrandList generation from wire list",
    icon: ClipboardList,
    className: "text-orange-600 dark:text-orange-400",
    bgClassName: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/50",
  },
  branding: {
    label: "Branding",
    description: "Physical labels being printed and prepared",
    icon: Tag,
    className: "text-purple-600 dark:text-purple-400",
    bgClassName: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800/50",
  },
  kitting: {
    label: "Kitting",
    description: "Devices being kitted for installation",
    icon: Layers,
    className: "text-blue-600 dark:text-blue-400",
    bgClassName: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50",
  },
  active: {
    label: "Active",
    description: "Assignments in progress across production stages",
    icon: Activity,
    className: "text-emerald-600 dark:text-emerald-400",
    bgClassName: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50",
  },
  blocked: {
    label: "Blocked",
    description: "One or more assignments are blocked",
    icon: Lock,
    className: "text-red-600 dark:text-red-400",
    bgClassName: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50",
  },
  completed: {
    label: "Completed",
    description: "All assignments finished BIQ",
    icon: CheckCircle2,
    className: "text-emerald-700 dark:text-emerald-400",
    bgClassName: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800/50",
  },
  shipped: {
    label: "Shipped",
    description: "Post-production shipment complete",
    icon: ExternalLink,
    className: "text-slate-600 dark:text-slate-400",
    bgClassName: "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700/50",
  },
};

export function CurrentStatusCard({ status }: { status?: string }) {
  const cfg = PROJECT_STATUS_DISPLAY[status ?? "legals_pending"] ?? PROJECT_STATUS_DISPLAY.legals_pending;
  const Icon = cfg.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", cfg.bgClassName)}>
      <div className={cn("rounded-md bg-white/60 p-1.5 dark:bg-black/20", cfg.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", cfg.className)}>{cfg.label}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{cfg.description}</p>
      </div>
    </div>
  );
}

const STAGE_DOT_COLORS: Record<string, string> = {
  slate: "bg-slate-400",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  sky: "bg-sky-500",
  fuchsia: "bg-fuchsia-500",
  rose: "bg-rose-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
};

export function StageDot({ color }: { color: string }) {
  return <div className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_COLORS[color] ?? "bg-slate-400")} />;
}
