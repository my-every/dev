"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { AssignableMember } from "@/components/projects/member-assignment-selector";

interface MemberQuickSelectorProps {
  members: AssignableMember[];
  selected: string[]; // Selected member badge(s)
  onChange: (selected: string[]) => void;
  max?: number;
  requireActiveStatus?: boolean;
  className?: string;
}

type ShiftTab = "all" | "1st" | "2nd";

/**
 * Member Quick Selector
 *
 * A simplified member picker for quick task assignment:
 * - Shift-filtered tabs (All, 1st, 2nd)
 * - Avatar-first grid layout
 * - Search by name or badge
 * - Single or multi-select (controlled by max)
 * - Status indicators (active/offline/meeting/break)
 */
export function MemberQuickSelector({
  members,
  selected,
  onChange,
  max = 1,
  requireActiveStatus = false,
  className,
}: MemberQuickSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeShift, setActiveShift] = useState<ShiftTab>("all");

  // Filter members by active status if required
  const availableMembers = useMemo(
    () =>
      requireActiveStatus
        ? members.filter((m) => m.status === "active")
        : members,
    [members, requireActiveStatus],
  );

  // Get unique shifts from available members
  const shifts = useMemo(() => {
    const shiftSet = new Set(
      availableMembers.map((m) => m.shift).filter(Boolean),
    );
    return Array.from(shiftSet).sort();
  }, [availableMembers]);

  // Filter by shift and search query
  const filteredMembers = useMemo(() => {
    let result = availableMembers;

    // Filter by shift
    if (activeShift !== "all") {
      result = result.filter((m) => m.shift === activeShift);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query) ||
          m.badge.toLowerCase().includes(query) ||
          m.firstName.toLowerCase().includes(query),
      );
    }

    return result;
  }, [availableMembers, activeShift, searchQuery]);

  const handleSelectMember = useCallback(
    (badge: string) => {
      if (selected.includes(badge)) {
        // Deselect
        onChange(selected.filter((b) => b !== badge));
      } else {
        // Select
        if (max === 1) {
          onChange([badge]);
        } else {
          onChange([...selected, badge]);
        }
      }
    },
    [selected, onChange, max],
  );

  const handleRemoveSelected = useCallback(
    (badge: string) => {
      onChange(selected.filter((b) => b !== badge));
    },
    [selected, onChange],
  );

  const getStatusColor = (
    status: "active" | "offline" | "meeting" | "break",
  ): string => {
    switch (status) {
      case "active":
        return "bg-emerald-500";
      case "meeting":
        return "bg-blue-500";
      case "break":
        return "bg-amber-500";
      case "offline":
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (
    status: "active" | "offline" | "meeting" | "break",
  ): string => {
    switch (status) {
      case "active":
        return "Active";
      case "meeting":
        return "In Meeting";
      case "break":
        return "On Break";
      case "offline":
        return "Offline";
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or badge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {/* Shift Tabs */}
      {shifts.length > 1 && (
        <Tabs
          value={activeShift}
          onValueChange={(value) => setActiveShift(value as ShiftTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            {shifts.map((shift) => (
              <TabsTrigger key={shift} value={shift}>
                {shift}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Selected Members */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((badge) => {
            const member = availableMembers.find((m) => m.badge === badge);
            if (!member) return null;
            return (
              <Badge
                key={badge}
                variant="secondary"
                className="flex items-center gap-1.5 py-1 pl-1.5 pr-1"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage
                    src={member.avatarPath ?? undefined}
                    alt={member.fullName}
                  />
                  <AvatarFallback className="text-[8px]">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{member.firstName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSelected(badge)}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Member Grid */}
      {filteredMembers.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-xs text-muted-foreground">
            {searchQuery.trim() ? "No members match your search" : "No members available"}
          </p>
        </div>
      ) : (
        <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border/50 bg-background/50 p-3">
          {filteredMembers.map((member) => {
            const isSelected = selected.includes(member.badge);
            const statusColor = getStatusColor(member.status);
            const statusLabel = getStatusLabel(member.status);

            return (
              <button
                key={member.badge}
                type="button"
                onClick={() => handleSelectMember(member.badge)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-all",
                  "hover:bg-accent/50",
                  isSelected &&
                    "bg-primary/10 border-2 border-primary/50 ring-1 ring-primary/20",
                  !isSelected && "border border-transparent",
                )}
                title={`${member.fullName} (${member.badge}) - ${statusLabel}`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={member.avatarPath ?? undefined}
                      alt={member.fullName}
                    />
                    <AvatarFallback className="text-[10px] font-semibold">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                      statusColor,
                    )}
                  />
                </div>
                <div className="min-w-0 text-center">
                  <p className="truncate text-[11px] font-medium text-foreground">
                    {member.firstName}
                  </p>
                  <p className="truncate text-[9px] text-muted-foreground font-mono">
                    {member.badge}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Badge variant="outline" className="text-[8px] py-0">
                    {member.shift}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center">
        {max === 1
          ? "Click to select one member"
          : `Click to select (max ${max})`}
      </p>
    </div>
  );
}
