"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BookOpen,
  FileText,
  FileUp,
  Layers3,
  LogIn,
  Activity,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import type { ActivityEntry } from "@/types/activity";
import type { MultiSheetImportSession } from "@/lib/wire-brand-list/multi-sheet-review";
import type { MultiSheetStatusSummary } from "@/components/wire-list/multi-sheet-review-types";

// ─── Constants ───────────────────────────────────────────────────────────────

/** How often (ms) to silently re-fetch activity in the background */
const ACTIVITY_POLL_MS = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchProjectActivities(url: string): Promise<ActivityEntry[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch activities (${res.status})`);
  const data: unknown = await res.json();
  // Support both array and envelope shapes: { activities: [...] } | { items: [...] } | [...]
  if (Array.isArray(data)) return data as ActivityEntry[];
  if (data && typeof data === "object") {
    const env = data as Record<string, unknown>;
    const list = env["activities"] ?? env["items"] ?? env["data"];
    if (Array.isArray(list)) return list as ActivityEntry[];
  }
  return [];
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface MultiSheetReviewCoverShellProps {
  canViewCompletedReview: boolean;
  coverActionLabel: string;
  importSession: MultiSheetImportSession | null;
  pendingImportCount: number;
  reviewState: MultiSheetStatusSummary;
  latestReviewLabel: string | null;
  latestReviewDescription: string;
  isAuthenticated: boolean;
  userLabel: string | null;
  /**
   * Badge / user-ID of the currently signed-in user.
   * Passed through to ActivityTimeline for comment ownership checks.
   */
  currentBadge?: string;
  /**
   * Project identifier used to build the default activity endpoint.
   */
  projectId?: string;
  /**
   * Current shift used by the default activity endpoint.
   * Falls back to `1st` when omitted.
   */
  currentShift?: string;
  /**
   * Fully override the activity API URL.
   * When omitted, falls back to `/api/activity/{currentBadge}?shift={currentShift}&projectIds={projectId}`.
   * Pass `null` explicitly to disable the timeline panel.
   */
  activitiesApiUrl?: string | null;
  /**
   * ISO timestamp when the project was created.
   * Used to synthesize a "Project created" seed entry when no activity exists.
   */
  projectCreatedAt?: string;
  brandingWorkbookHref?: string | null;
  wireListSchemaHref?: string | null;
  onDownloadAllWireLists?: () => void;
  onContinue: () => Promise<void> | void;
  onImport: () => void;
  onOpenTutorial: () => void;
  onOpenLogin: () => void;
  onCommentAdd?: (activityId: string, comment: string) => Promise<void>;
  onCommentDelete?: (activityId: string, commentId: string) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MultiSheetReviewCoverShell({
  canViewCompletedReview,
  coverActionLabel,
  importSession,
  pendingImportCount,
  reviewState,
  latestReviewLabel,
  latestReviewDescription,
  isAuthenticated,
  userLabel,
  currentBadge,
  projectId,
  currentShift,
  activitiesApiUrl,
  projectCreatedAt,
  brandingWorkbookHref,
  wireListSchemaHref,
  onDownloadAllWireLists,
  onContinue,
  onImport,
  onOpenTutorial,
  onOpenLogin,
  onCommentAdd,
  onCommentDelete,
}: MultiSheetReviewCoverShellProps) {
  // ── Activity state ──────────────────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve the API URL: project-wide endpoint (all badges) > explicit override > null (no panel)
  const resolvedApiUrl: string | null =
    activitiesApiUrl !== undefined
      ? activitiesApiUrl
      : projectId
        ? `/api/projects/${encodeURIComponent(projectId)}/activity?limit=200`
        : null;

  const loadActivities = useCallback(
    async (showLoader = false) => {
      if (!resolvedApiUrl) return;
      const startedAt = Date.now();
      if (showLoader) setActivitiesLoading(true);
      setActivitiesError(null);
      try {
        const bustUrl = `${resolvedApiUrl}${resolvedApiUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`;
        const data = await fetchProjectActivities(bustUrl);
        setActivities(data);
      } catch (err) {
        setActivitiesError(
          err instanceof Error ? err.message : "Failed to load activity",
        );
      } finally {
        if (showLoader) {
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, 2000 - elapsed);
          if (remaining > 0) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, remaining);
            });
          }
          setActivitiesLoading(false);
        }
      }
    },
    [resolvedApiUrl],
  );

  // Initial load + background polling
  useEffect(() => {
    void loadActivities(true);

    const delayedRefreshFast = window.setTimeout(() => {
      void loadActivities(false);
    }, 1200);
    const delayedRefreshSlow = window.setTimeout(() => {
      void loadActivities(false);
    }, 4000);

    if (resolvedApiUrl) {
      pollRef.current = setInterval(() => {
        void loadActivities(false);
      }, ACTIVITY_POLL_MS);
    }

    return () => {
      window.clearTimeout(delayedRefreshFast);
      window.clearTimeout(delayedRefreshSlow);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loadActivities, resolvedApiUrl]);

  // Re-sync when tab becomes active again.
  useEffect(() => {
    if (!resolvedApiUrl) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadActivities(false);
      }
    };

    const handleFocus = () => {
      void loadActivities(false);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadActivities, resolvedApiUrl]);

  const handleRefresh = useCallback(async () => {
    await loadActivities(true);
  }, [loadActivities]);

  // ── Synthesize a "Project created" seed when no real activity exists ──────
  const displayActivities = useMemo<ActivityEntry[]>(() => {
    if (activities.length > 0 || !projectCreatedAt) return activities;
    return [
      {
        id: `synthetic-created-${projectId ?? "unknown"}`,
        timestamp: projectCreatedAt,
        action: "PROJECT_CREATED" as const,
        performedBy: "",
        projectId: projectId ?? "",
        result: "success" as const,
        metadata: { projectId: projectId ?? "", projectName: "" },
      },
    ];
  }, [activities, projectCreatedAt, projectId]);

  // ── Start / Continue handler ─────────────────────────────────────────────
  const handleContinueClick = useCallback(async () => {
    setIsContinuing(true);
    // Refresh activity so any pre-navigate entries are visible
    await loadActivities(false);
    try {
      await onContinue();
    } finally {
      setIsContinuing(false);
    }
  }, [loadActivities, onContinue]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden backdrop-blur-3xl"
    >
      {/* Ambient background gradient */}
      <div className="pointer-events-none absolute inset-0 "
          style={{
            background:
              "radial-gradient(oklch(from var(--primary) calc(l * 0.8) calc(c * 1.5) h / 1) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
            maskImage:
              "radial-gradient(ellipse 95% 54% at 50% 100%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.4) 34%, transparent 74%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 95% 54% at 50% 100%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.4) 34%, transparent 74%)",
          }} />

      {/*
        Two-panel layout
        • Mobile  : single column, card → timeline stacked
        • lg+     : side-by-side, card fixed width | timeline flex-1
      */}
      <div className="relative flex h-full min-h-0 w-full flex-col items-stretch gap-0 overflow-y-auto p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-center lg:gap-6 lg:p-8 xl:p-10 2xl:p-12">

        {/* ── LEFT: Cover card ─────────────────────────────────────────── */}
        <div className="w-full shrink-0 sm:max-w-lg sm:self-center lg:max-w-none lg:self-auto lg:w-[420px] xl:w-[460px] max-h-[80vh]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-1  items-end justify-between">
            {/* Header pill */}
            <div className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/65">
              Brand List Review
            </div>
            {/* Status badge */}
            <div className="mt-6">
              {reviewState.brandingWorkbookReady ? (
                <Badge className="bg-emerald-500/20 text-emerald-200">
                  Export Ready
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-blue-500/20 text-blue-200"
                >
                  Review Open
                </Badge>
              )}
            </div>
        </div>

            {/* Title */}
            <h1 className="mt-6 text-3xl font-bold text-white">
              {canViewCompletedReview
                ? "Ready to View"
                : coverActionLabel === "Continue"
                  ? "In Progress"
                  : "Get Started"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/70">
              Keep the workflow simple: import when you have an external
              workbook, continue when work is in progress, and switch to
              view-only once the export is complete.
            </p>

          
            {/* Metrics grid */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <MetricCard label="Sheets" value={`${reviewState.totalSheets}`} />
              <MetricCard
                label="Approved"
                value={`${reviewState.approvedSheets}/${reviewState.totalSheets}`}
              />
              <MetricCard
                label="Schemas"
                value={`${reviewState.savedSchemas}/${reviewState.totalSheets}`}
              />
              <MetricCard label="Pending" value={`${pendingImportCount}`} />
            </div>

            {/* Primary actions */}
            <div className="mt-8 flex flex-col gap-3">
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-2xl bg-white text-slate-950 shadow-sm hover:bg-white/92"
                onClick={() => void handleContinueClick()}
                disabled={isContinuing}
              >
                {isContinuing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Layers3 className="mr-2 h-4 w-4" />
                    {coverActionLabel}
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-12 rounded-2xl border-white/20 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                onClick={onImport}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Import Brand List
              </Button>

              {(brandingWorkbookHref || wireListSchemaHref || onDownloadAllWireLists) ? (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-2.5">
                  <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.14em] text-white/55">
                    Exports
                  </div>
                  <div className="flex flex-col gap-2">
                    {brandingWorkbookHref ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start border-white/20 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                        onClick={() => {
                          window.open(brandingWorkbookHref, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Brand List Workbook
                      </Button>
                    ) : null}

                    {wireListSchemaHref ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start border-white/20 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                        onClick={() => {
                          window.open(wireListSchemaHref, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Layers3 className="mr-2 h-4 w-4" />
                        Download Wire List Schema
                      </Button>
                    ) : null}

                    {onDownloadAllWireLists ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start border-white/20 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                        onClick={onDownloadAllWireLists}
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Download Exported PDFs
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Auth row */}
            {!isAuthenticated ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full gap-2 rounded-2xl border-white/20 bg-white/6 hover:bg-white/12"
                onClick={onOpenLogin}
              >
                <LogIn className="h-4 w-4" />
                Sign in with Badge
              </Button>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                ✓ Tracking as{" "}
                <span className="font-semibold">{userLabel}</span>
              </div>
            )}

            {/* Import session resume */}
            {importSession ? (
              <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                <div className="font-semibold">Resume import</div>
                <div className="mt-1 text-xs text-sky-200/80">
                  {importSession.workbookFileName}
                </div>
              </div>
            ) : null}

            {/*
              Latest-activity summary card — only shown on mobile where the
              full timeline panel collapses below the fold.
            */}
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 lg:hidden">
              <div className="text-xs uppercase tracking-[0.14em] text-white/50">
                Latest Activity
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {latestReviewLabel ?? "No approvals yet"}
              </div>
              <p className="mt-1 text-xs text-white/60">
                {latestReviewDescription}
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Activity timeline panel ───────────────────────────── */}
        <div
          className={cn(
            "flex w-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border/70",
            "bg-card/95 text-card-foreground",
            "shadow-2xl backdrop-blur-xl",
            // On mobile allow it to grow naturally; on lg+ fill remaining width
            "min-h-[480px] lg:flex-1 lg:max-h-[80vh] lg:max-w-[620px]",
          )}
        >
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Activity
              </span>
              {displayActivities.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {displayActivities.length}
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={handleRefresh}
              disabled={activitiesLoading}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  activitiesLoading && "animate-spin",
                )}
              />
              {activitiesLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {/* Scrollable timeline body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {resolvedApiUrl ? (
              <ActivityTimeline
                activities={displayActivities}
                loading={activitiesLoading}
                error={activitiesError}
                compact={false}
                showStats
                allowFiltering
                allowSearch
                showComments={Boolean(onCommentAdd)}
                showNestedActivities
                initialFilterMode="brand_list"
                currentBadge={currentBadge}
                onRefresh={handleRefresh}
                onCommentAdd={onCommentAdd}
                onCommentDelete={onCommentDelete}
                containerClassName="px-1"
                projectId={projectId}
              />
            ) : (
              /* Shown when no projectId / activitiesApiUrl is provided */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 rounded-full border border-border bg-muted p-4">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No project linked
                </p>
                <p className="mt-1 max-w-[22ch] text-xs text-muted-foreground">
                  Pass a <code className="font-mono">projectId</code> prop to
                  display live activity here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.12em] text-white/50">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
