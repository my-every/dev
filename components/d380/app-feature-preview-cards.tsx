"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

// ── Shared preview chrome header ──────────────────────────────────────────────

function PreviewChrome({
  label,
  right,
}: {
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border/[0.06] bg-card px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-1.5 w-1.5 rounded-full bg-background/[0.08]" />
      ))}
      <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.15em] text-foreground/25">
        {label}
      </span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

// ── Card wrapper shared styles ────────────────────────────────────────────────

const cardClass =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/8 bg-card p-4 text-left transition-all duration-200 cursor-pointer hover:border-border/[0.13] hover:bg-muted/90 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]";

// ── Card 1: Analytics Overview ────────────────────────────────────────────────

export function AnalyticsPreviewCard() {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cardClass}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center rounded-lg bg-accent/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
          analytics
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">Performance Overview</h3>
      <p className="mt-0.5 text-xs leading-5 text-foreground/40">
        Daily summary of team performance and campaign metrics.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
        <PreviewChrome label="Dashboard" />
        <div className="flex flex-col gap-2 p-2.5">
          {/* Main metric tile */}
          <div className="overflow-hidden rounded-lg border border-border/[0.05] bg-background/[0.025] px-2.5 py-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-medium text-foreground/40">
                Team Performance
              </span>
            </div>
            <span className="text-lg font-medium tracking-tight text-foreground/80">
              94.2%
            </span>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background/[0.08]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "94.2%" }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full bg-emerald-400/50"
              />
            </div>
            <span className="mt-1 block text-[8px] text-foreground/25">
              Score for Search &amp; Delivery campaigns
            </span>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-border/[0.05] bg-background/[0.025] px-2.5 py-2">
              <span className="block text-[10px] font-medium text-foreground/70">
                1,070
              </span>
              <span className="text-[8px] font-medium uppercase text-foreground/25">
                Keywords
              </span>
            </div>
            <div className="rounded-lg border border-border/[0.05] bg-background/[0.025] px-2.5 py-2">
              <span className="block text-[10px] font-medium text-foreground/70">
                2.3M
              </span>
              <span className="text-[8px] font-medium uppercase text-foreground/25">
                Credits
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Card 2: Team Management ───────────────────────────────────────────────────

const TEAM_MEMBERS = [
  {
    name: "Anthony Dionne",
    role: "Pending admin approval",
    status: "Waitlist",
    dot: "bg-amber-400/70",
  },
  {
    name: "Nick Yahodin",
    role: "Dealership group admin",
    status: "Active",
    dot: "bg-emerald-400/70",
  },
  {
    name: "Mujeeb Aimaq",
    role: "Dealership group user",
    status: "Active",
    dot: "bg-emerald-400/70",
  },
];

export function TeamManagementPreviewCard() {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cardClass}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center rounded-lg bg-accent/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
          management
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">Team Management</h3>
      <p className="mt-0.5 text-xs leading-5 text-foreground/40">
        Manage roles, user permissions, and access control.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
        <PreviewChrome
          label="Active Users"
          right={
            <div className="flex items-center gap-1 rounded-md border border-border/[0.06] bg-background/[0.06] px-1.5 py-0.5">
              <span className="text-[8px] text-foreground/20">Search</span>
            </div>
          }
        />
        <div className="flex flex-col gap-0.5 p-1">
          {TEAM_MEMBERS.map((user, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-background/[0.04]"
            >
              {/* Avatar placeholder with status dot */}
              <div className="relative shrink-0">
                <div className="h-5 w-5 rounded-full border border-border/[0.08] bg-background/[0.08]" />
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-card",
                    user.dot,
                  )}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[10px] font-medium text-foreground/70">
                  {user.name}
                </span>
                <span className="truncate text-[8px] text-foreground/25">
                  {user.role}
                </span>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium",
                  user.status === "Active"
                    ? "bg-emerald-500/10 text-emerald-400/70"
                    : "bg-amber-500/10 text-amber-400/70",
                )}
              >
                {user.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Card 3: System Resources ──────────────────────────────────────────────────

const RESOURCE_FILES = [
  { file: "design_spec_v2.pdf", size: "2.4 MB", type: "PDF" },
  { file: "q4_performance.xls", size: "1.1 MB", type: "XLS" },
  { file: "branding_assets.zip", size: "48 MB", type: "ZIP" },
  { file: "system_logs.json", size: "4 KB", type: "JSON" },
];

export function ResourcesPreviewCard() {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cardClass}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center rounded-lg bg-accent/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">
          resources
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">System Assets</h3>
      <p className="mt-0.5 text-xs leading-5 text-foreground/40">
        Shared documentation, media logs, and archived files.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/[0.06] bg-accent">
        <PreviewChrome label="Archives & Logs" />
        <div className="flex flex-col gap-0.5 p-1">
          {RESOURCE_FILES.map((item, i) => (
            <div
              key={i}
              className="group/row flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-background/[0.04]"
            >
              {/* File type badge */}
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/[0.06] bg-background/[0.06]">
                <span className="text-[7px] font-semibold uppercase text-foreground/25">
                  {item.type.slice(0, 2)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[10px] font-medium text-foreground/70">
                  {item.file}
                </span>
                <span className="tabular-nums text-[8px] uppercase text-foreground/25">
                  {item.size} · {item.type}
                </span>
              </div>

              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/[0.06] opacity-0 transition-opacity group-hover/row:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
