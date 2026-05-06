"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers3, Users2 } from "lucide-react";

import { DetailSectionCard, type BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getUserResponsibilityLabel, getUserTitleLabel, normalizeUserLabel } from "./users-display";
import type { WorkspaceUserRecord } from "./users-types";

type ShiftMode = "together" | "1st" | "2nd" | "side-by-side";

type UsersTeamsSummaryListData = {
  users: WorkspaceUserRecord[];
  selectedUserBadge?: string | null;
  onSelectUser?: (user: WorkspaceUserRecord) => void;
};

type UsersTeamsSummaryListProps = BaseStatefulProps<UsersTeamsSummaryListData>;

type StageDefinition = {
  id: string;
  label: string;
  skillKey: keyof NonNullable<WorkspaceUserRecord["skills"]>;
};

const MAX_VISIBLE = 10;

const STAGES: StageDefinition[] = [
  { id: "build-up", label: "Build Up", skillKey: "buildUp" },
  { id: "wiring", label: "Wiring", skillKey: "wiring" },
  { id: "box-build", label: "Box Build", skillKey: "boxBuild" },
  { id: "cross-wire", label: "Cross Wire", skillKey: "crossWire" },
  { id: "test", label: "Test", skillKey: "test" },
  { id: "biq", label: "BIQ", skillKey: "biq" },
];

const SHIFT_MODES: Array<{ id: ShiftMode; label: string }> = [
  { id: "together", label: "1st + 2nd" },
  { id: "1st", label: "1st only" },
  { id: "2nd", label: "2nd only" },
  { id: "side-by-side", label: "1st vs 2nd" },
];

export function UsersTeamsSummaryList({
  mode = "default",
  data,
}: UsersTeamsSummaryListProps) {
  const [shiftMode, setShiftMode] = useState<ShiftMode>("together");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const stages = useMemo(() => {
    const users = data?.users ?? [];

    return STAGES.map((stage) => {
      const stageUsers = users
        .filter((user) => {
          const level = Number(user.skills?.[stage.skillKey] ?? 0);
          return level > 0;
        })
        .sort((left, right) => {
          const levelDelta = Number(right.skills?.[stage.skillKey] ?? 0) - Number(left.skills?.[stage.skillKey] ?? 0);
          if (levelDelta !== 0) return levelDelta;
          const shiftDelta = String(left.shift ?? "").localeCompare(String(right.shift ?? ""));
          if (shiftDelta !== 0) return shiftDelta;
          return left.fullName.localeCompare(right.fullName);
        });

      return {
        ...stage,
        users: stageUsers,
        firstShiftUsers: stageUsers.filter((user) => user.shift === "1st"),
        secondShiftUsers: stageUsers.filter((user) => user.shift === "2nd"),
      };
    });
  }, [data?.users]);

  if (mode === "skeleton") {
    return (
      <DetailSectionCard title="Teams" description="Stage-aligned team groupings by shift and competency.">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-28 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-background/70 p-4">
              <Skeleton className="h-5 w-36" />
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((__, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DetailSectionCard>
    );
  }

  return (
    <DetailSectionCard
      title="Teams"
      description="Main stage teams grouped by competency, with responsive shift views for 1st and 2nd shift."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SHIFT_MODES.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={shiftMode === option.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setShiftMode(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {stages.map((stage) => {
            const isOpen = expandedStages[stage.id] ?? true;
            const activeUsers =
              shiftMode === "1st"
                ? stage.firstShiftUsers
                : shiftMode === "2nd"
                  ? stage.secondShiftUsers
                  : stage.users;
            const visibleUsers = isOpen ? activeUsers : activeUsers.slice(0, MAX_VISIBLE);
            const hasMore = activeUsers.length > MAX_VISIBLE;

            return (
              <Collapsible
                key={stage.id}
                open={isOpen}
                onOpenChange={(open) =>
                  setExpandedStages((current) => ({ ...current, [stage.id]: open }))
                }
              >
                <div className="rounded-2xl border border-border bg-background/70">
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Layers3 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-base font-medium text-foreground">{stage.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {stage.users.length}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {stage.firstShiftUsers.length} first shift / {stage.secondShiftUsers.length} second shift
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="space-y-4 border-t border-border px-4 py-4">
                      {shiftMode === "side-by-side" ? (
                        <div className="grid gap-4 xl:grid-cols-2">
                          <StageShiftColumn
                            label="1st Shift"
                            users={stage.firstShiftUsers}
                            selectedUserBadge={data?.selectedUserBadge ?? null}
                            onSelectUser={data?.onSelectUser}
                          />
                          <StageShiftColumn
                            label="2nd Shift"
                            users={stage.secondShiftUsers}
                            selectedUserBadge={data?.selectedUserBadge ?? null}
                            onSelectUser={data?.onSelectUser}
                          />
                        </div>
                      ) : activeUsers.length > 0 ? (
                        <>
                          <div className="grid gap-3 lg:grid-cols-2">
                            {visibleUsers.map((user) => (
                              <TeamUserRow
                                key={`${stage.id}-${user.badge}`}
                                user={user}
                                selected={data?.selectedUserBadge === user.badge}
                                onSelect={() => data?.onSelectUser?.(user)}
                              />
                            ))}
                          </div>
                          {hasMore ? (
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                className="rounded-full"
                                onClick={() =>
                                  setExpandedStages((current) => ({
                                    ...current,
                                    [stage.id]: !isOpen,
                                  }))
                                }
                              >
                                {isOpen ? "Show less" : `Show ${activeUsers.length - MAX_VISIBLE} more`}
                              </Button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                          No users are currently mapped to {stage.label} for this shift view.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </DetailSectionCard>
  );
}

function StageShiftColumn({
  label,
  users,
  selectedUserBadge,
  onSelectUser,
}: {
  label: string;
  users: WorkspaceUserRecord[];
  selectedUserBadge: string | null;
  onSelectUser?: (user: WorkspaceUserRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleUsers = expanded ? users : users.slice(0, MAX_VISIBLE);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{users.length}</div>
      </div>
      {users.length > 0 ? (
        <>
          <div className="space-y-3">
            {visibleUsers.map((user) => (
              <TeamUserRow
                key={`${label}-${user.badge}`}
                user={user}
                selected={selectedUserBadge === user.badge}
                onSelect={() => onSelectUser?.(user)}
              />
            ))}
          </div>
          {users.length > MAX_VISIBLE ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "Show less" : `Show ${users.length - MAX_VISIBLE} more`}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No users available for {label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

function TeamUserRow({
  user,
  selected,
  onSelect,
}: {
  user: WorkspaceUserRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const topSkill = useMemo(() => getTopSkillLabel(user.skills), [user.skills]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-foreground/20 bg-accent/60"
          : "border-border bg-background hover:bg-accent/40",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium text-foreground">{user.preferredName || user.fullName}</div>
        <div className="text-sm text-muted-foreground">
          {user.badge} • {getUserTitleLabel(user)}
        </div>
        <div className="text-xs text-muted-foreground">
          Primary role / responsibility: {getUserResponsibilityLabel(user.role)}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{user.shift ?? "Unknown shift"}</span>
          <span>{topSkill}</span>
        </div>
      </div>
      <Users2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function getTopSkillLabel(skills?: Record<string, number> | null) {
  if (!skills) {
    return "No stage skill";
  }

  const topEntry = Object.entries(skills)
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0];

  if (!topEntry) {
    return "No stage skill";
  }

  return normalizeUserLabel(topEntry[0]);
}
