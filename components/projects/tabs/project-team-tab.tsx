"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, ClipboardList, Loader2, Tag, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyTabState, StatItem } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";

interface TeamMemberRecord {
  badge: string;
  fullName: string;
  preferredName?: string | null;
  role?: string | null;
  shift?: string | null;
  primaryLwc?: string | null;
}

interface TeamResponse {
  members?: TeamMemberRecord[];
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((token) => token[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProjectTeamTab({ project, onNavigateToTab }: ProjectTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const assignmentMeta = useMemo(
    () =>
      Object.values(project.assignments ?? {})
        .map((assignment) => assignment.boardAssignment)
        .filter(Boolean),
    [project.assignments],
  );

  const assignedBadges = useMemo(
    () => Array.from(new Set(assignmentMeta.map((meta) => meta?.assignedBadge).filter((badge): badge is string => Boolean(badge)))),
    [assignmentMeta],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTeam() {
      setLoading(true);
      try {
        const [firstShift, secondShift] = await Promise.all([
          fetch(`/api/users/team?shift=1st`, { cache: "no-store" }),
          fetch(`/api/users/team?shift=2nd`, { cache: "no-store" }),
        ]);

        const payloads = await Promise.all([
          firstShift.ok ? (firstShift.json() as Promise<TeamResponse>) : Promise.resolve({ members: [] }),
          secondShift.ok ? (secondShift.json() as Promise<TeamResponse>) : Promise.resolve({ members: [] }),
        ]);

        const merged = [...(payloads[0].members ?? []), ...(payloads[1].members ?? [])];
        const uniqueByBadge = new Map<string, TeamMemberRecord>();
        for (const member of merged) {
          if (member?.badge) uniqueByBadge.set(member.badge, member);
        }

        if (!cancelled) {
          setTeamMembers(Array.from(uniqueByBadge.values()));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTeam();
    return () => {
      cancelled = true;
    };
  }, []);

  const assignedMembers = useMemo(
    () => assignedBadges.map((badge) => teamMembers.find((member) => member.badge === badge) ?? { badge, fullName: badge }).filter(Boolean),
    [assignedBadges, teamMembers],
  );

  const scheduledCount = assignmentMeta.filter((meta) => meta?.workflowStatus === "scheduled").length;
  const inProgressCount = assignmentMeta.filter((meta) => meta?.workflowStatus === "in-progress").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team...
      </div>
    );
  }

  if (assignedMembers.length === 0) {
    return (
      <EmptyTabState
        icon={Tag}
        title="No Assigned Team Yet"
        description="Team members will appear here once assignments are scheduled or members badge into this project."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <StatItem icon={Users} label="Members" value={String(assignedMembers.length)} />
        <StatItem icon={Briefcase} label="Scheduled" value={String(scheduledCount)} color={project.color} />
        <StatItem icon={Tag} label="In Progress" value={String(inProgressCount)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          Assignment-linked
        </Badge>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          This list reflects the people currently tied to the project through board assignment metadata.
        </p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("assignments")}>
          Open Assignments
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("overview")}>
          Open Overview
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned Team Members</h4>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {assignedBadges.length} badges linked
          </Badge>
        </div>

        <div className="space-y-2">
          {assignedMembers.map((member) => {
            const matchingAssignments = assignmentMeta.filter((meta) => meta?.assignedBadge === member.badge);
            const latestWorkArea = matchingAssignments.find((meta) => meta?.workAreaLabel)?.workAreaLabel ?? null;

            return (
              <div key={member.badge} className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{getInitials(member.preferredName || member.fullName || member.badge)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.preferredName || member.fullName || member.badge}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{member.badge}</span>
                    {member.role ? <span>{member.role}</span> : null}
                    {member.shift ? <span>{member.shift} shift</span> : null}
                    {member.primaryLwc ? <span>{member.primaryLwc}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {matchingAssignments.length} assignment{matchingAssignments.length === 1 ? "" : "s"}
                  </Badge>
                  {latestWorkArea ? <p className="mt-1 text-[10px] text-muted-foreground">{latestWorkArea}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={() => onNavigateToTab?.("assignments")}>
                    <ClipboardList className="h-3 w-3" />
                    Assignments
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={() => onNavigateToTab?.("overview")}>
                    Overview
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
