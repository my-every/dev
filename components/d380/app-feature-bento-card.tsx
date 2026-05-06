"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Boxes, CalendarDays, FolderKanban, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceSlug = "projects" | "schedule" | "parts";

export interface AppFeatureBentoConfig {
  workspace: WorkspaceSlug;
  title: string;
  description: string;
  icon: LucideIcon;
  previewRows: string[];
}

export const APP_FEATURE_BENTO_CONFIGS: AppFeatureBentoConfig[] = [
  {
    workspace: "projects",
    title: "Projects",
    description: "Track active builds, revisions, and execution readiness.",
    icon: FolderKanban,
    previewRows: ["ANG01 / Build-up ready", "4M511 / Awaiting revision", "J0080 / QA hold"],
  },
  {
    workspace: "schedule",
    title: "Schedule",
    description: "Review timelines, slot planning, and team assignment flow.",
    icon: CalendarDays,
    previewRows: ["Today / 1st Shift", "Tomorrow / Parts staging", "Friday / Priority list sync"],
  },
  {
    workspace: "parts",
    title: "Parts",
    description: "Search part details, stock status, and terminal mapping.",
    icon: Boxes,
    previewRows: ["952575C1 / In stock", "4L361 relay / Low", "Terminals / Resync needed"],
  },
];

interface AppFeatureBentoCardProps {
  config: AppFeatureBentoConfig;
  badgeNumber: string | null;
}

export function AppFeatureBentoCard({ config, badgeNumber }: AppFeatureBentoCardProps) {
  const href = badgeNumber ? `/${badgeNumber}/${config.workspace}` : null;
  const Icon = config.icon;

  const content = (
    <motion.div
      whileHover={href ? { y: -2 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/8 bg-card p-4 text-left transition-all duration-200",
        href
          ? "cursor-pointer hover:border-border/[0.13] hover:bg-muted/90 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          : "opacity-50",
      )}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]",
            href ? "bg-accent/10 text-accent" : "bg-background/[0.04] text-foreground/25",
          )}
        >
          <Icon className="size-3 shrink-0" />
          {config.workspace}
        </div>
        {href ? (
          <ArrowRight className="size-3.5 text-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/50" />
        ) : (
          <Lock className="size-3.5 text-foreground/20" />
        )}
      </div>

      <h3 className="text-sm font-semibold text-foreground">{config.title}</h3>
      <p className="mt-0.5 text-xs leading-5 text-foreground/40">{config.description}</p>

      <WorkspaceIllustration workspace={config.workspace} previewRows={config.previewRows} />

      {!href && (
        <p className="mt-3 text-[11px] text-foreground/25">Enter badge and PIN to unlock navigation.</p>
      )}
    </motion.div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}

// ── Preview illustrations ─────────────────────────────────────────────────────
// All use the same hardcoded dark palette as the startup AppWindowFrame so they
// look consistent regardless of the active CSS theme.

function PreviewChrome({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border/[0.06] bg-card px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-1.5 w-1.5 rounded-full bg-background/[0.08]" />
      ))}
      <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.15em] text-foreground/25">{label}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function WorkspaceIllustration({ workspace, previewRows }: { workspace: WorkspaceSlug; previewRows: string[] }) {
  // ── Projects ───────────────────────────────────────────────────────────────
  if (workspace === "projects") {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
        <PreviewChrome label="Workbook" />
        <div className="space-y-1.5 p-2.5">
          {previewRows.map((row, i) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-lg border border-border/[0.05] bg-background/[0.025] px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-foreground/70">{row.split("/")[0]?.trim()}</p>
                <p className="truncate text-[9px] text-foreground/30">{row.split("/").slice(1).join("/").trim()}</p>
              </div>
              <span
                className={cn(
                  "ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                  i === 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : i === 1
                      ? "bg-amber-500/10 text-amber-400/80"
                      : "bg-red-500/10 text-red-400/70",
                )}
              >
                {i === 0 ? "Ready" : i === 1 ? "Open" : "Hold"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Schedule ───────────────────────────────────────────────────────────────
  if (workspace === "schedule") {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
        <PreviewChrome
          label="Timeline"
          right={
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent/60">
              This Week
            </span>
          }
        />
        <div className="space-y-2.5 p-2.5">
          {previewRows.map((row, i) => (
            <div key={row}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] text-foreground/45">{row.split("/")[0]?.trim()}</span>
                <span className="text-[9px] text-foreground/25">
                  {i === 0 ? "08:00" : i === 1 ? "13:00" : "16:30"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    i === 0
                      ? "w-[86%] bg-emerald-400/35"
                      : i === 1
                        ? "w-[62%] bg-sky-400/30"
                        : "w-[40%] bg-amber-400/30",
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Parts ──────────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
      <div className="border-b border-border/[0.06] bg-card px-2.5 py-2">
        <div className="flex h-6 items-center gap-1.5 rounded-lg border border-border/[0.06] bg-background/[0.03] px-2.5">
          <span className="h-2 w-2 rounded-full bg-background/[0.12]" />
          <span className="text-[9px] text-foreground/20">Search part number...</span>
        </div>
      </div>
      <div className="space-y-1.5 p-2.5">
        {previewRows.map((row, i) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-lg border border-border/[0.05] bg-background/[0.025] px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-medium text-foreground/60">{row.split("/")[0]?.trim()}</p>
              <p className="truncate text-[9px] text-foreground/25">{row.split("/").slice(1).join("/").trim()}</p>
            </div>
            <span
              className={cn(
                "ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                i === 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : i === 1
                    ? "bg-amber-500/10 text-amber-400/80"
                    : "bg-sky-500/10 text-sky-400/70",
              )}
            >
              {i === 0 ? "Stock" : i === 1 ? "Check" : "Sync"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
