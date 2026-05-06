"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users, BriefcaseBusiness, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";

import {
    WorkspaceSidePanelHeader,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import type { WorkspaceUserRecord } from "./users-types";
import { getUserResponsibilityLabel } from "./users-display";

type UsersSidePanelNavData = {
    users: WorkspaceUserRecord[];
    selectedUserBadge?: string | null;
    onSelectUser?: (user: WorkspaceUserRecord) => void;
};

type UsersSidePanelNavProps = BaseStatefulProps<UsersSidePanelNavData>;

type ShiftTab = "1st" | "2nd";
type FilterMode = "all" | "role" | "teams";

const SHIFT_TABS: ShiftTab[] = ["1st", "2nd"];
const FILTER_MODES: Array<{ id: FilterMode; label: string; icon: typeof UserRound }> = [
    { id: "all", label: "All", icon: UserRound },
    { id: "role", label: "Roles", icon: BriefcaseBusiness },
    { id: "teams", label: "Teams", icon: Users },
];

export function UsersSidePanelNav({ mode = "default", data, className }: UsersSidePanelNavProps) {
    const [activeShift, setActiveShift] = useState<ShiftTab>("1st");
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [searchValue, setSearchValue] = useState("");

    const users = data?.users ?? [];

    useEffect(() => {
        if (activeShift === "1st" && users.some((user) => normalizeShift(user.shift) === "1st")) {
            return;
        }
        if (activeShift === "2nd" && users.some((user) => normalizeShift(user.shift) === "2nd")) {
            return;
        }

        if (users.some((user) => normalizeShift(user.shift) === "1st")) {
            setActiveShift("1st");
            return;
        }

        if (users.some((user) => normalizeShift(user.shift) === "2nd")) {
            setActiveShift("2nd");
        }
    }, [activeShift, users]);

    const usersForShift = useMemo(() => {
        return users.filter((user) => normalizeShift(user.shift) === activeShift);
    }, [activeShift, users]);

    const filteredUsers = useMemo(() => {
        const query = searchValue.trim().toLowerCase();
        if (!query) {
            return usersForShift;
        }

        return usersForShift.filter((user) => {
            const haystack = [
                user.badge,
                user.fullName,
                user.preferredName,
                user.role,
                user.department,
                user.primaryLwc,
                user.location,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [searchValue, usersForShift]);

    const groupedUsers = useMemo(() => {
        if (filterMode === "all") {
            return [{ id: "all", label: `${activeShift} Shift`, users: filteredUsers }];
        }

        const buckets = new Map<string, WorkspaceUserRecord[]>();
        filteredUsers.forEach((user) => {
            const groupLabel =
                filterMode === "role"
                    ? getUserResponsibilityLabel(user.role || "Unassigned")
                    : normalizeLabel(user.department || user.primaryLwc || user.location || "Unassigned");
            const group = buckets.get(groupLabel) ?? [];
            group.push(user);
            buckets.set(groupLabel, group);
        });

        return Array.from(buckets.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([label, groupUsers]) => ({
                id: label.toLowerCase().replace(/\s+/g, "-"),
                label,
                users: groupUsers.sort((left, right) =>
                    (left.preferredName || left.fullName).localeCompare(right.preferredName || right.fullName),
                ),
            }));
    }, [activeShift, filterMode, filteredUsers]);

    const shiftCounts = useMemo(
        () => ({
            "1st": users.filter((user) => normalizeShift(user.shift) === "1st").length,
            "2nd": users.filter((user) => normalizeShift(user.shift) === "2nd").length,
        }),
        [users],
    );

    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow="Users workspace"
                title="Team Directory"
                subtitle="Filter shifts, search teammates, and group the directory before opening a user preview."
                status={mode === "skeleton" ? "Loading" : `${filteredUsers.length} visible`}
            />

            <div className="border-b border-border px-3 py-3 flex flex-col">
                {mode === "skeleton" ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <Skeleton className="h-9 rounded-xl" />
                            <Skeleton className="h-9 rounded-xl" />
                        </div>
                        <Skeleton className="h-10 rounded-2xl" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-16 rounded-full" />
                            <Skeleton className="h-8 w-16 rounded-full" />
                            <Skeleton className="h-8 w-16 rounded-full" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            {SHIFT_TABS.map((shift) => (
                                <button
                                    key={shift}
                                    type="button"
                                    onClick={() => setActiveShift(shift)}
                                    className={cn(
                                        "rounded-xl border px-3 py-2 text-sm transition-colors",
                                        activeShift === shift
                                            ? "border-primary/60 bg-primary/10 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:bg-accent",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{shift} Shift</span>
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                            {shiftCounts[shift]}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Search badge, name, responsibility, team..."
                                className="h-10 rounded-2xl border-border bg-card pl-9"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {FILTER_MODES.map((filter) => {
                                const Icon = filter.icon;
                                return (
                                    <Button
                                        key={filter.id}
                                        type="button"
                                        variant={filterMode === filter.id ? "default" : "outline"}
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => setFilterMode(filter.id)}
                                    >
                                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                                        {filter.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-4 px-3 py-3">
                    {mode === "skeleton"
                        ? Array.from({ length: 6 }).map((_, index) => (
                              <div key={index} className="rounded-2xl border border-border bg-background/70 p-3">
                                  <div className="flex items-center gap-3">
                                      <Skeleton className="h-10 w-10 rounded-full" />
                                      <div className="min-w-0 flex-1 space-y-2">
                                          <Skeleton className="h-4 w-28" />
                                          <Skeleton className="h-3 w-20" />
                                      </div>
                                  </div>
                              </div>
                          ))
                        : groupedUsers.map((group) => (
                              <div key={group.id} className="space-y-2">
                                  <div className="flex items-center justify-between px-1">
                                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                          {group.label}
                                      </div>
                                      <div className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                          {group.users.length}
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      {group.users.map((user) => (
                                          <button
                                              key={`${group.id}-${user.badge}`}
                                              type="button"
                                              onClick={() => data?.onSelectUser?.(user)}
                                              className={cn(
                                                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                                                  data?.selectedUserBadge === user.badge
                                                      ? "border-primary/60 bg-primary/10"
                                                      : "border-border bg-background/70 hover:bg-accent",
                                              )}
                                          >
                                              <UserAvatar user={user} />
                                              <div className="min-w-0 flex-1">
                                                  <div className="truncate text-sm font-medium text-foreground">
                                                      {user.preferredName || user.fullName}
                                                  </div>
                                                  <div className="truncate border border-muted-20 rounded-md px-2 py-0.5 text-center text-xs max-w-max text-muted-foreground">
                                                      {user.badge} • {getUserResponsibilityLabel(user.role || "Unassigned")}
                                                  </div>
                                              </div>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          ))}

                    {!filteredUsers.length && mode !== "skeleton" ? (
                        <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                            No users matched the current shift and search filter.
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}

function UserAvatar({ user }: { user: WorkspaceUserRecord }) {
    const avatar = getAvatarColor(user.badge);
    return (
        <Avatar className="h-10 w-10">
            <AvatarFallback className={`${avatar.bg} ${avatar.text}`}>
                {getAvatarInitials(user.fullName, user.preferredName)}
            </AvatarFallback>
        </Avatar>
    );
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeShift(value?: string | null): ShiftTab | "unknown" {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized.startsWith("1")) return "1st";
    if (normalized.startsWith("2")) return "2nd";
    return "unknown";
}
