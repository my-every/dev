"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, RefreshCw, Timer } from "lucide-react";

import {
  OverviewInsightCard,
  type OverviewInsightState,
} from "@/components/projects/overview-insight-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardDataResponse, BoardMemberView } from "@/lib/board/types";

export type OverviewTimerStatus = "idle" | "badged-in" | "badged-out";

export interface OverviewTimerState {
  status: OverviewTimerStatus;
  startedAt?: string;
  assignmentId?: string;
}

interface ActiveProjectBadge {
  badge: string;
  name: string;
  assignmentCount: number;
}

interface OverviewTimerCardProps {
  projectId: string;
  defaultBadge?: string;
  onStatusChange?: () => void;
}

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return "00:00:00";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "00:00:00";
  const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function toInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "--";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function OverviewTimerCard({
  projectId,
  defaultBadge,
  onStatusChange,
}: OverviewTimerCardProps) {
  const [badge, setBadge] = useState(defaultBadge ?? "");
  const [pin, setPin] = useState("");
  const [state, setState] = useState<OverviewTimerState>({ status: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());
  const [member, setMember] = useState<BoardMemberView | null>(null);
  const [boardData, setBoardData] = useState<BoardDataResponse | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const refreshBoardState = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/board/data", { cache: "no-store" });
      const payload = response.ok
        ? ((await response.json()) as BoardDataResponse)
        : null;
      setBoardData(payload);
      return payload;
    } catch {
      setWarning("Unable to load board member status.");
      return null;
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void refreshBoardState().then((payload) => {
      if (cancelled || !payload || !badge) return;
      const activeMember =
        payload.members.find((item) => item.badge === badge) ?? null;
      setMember(activeMember);
      if (!activeMember) {
        setState({ status: "idle" });
        return;
      }

      const activeAssignment =
        activeMember.activeAssignments.find(
          (assignment) => assignment.projectId === projectId,
        ) ?? null;
      if (
        activeMember.availabilityStatus === "ON_ASSIGNMENT" &&
        activeAssignment
      ) {
        setState({
          status: "badged-in",
          startedAt:
            activeAssignment.actualStartTime ??
            activeMember.availabilityClockedInAt ??
            undefined,
          assignmentId: activeAssignment.assignmentId,
        });
        return;
      }

      if (activeMember.availabilityStatus === "OFF_SHIFT") {
        setState({ status: "badged-out" });
        return;
      }

      setState({ status: "idle" });
    });

    return () => {
      cancelled = true;
    };
  }, [badge, projectId]);



  const elapsed = useMemo(
    () => formatElapsed(state.startedAt),
    [state.startedAt, liveNow],
  );

  const activeProjectBadges = useMemo<ActiveProjectBadge[]>(() => {
    if (!boardData) return [];
    return boardData.members
      .filter(
        (item) =>
          item.availabilityStatus === "ON_ASSIGNMENT" &&
          item.activeAssignments.some(
            (assignment) => assignment.projectId === projectId,
          ),
      )
      .map((item) => ({
        badge: item.badge,
        name: item.preferredName || item.fullName || item.badge,
        assignmentCount: item.activeAssignments.filter(
          (assignment) => assignment.projectId === projectId,
        ).length,
      }));
  }, [boardData, projectId]);

  const totalElapsed = useMemo(() => {
    if (!boardData) return "00:00:00";
    const projectAssignments =
      boardData.projects
        .find((project) => project.id === projectId)
        ?.assignments.filter(
          (assignment) => assignment.workflowStatus === "in-progress",
        ) ?? [];
    const totalSeconds = projectAssignments.reduce((sum, assignment) => {
      if (!assignment.actualStartTime) return sum;
      const startedAt = new Date(assignment.actualStartTime).getTime();
      if (!Number.isFinite(startedAt)) return sum;
      return sum + Math.max(0, Math.floor((liveNow - startedAt) / 1000));
    }, 0);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [boardData, liveNow, projectId]);

  const assignmentCount = useMemo(() => {
    if (!boardData) return 0;
    return (
      boardData.projects
        .find((project) => project.id === projectId)
        ?.assignments.filter(
          (assignment) => assignment.workflowStatus === "in-progress",
        ).length ?? 0
    );
  }, [boardData, projectId]);

  const callBadgeAction = async (action: "badge_in" | "badge_out") => {
    setBusy(true);
    setWarning(null);
    setMessage(null);

    const previous = state;
    if (action === "badge_in") {
      setState({ status: "badged-in", startedAt: new Date().toISOString() });
    } else {
      setState({ status: "badged-out" });
    }

    try {
      const response = await fetch("/api/board/member-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          badge,
          pin,
          shiftId: member?.availabilityShiftId ?? "1st",
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        assignment?: { assignmentId?: string; actualStartTime?: string | null };
      };
      if (!response.ok) {
        setState(previous);
        setWarning(payload.error ?? "Failed to update timer state.");
        return;
      }

      if (action === "badge_in") {
        setState({
          status: "badged-in",
          startedAt:
            payload.assignment?.actualStartTime ?? new Date().toISOString(),
          assignmentId: payload.assignment?.assignmentId,
        });
      } else {
        setState({ status: "badged-out" });
      }

      setMessage(payload.message ?? "Status updated.");
      await refreshBoardState();
      onStatusChange?.();
    } catch {
      setState(previous);
      setWarning("Failed to update timer state.");
    } finally {
      setBusy(false);
    }
  };

  const insightState: OverviewInsightState = busy
    ? "loading"
    : warning
      ? "warning"
      : message
        ? "success"
        : "idle";

  return (
    <OverviewInsightCard
      title="Time Tracker"
      description="Live assignment tracking with badge in and badge out controls."
      statusLabel={
        state.status === "badged-in"
          ? "Live"
          : state.status === "badged-out"
            ? "Off Shift"
            : "Idle"
      }
      state={insightState}
      className="flex flex-col"
      footer={
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total Elapsed
            </p>
            <p className="font-mono text-base font-semibold">
              {totalElapsed || elapsed}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Badges
            </p>
            {activeProjectBadges.length > 0 ? (
              <div className="mt-1 flex items-center gap-2">
                <AvatarGroup size={30} max={6}>
                  {activeProjectBadges.map((activeBadge) => (
                    <Avatar
                      key={activeBadge.badge}
                      title={`${activeBadge.name} (${activeBadge.badge})`}
                    >
                      <AvatarFallback className="text-[10px] font-semibold">
                        {toInitials(activeBadge.name || activeBadge.badge)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
                <span className="text-xs text-muted-foreground">
                  {activeProjectBadges.length}
                </span>
              </div>
            ) : (
              <p className="text-sm font-semibold">-</p>
            )}
          </div>
          <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Assignments
            </p>
            <p className="truncate text-sm font-semibold">
              {assignmentCount > 0 ? `${assignmentCount} active` : "Unassigned"}
            </p>
          </div>
          <div className="mt-2 flex items-center min-w-max gap-2 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            {warning ??
              message ??
              "Enter badge credentials to update board timer state."}
          </div>
        </div>
      }
    >
      <div className="flex max-h-max  flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={badge}
            onChange={(event) => setBadge(event.target.value)}
            placeholder="Badge"
            className="h-9"
          />
          <Input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            type="password"
            placeholder="PIN"
            className="h-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            className="h-9 flex-1"
            disabled={busy || !badge || !pin}
            onClick={() => callBadgeAction("badge_in")}
          >
            <LogIn className="mr-1 h-4 w-4" /> Badge In
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1"
            disabled={busy || !badge || !pin}
            onClick={() => callBadgeAction("badge_out")}
          >
            <LogOut className="mr-1 h-4 w-4" /> Badge Out
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={refreshing}
            onClick={() => void refreshBoardState()}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>
    </OverviewInsightCard>
  );
}
