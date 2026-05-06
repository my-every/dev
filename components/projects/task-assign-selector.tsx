"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AssignableMember } from "@/components/projects/member-assignment-selector";
import type { ProjectTaskTeam } from "@/types/project-task-team";

export interface TaskAssignSelectorProps {
  /** All members to render (already filtered by schedule/context logic upstream). */
  members: AssignableMember[];
  /** Available teams — used as a filter. Pass empty array to hide the filter. */
  teams: ProjectTaskTeam[];
  /** Currently selected team id, or empty string for "All teams". */
  selectedTeamId: string;
  /** Currently selected member badge, or empty string for none. */
  selectedBadge: string;
  onTeamChange: (teamId: string) => void;
  onSelectBadge: (badge: string) => void;
}

export function TaskAssignSelector({
  members,
  teams,
  selectedTeamId,
  selectedBadge,
  onTeamChange,
  onSelectBadge,
}: TaskAssignSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedShift, setSelectedShift] = useState("");

  const shifts = useMemo(() => {
    const seen = new Set<string>();
    for (const m of members) {
      if (m.shift) seen.add(m.shift);
    }
    return Array.from(seen).sort();
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (selectedShift && m.shift !== selectedShift) return false;
      if (q && !m.fullName.toLowerCase().includes(q) && !m.badge.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, search, selectedShift]);

  return (
    <div className="grid gap-2">
      {/* Filters row */}
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="h-8 flex-1 text-xs"
        />
        {shifts.length > 0 && (
          <Select
            value={selectedShift || "-"}
            onValueChange={(v) => setSelectedShift(v === "-" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-24 bg-background text-xs">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-" index={0}>All shifts</SelectItem>
              {shifts.map((shift, index) => (
                <SelectItem key={shift} value={shift} index={index + 1}>
                  {shift}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {teams.length > 0 && (
          <Select
            value={selectedTeamId || "-"}
            onValueChange={(value) => onTeamChange(value === "-" ? "" : value)}
          >
            <SelectTrigger className="h-8 w-28 bg-background text-xs">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-" index={0}>All teams</SelectItem>
              {teams.map((team, index) => (
                <SelectItem key={team.id} value={team.id} index={index + 1}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Member rows */}
      <ScrollArea className="h-44 rounded-lg border border-border bg-background">
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              No members found
            </p>
          ) : (
            filtered.map((member) => {
              const isSelected = member.badge === selectedBadge;
              const operation = member.primaryRole ?? member.experiencedStages[0] ?? "";
              return (
                <button
                  key={member.badge}
                  type="button"
                  onClick={() => onSelectBadge(isSelected ? "" : member.badge)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={member.avatarPath ?? undefined} alt={member.fullName} />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase leading-tight tracking-wide">
                      {member.fullName}
                    </p>
                    {operation && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {operation}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
